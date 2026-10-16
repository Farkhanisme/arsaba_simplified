'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  IsiBantuanPintasan,
  IsiDialogKoreksi,
  IsiDialogTolak,
  IsiLightbox,
  KontrolHalaman,
  PanelAksiMassal,
  PanelFilterVerifikasi,
  PanelGalat,
  PanelMemuat,
  PitaAntrean,
  DaftarKartuVerifikasi,
  DaftarKosong,
  hitungBelumCheckout,
  infoHalaman,
  kelompokkan,
  potongHalaman,
  type Baris,
  type FilterVerifikasi,
  type Pilihan,
} from './komponen';

function HalamanVerifikasi() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<Baris[]>([]);
  const [ambang, setAmbang] = useState(5);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pilihan, setPilihan] = useState<Pilihan>({ toko: [], karyawan: [] });
  const [pilih, setPilih] = useState<number[]>([]);
  const [finalInput, setFinalInput] = useState<Record<number, string>>({});
  const [dialogTolak, setDialogTolak] = useState<{ ids: number[] } | null>(null);
  const [alasanTolak, setAlasanTolak] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [koreksi, setKoreksi] = useState<{ id: number; operasi: string; waktu: string; alasan: string } | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [ukuranHalaman, setUkuranHalaman] = useState(20);
  const [indeksAktif, setIndeksAktif] = useState(0);
  const [bantuanTerbuka, setBantuanTerbuka] = useState(false);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const [rDaftar, rPilih] = await Promise.all([
        fetch(`/api/admin/verifikasi?${query}`),
        fetch('/api/admin/verifikasi/pilihan'),
      ]);
      if (!rDaftar.ok) {
        if (await adalahAksesDitolak(rDaftar)) {
          setAksesDitolak(true);
          return;
        }
        const b = await rDaftar.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat data.');
      }
      const badan = await rDaftar.json();
      setDaftar(badan.data as Baris[]);
      setAmbang(badan.ambang as number);
      if (rPilih.ok) setPilihan((await rPilih.json()).data);
      setPilih([]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setMemuat(false);
    }
  }, [query]);

  useEffect(() => {
    muat();
  }, [muat]);

  // Filter berubah (query URL) -> kembali ke halaman pertama. Pilihan
  // checkbox sengaja dipertahankan lintas halaman untuk alur massal.
  useEffect(() => {
    setHalaman(1);
    setIndeksAktif(0);
  }, [query]);

  const daftarHalaman = useMemo(
    () => potongHalaman(daftar, halaman, ukuranHalaman),
    [daftar, halaman, ukuranHalaman],
  );

  // Halaman aktif tidak boleh melewati halaman terakhir (mis. setelah
  // keputusan disimpan dan daftar menyusut).
  const { totalHalaman } = infoHalaman(daftar.length, halaman, ukuranHalaman);
  useEffect(() => {
    if (halaman > totalHalaman) setHalaman(totalHalaman);
    if (indeksAktif >= daftarHalaman.length) setIndeksAktif(0);
  }, [halaman, totalHalaman, indeksAktif, daftarHalaman.length]);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/verifikasi?${p.toString()}`);
  }

  async function kirimKeputusan(id: number, keputusan: 'DISETUJUI' | 'DITOLAK', alasan?: string) {
    const baris = daftar.find((b) => b.id === id);
    const body: Record<string, unknown> = { keputusan };
    if (alasan !== undefined) body['alasan_tolak'] = alasan;
    if (keputusan === 'DISETUJUI' && baris?.jenis === 'CHECKIN') {
      const v = finalInput[id];
      if (v !== undefined && v !== '') body['keterlambatan_final_menit'] = Number(v);
    }
    const res = await fetch(`/api/admin/verifikasi/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan keputusan.');
      return false;
    }
    return true;
  }

  async function setujuiSatuan(id: number): Promise<boolean> {
    if (await kirimKeputusan(id, 'DISETUJUI')) {
      setPesan('Keputusan berhasil disimpan.');
      muat();
      return true;
    }
    return false;
  }

  async function kirimTolakMassal() {
    if (!dialogTolak || alasanTolak.trim() === '') return;
    const res = await fetch('/api/admin/verifikasi/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: dialogTolak.ids, keputusan: 'DITOLAK', alasan_tolak: alasanTolak.trim() }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal memproses massal.');
      return;
    }
    setDialogTolak(null);
    setAlasanTolak('');
    setPesan('Keputusan berhasil disimpan.');
    muat();
  }

  async function setujuiMassal() {
    const finals: Record<string, number> = {};
    for (const id of pilih) {
      const v = finalInput[id];
      if (v !== undefined && v !== '') finals[String(id)] = Number(v);
    }
    const res = await fetch('/api/admin/verifikasi/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pilih, keputusan: 'DISETUJUI', final_menit: finals }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal memproses massal.');
      return;
    }
    setPesan('Keputusan berhasil disimpan.');
    muat();
  }

  async function kirimKoreksi() {
    if (!koreksi || koreksi.alasan.trim() === '' || koreksi.waktu === '') return;
    const waktuISO = `${koreksi.waktu}:00+07:00`;
    const body: Record<string, unknown> = { alasan: koreksi.alasan.trim() };
    if (koreksi.operasi === 'tambah_checkout') {
      body['operasi'] = 'tambah_checkout';
      body['checkin_id'] = koreksi.id;
      body['waktu'] = waktuISO;
    } else if (koreksi.operasi === 'tambah_checkin') {
      const baris = daftar.find((b) => b.id === koreksi.id);
      body['operasi'] = 'tambah_checkin';
      body['karyawan_id'] = baris?.karyawan_id;
      body['waktu'] = waktuISO;
    } else {
      body['operasi'] = 'ubah_waktu';
      body['event_id'] = koreksi.id;
      body['waktu'] = waktuISO;
    }
    const res = await fetch('/api/admin/koreksi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan koreksi.');
      return;
    }
    setKoreksi(null);
    setPesan('Koreksi berhasil disimpan.');
    muat();
  }

  const kelompok = useMemo(() => kelompokkan(daftarHalaman), [daftarHalaman]);

  const menunggu = useMemo(() => daftar.filter((b) => b.status === 'MENUNGGU').length, [daftar]);
  const belumCheckout = useMemo(() => hitungBelumCheckout(daftar), [daftar]);

  // Fokus mengikuti kartu aktif (J/K). `scrollIntoView` memakai perilaku
  // halus kecuali pengguna meminta kurangi gerakan.
  useEffect(() => {
    const baris = daftarHalaman[indeksAktif];
    if (!baris) return;
    const el = document.querySelector<HTMLElement>(`[data-kartu-id="${baris.id}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const kurangiGerakan = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', behavior: kurangiGerakan ? 'auto' : 'smooth' });
  }, [indeksAktif, daftarHalaman]);

  // Pintasan keyboard untuk antrean. Nonaktif di dalam kolom isian dan saat
  // dialog terbuka (kecuali Escape yang ditangani Dialog sendiri), supaya
  // tidak menabrak pengetikan maupun pembaca layar.
  useEffect(() => {
    function saatTombol(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const diIsian =
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      const dialogTerbuka =
        dialogTolak !== null || koreksi !== null || lightbox !== null || bantuanTerbuka;
      if (diIsian || dialogTerbuka) return;
      const baris = daftarHalaman[indeksAktif];
      switch (e.key) {
        case 'j':
        case 'J':
          e.preventDefault();
          setIndeksAktif((i) => Math.min(i + 1, Math.max(0, daftarHalaman.length - 1)));
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          setIndeksAktif((i) => Math.max(i - 1, 0));
          break;
        case 'a':
        case 'A':
          if (baris) {
            e.preventDefault();
            void setujuiSatuan(baris.id);
          }
          break;
        case 't':
        case 'T':
          if (baris) {
            e.preventDefault();
            setDialogTolak({ ids: [baris.id] });
            setAlasanTolak('');
          }
          break;
        case 'c':
        case 'C':
          if (baris) {
            e.preventDefault();
            setKoreksi({ id: baris.id, operasi: 'ubah_waktu', waktu: '', alasan: '' });
          }
          break;
        case '?':
          e.preventDefault();
          setBantuanTerbuka(true);
          break;
      }
    }
    window.addEventListener('keydown', saatTombol);
    return () => window.removeEventListener('keydown', saatTombol);
  }, [daftarHalaman, indeksAktif, dialogTolak, koreksi, lightbox, bantuanTerbuka]);

  const barisLightbox = lightbox !== null ? daftar.find((b) => b.id === lightbox) ?? null : null;
  const indeksLightbox = lightbox !== null ? daftar.findIndex((b) => b.id === lightbox) : -1;

  const filter: FilterVerifikasi = {
    status: params.get('status') ?? 'MENUNGGU',
    toko_id: params.get('toko_id') ?? '',
    dari: params.get('dari') ?? '',
    sampai: params.get('sampai') ?? '',
    karyawan_id: params.get('karyawan_id') ?? '',
    jenis: params.get('jenis') ?? '',
    belum_checkout: (params.get('belum_checkout') ?? '') === '1',
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Verifikasi Absensi</h1>

      {pesan ? (
        <Alert>
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      ) : null}

      <PanelFilterVerifikasi nilai={filter} pilihan={pilihan} onUbah={aturParam} />

      <PitaAntrean
        menunggu={menunggu}
        terpilih={pilih.length}
        belumCheckout={belumCheckout}
        onBantuan={() => setBantuanTerbuka(true)}
      />

      {daftar.length > 0 && !memuat && !galat && !aksesDitolak ? (
        <KontrolHalaman
          halaman={halaman}
          total={daftar.length}
          ukuran={ukuranHalaman}
          onHalaman={(h) => {
            setHalaman(h);
            setIndeksAktif(0);
          }}
          onUkuran={(u) => {
            setUkuranHalaman(u);
            setHalaman(1);
            setIndeksAktif(0);
          }}
        />
      ) : null}

      {pilih.length > 0 ? (
        <PanelAksiMassal
          jumlah={pilih.length}
          onSetujui={setujuiMassal}
          onTolak={() => {
            setDialogTolak({ ids: [...pilih] });
            setAlasanTolak('');
          }}
        />
      ) : null}

      {memuat ? (
        <PanelMemuat />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalat pesan={galat} onCobaLagi={muat} />
      ) : daftar.length === 0 ? (
        <DaftarKosong />
      ) : (
        <DaftarKartuVerifikasi
          kelompok={kelompok}
          terpilih={pilih}
          onPilih={(id, terpilih) =>
            setPilih(terpilih ? [...pilih, id] : pilih.filter((x) => x !== id))
          }
          onLihatFoto={setLightbox}
          finalInput={finalInput}
          onUbahFinal={(id, nilai) => setFinalInput({ ...finalInput, [id]: nilai })}
          onSetujui={setujuiSatuan}
          onTolak={(id) => {
            setDialogTolak({ ids: [id] });
            setAlasanTolak('');
          }}
          onKoreksi={(id) => setKoreksi({ id, operasi: 'ubah_waktu', waktu: '', alasan: '' })}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Ambang terlambat sistem: {ambang} menit (diatur Super Admin di Pengaturan).
      </p>

      <Dialog open={bantuanTerbuka} onOpenChange={(buka) => !buka && setBantuanTerbuka(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Bantuan pintasan keyboard</DialogTitle>
          </DialogHeader>
          <IsiBantuanPintasan onTutup={() => setBantuanTerbuka(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialogTolak !== null} onOpenChange={(buka) => !buka && setDialogTolak(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Tolak absensi</DialogTitle>
          </DialogHeader>
          {dialogTolak ? (
            <IsiDialogTolak
              jumlah={dialogTolak.ids.length}
              alasan={alasanTolak}
              onUbahAlasan={setAlasanTolak}
              onBatal={() => setDialogTolak(null)}
              onKirim={kirimTolakMassal}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={koreksi !== null} onOpenChange={(buka) => !buka && setKoreksi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Koreksi absensi</DialogTitle>
          </DialogHeader>
          {koreksi ? (
            <IsiDialogKoreksi
              id={koreksi.id}
              operasi={koreksi.operasi}
              waktu={koreksi.waktu}
              alasan={koreksi.alasan}
              onUbah={(sebagian) => setKoreksi({ ...koreksi, ...sebagian })}
              onBatal={() => setKoreksi(null)}
              onKirim={kirimKoreksi}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={barisLightbox !== null} onOpenChange={(buka) => !buka && setLightbox(null)}>
        <DialogContent className="sm:max-w-2xl">
          {barisLightbox ? (
            <IsiLightbox
              baris={barisLightbox}
              onSetujui={() => setujuiSatuan(barisLightbox.id).then((ok) => ok && setLightbox(null))}
              onTolak={() => {
                setLightbox(null);
                setDialogTolak({ ids: [barisLightbox.id] });
                setAlasanTolak('');
              }}
              onBerikutnya={() => {
                const berikutnya = daftar[(indeksLightbox + 1) % daftar.length];
                if (berikutnya) setLightbox(berikutnya.id);
              }}
              onTutup={() => setLightbox(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuat />}>
      <HalamanVerifikasi />
    </Suspense>
  );
}