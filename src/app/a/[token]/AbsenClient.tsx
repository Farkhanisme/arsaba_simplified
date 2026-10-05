'use client';

/**
 * Interaksi absen karyawan (K-52, K-53, BR-A2, BR-A3).
 *
 * Alur: pratinjau langsung -> [Foto][Ganti Kamera] -> MODAL hasil foto
 * [Foto Ulang][Absen] -> kirim -> Telegram. Tanpa <input type="file">.
 * Kompresi JPEG otomatis (src/lib/kompres.ts). Lokasi apa pun tidak
 * menghalangi kirim.
 *
 * Ganti kamera memakai TANGGA fallback (BUG-UI-10): deviceId eksak dari
 * enumerateDevices -> facingMode exact -> facingMode polos. String facingMode
 * polos ditolak sebagian browser (Opera Android) tanpa pesan yang jelas, jadi
 * OverconstrainedError dipetakan ke pesan jujur dan tombolnya disembunyikan
 * bila HP cuma punya satu kamera.
 *
 * Perilaku modal (keputusan pemilik):
 *   - Modal terbuka saat foto diambil, menutupi pratinjau. Tombol di
 *     belakangnya mati (Dialog modal + disabled).
 *   - Modal TIDAK bisa ditutup lewat klik-luar/Escape — hanya lewat Foto
 *     Ulang atau hasil kirim. Kalau bisa ditutup sembarangan, foto hilang
 *     tanpa jejak dan karyawan bingung.
 *   - Saat mengirim, modal tetap terbuka (tombol nonaktif + "Mengirim…").
 *   - Sukses: foto dibuang (modal tertutup otomatis) + toast sukses.
 *   - Gagal: foto dibuang (modal tertutup) + toast galat di halaman utama.
 *     Karyawan harus foto ulang dari awal — tidak ada kirim ulang.
 *   - Setiap foto selalu dapat request_id BARU (BR-A11 tidak lagi dipakai
 *     untuk percobaan ulang, karena foto yang gagal ikut dibuang).
 *
 * Pesan sukses/galat memakai toast sonner, khusus halaman ini (Toaster
 * dipasang di sini, bukan di layout root).
 *
 * Komponen shadcn dipakai sejak 2026-10-03 (sebelumnya inline style dengan
 * warna literal, BUG-UI-07).
 *
 * CATATAN SENTUH: `Button` shadcn hanya sampai `lg` = h-9 = 36px, sedangkan
 * rules/05 baris 23 mewajibkan target sentuh minimum 44x44 px. Karena itu
 * `KELAS_SENTUH` menambah tinggi ke 48px lewat className, bukan memakai size
 * bawaan. Jangan dikecilkan tanpa membaca rules/05 §3.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CameraIcon, CheckIcon, RefreshCwIcon, RotateCcwIcon, SwitchCameraIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import type { InfoAbsen } from '../../../server/absen-info';
import { kompresBlobBrowser } from '../../../lib/kompres';

type StatusLokasi = { keadaan: 'TERSEDIA'; lat: number; lng: number } | { keadaan: 'DITOLAK' | 'GAGAL' | 'BELUM' };

/** rules/05: target sentuh minimum 44x44 px. 48px memberi ruang aman. */
const KELAS_SENTUH = 'h-12 text-base';

/** Bentuk minimal perangkat untuk memilih kamera — MediaDeviceInfo cocok langsung. */
export interface PerangkatKamera {
  kind: string;
  label: string;
  deviceId: string;
}

/**
 * Memilih kamera belakang dari daftar perangkat.
 *
 * Fungsi murni agar bisa diuji tanpa browser: diberi daftar label, harus
 * mengembalikan deviceId yang tepat atau null.
 *
 * Kenapa perlu: `facingMode: 'environment'` dalam bentuk string polos artinya
 * "kalau bisa" — browser boleh mengabaikannya (tetap kamera depan) atau
 * malah melempar error seperti di Opera Android (BUG-UI-10). Meminta lewat
 * `deviceId: { exact }` adalah permintaan eksak ke perangkat yang nyata ada.
 */
export function pilihKameraBelakang(daftar: PerangkatKamera[]): string | null {
  const video = daftar.filter((d) => d.kind === 'videoinput' && d.deviceId);
  const belakang = video.find(
    (d) => /back|rear|belakang|trasera|arri[eè]re/i.test(d.label) && !/front/i.test(d.label),
  );
  return belakang?.deviceId ?? null;
}

