'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface Pesan {
  jenis: 'sukses' | 'galat';
  teks: string;
}

/**
 * Toast bersama halaman admin (rules/05 §6): sukses hijau hilang sendiri,
 * error merah menetap sampai ditutup.
 *
 * Memakai Alert + Button shadcn, tanpa inline style dan tanpa button polos.
 * Warna dipertahankan semantiknya: sukses hijau, galat merah (destructive).
 */
export function Toast({ pesan, onTutup }: { pesan: Pesan | null; onTutup: () => void }) {
  const [terlihat, setTerlihat] = useState(() => pesan !== null);

  useEffect(() => {
    if (!pesan) {
      setTerlihat(false);
      return;
    }
    setTerlihat(true);
    if (pesan.jenis === 'sukses') {
      const t = setTimeout(() => {
        setTerlihat(false);
        onTutup();
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [pesan, onTutup]);

  if (!pesan || !terlihat) return null;
  if (pesan.jenis === 'sukses') {
    return (
      <Alert
        role="status"
        className="mb-3 border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
      >
        <AlertDescription>{pesan.teks}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" role="alert" className="mb-3">
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{pesan.teks}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setTerlihat(false);
            onTutup();
          }}
          aria-label="Tutup pesan"
        >
          Tutup
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Membaca pesan galat { kode, pesan } dari respons JSON. */
export async function pesanGalat(res: Response, bawaan: string): Promise<string> {
  try {
    const data = await res.clone().json();
    if (typeof data?.pesan === 'string' && data.pesan.length > 0) return data.pesan;
  } catch {
    /* abaikan */
  }
  return bawaan;
}

/**
 * True bila respons adalah 403 AKSES_DITOLAK (peran tidak cukup, K-22).
 * Memakai clone() supaya body asli tetap bisa dibaca pemanggil.
 */
export async function adalahAksesDitolak(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const data = await res.clone().json();
    return (data as { kode?: unknown })?.kode === 'AKSES_DITOLAK';
  } catch {
    return false;
  }
}

/**
 * Keadaanpengganti halaman saat API menjawab 403 AKSES_DITOLAK (BUG-UI-03):
 * pesan jelas, bukan layar kosong. Server tetap yang menolak — ini hanya
 * tampilannya.
 */
export function AksesDitolak() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Akses ditolak</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Anda tidak punya akses ke halaman ini.</p>
      </CardContent>
    </Card>
  );
}

/** Galat umum halaman admin: pesan + tombol "Coba lagi" (rules/05 §5.x). */
export function PanelGalat({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{pesan}</span>
        <Button size="sm" variant="outline" onClick={onCobaLagi}>
          Coba lagi
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Memuat umum halaman admin: skeleton baris, bukan teks "Memuat…". */
export function PanelMemuat({ jumlahBaris = 5 }: { jumlahBaris?: number }) {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      {Array.from({ length: jumlahBaris }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
