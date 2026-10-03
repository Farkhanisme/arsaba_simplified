'use client';

import { useEffect, useState } from 'react';

const KUNCI = 'arsaba-tema';

/**
 * Pengalih tema terang/gelap. Pilihan disimpan di localStorage; nilai awal
 * mengikuti prefers-color-scheme. Kelas `dark` di <html> dipasang SEBELUM
 * hydrate oleh skrip inline di layout (tanpa kedipan putih).
 */
export default function PengalihTema() {
  const [gelap, setGelap] = useState(false);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    setGelap(document.documentElement.classList.contains('dark'));
    setSiap(true);
  }, []);

  function alih() {
    const jadi = !gelap;
    setGelap(jadi);
    document.documentElement.classList.toggle('dark', jadi);
    try {
      window.localStorage.setItem(KUNCI, jadi ? 'gelap' : 'terang');
    } catch {
      /* abaikan */
    }
  }

  return (
    <button
      type="button"
      onClick={alih}
      aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      aria-pressed={gelap}
      style={{ padding: '8px 12px', fontSize: 14 }}
    >
      {siap ? (gelap ? '☀️ Terang' : '🌙 Gelap') : 'Tema'}
    </button>
  );
}
