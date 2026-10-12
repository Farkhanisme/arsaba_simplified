'use client';

/**
 * Tab Agenda untuk halaman karyawan (M12), rules/02 §18.3.
 *
 * Berdiri sendiri dari `AbsenClient.tsx` dan sengaja tidak menyalin logika
 * kamera dari sana: yang dipakai ulang adalah komponen `PemotretFoto` di bawah,
 * yang membungkus kamera + kompresi + modal dengan perilaku identik (K-52, K-53).
 * Duplikasi alur kamera adalah cara tercepat membuat absen dan agenda punya
 * dua perilaku berbeda setelah tiga bulan.
 *
 * Alur per agenda (K-59, BR-G7):
 *   1. Agenda wajib foto, belum mulai -> tombol "Ambil Foto Before".
 *   2. Draft tersimpan -> tombol "Ambil Foto After", lalu "Kirim Laporan".
 *   3. Agenda tanpa wajib foto -> keterangan opsional, langsung kirim.
 *   4. Ditolak -> tombol "Coba Lagi" (percobaan baru, BR-G11).
 *
 * Draft tidak pernah terlihat admin (BR-G9) — jadi di layar karyawan labelnya
 * "Draft", bukan "Menunggu verifikasi", supaya tidak memberi kesan sudah dikirim.
 *
 * CATATAN SENTUH: tinggi tombol 48px (rules/05 §3), bukan 36px default shadcn.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CameraIcon, CheckIcon, RefreshCwIcon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { kompresBlobBrowser } from '../../../lib/kompres';
import { pilihKameraBelakang, type PerangkatKamera } from './AbsenClient';
import { labelTahap, type AksiLaporan } from '../../../server/aturan/laporan';
import type { InfoAgenda } from '../../../server/agenda-info';

const KELAS_SENTUH = 'h-12 text-base';

type Tahap = 'SEBELUM' | 'SESUDAH';

interface KerangkaFoto {
  foto: Blob | null;
  pratinjau: string | null;
  requestId: string | null;
}

/** Ekstrak logika kamera yang dipakai bersama absen dan agenda, dengan callback props. */
export function usePemotret({ aktif }: { aktif: boolean }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [galatKamera, setGalatKamera] = useState<string | null>(null);
  const [bisaGanti, setBisaGanti] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const hentikanStream = useCallback(async (s: MediaStream | null) => {
    if (!s) return;
    s.getTracks().forEach((t) => t.stop());
  }, []);

  const mulaiKamera = useCallback(
    async (mode: 'user' | 'environment') => {
      setGalatKamera(null);
      await hentikanStream(streamRef.current);
      setStream(null);
      try {
        const media = navigator.mediaDevices;
        if (!media?.getUserMedia) throw new DOMException('Kamera tidak ada', 'NotFoundError');
        let gotten: MediaStream;
        if (mode === 'user') {
          gotten = await media.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        } else {
          // Tangga fallback sama seperti AbsenClient (BUG-UI-10).
          gotten = null as unknown as MediaStream;
          try {
            const daftar = await media.enumerateDevices();
            const id = pilihKameraBelakang(
              daftar.map((d) => ({ kind: d.kind, label: d.label, deviceId: d.deviceId })) as PerangkatKamera[],
            );
            if (id) gotten = await media.getUserMedia({ video: { deviceId: { exact: id } }, audio: false });
          } catch {
            gotten = null as unknown as MediaStream;
          }
          if (!gotten) {
            gotten = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          }
        }
        setStream(gotten);
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
          setGalatKamera('Izin kamera diperlukan. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.');
        } else if (e instanceof DOMException && e.name === 'NotFoundError') {
          setGalatKamera('Kamera tidak ditemukan di perangkat ini.');
        } else {
          setGalatKamera('Kamera tidak dapat dibuka. Coba lagi.');
        }
      }
    },
    [hentikanStream],
  );

  useEffect(() => {
    if (!aktif) return;
    void mulaiKamera('user');
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [aktif, mulaiKamera]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

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

  async function ambilFoto(): Promise<{ blob: Blob; requestId: string } | null> {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error('Kamera belum siap. Tunggu pratinjau tampil.');
      return null;
    }
    const kanvas = document.createElement('canvas');
    kanvas.width = video.videoWidth;
    kanvas.height = video.videoHeight;
    kanvas.getContext('2d')?.drawImage(video, 0, 0);
    const mentah: Blob | null = await new Promise((selesai) => kanvas.toBlob((b) => selesai(b), 'image/jpeg', 0.95));
    if (!mentah) {
      toast.error('Foto tidak dapat diproses. Coba lagi.');
      return null;
    }
    return { blob: mentah, requestId: crypto.randomUUID() };
  }

  return { videoRef, stream, galatKamera, bisaGanti, mulaiKamera, ambilFoto };
}

