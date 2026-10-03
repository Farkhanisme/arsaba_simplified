'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  FilterRekap,
  PanelGalatRekap,
  PanelMemuatRekap,
  PanelRekap,
  type DataRekap,
} from './komponen';

export { PanelRekap };
export type { DataRekap };

function HalamanRekap() {
  const router = useRouter();
  const params = useSearchParams();
  const [tokoList, setTokoList] = useState<{ id: number; nama: string }[]>([]);
  const [data, setData] = useState<DataRekap | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [mengunduh, setMengunduh] = useState(false);

  useEffect(() => {
    fetch('/api/admin/verifikasi/pilihan')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b) setTokoList(b.data.toko);
      })
      .catch(() => undefined);
  }, []);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/rekap?${p.toString()}`);
  }

  const periksa = useCallback(async () => {
    const dari = params.get('dari') ?? '';
    const sampai = params.get('sampai') ?? '';
    const tokoId = params.get('toko_id') ?? '';
    if (!dari || !sampai) {
      setGalat('Isi rentang tanggal dulu.');
      return;
    }
    setMemuat(true);
    setGalat(null);
    setPesan(null);
    setAksesDitolak(false);
    try {
      const res = await fetch(`/api/admin/rekap?dari=${dari}&sampai=${sampai}${tokoId ? `&toko_id=${tokoId}` : ''}`);
      if (!res.ok) {
        if (await adalahAksesDitolak(res)) {
          setAksesDitolak(true);
          return;
        }
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal membuat rekap.');
      }
      setData(((await res.json()).data as DataRekap));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat rekap.');
    } finally {
      setMemuat(false);
    }
  }, [params]);

  async function unduh() {
    const dari = params.get('dari') ?? '';
    const sampai = params.get('sampai') ?? '';
    const tokoId = params.get('toko_id') ?? '';
    setMengunduh(true);
    try {
      const res = await fetch('/api/admin/rekap/ekspor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dari, sampai, toko_id: tokoId ? Number(tokoId) : null }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Ekspor gagal.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-${dari}-${sampai}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setPesan('File Excel berhasil diunduh.');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Ekspor gagal.');
    } finally {
      setMengunduh(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Rekap &amp; Ekspor</h1>
      {pesan ? (
        <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      ) : null}
      <FilterRekap
        dari={params.get('dari') ?? ''}
        sampai={params.get('sampai') ?? ''}
        tokoId={params.get('toko_id') ?? ''}
        tokoList={tokoList}
        memuat={memuat}
        onUbah={aturParam}
        onPeriksa={periksa}
      />

      {memuat ? (
        <PanelMemuatRekap />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalatRekap pesan={galat} onCobaLagi={periksa} />
      ) : data ? (
        <PanelRekap data={data} mengunduh={mengunduh} onUnduh={unduh} />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuatRekap />}>
      <HalamanRekap />
    </Suspense>
  );
}
