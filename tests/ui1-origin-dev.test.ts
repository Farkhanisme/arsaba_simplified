process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { originDiterima } from '../src/server/guard';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_origin_dev.db';
const PROD_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const DEV_ORIGIN = 'http://localhost:3000';

// process.env.NODE_ENV bertipe readonly di @types/node — tulis lewat alias.
const ENV = process.env as Record<string, string | undefined>;
function setNodeEnv(v: string | undefined) {
  if (v === undefined) delete ENV['NODE_ENV'];
  else ENV['NODE_ENV'] = v;
}

function reqLogin(origin: string | null, username: string, password: string) {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd });
}

describe('BUG-UI-02 jalur Origin development', () => {
  const simpanNodeEnv = process.env['NODE_ENV'];
  const simpanDev = process.env['APP_ORIGIN_DEV'];

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  beforeEach(() => {
    delete process.env['APP_ORIGIN_DEV'];
  });

  afterEach(() => {
    setNodeEnv(simpanNodeEnv);
    if (simpanDev === undefined) delete process.env['APP_ORIGIN_DEV'];
    else process.env['APP_ORIGIN_DEV'] = simpanDev;
  });

  it('produksi: Origin tidak persis TETAP 403 walau APP_ORIGIN_DEV diset', () => {
    setNodeEnv('production');
    process.env['APP_ORIGIN_DEV'] = DEV_ORIGIN;
    // APP_ORIGIN_DEV diabaikan total di produksi.
    expect(originDiterima(DEV_ORIGIN)).toBe(false);
    expect(originDiterima(`${PROD_ORIGIN}.penyerang.com`)).toBe(false);
    expect(originDiterima('')).toBe(false);
    expect(originDiterima(PROD_ORIGIN)).toBe(true);
  });

  it('development TANPA APP_ORIGIN_DEV: mismatch tetap 403', () => {
    setNodeEnv('development');
    expect(originDiterima(DEV_ORIGIN)).toBe(false);
    expect(originDiterima(PROD_ORIGIN)).toBe(true);
  });

  it('development DENGAN APP_ORIGIN_DEV: dev origin diterima, produksi tetap diterima, lainnya 403', () => {
    setNodeEnv('development');
    process.env['APP_ORIGIN_DEV'] = DEV_ORIGIN;
    expect(originDiterima(DEV_ORIGIN)).toBe(true);
    expect(originDiterima(PROD_ORIGIN)).toBe(true);
    expect(originDiterima('http://localhost:3001')).toBe(false);
    expect(originDiterima('')).toBe(false);
  });

  it('login: Origin ditolak tetap berpesan generik (BR-AUTH tidak bocor)', async () => {
    setNodeEnv('development');
    const res = await loginRoute(reqLogin('http://situs-asing.test', 'superadmin', 'test1234'));
    expect(res.status).toBe(403);
    expect((await res.json()).pesan).toBe('Username atau password salah.');
  });

  it('login BERHASIL dengan APP_ORIGIN development yang benar', async () => {
    setNodeEnv('development');
    process.env['APP_ORIGIN_DEV'] = DEV_ORIGIN;
    const res = await loginRoute(reqLogin(DEV_ORIGIN, 'superadmin', 'test1234'));
    expect(res.status).toBe(200);
  });
});
