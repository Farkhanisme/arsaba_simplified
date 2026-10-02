process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { getDb, denganTransaksi } from '../src/server/db';
import { catatAudit } from '../src/server/audit';
import { serialisasiWIB } from '../src/server/waktu';

const DB_PATH = 'data/uji_transaksi.db';

describe('audit dalam transaksi (Fix A)', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  async function namaPengguna(id: number): Promise<string> {
    const db = getDb();
    const r = await db.execute({ sql: 'SELECT nama FROM pengguna_admin WHERE id = ?', args: [id] });
    return String((r.rows[0] as Record<string, unknown>)['nama']);
  }

  async function hitungAudit(aksi: string): Promise<number> {
    const db = getDb();
    const r = await db.execute({ sql: 'SELECT COUNT(*) as c FROM audit_log WHERE aksi = ?', args: [aksi] });
    return Number((r.rows[0] as Record<string, unknown>)['c']);
  }

  it('mutasi + audit dalam satu transaksi yang COMMIT: keduanya tersimpan', async () => {
    const sebelum = await hitungAudit('TES_COMMIT');

    await denganTransaksi(async (tx) => {
      await tx.execute({
        sql: 'UPDATE pengguna_admin SET nama = ? WHERE id = ?',
        args: ['Nama Setelah Commit', 1],
      });
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: 1,
          aksi: 'TES_COMMIT',
          entitas: 'pengguna_admin',
          entitas_id: 1,
          sesudah: JSON.stringify({ nama: 'Nama Setelah Commit' }),
        },
        tx,
      );
    });

    expect(await namaPengguna(1)).toBe('Nama Setelah Commit');
    expect(await hitungAudit('TES_COMMIT')).toBe(sebelum + 1);
  });

  it('mutasi + audit dalam satu transaksi yang ROLLBACK: audit HARUS ikut hilang', async () => {
    // Ini inti Fix A. Kalau catatAudit memakai getDb() (koneksi terpisah), baris audit
    // akan tetap ada walau transaksi sudah rollback — dan tes ini akan gagal.
    const namaSebelum = await namaPengguna(1);
    const auditSebelum = await hitungAudit('TES_ROLLBACK');

    await expect(
      denganTransaksi(async (tx) => {
        await tx.execute({
          sql: 'UPDATE pengguna_admin SET nama = ? WHERE id = ?',
          args: ['Nama Seharusnya Dibatalkan', 1],
        });
        await catatAudit(
          {
            waktu: serialisasiWIB(),
            pengguna_id: 1,
            aksi: 'TES_ROLLBACK',
            entitas: 'pengguna_admin',
            entitas_id: 1,
          },
          tx,
        );
        throw new Error('paksa rollback');
      }),
    ).rejects.toThrow('paksa rollback');

    // Mutasi tidak boleh bocor.
    expect(await namaPengguna(1)).toBe(namaSebelum);
    expect(await namaPengguna(1)).not.toBe('Nama Seharusnya Dibatalkan');

    // Dan audit juga tidak boleh bocor — inilah pembuktiannya.
    expect(await hitungAudit('TES_ROLLBACK')).toBe(auditSebelum);
  });

  it('catatAudit tanpa executor tetap berfungsi (route M1 tidak rusak)', async () => {
    const sebelum = await hitungAudit('TES_TANPA_EXECUTOR');

    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: null,
      aksi: 'TES_TANPA_EXECUTOR',
      entitas: 'pengguna_admin',
    });

    expect(await hitungAudit('TES_TANPA_EXECUTOR')).toBe(sebelum + 1);
  });

  it('audit_log tetap append-only: UPDATE ditolak trigger', async () => {
    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: 1,
      aksi: 'TES_APPEND_ONLY',
      entitas: 'pengguna_admin',
    });
    const db = getDb();
    const idRes = await db.execute({
      sql: 'SELECT id FROM audit_log WHERE aksi = ?',
      args: ['TES_APPEND_ONLY'],
    });
    const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);

    await expect(
      db.execute({ sql: 'UPDATE audit_log SET aksi = ? WHERE id = ?', args: ['DIRUSAK', id] }),
    ).rejects.toThrow();

    await expect(
      db.execute({ sql: 'DELETE FROM audit_log WHERE id = ?', args: [id] }),
    ).rejects.toThrow();
  });
});
