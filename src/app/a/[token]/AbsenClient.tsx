'use client';

/**
 * Interaksi absen karyawan (K-52, K-53, BR-A2, BR-A3).
 *
 * Alur: pratinjau langsung -> [Foto][Ganti Kamera] -> MODAL hasil foto
 * [Foto Ulang][Absen] -> kirim -> Telegram. Tanpa <input type="file">.
 * Kompresi JPEG otomatis (src/lib/kompres.ts). Lokasi apa pun tidak
 * menghalangi kirim.
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
import { useParams } from 'next/navigation';
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

export default function AbsenClient({ infoAwal }: { infoAwal: InfoAbsen }) {
  // Token dibaca dari URL di browser (pemilik link sudah memilikinya lewat
  // URL) — tidak dikirim lewat props agar tak terserialisasi ke HTML.
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [info, setInfo] = useState<InfoAbsen>(infoAwal);
  const [kamera, setKamera] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [galatKamera, setGalatKamera] = useState<string | null>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState<StatusLokasi>({ keadaan: 'BELUM' });
  const [mengirim, setMengirim] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Modal terbuka tepat saat ada foto yang menunggu keputusan.
  const modalTerbuka = foto !== null && pratinjau !== null;

  const mulaiKamera = useCallback(async (mode: 'user' | 'environment') => {
    setGalatKamera(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGalatKamera('Kamera tidak ditemukan di perangkat ini.');
        return;
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      setStream((lama) => {
        lama?.getTracks().forEach((t) => t.stop());
        return s;
      });
      setKamera(mode);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        setGalatKamera('Izin kamera diperlukan untuk absen. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.');
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        setGalatKamera('Kamera tidak ditemukan di perangkat ini.');
      } else {
        setGalatKamera('Kamera tidak dapat dibuka. Coba lagi.');
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
        <Card aria-label="Status absen">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm">{info.alasan}</p>
            <Button className={KELAS_SENTUH} onClick={muatUlang}>
              Periksa lagi
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Card aria-label="Ambil absen">
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
              Foto
            </Button>
            <Button
              variant="outline"
              className={`flex-1 ${KELAS_SENTUH}`}
              onClick={() => mulaiKamera(kamera === 'user' ? 'environment' : 'user')}
              disabled={mengirim || modalTerbuka}
            >
              Ganti Kamera
            </Button>
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
      <img src={src} alt="Hasil foto absen" className="w-full rounded-lg" />
      <div className="flex gap-2">
        <Button variant="outline" className={`flex-1 ${KELAS_SENTUH}`} onClick={onFotoUlang} disabled={mengirim}>
          Foto Ulang
        </Button>
        <Button className={`flex-1 ${KELAS_SENTUH}`} onClick={onKirim} disabled={mengirim}>
          {mengirim ? 'Mengirim…' : aksi === 'CHECKOUT' ? 'Absen Check-out' : 'Absen'}
        </Button>
      </div>
    </>
  );
}
