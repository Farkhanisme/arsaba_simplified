'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast, pesanGalat, type Pesan } from '../komponen';

interface Akun {
  id: number;
  username: string;
  nama: string;
  peran: 'ADMIN' | 'SUPER_ADMIN';
  aktif: number;
}

export default function HalamanAkun() {
  const [daftar, setDaftar] = useState<Akun[]>([]);
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [form, setForm] = useState({ username: '', password: '', nama: '', peran: 'ADMIN' });
  const [passwordSekali, setPasswordSekali] = useState<{ username: string; password: string } | null>(null);
  const [reset, setReset] = useState<{ id: number; username: string; password: string } | null>(null);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/akun');
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal memuat akun.') });
      return;
    }
    setDaftar((await res.json()).data as Akun[]);
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/akun', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal membuat akun.') });
      return;
    }
    const data = await res.json();
    setForm({ username: '', password: '', nama: '', peran: 'ADMIN' });
    setPasswordSekali({ username: data.data.username as string, password: data.data.password as string });
    setPesan({ jenis: 'sukses', teks: 'Akun berhasil dibuat.' });
    muat();
  }

  async function alihAktif(a: Akun) {
    const res = await fetch(`/api/admin/akun/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: a.aktif === 1 ? 0 : 1 }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah status akun.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: a.aktif === 1 ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.' });
    muat();
  }

  async function kirimReset(e: React.FormEvent) {
    e.preventDefault();
    if (!reset) return;
    const res = await fetch(`/api/admin/akun/${reset.id}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: reset.password }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal me-reset password.') });
      return;
    }
    const data = await res.json();
    setPasswordSekali({ username: data.data.username as string, password: data.data.password as string });
    setReset(null);
    setPesan({ jenis: 'sukses', teks: `Password di-reset. ${data.data.sesi_dibatalkan as number} sesi dibatalkan.` });
    muat();
  }

  async function bukaKunci(username: string) {
    const fd = new FormData();
    fd.set('username', username);
    const res = await fetch('/api/admin/akun/buka-kunci', { method: 'POST', body: fd });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal membuka kunci.') });
      return;
    }
    const data = await res.json();
    setPesan({ jenis: 'sukses', teks: data.pesan as string });
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Akun Admin</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />

      {passwordSekali ? (
        <div role="status" style={{ background: '#fef9c3', border: '1px solid #facc15', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <strong>Password akun {passwordSekali.username} (ditampilkan sekali):</strong>{' '}
          <code>{passwordSekali.password}</code>{' '}
          <button type="button" onClick={() => setPasswordSekali(null)}>Sembunyikan</button>
          <div style={{ fontSize: 13 }}>Salin sekarang — password tidak akan ditampilkan lagi.</div>
        </div>
      ) : null}

      <form onSubmit={tambah} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16, background: '#fff', padding: 12, border: '1px solid #ddd' }}>
        <div><label>Username*<br /><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required maxLength={50} style={{ padding: 8 }} /></label></div>
        <div><label>Password* (min 8)<br /><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} style={{ padding: 8 }} /></label></div>
        <div><label>Nama*<br /><input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required maxLength={200} style={{ padding: 8 }} /></label></div>
        <div><label>Peran<br />
          <select value={form.peran} onChange={(e) => setForm({ ...form, peran: e.target.value })} style={{ padding: 8 }}>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </label></div>
        <button type="submit" style={{ padding: '8px 16px' }}>Tambah</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Username</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Nama</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Peran</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Status</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((a) => (
            <tr key={a.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.username}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.nama}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.aktif === 1 ? 'Aktif' : 'Nonaktif'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => alihAktif(a)}>{a.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button type="button" onClick={() => setReset({ id: a.id, username: a.username, password: '' })}>Reset Password</button>
                  <button type="button" onClick={() => bukaKunci(a.username)}>Buka Kunci</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {reset ? (
        <form onSubmit={kirimReset} style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid #ddd', display: 'flex', gap: 8, alignItems: 'end' }}>
          <div>
            <label>Password baru untuk {reset.username} (min 8)<br />
              <input type="password" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} required minLength={8} style={{ padding: 8 }} />
            </label>
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Reset</button>
          <button type="button" onClick={() => setReset(null)}>Batal</button>
        </form>
      ) : null}
    </div>
  );
}
