'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, AksesDitolak, adalahAksesDitolak, type Pesan } from '../../komponen';
import { FilterCariToko, FormulirTambahToko, TabelToko, type Toko } from './komponen';

function HalamanToko() {
  const router = useRouter();
  const params = useSearchParams();
  const cari = params.get('cari') ?? '';
  const [daftar, setDaftar] = useState<Toko[]>([]);
  const [namaBaru, setNamaBaru] = useState('');
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [suntingId, setSuntingId] = useState<number | null>(null);
  const [suntingNama, setSuntingNama] = useState('');
  const [aksesDitolak, setAksesDitolak] = useState(false);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/master/toko');
    if (!res.ok) {
      if (await adalahAksesDitolak(res)) {
        setAksesDitolak(true);
        return;
      }
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal memuat daftar toko.') });
      return;
    }
    const data = await res.json();
    setDaftar(data.data as Toko[]);
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const tampil = daftar.filter((t) => t.nama.toLowerCase().includes(cari.toLowerCase()));

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/master/toko', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: namaBaru }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal menambah toko.') });
      return;
    }
    setNamaBaru('');
    setPesan({ jenis: 'sukses', teks: 'Toko berhasil ditambah.' });
    muat();
  }

  async function simpanSunting(id: number) {
    const res = await fetch(`/api/admin/master/toko/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: suntingNama }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah toko.') });
      return;
    }
    setSuntingId(null);
    setPesan({ jenis: 'sukses', teks: 'Toko berhasil diubah.' });
    muat();
  }

  async function alihAktif(t: Toko) {
    const res = await fetch(`/api/admin/master/toko/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: t.aktif === 1 ? 0 : 1 }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah status toko.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: t.aktif === 1 ? 'Toko dinonaktifkan.' : 'Toko diaktifkan kembali.' });
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Data Master — Toko</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />
      {aksesDitolak ? <AksesDitolak /> : null}

      <FormulirTambahToko namaBaru={namaBaru} onUbahNama={setNamaBaru} onTambah={tambah} />

      <FilterCariToko
        cari={cari}
        onUbahCari={(nilai) => router.replace(`/admin/master/toko?cari=${encodeURIComponent(nilai)}`)}
      />

      <TabelToko
        daftar={tampil}
        suntingId={suntingId}
        suntingNama={suntingNama}
        onUbahSuntingNama={setSuntingNama}
        onMulaiSunting={(t) => {
          setSuntingId(t.id);
          setSuntingNama(t.nama);
        }}
        onBatalSunting={() => setSuntingId(null)}
        onSimpanSunting={simpanSunting}
        onAlihAktif={alihAktif}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
      <HalamanToko />
    </Suspense>
  );
}
