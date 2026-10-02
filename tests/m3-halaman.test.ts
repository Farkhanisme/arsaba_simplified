process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { buatTokenLink, buatLink } from '../src/server/repo/link';
import { pindahKaryawan } from '../src/server/repo/penempatan';

vi.mock('next/navigation', () => ({
  notFound: (): never => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import HalamanAbsen from '../src/app/a/[token]/page';

const DB_PATH = 'data/uji_m3_halaman.db';

describe('M3 halaman /a/[token]', () => {
  let token = '';

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko Halaman', sekarang] });
    const t = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const tokoId = Number((t.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Kry Halaman', sekarang] });
    const k = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const kryId = Number((k.rows[0] as Record<string, unknown>)['id']);
    await pindahKaryawan(kryId, tokoId, tanggalWIB(sekarang), db);
    token = (await buatLink(kryId, buatTokenLink(), 1, sekarang, db)).token;
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('token valid -> render nama, toko, jadwal/absen (US-K1)', async () => {
    const el = await HalamanAbsen({ params: Promise.resolve({ token }) });
    const html = JSON.stringify(el);
    expect(html).toContain('Kry Halaman');
    expect(html).toContain('Toko Halaman');
    expect(html).toContain('Jadwal hari ini');
    expect(html).toContain('Absen hari ini');
    // Tidak membocorkan token di output render.
    expect(html).not.toContain(token);
  });

  it('token tak dikenal -> notFound (pesan generik di not-found.tsx)', async () => {
    await expect(HalamanAbsen({ params: Promise.resolve({ token: 'ngawur' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('jadwal kosong -> teks "Tidak ada jadwal"', async () => {
    const el = await HalamanAbsen({ params: Promise.resolve({ token }) });
    expect(JSON.stringify(el)).toContain('Tidak ada jadwal');
  });
});
