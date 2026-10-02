import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../src/server/db';
import * as fs from 'fs';
import { execSync } from 'child_process';

const DB_PATH = 'data/uji.db';

describe('Integrasi database lokal', () => {
  beforeAll(async () => {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
  });

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
  });

  it('database uji adalah file lokal, bukan :memory:', () => {
    expect(fs.existsSync(DB_PATH)).toBe(true);
    expect(fs.statSync(DB_PATH).isFile()).toBe(true);
  });

  it('PRAGMA foreign_keys = ON benar-benar aktif', async () => {
    const db = getDb();
    await db.execute('PRAGMA foreign_keys = ON');
    const res = await db.execute('PRAGMA foreign_keys');
    const row = res.rows[0] as Record<string, unknown>;
    expect(row['foreign_keys']).toBe(1);
  });

  it('FK menolak insert yang melanggar referensi', async () => {
    const db = getDb();
    await db.execute('PRAGMA foreign_keys = ON');
    await expect(
      db.execute({
        sql: 'INSERT INTO absensi (karyawan_id, toko_id, tanggal, jenis, waktu, sumber, lokasi_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [9999, 1, '2026-09-30', 'CHECKIN', '2026-09-30T07:00:00+07:00', 'KARYAWAN', 'TERSEDIA'],
      })
    ).rejects.toThrow();
  });

  it('partial index uq_link_aktif menolak dua link aktif untuk karyawan yang sama', async () => {
    const db = getDb();
    await db.execute('PRAGMA foreign_keys = ON');
    await db.execute({
      sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)',
      args: ['Tes Karyawan', '2026-09-30T07:00:00+07:00'],
    });
    await db.execute({
      sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at) VALUES (?, ?, ?)',
      args: [1, 'token1', '2026-09-30T07:00:00+07:00'],
    });
    await expect(
      db.execute({
        sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at) VALUES (?, ?, ?)',
        args: [1, 'token2', '2026-09-30T07:00:00+07:00'],
      })
    ).rejects.toThrow();
  });

  it('trigger audit_log_tolak_update menolak UPDATE', async () => {
    const db = getDb();
    await db.execute('PRAGMA foreign_keys = ON');
    await db.execute({
      sql: 'INSERT INTO pengguna_admin (username, password_hash, nama, peran, aktif, dibuat_at) VALUES (?, ?, ?, ?, 1, ?)',
      args: ['admin1', 'hash', 'Admin Tes', 'SUPER_ADMIN', '2026-09-30T07:00:00+07:00'],
    });
    await db.execute({
      sql: 'INSERT INTO audit_log (waktu, pengguna_id, aksi, entitas, entitas_id, sebelum, sesudah, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['2026-09-30T07:00:00+07:00', 1, 'TES', 'tes', 1, '{}', '{}', ''],
    });
    await expect(
      db.execute({
        sql: 'UPDATE audit_log SET waktu = ? WHERE id = 1',
        args: ['2026-09-30T08:00:00+07:00'],
      })
    ).rejects.toThrow();
  });

  it('trigger audit_log_tolak_delete menolak DELETE', async () => {
    const db = getDb();
    await db.execute('PRAGMA foreign_keys = ON');
    await expect(db.execute({ sql: 'DELETE FROM audit_log', args: [] })).rejects.toThrow();
  });
});
