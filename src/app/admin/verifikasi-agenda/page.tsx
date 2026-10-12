'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  FilterVerifikasiAgenda,
  IsiDialogTolakLaporan,
  PanelGalat,
  PanelMemuat,
  TabelLaporanAgenda,
  type BarisLaporanAgenda,
} from './komponen';

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

      {memuat ? (
        <PanelMemuat />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalat pesan={galat} onCobaLagi={muat} />
      ) : (
        <TabelLaporanAgenda
          daftar={daftar}
          adaFoto={() => ({ sebelum: true, sesudah: true })}
          onSetujui={(id) => void kirimKeputusan(id, 'DISETUJUI')}
          onTolak={(baris) => setTolak({ baris, alasan: '' })}
        />
      )}

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