process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';

// `useRouter` dari next/navigation melempar "expected app router to be mounted"
// di luar pohon Next. Yang di-mock adalah RUNTIME Next, bukan kode kita —
// supaya komponen bisa dirender dan yang diuji adalah isi halamannya.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as ubahPasswordRoute } from '../src/app/api/admin/ubah-password/route';
import { getDb } from '../src/server/db';

const DB_PATH = 'data/uji_ganti_password.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const PASSWORD_SEED = process.env['SEED_PASSWORD'] || 'test1234';

function req(
  url: string,
  opsi: { method?: string; body?: FormData; cookie?: string; origin?: string | null } = {},
) {
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
  const m = /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  if (!m) throw new Error('set-cookie tidak memuat sesi');
  return m[1]!;
}

async function login(username: string, password: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const res = await loginRoute(req('/api/login', { method: 'POST', body: fd }));
  if (res.status !== 200) throw new Error(`login ${username} gagal: ${res.status}`);
  return cookieDari(res);
}

function formGanti(saatIni: string, baru: string, konfirmasi = baru) {
  const fd = new FormData();
  fd.set('passwordSaatIni', saatIni);
  fd.set('passwordBaru', baru);
  fd.set('konfirmasi', konfirmasi);
  return fd;
}

describe('ganti password M1 (menegakkan BR-AUTH3, K-47, K-48)', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('halaman /admin/ubah-password benar-benar bisa dirender dan menjelaskan K-47 serta K-48', async () => {
    // Dulu tes ini `expect(true).toBe(true)`, lalu diganti `existsSync(file)`.
    // Keduanya memeriksa bentuk, bukan perilaku: existsSync tetap lulus untuk file
    // yang isinya rusak atau import-nya tidak ketemu.
    // Sekarang halamannya benar-benar DIRENDER, lalu diperiksa teks yang dilihat user.
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { default: UbahPasswordPage } = await import('../src/app/admin/ubah-password/page');

    // Komponen harus dijalankan DI DALAM render React, jadi elemennya yang
    // diteruskan — bukan memanggil UbahPasswordPage() langsung, yang akan
    // melempar "Cannot read properties of null (reading 'useContext')".
    const html = renderToStaticMarkup(createElement(UbahPasswordPage));

    // K-47 harus terlihat oleh user, bukan hanya berlaku diam-diam di server.
    expect(html).toContain('seluruh sesi akun ini berakhir');
    // Tiga input dengan nama yang sama persis dengan yang dibaca route.
    for (const name of ['passwordSaatIni', 'passwordBaru', 'konfirmasi']) {
      expect(html, `input ${name} harus ada`).toContain(`name="${name}"`);
    }
    // K-48 harus sampai ke browser lewat minLength, bukan hanya divalidasi di server.
    expect(html.match(/minLength="8"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Minimal 8 karakter.');
    expect(html).toContain('Simpan');
  });

  it('halaman menolak password baru kurang dari 8 karakter (K-48)', async () => {
    const cookie = await login('superadmin', PASSWORD_SEED);
    const res = await ubahPasswordRoute(
      req('/api/admin/ubah-password', {
        method: 'POST',
        body: formGanti(PASSWORD_SEED, 'pendek7'),
        cookie,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).kode).toBe('PASSWORD_PENDEK');
  });

  it('halaman menolak password saat ini yang salah', async () => {
    const cookie = await login('superadmin', PASSWORD_SEED);
    const res = await ubahPasswordRoute(
      req('/api/admin/ubah-password', {
        method: 'POST',
        body: formGanti('bukan-password-ini', 'passwordbaru123'),
        cookie,
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).kode).toBe('GANTI_PASSWORD_GAGAL');
  });

  it('ganti password membatalkan seluruh sesi akun itu (K-47)', async () => {
    const s1 = await login('admin', PASSWORD_SEED);
    const s2 = await login('admin', PASSWORD_SEED);
    expect(s1).not.toBe(s2);

    const res = await ubahPasswordRoute(
      req('/api/admin/ubah-password', {
        method: 'POST',
        body: formGanti(PASSWORD_SEED, 'passwordbaru123'),
        cookie: s1,
      }),
    );
    expect(res.status).toBe(200);

    const db = getDb();
    const sisa = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM sesi_admin WHERE pengguna_id = (SELECT id FROM pengguna_admin WHERE username = ?)',
      args: ['admin'],
    });
    expect(Number((sisa.rows[0] as Record<string, unknown>)['c'])).toBe(0);
  });

  it('audit ganti password tidak memuat password maupun hash (BR-AU2)', async () => {
    const db = getDb();
    const res = await db.execute({
      sql: "SELECT sebelum, sesudah, catatan FROM audit_log WHERE aksi = 'GANTI_PASSWORD'",
      args: [],
    });
    expect(res.rows.length).toBeGreaterThan(0);
    const gabung = JSON.stringify(res.rows);
    expect(gabung).not.toContain(PASSWORD_SEED);
    expect(gabung).not.toContain('passwordbaru123');
    expect(gabung.toLowerCase()).not.toContain('hash');
  });
});
