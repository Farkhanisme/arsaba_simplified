/**
 * Menyiapkan database pengembangan lokal dalam SATU perintah.
 *
 * Dipakai setelah `npm run migrate` gagal, atau saat clone baru, atau saat
 * data/demo.db tidak ada (file .db tidak ikut masuk git).
 *
 * Yang dilakukan:
 *   1. Menjalankan migrasi 0001_init.sql
 *   2. Membuat dua akun admin (superadmin dan admin) dari SEED_PASSWORD
 *   3. Mengisi data master: 10 toko, 26 karyawan, dan penempatan
 *      (shift template, jadwal, dan absensi TIDAK diisi — lihat skripnya)
 *
 * PENTING: langkah 3 OPSIONAL. Lewati dengan --minimal kalau Anda hanya ingin
 * database kosong untuk keperluan lain:
 *
 *   npx tsx scripts/dev:siap.ts --minimal
 */
process.loadEnvFile('.env.local');

import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

const MINIMAL = process.argv.includes('--minimal');
const url = process.env['TURSO_DATABASE_URL'] ?? 'file:./data/uji.db';
const lokal = url.startsWith('file:');
const jalur = lokal ? url.replace('file:', '') : url;

function jalankan(perintah: string, judul: string): void {
  console.log(`\n[${judul}]`);
  execSync(perintah, { stdio: 'inherit' });
}

console.log('Menyiapkan database pengembangan');
console.log(`  tujuan : ${url}`);
if (!lokal) {
  console.log('\n  CATATAN: tujuan ini BUKAN file lokal (kemungkinan Turso).');
  console.log('  Perintah di bawah akan MENULIS ke database itu dan membuat akun admin.');
  console.log('  Pastikan itu memang yang Anda mau. Untuk membatalkan, tekan Ctrl+C.');
}

if (lokal && existsSync(jalur) && statSync(jalur).size < 1024) {
  console.log(`\n  Ditemukan ${jalur} berukuran 0 byte — itu bukan database yang benar.`);
  console.log('  File kosong seperti itu membuat setiap query gagal dan login jadi 500.');
  console.log('  Menghapusnya agar migrasi bisa membuat ulang dengan benar.');
  execSync(`rm -f ${JSON.stringify(jalur)}`);
}

jalankan('npx tsx scripts/migrate.ts', '1/3 migrasi');
jalankan('npx tsx scripts/seed.ts', '2/3 akun admin');

if (MINIMAL) {
  console.log('\nSelesai (mode minimal — tanpa data master).');
} else {
  jalankan('npx tsx scripts/isi-data-demo.ts', '3/3 data master');
  console.log('\nSelesai. Database pengembangan siap.');
}

console.log('\nLangkah berikutnya:');
console.log('  npm run dev');
console.log('  lalu buka http://localhost:3000');
console.log('  akun: admin atau superadmin, password dari SEED_PASSWORD');
console.log('');
console.log('PENTING: pakai `npm run dev`. Kalau memakai `npm run build && npm start`,');
console.log('aplikasi berjalan pada NODE_ENV=production, dan APP_ORIGIN_DEV diabaikan');
console.log('sehingga login lokal akan ditolak dengan pesan "Username atau password salah."');