/** Isi modal hasil foto — diekstrak agar bisa diuji tanpa portal Dialog. */
export function IsiModalAgendaFoto({
  pratinjau,
  label,
  mengirim,
  onFotoUlang,
  onSimpan,
  teksSimpan,
}: {
  pratinjau: string;
  label: string;
  mengirim: boolean;
  onFotoUlang: () => void;
  onSimpan: () => void;
  teksSimpan: string;
}) {
  return (
    <>
      <img src={pratinjau} alt={label} className="w-full rounded-lg" />
      <div className="flex gap-2">
        <Button variant="outline" className={`flex-1 ${KELAS_SENTUH}`} onClick={onFotoUlang} disabled={mengirim}>
          <RotateCcwIcon />Foto Ulang
        </Button>
        <Button className={`flex-1 ${KELAS_SENTUH}`} onClick={onSimpan} disabled={mengirim}>
          {mengirim ? 'Menyimpan…' : <><CheckIcon />{teksSimpan}</>}
        </Button>
      </div>
    </>
  );
}

export default function AgendaClient({ infoAwal }: { infoAwal: InfoAgenda }) {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [info, setInfo] = useState<InfoAgenda>(infoAwal);
  const [memuat, setMemuat] = useState(false);
  const [kerangka, setKerangka] = useState<KerangkaFoto>({ foto: null, pratinjau: null, requestId: null });
  const [tahap, setTahap] = useState<Tahap>('SEBELUM');
  const [keterangan, setKeterangan] = useState('');
  const [mengirim, setMengirim] = useState(false);
  // Agenda yang sedang difoto. Null = tidak ada yang dikerjakan.
  const [aktifId, setAktifId] = useState<number | null>(null);
  const [buatDibuka, setBuatDibuka] = useState(false);
  const [judulBaru, setJudulBaru] = useState('');
  const [keteranganBaru, setKeteranganBaru] = useState('');

  const { videoRef, stream, galatKamera, bisaGanti, mulaiKamera, ambilFoto } = usePemotret({
    aktif: aktifId !== null || buatDibuka,
  });

  const modalTerbuka = kerangka.foto !== null && kerangka.pratinjau !== null;

  async function muatUlang() {
    try {
      const res = await fetch(`/api/agenda/info?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        toast.error('Link tidak berlaku. Hubungi admin.');
        return;
      }
      setInfo((await res.json()).data as InfoAgenda);
      router.refresh();
    } catch {
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    }
  }

  useEffect(() => {
    setInfo(infoAwal);
  }, [infoAwal]);

  useEffect(() => {
    return () => {
      if (kerangka.pratinjau) URL.revokeObjectURL(kerangka.pratinjau);
    };
  }, [kerangka.pratinjau]);

  function buangFoto() {
    setKerangka((lama) => {
      if (lama.pratinjau) URL.revokeObjectURL(lama.pratinjau);
      return { foto: null, pratinjau: null, requestId: null };
    });
    setAktifId(null);
  }

  async function bukaKerja(agendaId: number, tahapBaru: Tahap) {
    setTahap(tahapBaru);
    setAktifId(agendaId);
    if (tahapBaru === 'SESUDAH') {
      const laporan = info.daftar.find((a) => a.id === agendaId)?.laporan;
      setKeterangan(laporan?.keterangan ?? '');
    } else {
      setKeterangan('');
    }
  }

  async function tekanFoto(agendaId: number, tahapFoto: Tahap) {
    const hasil = await ambilFoto();
    if (!hasil) return;
    setKerangka({
      foto: hasil.blob,
      pratinjau: URL.createObjectURL(hasil.blob),
      requestId: hasil.requestId,
    });
    setTahap(tahapFoto);
    setAktifId(agendaId);
  }

  /** Kirim foto (tahap) atau keterangan saja (agenda tanpa foto). */
  async function simpan() {
    if (aktifId === null) return;
    if (!navigator.onLine) {
      buangFoto();
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
      return;
    }
    setMengirim(true);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('tahap', tahap === 'SEBELUM' ? 'DRAFT' : 'MENUNGGU');
      fd.set('agenda_id', String(aktifId));
      fd.set('request_id', kerangka.requestId ?? crypto.randomUUID());
      if (keterangan.trim()) fd.set('keterangan', keterangan.trim());
      // Agenda tanpa foto wajib (BR-G8) tidak mengirim apa pun.
      if (kerangka.foto) {
        const hasil = await kompresBlobBrowser(kerangka.foto);
        if (!hasil) {
          buangFoto();
          toast.error('Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.');
          return;
        }
        fd.set('foto', new File([hasil.blob], 'agenda.jpg', { type: 'image/jpeg' }));
      }
      const res = await fetch('/api/agenda/laporan', { method: 'POST', body: fd });
      const badan = await res.json();
      if (!res.ok) {
        buangFoto();
        toast.error((badan.pesan as string) ?? 'Laporan gagal disimpan.');
        return;
      }
      buangFoto();
      toast.success(badan.pesan as string);
      await muatUlang();
    } catch {
      buangFoto();
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    } finally {
      setMengirim(false);
    }
  }

  /** Agenda tanpa wajib foto: kirim langsung tanpa kamera. */
  async function kirimTanpaFoto(agendaId: number) {
    if (!navigator.onLine) {
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
      return;
    }
    setAktifId(agendaId);
    setTahap('SESUDAH');
    setKeterangan((l) => l);
    setMengirim(true);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('tahap', 'MENUNGGU');
      fd.set('agenda_id', String(agendaId));
      fd.set('request_id', crypto.randomUUID());
      const laporan = info.daftar.find((a) => a.id === agendaId);
      if (laporan?.laporan?.keterangan) fd.set('keterangan', laporan.laporan.keterangan);
      const res = await fetch('/api/agenda/laporan', { method: 'POST', body: fd });
      const badan = await res.json();
      if (!res.ok) {
        toast.error((badan.pesan as string) ?? 'Laporan gagal disimpan.');
        return;
      }
      toast.success(badan.pesan as string);
      await muatUlang();
    } catch {
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    } finally {
      setMengirim(false);
      setAktifId(null);
    }
  }

  async function buatAgendaPribadi() {
    if (!judulBaru.trim()) {
      toast.error('Judul agenda wajib diisi.');
      return;
    }
    setMengirim(true);
    try {
      const res = await fetch('/api/agenda/buat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, judul: judulBaru.trim(), keterangan: keteranganBaru.trim() || undefined }),
      });
      const badan = await res.json();
      if (!res.ok) {
        toast.error((badan.pesan as string) ?? 'Agenda gagal disimpan.');
        return;
      }
      setBuatDibuka(false);
      setJudulBaru('');
      setKeteranganBaru('');
      toast.success(badan.pesan as string);
      await muatUlang();
    } catch {
      toast.error('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    } finally {
      setMengirim(false);
    }
  }

  const adaYangBisaDikerjakan = info.daftar.some((a) => a.aksi !== 'TUNDAK_BISA');

  return (
    <>
      <Toaster position="top-center" />
      <section aria-label="Agenda" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">Agenda</h2>
          <Button variant="outline" size="sm" onClick={() => setBuatDibuka((b) => !b)}>
            Buat Agenda
          </Button>
        </div>

        {buatDibuka ? (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ag-judul-baru" className="text-base">Judul agenda</Label>
                <Input
                  id="ag-judul-baru"
                  value={judulBaru}
                  maxLength={120}
                  onChange={(e) => setJudulBaru(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ag-keterangan-baru" className="text-base">Keterangan (opsional)</Label>
                <Textarea
                  id="ag-keterangan-baru"
                  value={keteranganBaru}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => setKeteranganBaru(e.target.value)}
                />
              </div>
              <Alert>
                <AlertDescription>
                  Agenda yang kamu buat sendiri wajib foto before dan after, seperti agenda dari admin.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button className={KELAS_SENTUH} onClick={buatAgendaPribadi} disabled={mengirim}>
                  {mengirim ? 'Menyimpan…' : 'Simpan Agenda'}
                </Button>
                <Button variant="outline" className={KELAS_SENTUH} onClick={() => setBuatDibuka(false)}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {memuat ? null : info.daftar.length === 0 ? (
          <p className="text-base text-muted-foreground">Belum ada agenda untukmu.</p>
        ) : (
          info.daftar.map((a) => (
            <KartuAgenda
              key={a.id}
              judul={a.judul}
              keterangan={a.keterangan}
              wajibFoto={a.wajib_foto}
              dibuatSendiri={a.dibuat_sendiri}
              aksi={a.aksi}
              statusLaporan={a.laporan?.status ?? null}
              alasanTolak={a.laporan?.alasan_tolak ?? null}
              percobaan={a.laporan?.percobaan ?? null}
              onMulai={() => {
                setMengirim(false);
                if (!a.wajib_foto) {
                  void kirimTanpaFoto(a.id);
                  return;
                }
                void tekanFoto(a.id, a.aksi === 'SUBMIT' ? 'SESUDAH' : 'SEBELUM');
              }}
              onLanjut={() => void tekanFoto(a.id, 'SESUDAH')}
              onBuatDraft={a.wajib_foto ? () => void tekanFoto(a.id, 'SEBELUM') : undefined}
            />
          ))
        )}

        {adaYangBisaDikerjakan ? null : (
          <p className="text-base text-muted-foreground">Semua agenda sudah selesai atau menunggu verifikasi.</p>
        )}

        {aktifId !== null && tahap === 'SESUDAH' && !modalTerbuka ? (
          <KeteranganLaporan
            keterangan={keterangan}
            onUbah={setKeterangan}
            mengirim={mengirim}
            wajibFoto={info.daftar.find((a) => a.id === aktifId)?.wajib_foto ?? true}
            onKirim={simpan}
            onFotoAfter={() => void tekanFoto(aktifId, 'SESUDAH')}
            onBatal={buangFoto}
          />
        ) : null}
      </section>

      <Dialog open={modalTerbuka} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle className="text-base font-medium">
            {tahap === 'SEBELUM' ? 'Periksa foto before' : 'Periksa foto after'}
          </DialogTitle>
          {kerangka.pratinjau ? (
            <IsiModalAgendaFoto
              pratinjau={kerangka.pratinjau}
              label={tahap === 'SEBELUM' ? 'Hasil foto before agenda' : 'Hasil foto after agenda'}
              mengirim={mengirim}
              onFotoUlang={buangFoto}
              onSimpan={simpan}
              teksSimpan={tahap === 'SEBELUM' ? 'Simpan Draft' : 'Kirim Laporan'}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Panel keterangan + tombol kirim, untuk agenda yang sudah punya foto before. */
export function KeteranganLaporan({
  keterangan,
  wajibFoto,
  mengirim,
  onUbah,
  onKirim,
  onFotoAfter,
  onBatal,
}: {
  keterangan: string;
  wajibFoto: boolean;
  mengirim: boolean;
  onUbah: (v: string) => void;
  onKirim: () => void;
  onFotoAfter?: () => void;
  onBatal: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-keterangan" className="text-base">Keterangan (opsional)</Label>
          <Textarea id="ag-keterangan" value={keterangan} maxLength={500} rows={2} onChange={(e) => onUbah(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {wajibFoto && onFotoAfter ? (
            <Button variant="outline" className={KELAS_SENTUH} onClick={onFotoAfter} disabled={mengirim}>
              <CameraIcon />Ambil Foto After
            </Button>
          ) : null}
          <Button className={KELAS_SENTUH} onClick={onKirim} disabled={mengirim}>
            <SendIcon />{mengirim ? 'Mengirim…' : 'Kirim Laporan'}
          </Button>
          <Button variant="outline" className={KELAS_SENTUH} onClick={onBatal} disabled={mengirim}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Satu kartu agenda + tombol aksi yang tepat (aksiDariAturan, bukan tebakan). */
export function KartuAgenda({
  judul,
  keterangan,
  wajibFoto,
  dibuatSendiri,
  aksi,
  statusLaporan,
  alasanTolak,
  percobaan,
  onMulai,
  onLanjut,
  onBuatDraft,
}: {
  judul: string;
  keterangan: string | null;
  wajibFoto: boolean;
  dibuatSendiri: boolean;
  aksi: AksiLaporan;
  statusLaporan: string | null;
  alasanTolak: string | null;
  percobaan: number | null;
  onMulai: () => void;
  onLanjut?: () => void;
  onBuatDraft?: () => void;
}) {
  return (
    <Card aria-label={`Agenda ${judul}`}>
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium">{judul}</span>
          {statusLaporan ? <Badge variant="secondary">{labelTahap(statusLaporan)}</Badge> : null}
          {dibuatSendiri ? <Badge variant="outline">Milik saya</Badge> : null}
        </div>
        {keterangan ? <p className="text-base text-muted-foreground">{keterangan}</p> : null}
        {wajibFoto ? (
          <p className="text-base text-muted-foreground">Wajib foto before dan after.</p>
        ) : (
          <p className="text-base text-muted-foreground">Tidak wajib foto. Keterangan opsional saja.</p>
        )}
        {alasanTolak ? <p className="text-base text-destructive">Ditolak: {alasanTolak}</p> : null}
        {percobaan && percobaan > 1 ? (
          <p className="text-sm text-muted-foreground">Percobaan ke-{percobaan}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {aksi === 'SIMPAN_DRAFT' ? (
            <Button size="sm" className={KELAS_SENTUH} onClick={wajibFoto && onBuatDraft ? onBuatDraft : onMulai}>
              <CameraIcon />Mulai
            </Button>
          ) : null}
          {aksi === 'SUBMIT' && onLanjut ? (
            <Button size="sm" className={KELAS_SENTUH} onClick={onLanjut}>
              <CameraIcon />Ambil Foto After
            </Button>
          ) : null}
          {aksi === 'ULANG' ? (
            <Button size="sm" variant="outline" className={KELAS_SENTUH} onClick={onMulai}>
              <RefreshCwIcon />Coba Lagi
            </Button>
          ) : null}
          {aksi === 'TUNDAK_BISA' ? (
            <span className="text-base text-muted-foreground">
              {statusLaporan === 'MENUNGGU'
                ? 'Menunggu verifikasi admin.'
                : statusLaporan === 'DISETUJUI'
                  ? 'Selesai.'
                  : 'Agenda ini sudah dibatalkan.'}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
