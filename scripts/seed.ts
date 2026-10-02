#!/usr/bin/env node
import { getDb } from '../src/server/db';
import { hashPassword } from '../src/server/auth';
import { serialisasiWIB } from '../src/server/waktu';

process.loadEnvFile('.env.local');

async function seed() {
  const seedPassword = process.env['SEED_PASSWORD'];
  if (!seedPassword) {
    console.error('SEED_PASSWORD belum diisi di env. Seed gagal.');
    process.exit(1);
  }

  const db = getDb();
  const superAdminHash = hashPassword(seedPassword);
  const adminHash = hashPassword(seedPassword);

  // Hapus akun jika sudah ada (untuk seed ulang)
  await db.execute({ sql: "DELETE FROM pengguna_admin WHERE username IN (?, ?)", args: ['superadmin', 'admin'] });

  await db.execute({
    sql: `INSERT INTO pengguna_admin (username, password_hash, nama, peran, aktif, dibuat_at)
          VALUES (?, ?, ?, ?, 1, ?)`,
    args: ['superadmin', superAdminHash.combined, 'Super Admin Awal', 'SUPER_ADMIN', serialisasiWIB()],
  });

  await db.execute({
    sql: `INSERT INTO pengguna_admin (username, password_hash, nama, peran, aktif, dibuat_at)
          VALUES (?, ?, ?, ?, 1, ?)`,
    args: ['admin', adminHash.combined, 'Admin Awal', 'ADMIN', serialisasiWIB()],
  });

  console.log('Seed berhasil: dua akun dibuat (superadmin, admin). Password dari SEED_PASSWORD.');
  console.log('SETELAH SEED, buka /admin/ubah-password untuk mengganti password kedua akun.');
}

seed().catch((e) => {
  console.error('Seed gagal:', e);
  process.exit(1);
});
