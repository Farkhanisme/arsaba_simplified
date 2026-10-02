'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, type Pesan } from '../../komponen';

interface Toko {
  id: number;
  nama: string;
  aktif: number;
}

interface Shift {
  id: number;
  toko_id: number;
  nama: string;
  tipe_hari: 'SEMUA' | 'WEEKDAY' | 'WEEKEND';
  jam_mulai: string;
  jam_selesai: string;
  aktif: number;
}

const LABEL_TIPE: Record<Shift['tipe_hari'], string> = {
  SEMUA: 'Semua hari',
  WEEKDAY: 'Weekday (Senin–Jumat)',
  WEEKEND: 'Weekend (Sabtu–Minggu)',
};

function HalamanShift() {
  const router = useRouter();
  const params = useSearchParams();
  const tokoId = params.get('toko_id') ?? '';
  const [daftarToko, setDaftarToko] = useState<Toko[]>([]);
  const [daftar, setDaftar] = useState<Shift[]>([]);
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [form, setForm] = useState({ nama: '', tipe_hari: 'SEMUA', jam_mulai: '', jam_selesai: '' });
  const [sunting, setSunting] = useState<Shift | null>(null);

  const muatToko = useCallback(async () => {
    const res = await fetch('/api/admin/master/toko');
    if (res.ok) setDaftarToko(((await res.json()).data as Toko[]).filter((t) => t.aktif === 1));
  }, []);

  const muat = useCallback(async () => {
    const res = await fetch(`/api/admin/master/shift${tokoId ? `?toko_id=${encodeURIComponent(tokoId)}` : ''}`);
    if (!res.ok) {
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
    <div>
      <h1 style={{ marginTop: 0 }}>Data Master — Shift</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="filter-toko">Toko: </label>
        <select id="filter-toko" value={tokoId} onChange={(e) => router.replace(`/admin/master/shift${e.target.value ? `?toko_id=${e.target.value}` : ''}`)} style={{ padding: 8 }}>
          <option value="">— Pilih toko —</option>
          {daftarToko.map((t) => (
            <option key={t.id} value={t.id}>{t.nama}</option>
          ))}
        </select>
      </div>

      <p style={{ color: '#555', fontSize: 14 }}>
        Pilih “Semua hari” bila jam sama setiap hari; buat dua baris bernama sama (Weekday &amp; Weekend) bila berbeda.
      </p>

      {tokoId ? (
        <form onSubmit={tambah} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'end' }}>
          <div>
            <label htmlFor="nama">Nama<br /><input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required maxLength={100} style={{ padding: 8 }} /></label>
          </div>
          <div>
            <label htmlFor="tipe">Tipe hari<br />
              <select id="tipe" value={form.tipe_hari} onChange={(e) => setForm({ ...form, tipe_hari: e.target.value })} style={{ padding: 8 }}>
                <option value="SEMUA">Semua hari</option>
                <option value="WEEKDAY">Weekday</option>
                <option value="WEEKEND">Weekend</option>
              </select>
            </label>
          </div>
          <div>
            <label htmlFor="mulai">Jam mulai<br /><input id="mulai" type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} required style={{ padding: 8 }} /></label>
          </div>
          <div>
            <label htmlFor="selesai">Jam selesai<br /><input id="selesai" type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} required style={{ padding: 8 }} /></label>
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Tambah</button>
        </form>
      ) : null}

      {daftar.length === 0 ? (
        <p>{tokoId ? 'Belum ada shift di toko ini.' : 'Pilih toko untuk melihat shift.'}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Nama</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Tipe hari</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Jam</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.nama}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{LABEL_TIPE[s.tipe_hari]}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.jam_mulai}–{s.jam_selesai} WIB</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <button type="button" onClick={() => setSunting({ ...s })}>Ubah</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sunting ? (
        <form onSubmit={simpanSunting} style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid #ddd', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label>Nama<br /><input value={sunting.nama} onChange={(e) => setSunting({ ...sunting, nama: e.target.value })} required maxLength={100} style={{ padding: 8 }} /></label>
          </div>
          <div>
            <label>Tipe hari<br />
              <select value={sunting.tipe_hari} onChange={(e) => setSunting({ ...sunting, tipe_hari: e.target.value as Shift['tipe_hari'] })} style={{ padding: 8 }}>
                <option value="SEMUA">Semua hari</option>
                <option value="WEEKDAY">Weekday</option>
                <option value="WEEKEND">Weekend</option>
              </select>
            </label>
          </div>
          <div>
            <label>Jam mulai<br /><input type="time" value={sunting.jam_mulai} onChange={(e) => setSunting({ ...sunting, jam_mulai: e.target.value })} required style={{ padding: 8 }} /></label>
          </div>
          <div>
            <label>Jam selesai<br /><input type="time" value={sunting.jam_selesai} onChange={(e) => setSunting({ ...sunting, jam_selesai: e.target.value })} required style={{ padding: 8 }} /></label>
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Simpan</button>
          <button type="button" onClick={() => setSunting(null)}>Batal</button>
        </form>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanShift />
    </Suspense>
  );
}
