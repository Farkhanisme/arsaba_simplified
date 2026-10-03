'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  FilterAudit,
  IsiDialogDetail,
  NavigasiHalaman,
  PanelGalatAudit,
  PanelMemuatAudit,
  TabelAudit,
  type BarisAudit,
  type NilaiFilterAudit,
  type OpsiFilterAudit,
} from './komponen';

const BATAS = 50;

function HalamanAuditLog() {
  const router = useRouter();
  const params = useSearchParams();
  const [baris, setBaris] = useState<BarisAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [opsi, setOpsi] = useState<OpsiFilterAudit>({ aksi: [], entitas: [], pelaku: [] });
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const query = params.toString();
  const offset = Number(params.get('offset') ?? '0');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const res = await fetch(`/api/admin/audit-log?${query}`);
      if (!res.ok) {
        if (await adalahAksesDitolak(res)) {
          setAksesDitolak(true);
          return;
        }
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat audit log.');
      }
      const badan = await res.json();
      setBaris(badan.data.baris as BarisAudit[]);
      setTotal(badan.data.total as number);
      setOpsi(badan.data.filter as OpsiFilterAudit);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat audit log.');
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
    if (kunci !== 'offset') p.delete('offset');
    router.replace(`/admin/audit-log?${p.toString()}`);
  }

  const nilai: NilaiFilterAudit = {
    dari: params.get('dari') ?? '',
    sampai: params.get('sampai') ?? '',
    pengguna_id: params.get('pengguna_id') ?? '',
    aksi: params.get('aksi') ?? '',
    entitas: params.get('entitas') ?? '',
  };

  const barisDetail = detailId === null ? null : baris.find((b) => b.id === detailId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Audit Log</h1>

      <FilterAudit nilai={nilai} opsi={opsi} onUbah={aturParam} />

      {memuat ? (
        <PanelMemuatAudit />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalatAudit pesan={galat} onCobaLagi={muat} />
      ) : (
        <>
          <TabelAudit baris={baris} onBuka={setDetailId} />
          <NavigasiHalaman offset={Number.isFinite(offset) && offset > 0 ? offset : 0} limit={BATAS} total={total} onUbah={(o) => aturParam('offset', String(o))} />
        </>
      )}

      <Dialog open={barisDetail !== null} onOpenChange={(buka) => !buka && setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Detail audit</DialogTitle>
          </DialogHeader>
          {barisDetail ? <IsiDialogDetail baris={barisDetail} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuatAudit />}>
      <HalamanAuditLog />
    </Suspense>
  );
}
