// `next build` menyuntik entri ".next/dev/types" ke tsconfig.json setiap kali
// dijalankan. Entri itu tidak boleh ada karena:
//
//   1. Direktori .next/dev hanya ada pada `next dev`, bukan hasil build produksi,
//      jadi `tsc --noEmit` ikut memeriksa berkas yang tidak akan pernah ada di Vercel.
//   2. Selisih antara yang dicek lokal dan yang dicek di server bisa menutupi
//      kesalahan yang baru muncul saat build produksi.
//
// Script ini dijalankan otomatis lewat `postbuild`, jadi tidak bergantung pada
// orang ingat membersihkannya. Hanya menyentuh array `include`.
//
// Referensi: rules/NOTES.md §9.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KONFIG = join(process.cwd(), 'tsconfig.json');
const ENTRI_YANG_DIBUANG = '.next/dev/types/**/*.ts';

const asli = readFileSync(KONFIG, 'utf8');
let isi;

try {
  isi = JSON.parse(asli);
} catch {
  console.error('[perbaiki-tsconfig] tsconfig.json bukan JSON valid — dilewati.');
  process.exit(0);
}

const sebelum = Array.isArray(isi.include) ? isi.include.length : 0;
if (Array.isArray(isi.include)) {
  isi.include = isi.include.filter((e) => e !== ENTRI_YANG_DIBUANG);
}

const sesudah = isi.include.length;
if (sesudah !== sebelum) {
  writeFileSync(KONFIG, `${JSON.stringify(isi, null, 2)}\n`);
  console.log(`[perbaiki-tsconfig] entri "${ENTRI_YANG_DIBUANG}" dibuang dari tsconfig.json`);
} else {
  console.log('[perbaiki-tsconfig] tidak ada yang perlu dibuang');
}
