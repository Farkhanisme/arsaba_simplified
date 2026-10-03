'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  FilterTidakBerangkat,
  FormulirTandai,
  IsiDialogUbah,
  PanelGalat,
  PanelHasilTandai,
  PanelMemuat,
  TabelPenandaan,
  type FormulirTandai as BentukFormulir,
  type HasilTandai,
  type Penandaan,
} from './komponen';

export { PanelHasilTandai };
export type { HasilTandai };

function HalamanTidakBerangkat() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<Penandaan[]>([]);
  const [pilihan, setPilihan] = useState<{ toko: { id: number; nama: string }[]; karyawan: { id: number; nama: string }[] }>({ toko: [], karyawan: [] });
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [form, setForm] = useState<BentukFormulir>({ karyawan: [], dari: '', sampai: '', jenis: 'IZIN', catatan: '' });
  const [hasil, setHasil] = useState<HasilTandai | null>(null);
  const [ubah, setUbah] = useState<{ id: number; jenis: 'IZIN' | 'TANPA_KETERANGAN'; catatan: string } | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const [rDaftar, rPilih] = await Promise.all([
        fetch(`/api/admin/tidak-berangkat?${query}`),
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
      setDaftar(((await rDaftar.json()).data as Penandaan[]));
      if (rPilih.ok) setPilihan((await rPilih.json()).data);
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
    router.replace(`/admin/tidak-berangkat?${p.toString()}`);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/tidak-berangkat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        karyawan_ids: form.karyawan,
        dari: form.dari,
        sampai: form.sampai || undefined,
        jenis: form.jenis,
        catatan: form.catatan || undefined,
      }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok && res.status !== 409) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    if (b?.data) setHasil(b.data as HasilTandai);
    setPesan((b?.pesan as string) ?? '');
    muat();
  }

  async function simpanUbah() {
    if (!ubah) return;
    const res = await fetch(`/api/admin/tidak-berangkat/${ubah.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jenis: ubah.jenis, catatan: ubah.catatan || null }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal mengubah.');
      return;
    }
    setUbah(null);
    setPesan('Penandaan berhasil diubah.');
    muat();
  }

  async function hapusBaris(id: number) {
    if (!window.confirm('Hapus penandaan ini? Karyawan bisa absen lagi pada tanggal itu.')) return;
    const res = await fetch(`/api/admin/tidak-berangkat/${id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menghapus.');
      return;
    }
    setPesan('Penandaan berhasil dihapus.');
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Tandai Tidak Berangkat</h1>
      {pesan ? (
        <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      ) : null}

      <FormulirTandai pilihanKaryawan={pilihan.karyawan} form={form} onUbah={setForm} onKirim={kirim} />

      {hasil ? <PanelHasilTandai hasil={hasil} /> : null}

      <FilterTidakBerangkat
        tokoId={params.get('toko_id') ?? ''}
        dari={params.get('dari') ?? ''}
        sampai={params.get('sampai') ?? ''}
        pilihanToko={pilihan.toko}
        onUbah={aturParam}
      />

      {memuat ? (
        <PanelMemuat />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalat pesan={galat} onCobaLagi={muat} />
      ) : (
        <TabelPenandaan
          daftar={daftar}
          onMintaUbah={(d) => setUbah({ id: d.id, jenis: d.jenis, catatan: d.catatan ?? '' })}
          onHapus={hapusBaris}
        />
      )}

      <Dialog open={ubah !== null} onOpenChange={(buka) => !buka && setUbah(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Ubah penandaan</DialogTitle>
          </DialogHeader>
          {ubah ? (
            <IsiDialogUbah ubah={ubah} onUbah={setUbah} onBatal={() => setUbah(null)} onSimpan={simpanUbah} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuat />}>
      <HalamanTidakBerangkat />
    </Suspense>
  );
}
