'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function labelKeluar(mengirim: boolean): string {
  return mengirim ? 'Keluar…' : 'Keluar';
}

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
    <Button
      type="button"
      variant="ghost"
      onClick={keluar}
      disabled={mengirim}
      aria-label="Keluar"
      className="w-full justify-start"
    >
      {labelKeluar(mengirim)}
    </Button>
  );
}
