'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelUbahPassword } from './komponen';

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
    <main className="mx-auto w-full max-w-md p-6">
      <PanelUbahPassword mengirim={mengirim} galat={error} sukses={sukses} onKirim={kirim} />
    </main>
  );
}
