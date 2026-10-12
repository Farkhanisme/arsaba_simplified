'use client';

import { usePathname } from 'next/navigation';
import type { Peran } from '../../server/izin';
import { labelHalaman } from './label-halaman';

/**
 * Judul halaman di header admin.
 *
 * WAJIB `'use client'`. Layout adalah server component (memanggil `cookies()`),
 * tapi `usePathname` hanya boleh dipanggil di client. Directive ini hanya
 * ketahuan saat `next build` — `tsc` dan vitest sama-sama tidak menangkapnya,
 * jadi ada tes yang menjaganya.
 *
 * File ini dipisah dari layout.tsx karena dua alasan:
 *   1. layout tidak boleh punya `'use client'` (ia butuh `cookies()`).
 *   2. Fungsi murni `labelHalaman` sekarang bisa diimpor dan diuji langsung,
 *      bukan disalin ke dalam tes — menyalin berarti tes bisa lulus
 *      sementara kodenya salah (terbukti: mutasi "selalu pakai SUPER_ADMIN"
 *      LULUS saat logikanya masih disalin di file tes).
 */
export default function JudulHalaman({ peran }: { peran: Peran }) {
  const pathname = usePathname();
  const label = labelHalaman(pathname, peran);

  return label ? <h1 className="truncate text-base font-semibold">{label}</h1> : null;
}