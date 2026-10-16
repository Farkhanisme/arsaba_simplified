'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  DaftarKartuLaporan,
  FilterVerifikasiAgenda,
  IsiBantuanPintasanAgenda,
  IsiDialogTolakLaporan,
  IsiLightboxBanding,
  KontrolHalaman,
  PanelGalat,
  PanelMemuat,
  PitaAntreanAgenda,
  type BarisLaporanAgenda,
} from './komponen';
import { infoHalaman, potongHalaman } from '../verifikasi/komponen';

/**
 * Halaman Verifikasi Agenda (M13). Terpisah dari verifikasi absensi (BR-G10).
 *
 * Foto tidak dimuat di halaman ini; hanya tautan ke proxy server yang ditampilkan,
 * dan proxy itu menolak untuk draft (BR-G9).
 */
function HalamanVerifikasiAgenda() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<BarisLaporanAgenda[]>([]);
  const [pilihanToko, setPilihanToko] = useState<{ id: number; nama: string }[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tolak, setTolak] = useState<{ baris: BarisLaporanAgenda; alasan: string } | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [ukuranHalaman, setUkuranHalaman] = useState(20);
  const [indeksAktif, setIndeksAktif] = useState(0);
  const [bantuanTerbuka, setBantuanTerbuka] = useState(false);
  const [lightboxId, setLightboxId] = useState<number | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const [rDaftar, rToko] = await Promise.all([
        fetch(`/api/admin/verifikasi-agenda?${query}`),
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
      setDaftar((await rDaftar.json()).data as BarisLaporanAgenda[]);
      if (rToko.ok) setPilihanToko((await rToko.json()).data.toko);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setMemuat(false);
    }
  }, [query]);

  useEffect(() => {
    muat();
  }, [muat]);

  // Filter berubah (query URL) -> kembali ke halaman pertama.
  useEffect(() => {
    setHalaman(1);
    setIndeksAktif(0);
  }, [query]);

  const daftarHalaman = useMemo(
    () => potongHalaman(daftar, halaman, ukuranHalaman),
    [daftar, halaman, ukuranHalaman],
  );

  const { totalHalaman } = infoHalaman(daftar.length, halaman, ukuranHalaman);
  useEffect(() => {
    if (halaman > totalHalaman) setHalaman(totalHalaman);
    if (indeksAktif >= daftarHalaman.length) setIndeksAktif(0);
  }, [halaman, totalHalaman, indeksAktif, daftarHalaman.length]);

  const menunggu = useMemo(() => daftar.filter((r) => r.status === 'MENUNGGU').length, [daftar]);

  const barisLightbox =
    lightboxId !== null ? (daftarHalaman.find((r) => r.id === lightboxId) ?? null) : null;
  const indeksLightbox =
    lightboxId !== null ? daftarHalaman.findIndex((r) => r.id === lightboxId) : -1;

  async function setujuiLaporan(id: number): Promise<void> {
    await kirimKeputusan(id, 'DISETUJUI');
  }

  function tolakLaporan(baris: BarisLaporanAgenda): void {
    setLightboxId(null);
    setTolak({ baris, alasan: '' });
  }

  // Fokus mengikuti laporan aktif (J/K). Hormati prefers-reduced-motion.
  useEffect(() => {
    const baris = daftarHalaman[indeksAktif];
    if (!baris) return;
    const el = document.querySelector<HTMLElement>(`[data-laporan-id="${baris.id}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const kurangiGerakan = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', behavior: kurangiGerakan ? 'auto' : 'smooth' });
  }, [indeksAktif, daftarHalaman]);

  // Pintasan keyboard. Nonaktif di dalam kolom isian dan saat dialog terbuka
  // (kecuali Escape yang ditangani Dialog sendiri).
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
      const dialogTerbuka = tolak !== null || lightboxId !== null || bantuanTerbuka;
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
            void setujuiLaporan(baris.id);
          }
          break;
        case 't':
        case 'T':
          if (baris) {
            e.preventDefault();
            setTolak({ baris, alasan: '' });
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
  }, [daftarHalaman, indeksAktif, tolak, lightboxId, bantuanTerbuka]);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/verifikasi-agenda?${p.toString()}`);
  }

  async function kirimKeputusan(id: number, keputusan: 'DISETUJUI' | 'DITOLAK', alasan?: string) {
    const res = await fetch(`/api/admin/verifikasi-agenda/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keputusan, alasan_tolak: alasan }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan keputusan.');
      return;
    }
    setTolak(null);
    setPesan(keputusan === 'DISETUJUI' ? 'Laporan disetujui.' : 'Laporan ditolak.');
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Verifikasi Agenda</h1>
      {pesan ? (
        <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      ) : null}

      <FilterVerifikasiAgenda
        status={params.get('status') ?? ''}
        tokoId={params.get('toko_id') ?? ''}
        dari={params.get('dari') ?? ''}
        sampai={params.get('sampai') ?? ''}
        pilihanToko={pilihanToko}
        onUbah={aturParam}
      />

      <PitaAntreanAgenda
        menunggu={menunggu}
        total={daftar.length}
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

      {memuat ? (
        <PanelMemuat />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalat pesan={galat} onCobaLagi={muat} />
      ) : (
        <DaftarKartuLaporan
          daftar={daftarHalaman}
          adaFoto={() => ({ sebelum: true, sesudah: true })}
          onLihatFoto={(id) => setLightboxId(id)}
          onSetujui={(id) => void setujuiLaporan(id)}
          onTolak={tolakLaporan}
        />
      )}

      <Dialog open={bantuanTerbuka} onOpenChange={(buka) => !buka && setBantuanTerbuka(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Bantuan pintasan keyboard</DialogTitle>
          </DialogHeader>
          <IsiBantuanPintasanAgenda onTutup={() => setBantuanTerbuka(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={barisLightbox !== null} onOpenChange={(buka) => !buka && setLightboxId(null)}>
        <DialogContent className="sm:max-w-3xl">
          {barisLightbox ? (
            <IsiLightboxBanding
              r={barisLightbox}
              adaFoto={{ sebelum: true, sesudah: true }}
              onSetujui={() => {
                void setujuiLaporan(barisLightbox.id).then(() => setLightboxId(null));
              }}
              onTolak={() => tolakLaporan(barisLightbox)}
              onBerikutnya={() => {
                const berikutnya = daftarHalaman[(indeksLightbox + 1) % daftarHalaman.length];
                if (berikutnya) setLightboxId(berikutnya.id);
              }}
              onTutup={() => setLightboxId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={tolak !== null} onOpenChange={(buka) => !buka && setTolak(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Tolak laporan agenda</DialogTitle>
          </DialogHeader>
          {tolak ? (
            <IsiDialogTolakLaporan
              namaKaryawan={tolak.baris.karyawan_nama}
              alasan={tolak.alasan}
              onUbahAlasan={(v) => setTolak({ ...tolak, alasan: v })}
              onBatal={() => setTolak(null)}
              onSimpan={() => void kirimKeputusan(tolak.baris.id, 'DITOLAK', tolak.alasan)}
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
      <HalamanVerifikasiAgenda />
    </Suspense>
  );
}