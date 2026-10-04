'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KUNCI = 'arsaba-tema';

/**
 * Teks saja, tanpa emoji. Ikon dirender terpisah di tombol supaya tidak
 * bergantung pada font emoji HP (tampil beda di tiap perangkat).
 */
export function labelTema(siap: boolean, gelap: boolean): string {
  if (!siap) return 'Tema';
  return gelap ? 'Terang' : 'Gelap';
}

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
    <Button
      type="button"
      variant="ghost"
      onClick={alih}
      aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      aria-pressed={gelap}
      className="w-full justify-start"
    >
      {siap ? (gelap ? <SunIcon /> : <MoonIcon />) : null}
      {labelTema(siap, gelap)}
    </Button>
  );
}