export default function AbsenClient({ infoAwal }: { infoAwal: InfoAbsen }) {
  // Token dibaca dari URL di browser (pemilik link sudah memilikinya lewat
  // URL) — tidak dikirim lewat props agar tak terserialisasi ke HTML.
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [info, setInfo] = useState<InfoAbsen>(infoAwal);
  const [kamera, setKamera] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [galatKamera, setGalatKamera] = useState<string | null>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState<StatusLokasi>({ keadaan: 'BELUM' });
  const [mengirim, setMengirim] = useState(false);
  // null = belum tahu (tampilkan tombol seperti dulu); false = satu kamera.
  const [bisaGanti, setBisaGanti] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Cerminan stream untuk dibaca di dalam mulaiKamera (callback tanpa deps).
  const streamRef = useRef<MediaStream | null>(null);

  // Modal terbuka tepat saat ada foto yang menunggu keputusan.
  const modalTerbuka = foto !== null && pratinjau !== null;

  /** Menyampaikan galat kamera: toast bila pratinjau masih hidup, panel bila tidak. */
  function sampaikanGalat(pesan: string) {
    if (streamRef.current) {
      // Gagal GANTI kamera saat pratinjau depan masih tampil: jangan ganti
      // video dengan teks error — cukup toast, kamera depan tetap jalan.
      toast.error(pesan);
    } else {
      setGalatKamera(pesan);
    }
  }

  /**
   * Membuka stream untuk mode yang diminta.
   *
   * Kamera depan ('user') langsung diminta seperti dulu — itu yang terbukti
   * jalan. Kamera belakang ('environment') menuruni TANGGA fallback, dari yang
   * paling eksak ke yang paling longgar:
   *   1. deviceId eksak dari enumerateDevices (perangkat yang nyata ada),
   *   2. facingMode { exact: 'environment' },
   *   3. facingMode 'environment' polos (perilaku lama, baris terakhir).
   *
   * Melempar DOMException asal bila semuanya gagal; pemanggil memetakannya ke
   * pesan yang jujur (bukan "Coba lagi" untuk semua jenis gagal).
   */
  async function bukaStream(mode: 'user' | 'environment'): Promise<MediaStream> {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      throw new DOMException('Kamera tidak ada', 'NotFoundError');
    }
    if (mode === 'user') {
      return media.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    }
    try {
      const daftar = await media.enumerateDevices();
      const id = pilihKameraBelakang(
        daftar.map((d) => ({ kind: d.kind, label: d.label, deviceId: d.deviceId })),
      );
      if (id) {
        return await media.getUserMedia({ video: { deviceId: { exact: id } }, audio: false });
      }
    } catch {
      // Lanjut ke tingkat berikutnya — enumerateDevices bisa gagal di
      // browser yang membatasi akses daftar perangkat.
    }
    try {
      return await media.getUserMedia({ video: { facingMode: { exact: 'environment' } }, audio: false });
    } catch {
      // Baris terakhir: perilaku lama. Bisa tetap tidak menghormati di
      // sebagian browser, tapi tidak melempar OverconstrainedError.
      return await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    }
  }

  /** Hentikan stream & tunggu track benar-benar ended (hindari NotReadableError saat ganti cepat). */
  const hentikanStream = useCallback((stream: MediaStream | null): Promise<void> => {
    if (!stream) return Promise.resolve();
    const tracks = stream.getTracks();
    if (tracks.length === 0) return Promise.resolve();
    tracks.forEach((t) => t.stop());
    return Promise.all(
      tracks.map(
        (t) =>
          new Promise<void>((resolve) => {
            if (t.readyState === 'ended') return resolve();
            t.addEventListener('ended', () => resolve(), { once: true });
            // Fallback timeout: beberapa browser tidak fire 'ended' reliable
            setTimeout(resolve, 200);
          }),
      ),
    ).then(() => {});
  }, []);

  const mulaiKamera = useCallback(async (mode: 'user' | 'environment') => {
    setGalatKamera(null);
    // Race condition fix: hentikan stream lama & TUNGGU hardware terlepas SEBELUM minta stream baru
    await setStream(async (lama) => {
      await hentikanStream(lama);
      return null;
    });
    try {
      const s = await bukaStream(mode);
      setStream(s);
      setKamera(mode);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        sampaikanGalat('Izin kamera diperlukan untuk absen. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.');
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        sampaikanGalat('Kamera tidak ditemukan di perangkat ini.');
      } else if (e instanceof DOMException && e.name === 'OverconstrainedError') {
        // BUG-UI-10: ini yang terjadi di Opera Android — permintaan kamera
        // belakang DITOLAK, bukan diabaikan. Pesan harus menyebut itu supaya
        // laporan berikutnya langsung jelas jenisnya.
        sampaikanGalat(
          mode === 'environment'
            ? 'Kamera belakang tidak dapat dibuka di perangkat ini. Tetap memakai kamera depan untuk absen.'
            : 'Kamera tidak dapat dibuka. Coba lagi.',
        );
      } else if (e instanceof DOMException && e.name === 'NotReadableError') {
        // Kamera ada tapi tidak bisa dibaca (sedang dipakai app lain, atau hardware busy)
        sampaikanGalat('Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.');
      } else {
        // Log error asli ke konsol untuk debug (hanya development)
        if (process.env.NODE_ENV === 'development') {
          console.error('[AbsenClient] Kamera error:', e);
        }
        sampaikanGalat('Kamera tidak dapat dibuka. Coba lagi.');
      }
    }
  }, []);

  // Kamera + lokasi dimulai saat halaman dibuka (rules/05 §3: pratinjau langsung).
  useEffect(() => {
    void mulaiKamera('user');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLokasi({ keadaan: 'TERSEDIA', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLokasi({ keadaan: err.code === err.PERMISSION_DENIED ? 'DITOLAK' : 'GAGAL' }),
        { timeout: 8000 },
      );
    } else {
      setLokasi({ keadaan: 'GAGAL' });
    }
    return () => {
      setStream((lama) => {
        lama?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [mulaiKamera]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  // Cerminan stream untuk sampaikanGalat (callback tanpa deps tidak bisa
  // membaca state langsung).
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Sekali saja setelah stream pertama hidup: hitung kamera yang benar-benar
  // ada. Kalau cuma satu, tombol Ganti Kamera disembunyikan — bukan dibiarkan
  // sebagai tombol yang selalu gagal. Gagal menghitung = tampilkan tombol
  // seperti dulu (jangan mengunci fitur karena telemetri gagal).
  useEffect(() => {
    if (!stream || bisaGanti !== null) return;
    let batal = false;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((daftar) => {
        if (!batal) setBisaGanti(daftar.filter((d) => d.kind === 'videoinput').length > 1);
      })
      .catch(() => {
        if (!batal) setBisaGanti(true);
      });
    return () => {
      batal = true;
    };
  }, [stream, bisaGanti]);

  useEffect(() => {
    return () => {
      if (pratinjau) URL.revokeObjectURL(pratinjau);
    };
  }, [pratinjau]);

  /** Membuang foto dan menutup modal. Dipakai Foto Ulang dan hasil kirim. */
  function buangFoto() {
    setPratinjau((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return null;
    });
    setFoto(null);
    setRequestId(null);
  }

  async function ambilFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error('Kamera belum siap. Tunggu pratinjau tampil.');
      return;
    }
    const kanvas = document.createElement('canvas');
    kanvas.width = video.videoWidth;
    kanvas.height = video.videoHeight;
    kanvas.getContext('2d')?.drawImage(video, 0, 0);
    const mentah: Blob | null = await new Promise((selesai) => kanvas.toBlob((b) => selesai(b), 'image/jpeg', 0.95));
    if (!mentah) {
      toast.error('Foto tidak dapat diproses. Coba lagi.');
      return;
    }
    setFoto(mentah);
    setPratinjau((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return URL.createObjectURL(mentah);
    });
    setRequestId(crypto.randomUUID());
  }

  /**
   * Memuat ulang info absen dari server.
   *
   * Dua state diperbarui sekaligus, karena halaman ini punya DUA sumber data:
   *   1. State lokal komponen ini (kartu kamera: aksi CHECKIN/CHECKOUT) — lewat setInfo.
   *   2. Server Component di page.tsx ("Absen hari ini") — lewat router.refresh().
   *
   * Tanpa router.refresh(), daftar "Absen hari ini" tetap memakai data saat
   * halaman dibuka dan baru muncul setelah reload manual (BUG-UI-09). Refresh
   * tidak me-remount komponen ini — stream kamera dan foto tetap utuh.
   */
  async function muatUlang() {
    try {
      const res = await fetch(`/api/absen/info?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        toast.error('Link tidak berlaku. Hubungi admin.');
        return;
      }
      const badan = await res.json();
      setInfo(badan.data as InfoAbsen);
      buangFoto();
      router.refresh();
    } catch {
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    }
  }

  async function kirim() {
    if (!foto || !requestId) return;
    if (!navigator.onLine) {
      buangFoto();
      toast.error('Tidak ada koneksi internet. Sambungkan lalu foto ulang.');
      return;
    }
    setMengirim(true);
    try {
      // Kompresi otomatis (K-53); karyawan tidak melihat proses ini.
      const hasil = await kompresBlobBrowser(foto);
      if (!hasil) {
        buangFoto();
        toast.error('Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.');
        return;
      }
      const fd = new FormData();
      fd.set('token', token);
      fd.set('jenis', info.aksi === 'CHECKOUT' ? 'CHECKOUT' : 'CHECKIN');
      fd.set('foto', new File([hasil.blob], 'absen.jpg', { type: 'image/jpeg' }));
      if (lokasi.keadaan === 'TERSEDIA') {
        fd.set('lat', String(lokasi.lat));
        fd.set('lng', String(lokasi.lng));
      } else if (lokasi.keadaan === 'DITOLAK' || lokasi.keadaan === 'GAGAL') {
        fd.set('lokasi_status', lokasi.keadaan);
      }
      // Setiap foto selalu dapat request_id baru: foto yang gagal ikut dibuang
      // bersama modalnya, jadi tidak ada percobaan ulang foto yang sama.
      fd.set('request_id', requestId);
      const res = await fetch('/api/absen', { method: 'POST', body: fd });
      const badan = await res.json();
      if (!res.ok) {
        buangFoto();
        toast.error((badan.pesan as string) ?? 'Absen gagal dikirim dan tidak tersimpan. Silakan foto ulang.');
        return;
      }
      buangFoto();
      toast.success(badan.pesan as string);
      await muatUlang();
    } catch {
      buangFoto();
      toast.error('Tidak ada koneksi internet. Sambungkan lalu foto ulang.');
    } finally {
      setMengirim(false);
    }
  }

  if (info.aksi === 'TIDAK_TERSEDIA') {
    return (
      <>
        <Toaster position="top-center" />
        <Card aria-label="Status absen" className="animate-in fade-in slide-in-from-bottom duration-300 motion-reduce:animate-none">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm">{info.alasan}</p>
            <Button className={KELAS_SENTUH} onClick={muatUlang}>
              <RefreshCwIcon />Periksa lagi
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Card aria-label="Ambil absen" className="animate-in fade-in slide-in-from-bottom duration-300 motion-reduce:animate-none">
        <CardContent className="flex flex-col gap-3 py-4">
          {galatKamera ? (
            <Alert variant="destructive">
              <AlertDescription>{galatKamera}</AlertDescription>
            </Alert>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ background: '#000' }}
              className="aspect-[3/4] w-full rounded-lg object-cover"
              aria-label="Pratinjau kamera"
            />
          )}

          {lokasi.keadaan !== 'TERSEDIA' && lokasi.keadaan !== 'BELUM' ? (
            <Alert>
              <AlertDescription>Lokasi tidak aktif. Absen tetap bisa dikirim tanpa lokasi.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-2">
            <Button className={`flex-1 ${KELAS_SENTUH}`} onClick={ambilFoto} disabled={mengirim || !stream || modalTerbuka}>
              <CameraIcon />Foto
            </Button>
            {bisaGanti !== false ? (
              <Button
                variant="outline"
                className={`flex-1 ${KELAS_SENTUH}`}
                onClick={() => mulaiKamera(kamera === 'user' ? 'environment' : 'user')}
                disabled={mengirim || modalTerbuka}
              >
                <SwitchCameraIcon />Ganti Kamera
              </Button>
            ) : null}
          </div>

          {info.aksi === 'CHECKOUT' ? (
            <p className="text-sm text-muted-foreground">Ada check-in terbuka. Ambil foto untuk check-out.</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal hasil foto. Sengaja dikunci: abaikan semua permintaan tutup dari
          klik-luar/Escape — hanya Foto Ulang atau hasil kirim yang menutupnya. */}
      <Dialog open={modalTerbuka} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle className="text-base font-medium">Periksa hasil foto</DialogTitle>
          {pratinjau ? (
            <IsiModalFoto
              src={pratinjau}
              aksi={info.aksi}
              mengirim={mengirim}
              onFotoUlang={buangFoto}
              onKirim={kirim}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Isi modal hasil foto. Dipisah dari Dialog agar bisa diuji tanpa portal:
 * Dialog yang tertutup tidak masuk render statis karena portal. Judul dialog
 * (DialogTitle, butuh konteks Dialog) dipasang pemanggil di DialogContent.
 */
export function IsiModalFoto({
  src,
  aksi,
  mengirim,
  onFotoUlang,
  onKirim,
}: {
  src: string;
  aksi: string;
  mengirim: boolean;
  onFotoUlang: () => void;
  onKirim: () => void;
}) {
  return (
    <>
      <img src={src} alt="Hasil foto absen" className="w-full rounded-lg animate-in fade-in duration-300 motion-reduce:animate-none" />
      <div className="flex gap-2">
        <Button variant="outline" className={`flex-1 ${KELAS_SENTUH}`} onClick={onFotoUlang} disabled={mengirim}>
          <RotateCcwIcon />Foto Ulang
        </Button>
        <Button className={`flex-1 ${KELAS_SENTUH}`} onClick={onKirim} disabled={mengirim}>
          {mengirim ? 'Mengirim…' : aksi === 'CHECKOUT' ? (<><CheckIcon />Absen Check-out</>) : (<><CheckIcon />Absen</>)}
        </Button>
      </div>
    </>
  );
}
