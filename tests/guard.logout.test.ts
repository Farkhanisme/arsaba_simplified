process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { getDb } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as logoutRoute } from '../src/app/api/logout/route';
import { GET as adminTestRoute } from '../src/app/api/admin/test/route';
import { POST as ubahPasswordRoute } from '../src/app/api/admin/ubah-password/route';

const DB_PATH = 'data/uji_guard.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const PASSWORD_SEED = process.env['SEED_PASSWORD'] || 'test1234';

function req(url: string, opsi: { method?: string; body?: FormData; cookie?: string; origin?: string | null } = {}) {
  const headers = new Headers();
  if (opsi.origin !== null) headers.set('origin', opsi.origin ?? APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`${APP_ORIGIN}${url}`, {
    method: opsi.method ?? 'GET',
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

async function login(): Promise<string> {
  const fd = new FormData();
  fd.set('username', 'superadmin');
  fd.set('password', PASSWORD_SEED);
  const res = await loginRoute(req('/api/login', { method: 'POST', body: fd }));
  if (res.status !== 200) throw new Error(`login gagal: ${res.status}`);
  return cookieDari(res);
}

async function jumlahSesi(): Promise<number> {
  const db = getDb();
  const r = await db.execute({ sql: 'SELECT COUNT(*) as c FROM sesi_admin', args: [] });
  return Number((r.rows[0] as Record<string, unknown>)['c']);
}

describe('guard + logout (Fix C)', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  // ---------------------------------------------------------------------
  // Bug logout: destroySession() mencari id_hash (sha256), tapi cookie berisi
  // id_sesi mentah. Kalau nilai cookie yang dikirim, DELETE kena 0 baris dan
  // sesi TETAP HIDUP sampai kedaluwarsa.
  // ---------------------------------------------------------------------
  it('LOGOUT benar-benar menghapus sesi di server', async () => {
    const cookie = await login();

    // Sesi ada dan cookie ini dipakai untuk akses.
    expect(await jumlahSesi()).toBeGreaterThan(0);
    expect((await adminTestRoute(req('/api/admin/test', { cookie }))).status).toBe(200);

    // Hash dari cookie inilah yang tersimpan di DB.
    const hashId = createHash('sha256').update(cookie).digest('base64url');
    const db = getDb();
    const sebelum = await db.execute({ sql: 'SELECT id_hash FROM sesi_admin', args: [] });
    const hashes: string[] = sebelum.rows.map((r) => String((r as Record<string, unknown>)['id_hash']));
    expect(hashes).toContain(hashId);

    const keluar = await logoutRoute(req('/api/logout', { method: 'POST', cookie }));
    expect(keluar.status).toBe(200);

    // Baris sesinya benar-benar hilang — inilah yang dulu tidak terjadi.
    const sesudah = await db.execute({ sql: 'SELECT id_hash FROM sesi_admin', args: [] });
    const hashesSesudah: string[] = sesudah.rows.map((r) => String((r as Record<string, unknown>)['id_hash']));
    expect(hashesSesudah).not.toContain(hashId);

    // Dan cookie lama tidak bisa dipakai lagi.
    expect((await adminTestRoute(req('/api/admin/test', { cookie }))).status).toBe(401);
  });

  it('LOGOUT tanpa cookie tidak error', async () => {
    const res = await logoutRoute(req('/api/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
  });

  it('LOGOUT menolak Origin salah', async () => {
    const res = await logoutRoute(
      req('/api/logout', { method: 'POST', origin: `${APP_ORIGIN}.evil.com` }),
    );
    expect(res.status).toBe(403);
  });

  // ---------------------------------------------------------------------
  // guard: urutan Origin -> sesi -> izin berlaku di semua route terlindungi
  // ---------------------------------------------------------------------
  it('guard menolak Origin salah di semua route terlindungi', async () => {
    const cookie = await login();
    const asalJahat = `${APP_ORIGIN}.evil.com`;

    for (const [nama, panggil] of [
      ['admin/test', () => adminTestRoute(req('/api/admin/test', { cookie, origin: asalJahat }))],
      ['logout', () => logoutRoute(req('/api/logout', { method: 'POST', cookie, origin: asalJahat }))],
      [
        'ubah-password',
        () => {
          const fd = new FormData();
          fd.set('passwordSaatIni', PASSWORD_SEED);
          fd.set('passwordBaru', 'passwordbaru123');
          fd.set('konfirmasi', 'passwordbaru123');
          return ubahPasswordRoute(req('/api/admin/ubah-password', { method: 'POST', body: fd, cookie, origin: asalJahat }));
        },
      ],
    ] as const) {
      const res = await panggil();
      expect(res.status, nama).toBe(403);
      expect((await res.json()).kode, nama).toBe('ORIGIN_TIDAK_VALID');
    }
  });

  it('GET tanpa Origin LOLOS (browser same-origin tidak mengirimnya)', async () => {
    // BUG-UI-05. Aturan proyek (rules/03 §9.4): "cek Origin PADA MUTASI".
    // GET same-origin tidak membawa header Origin sama sekali, jadi menjoloknya
    // membuat seluruh UI admin tidak bisa dipakai di browser.
    const cookie = await login();
    const res = await adminTestRoute(req('/api/admin/test', { cookie, origin: null }));
    expect(res.status).toBe(200);
  });

  it('MUTASI tanpa Origin tetap DITOLAK 403', async () => {
    // Penyeimbangnya: proteksi CSRF yang sesungguhnya tidak boleh kendur.
    const cookie = await login();
    const res = await logoutRoute(req('/api/logout', { method: 'POST', cookie, origin: null }));
    expect(res.status).toBe(403);
    expect((await res.json()).kode).toBe('ORIGIN_TIDAK_VALID');
  });

  it('guard menolak tanpa sesi dan dengan cookie rusak', async () => {
    const tanpaSesi = await adminTestRoute(req('/api/admin/test'));
    expect(tanpaSesi.status).toBe(401);
    expect((await tanpaSesi.json()).kode).toBe('TANPA_SESI');

    const rusak = await adminTestRoute(req('/api/admin/test', { cookie: '-ngawur' }));
    expect(rusak.status).toBe(401);
    expect((await rusak.json()).kode).toBe('SESI_TIDAK_VALID');
  });

  it('guard/context memberi peran yang benar ke handler', async () => {
    const cookieSuper = await login();
    const superRes = await adminTestRoute(req('/api/admin/test', { cookie: cookieSuper }));
    const body = await superRes.json();
    expect(body.peran).toBe('SUPER_ADMIN');
    expect(body.izinSuper).toBe(true);
  });

  it('LOGIN tetap memakai pesan generik untuk Origin salah (tidak membocorkan)', async () => {
    const fd = new FormData();
    fd.set('username', 'superadmin');
    fd.set('password', PASSWORD_SEED);
    const res = await loginRoute(req('/api/login', { method: 'POST', body: fd, origin: `${APP_ORIGIN}.evil.com` }));
    expect(res.status).toBe(403);
    // Pesannya harus sama dengan kegagalan kredensial, bukan "Akses ditolak.".
    expect((await res.json()).pesan).toBe('Username atau password salah.');
  });
});
