'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, type Pesan } from '../../komponen';

interface Toko {
  id: number;
  nama: string;
  aktif: number;
  dibuat_at: string;
}

function HalamanToko() {
  const router = useRouter();
  const params = useSearchParams();
  const cari = params.get('cari') ?? '';
  const [daftar, setDaftar] = useState<Toko[]>([]);
  const [namaBaru, setNamaBaru] = useState('');
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [suntingId, setSuntingId] = useState<number | null>(null);
  const [suntingNama, setSuntingNama] = useState('');

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/master/toko');
    if (!res.ok) {
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
    <div>
      <h1 style={{ marginTop: 0 }}>Data Master — Toko</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />

      <form onSubmit={tambah} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <label htmlFor="nama-baru" className="sr-only">Nama toko baru</label>
        <input id="nama-baru" value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} placeholder="Nama toko baru" required maxLength={100} style={{ padding: 8, fontSize: 14, flex: 1 }} />
        <button type="submit" style={{ padding: '8px 16px' }}>Tambah</button>
      </form>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cari">Cari: </label>
        <input id="cari" defaultValue={cari} onChange={(e) => router.replace(`/admin/master/toko?cari=${encodeURIComponent(e.target.value)}`)} placeholder="Filter nama toko" style={{ padding: 8, fontSize: 14 }} />
      </div>

      {tampil.length === 0 ? (
        <p>Belum ada toko.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Nama</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((t) => (
              <tr key={t.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {suntingId === t.id ? (
                    <input value={suntingNama} onChange={(e) => setSuntingNama(e.target.value)} maxLength={100} style={{ padding: 6 }} aria-label="Nama toko" />
                  ) : (
                    t.nama
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.aktif === 1 ? 'Aktif' : 'Nonaktif'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', gap: 8 }}>
                  {suntingId === t.id ? (
                    <>
                      <button type="button" onClick={() => simpanSunting(t.id)}>Simpan</button>
                      <button type="button" onClick={() => setSuntingId(null)}>Batal</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setSuntingId(t.id); setSuntingNama(t.nama); }}>Ubah</button>
                  )}
                  <button type="button" onClick={() => alihAktif(t)}>{t.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanToko />
    </Suspense>
  );
}
