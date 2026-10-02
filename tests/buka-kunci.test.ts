process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { getDb } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as bukaKunciRoute } from '../src/app/api/admin/akun/buka-kunci/route';
import { checkLoginAttempts, recordLoginAttempt, bukaKunciUsername } from '../src/server/auth';

const DB_PATH = 'data/uji_kunci.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const PASSWORD_SEED = process.env['SEED_PASSWORD'] || 'test1234';

function req(
  opsi: { method?: string; body?: FormData; cookie?: string; origin?: string | null } = {},
) {
  const headers = new Headers();
  if (opsi.origin !== null) headers.set('origin', opsi.origin ?? APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`${APP_ORIGIN}/api/admin/akun/buka-kunci`, {
    method: opsi.method ?? 'POST',
    headers,
    body: opsi.body,
  });
}

async function cookieDari(res: Response): Promise<string> {
  const setCookie = res.headers.get('set-cookie') || '';
  const m = /sesi=([^;]+)/.exec(setCookie);
  if (!m) throw new Error('set-cookie tidak memuat sesi: ' + setCookie);
  return m[1]!;
}

function formBukaKunci(username: string) {
  const fd = new FormData();
  fd.set('username', username);
  return fd;
}

async function loginSebagai(username: string, password: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const res = await loginRoute(
    new NextRequest(`${APP_ORIGIN}/api/login`, {
      method: 'POST',
      headers: { origin: APP_ORIGIN },
      body: fd,
    }),
  );
  if (res.status !== 200) throw new Error(`login ${username} gagal: ${res.status}`);
  return cookieDari(res);
}

describe('buka kunci akun (K-46, Fix B)', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('akun terkunci setelah 5 percobaan gagal', async () => {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM percobaan_login', args: [] });

    for (let i = 0; i < 5; i++) {
      await recordLoginAttempt('admin', '10.0.0.9', false);
    }

    const sebelum = await checkLoginAttempts('admin', '10.0.0.9');
    expect(sebelum.blocked).toBe(true);

    // Dan benar-benar tidak bisa login.
    const fd = new FormData();
    fd.set('username', 'admin');
    fd.set('password', PASSWORD_SEED);
    const ditolak = await loginRoute(
      new NextRequest(`${APP_ORIGIN}/api/login`, { method: 'POST', headers: { origin: APP_ORIGIN }, body: fd }),
    );
    expect(ditolak.status).toBe(429);
  });

  it('bukaKunciUsername mengembalikan akun dari status terkunci', async () => {
    // Bersihkan dulu: tes sebelumnya deliberately mengisi baris gagal, jadi jumlahnya
    // tidak boleh diasumsikan 5.
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM percobaan_login', args: [] });
    for (let i = 0; i < 5; i++) {
      await recordLoginAttempt('admin', '10.0.0.9', false);
    }
    expect((await checkLoginAttempts('admin', '10.0.0.9')).blocked).toBe(true);

    const dihapus = await bukaKunciUsername('admin');
    expect(dihapus).toBe(5);

    const sesudah = await checkLoginAttempts('admin', '10.0.0.9');
    expect(sesudah.blocked).toBe(false);

    // Password yang benar sekarang harus bisa dipakai lagi.
    const fd = new FormData();
    fd.set('username', 'admin');
    fd.set('password', PASSWORD_SEED);
    const boleh = await loginRoute(
      new NextRequest(`${APP_ORIGIN}/api/login`, { method: 'POST', headers: { origin: APP_ORIGIN }, body: fd }),
    );
    expect(boleh.status).toBe(200);
  });

  it('hanya menghapus percobaan GAGAL, riwayat berhasil dibiarkan', async () => {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM percobaan_login', args: [] });
    await recordLoginAttempt('admin', '10.0.0.9', false);
    await recordLoginAttempt('admin', '10.0.0.9', true);

    const dihapus = await bukaKunciUsername('admin');
    expect(dihapus).toBe(1);

    const sisa = await db.execute({
      sql: 'SELECT COUNT(*) as c FROM percobaan_login WHERE username = ?',
      args: ['admin'],
    });
    expect(Number((sisa.rows[0] as Record<string, unknown>)['c'])).toBe(1);
  });

  it('endpoint menolak ADMIN biasa dengan 403', async () => {
    const cookieAdmin = await loginSebagai('admin', PASSWORD_SEED);
    const res = await bukaKunciRoute(req({ body: formBukaKunci('admin'), cookie: cookieAdmin }));
    expect(res.status).toBe(403);
    expect((await res.json()).kode).toBe('AKSES_DITOLAK');
  });

  it('endpoint menerima SUPER_ADMIN dan mencatat audit', async () => {
    const cookieSuper = await loginSebagai('superadmin', PASSWORD_SEED);

    // Kunci dulu supaya ada yang dibuka.
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM percobaan_login', args: [] });
    for (let i = 0; i < 5; i++) await recordLoginAttempt('admin', '10.0.0.9', false);

    const auditSebelum = await db.execute({
      sql: "SELECT COUNT(*) as c FROM audit_log WHERE aksi = 'BUKA_KUNCI_AKUN'",
      args: [],
    });
    const sebelum = Number((auditSebelum.rows[0] as Record<string, unknown>)['c']);

    const res = await bukaKunciRoute(req({ body: formBukaKunci('admin'), cookie: cookieSuper }));
    expect(res.status).toBe(200);
    expect((await res.json()).jumlahDihapus).toBe(5);

    const auditSesudah = await db.execute({
      sql: "SELECT COUNT(*) as c FROM audit_log WHERE aksi = 'BUKA_KUNCI_AKUN'",
      args: [],
    });
    expect(Number((auditSesudah.rows[0] as Record<string, unknown>)['c'])).toBe(sebelum + 1);

    // Dan kuncinya benar-benar terbuka.
    expect((await checkLoginAttempts('admin', '10.0.0.9')).blocked).toBe(false);
  });

  it('endpoint menolak username yang tidak ada', async () => {
    const cookieSuper = await loginSebagai('superadmin', PASSWORD_SEED);
    const res = await bukaKunciRoute(req({ body: formBukaKunci('entah-siapa'), cookie: cookieSuper }));
    expect(res.status).toBe(404);
  });

  it('endpoint menolak Origin salah dan tanpa sesi', async () => {
    const cookieSuper = await loginSebagai('superadmin', PASSWORD_SEED);

    const salahOrigin = await bukaKunciRoute(
      req({ body: formBukaKunci('admin'), cookie: cookieSuper, origin: `${APP_ORIGIN}.evil.com` }),
    );
    expect(salahOrigin.status).toBe(403);

    const tanpaSesi = await bukaKunciRoute(req({ body: formBukaKunci('admin') }));
    expect(tanpaSesi.status).toBe(401);
  });
});
