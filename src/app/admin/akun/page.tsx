'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast, pesanGalat, AksesDitolak, adalahAksesDitolak, type Pesan } from '../komponen';
import {
  FormulirResetPassword,
  FormulirTambahAkun,
  PanelPasswordSekali,
  TabelAkun,
  type Akun,
  type FormulirAkun,
} from './komponen';

export default function HalamanAkun() {
  const [daftar, setDaftar] = useState<Akun[]>([]);
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [form, setForm] = useState<FormulirAkun>({ username: '', password: '', nama: '', peran: 'ADMIN' });
  const [passwordSekali, setPasswordSekali] = useState<{ username: string; password: string } | null>(null);
  const [reset, setReset] = useState<{ id: number; username: string; password: string } | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/akun');
    if (!res.ok) {
      if (await adalahAksesDitolak(res)) {
        setAksesDitolak(true);
        return;
      }
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
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Akun Admin</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />
      {aksesDitolak ? <AksesDitolak /> : null}

      {passwordSekali ? (
        <PanelPasswordSekali info={passwordSekali} onSembunyikan={() => setPasswordSekali(null)} />
      ) : null}

      <FormulirTambahAkun
        form={form}
        onUbah={(sebagian) => setForm({ ...form, ...sebagian })}
        onTambah={tambah}
      />

      <TabelAkun
        daftar={daftar}
        onAlihAktif={alihAktif}
        onMintaReset={(a) => setReset({ id: a.id, username: a.username, password: '' })}
        onBukaKunci={bukaKunci}
      />

      {reset ? (
        <FormulirResetPassword
          reset={reset}
          onUbahPassword={(nilai) => setReset({ ...reset, password: nilai })}
          onBatal={() => setReset(null)}
          onKirim={kirimReset}
        />
      ) : null}
    </div>
  );
}
