'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, AksesDitolak, adalahAksesDitolak, type Pesan } from '../../komponen';
import {
  BantuanShift,
  FilterTokoShift,
  FormulirSuntingShift,
  FormulirTambahShift,
  TabelShift,
  type FormulirShift,
  type Shift,
  type Toko,
} from './komponen';

function HalamanShift() {
  const router = useRouter();
  const params = useSearchParams();
  const tokoId = params.get('toko_id') ?? '';
  const [daftarToko, setDaftarToko] = useState<Toko[]>([]);
  const [daftar, setDaftar] = useState<Shift[]>([]);
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [form, setForm] = useState<FormulirShift>({ nama: '', tipe_hari: 'SEMUA', jam_mulai: '', jam_selesai: '' });
  const [sunting, setSunting] = useState<Shift | null>(null);

  const muatToko = useCallback(async () => {
    const res = await fetch('/api/admin/master/toko');
    if (res.ok) setDaftarToko(((await res.json()).data as Toko[]).filter((t) => t.aktif === 1));
  }, []);

  const muat = useCallback(async () => {
    const res = await fetch(`/api/admin/master/shift${tokoId ? `?toko_id=${encodeURIComponent(tokoId)}` : ''}`);
    if (!res.ok) {
      if (await adalahAksesDitolak(res)) {
        setAksesDitolak(true);
        return;
      }
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal memuat shift.') });
      return;
    }
    setDaftar((await res.json()).data as Shift[]);
  }, [tokoId]);

  useEffect(() => {
    muatToko();
    muat();
  }, [muatToko, muat]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!tokoId) {
      setPesan({ jenis: 'galat', teks: 'Pilih toko terlebih dahulu.' });
      return;
    }
    const res = await fetch('/api/admin/master/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toko_id: Number(tokoId), ...form }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal menambah shift.') });
      return;
    }
    setForm({ nama: '', tipe_hari: 'SEMUA', jam_mulai: '', jam_selesai: '' });
    setPesan({ jenis: 'sukses', teks: 'Shift berhasil ditambah.' });
    muat();
  }

  async function simpanSunting(e: React.FormEvent) {
    e.preventDefault();
    if (!sunting) return;
    const res = await fetch(`/api/admin/master/shift/${sunting.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: sunting.nama, tipe_hari: sunting.tipe_hari, jam_mulai: sunting.jam_mulai, jam_selesai: sunting.jam_selesai }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah shift.') });
      return;
    }
    setSunting(null);
    setPesan({ jenis: 'sukses', teks: 'Shift berhasil diubah.' });
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Data Master — Shift</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />
      {aksesDitolak ? <AksesDitolak /> : null}

      <FilterTokoShift
        tokoId={tokoId}
        daftarToko={daftarToko}
        onUbah={(nilai) => router.replace(`/admin/master/shift${nilai ? `?toko_id=${nilai}` : ''}`)}
      />

      <BantuanShift />

      {tokoId ? (
        <FormulirTambahShift
          form={form}
          onUbah={(sebagian) => setForm({ ...form, ...sebagian })}
          onTambah={tambah}
        />
      ) : null}

      <TabelShift daftar={daftar} adaTokoDipilih={tokoId !== ''} onMintaSunting={(s) => setSunting({ ...s })} />

      {sunting ? (
        <FormulirSuntingShift
          sunting={sunting}
          onUbah={setSunting}
          onBatal={() => setSunting(null)}
          onSimpan={simpanSunting}
        />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
      <HalamanShift />
    </Suspense>
  );
}
