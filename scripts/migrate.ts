#!/usr/bin/env node
process.loadEnvFile('.env.local');

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { serialisasiWIB } from '../src/server/waktu';

async function main() {
  const url = process.env['TURSO_DATABASE_URL'] || 'file:./data/uji.db';
  const authToken = process.env['TURSO_AUTH_TOKEN'] || '';

  // Jejak audit: cetak target SEBELUM menyentuh database apa pun.
  //
  // Kenapa wajib: tanpa baris ini, migrasi yang jatuh ke file lokal tetap
  // mencetak "Migrasi selesai." lalu terlihat sukses, padahal database Turso
  // tidak tersentuh sama sekali. Itu yang terjadi pada 2026-10-03 — migrate.ts
  // juga belum memuat .env.local, jadi nilai Turso di sana diabaikan.
  //
  // Baca baris "Target migrasi" ini sebelum migrasi berjalan: kalau
  // target-nya file: dan bukan libsql://, migrasi tidak menyentuh Turso.
  console.log(`Target migrasi: ${url}`);

  // Pagar kedua: jangan pernah mengarahkan migrasi ke Turso produksi dari
  // skrip yang berjalan di dalam proses tes.
  //
  // Kenapa perlu: `npm test` menjalankan 26 file yang memanggil skrip ini lewat
  // execSync. Semuanya memakai file lokal `data/uji_*.db`, tapi `.env.local`
  // berisi URL Turso produksi. ansiedad 2026-10-03: `integrasi.db.test.ts`
  // lupa menyetel TURSO_DATABASE_URL, sehingga tes itu ikut menulis ke
  // produksi. Satu baris lupa sudah cukup untuk itu terjadi.
  const namaSkrip = path.basename(process.argv[1] ?? '');
  const dipanggilDariTes = process.env['VITEST'] === 'true' || process.env['VITEST_WORKER_ID'] !== undefined;
  if (dipanggilDariTes && url.startsWith('libsql://')) {
    console.error(
      `\nDITOLAK: skrip ini dipanggil dari dalam tes, tapi target-nya Turso produksi.\n` +
        `  ${namaSkrip} — ${url}\n` +
        `  Setiap file tes WAJIB menyetel process.env['TURSO_DATABASE_URL'] ke file\n` +
        `  lokal (mis. 'file:./data/uji_<nama>.db') SEBELUM memanggil skrip ini.\n` +
        `  Kalau tidak, data uji akan mengotori database produksi.`,
    );
    process.exit(1);
  }

  const db = createClient({ url, authToken: authToken || undefined });

  // Pastikan folder data/ ada
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }

  // Coba buat tabel schema_migrations jika belum ada (database baru)
  try {
    await db.execute('SELECT 1 FROM schema_migrations LIMIT 1');
  } catch {
    // Database baru atau tabel belum ada — akan dibuat oleh SQL migrasi pertama
  }

  // Pastikan PRAGMA foreign_keys = ON pada koneksi ini
  await db.execute('PRAGMA foreign_keys = ON');

  // Baca semua file migrasi
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const versi = file.replace('.sql', '');
    let sudahAda = false;
    try {
      const check = await db.execute({ sql: 'SELECT 1 FROM schema_migrations WHERE versi = ?', args: [versi] });
      sudahAda = check.rows.length > 0;
    } catch {
      // Tabel belum ada; anggap belum diterapkan
      sudahAda = false;
    }
    if (sudahAda) {
      console.log('Lewati:', file);
      continue;
    }
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    // Ganti placeholder waktu seed
    const sekarang = serialisasiWIB();
    sql = sql.replace(/<waktu-seed>/g, sekarang);
    // Jalankan SQL sebagai batch
    const statements = sql.split(/;\s*$/m).filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      await db.execute(trimmed + ';');
    }
    await db.execute({ sql: 'INSERT INTO schema_migrations (versi, diterapkan_at) VALUES (?, ?)', args: [versi, sekarang] });
    console.log('Diterapkan:', file);
  }

  console.log('Migrasi selesai.');
}

main().catch(e => {
  console.error('Migrasi gagal:', e);
  process.exit(1);
});
