'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TombolKeluar() {
  const router = useRouter();
  const [mengirim, setMengirim] = useState(false);

  async function keluar() {
    setMengirim(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={keluar} disabled={mengirim} style={{ padding: '8px 12px', fontSize: 14 }}>
      {mengirim ? 'Keluar…' : 'Keluar'}
    </button>
  );
}
