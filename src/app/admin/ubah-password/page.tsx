'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UbahPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMengirim(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const res = await fetch('/api/admin/ubah-password', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.pesan ?? 'Gagal mengganti password.');
        return;
      }
      // Seluruh sesi dibatalkan (K-47), jadi hanya tersisa login ulang.
      setSukses(true);
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1500);
    } catch {
      setError('Tidak ada koneksi internet. Sambungkan lalu coba lagi.');
    } finally {
      setMengirim(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ubah Password</h1>
      <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
        Setelah diganti, seluruh sesi akun ini berakhir dan Anda harus masuk kembali.
      </p>

      {sukses ? (
        <p role="status" style={{ color: '#166534' }}>
          Password berhasil diubah. Silakan masuk kembali.
        </p>
      ) : (
        <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label htmlFor="passwordSaatIni">Password saat ini</label>
          <input
            id="passwordSaatIni"
            name="passwordSaatIni"
            type="password"
            required
            autoComplete="current-password"
            style={{ padding: 12, fontSize: 16 }}
          />

          <label htmlFor="passwordBaru">Password baru</label>
          <input
            id="passwordBaru"
            name="passwordBaru"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ padding: 12, fontSize: 16 }}
          />
          <small style={{ color: '#666' }}>Minimal 8 karakter.</small>

          <label htmlFor="konfirmasi">Konfirmasi password baru</label>
          <input
            id="konfirmasi"
            name="konfirmasi"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ padding: 12, fontSize: 16 }}
          />

          {error ? (
            <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={mengirim} style={{ padding: 12, fontSize: 16 }}>
            {mengirim ? 'Mengirim…' : 'Simpan'}
          </button>
        </form>
      )}
    </main>
  );
}
