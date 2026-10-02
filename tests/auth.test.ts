process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword, generateSessionId, createSession, getSession, destroySession, checkLoginAttempts, recordLoginAttempt, MAX_LOGIN_ATTEMPTS } from '../src/server/auth';
import { buatPengguna, nonaktifkanPengguna } from '../src/server/repo/pengguna';
import { getDb } from '../src/server/db';
import { catatAudit } from '../src/server/audit';
import { serialisasiWIB } from '../src/server/waktu';
import * as fs from 'fs';
import { execSync } from 'child_process';

const DB_PATH = 'data/uji_auth.db';

describe('auth M1', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = 'file:./data/uji_auth.db';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  });

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('hashPassword menghasilkan hash berbeda untuk salt berbeda', () => {
    const h1 = hashPassword('test');
    const h2 = hashPassword('test');
    expect(h1.salt).not.toBe(h2.salt);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it('verifyPassword berhasil untuk password benar', () => {
    const { combined } = hashPassword('secret');
    expect(verifyPassword('secret', combined)).toBe(true);
  });

  it('verifyPassword gagal untuk password salah', () => {
    const { combined } = hashPassword('secret');
    expect(verifyPassword('wrong', combined)).toBe(false);
  });

  it('generateSessionId menghasilkan id dan hash berbeda', () => {
    const s1 = generateSessionId();
    const s2 = generateSessionId();
    expect(s1.raw).not.toBe(s2.raw);
    expect(s1.hash).not.toBe(s2.hash);
  });

  it('sesi disimpan dengan hash, bukan raw id', async () => {
    const { raw, hash, kedaluwarsa_at } = await createSession(1);
    expect(typeof raw).toBe('string');
    expect(typeof hash).toBe('string');
    expect(raw).not.toBe(hash);
    // getSession menggunakan raw cookie value
    const sessionFromRaw = await getSession(raw);
    expect(sessionFromRaw).not.toBeNull();
    expect(sessionFromRaw!.id_hash).toBe(hash);
    expect(new Date(sessionFromRaw!.kedaluwarsa_at).getTime()).toBeGreaterThan(Date.now());
    await destroySession(hash);
    const sessionAfter = await getSession(raw);
    expect(sessionAfter).toBeNull();
  });

  it('durasi sesi tepat 12 jam', async () => {
    const { kedaluwarsa_at } = await createSession(1);
    const kedaluwarsa = new Date(kedaluwarsa_at);
    const sekarang = new Date();
    const selisihJam = (kedaluwarsa.getTime() - sekarang.getTime()) / (1000 * 60 * 60);
    expect(selisihJam).toBeGreaterThanOrEqual(11.9);
    expect(selisihJam).toBeLessThanOrEqual(12.1);
    await destroySession(await (await getSession((await createSession(1)).raw))?.id_hash || '');
  });

  it('percobaan login tercatat dan diblokir setelah MAX_LOGIN_ATTEMPTS', async () => {
    const db = getDb();
    await recordLoginAttempt('testuser', '127.0.0.1', false);
    await recordLoginAttempt('testuser', '127.0.0.1', false);
    await recordLoginAttempt('testuser', '127.0.0.1', false);
    await recordLoginAttempt('testuser', '127.0.0.1', false);
    await recordLoginAttempt('testuser', '127.0.0.1', false);
    const result = await checkLoginAttempts('testuser', '127.0.0.1');
    expect(result.blocked).toBe(true);
    expect(result.countUsername).toBeGreaterThanOrEqual(5);
    expect(result.countIp).toBeGreaterThanOrEqual(5);
  });

  it('audit login berhasil tercatat', async () => {
    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: 1,
      aksi: 'LOGIN_BERHASIL',
      entitas: 'pengguna_admin',
      entitas_id: 1,
    });
    const db = getDb();
    const res = await db.execute({ sql: 'SELECT * FROM audit_log WHERE aksi = ?', args: ['LOGIN_BERHASIL'] });
    expect(res.rows.length).toBeGreaterThan(0);
  });

  it('audit login gagal dengan pengguna_id NULL bila username tidak ada', async () => {
    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: null as any,
      aksi: 'LOGIN_GAGAL',
      entitas: 'pengguna_admin',
      entitas_id: null as any,
    });
    const db = getDb();
    const res = await db.execute({ sql: 'SELECT * FROM audit_log WHERE aksi = ? AND pengguna_id IS NULL', args: ['LOGIN_GAGAL'] });
    expect(res.rows.length).toBeGreaterThan(0);
  });

  it('akun nonaktif tidak bisa login', async () => {
    const userId = await buatPengguna('testnonaktif', hashPassword('testpass').combined, 'Tes Nonaktif', 'ADMIN', 1);
    await nonaktifkanPengguna(userId);
    const db = getDb();
    const userRes = await db.execute({ sql: 'SELECT id, username, password_hash, peran, aktif FROM pengguna_admin WHERE username = ?', args: ['testnonaktif'] });
    const userRow = userRes.rows[0] as Record<string, unknown>;
    expect(Number(userRow['aktif'])).toBe(0);
  });

  // Catatan: dulu ada tes di sini yang membaca isi file route lalu membandingkannya
  // dengan string 'origin !== appOrigin'. Dua masalah: (a) menguji teks, bukan
  // perilaku; (b) hanya memeriksa 4 route, padahal M2-M4 menambah 23 route lagi,
  // sehingga pagar itu sudah bocor tanpa disadari.
  //
  // Perilaku Origin kini diuji di tests/guard-origin.test.ts: SEMUA route dipanggil
  // tanpa Origin dan dengan Origin berawalan sama, semuanya harus ditolak 403,
  // tanpa membaca teks satu pun. Tes di lokasi ini dihapus, bukan diperbaiki,
  // karena isinya sudah tercakup penuh di sana — menyisakannya hanya menambah
  // tes yang tidak memeriksa apa-apa.

  it('password ber-spasi berhasil login', async () => {
    const result = hashPassword('  test1234  ');
    expect(verifyPassword('  test1234  ', result.combined)).toBe(true);
    expect(verifyPassword('test1234', result.combined)).toBe(false);
  });
});
