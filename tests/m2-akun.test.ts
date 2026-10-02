process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { GET as adminTest } from '../src/app/api/admin/test/route';
import { GET as daftarAkun, POST as tambahAkun } from '../src/app/api/admin/akun/route';
import { GET as detailAkun, PUT as ubahAkun } from '../src/app/api/admin/akun/[id]/route';
import { POST as resetPassword } from '../src/app/api/admin/akun/[id]/reset/route';

const DB_PATH = 'data/uji_m2_akun.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

function req(url: string, opsi: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  headers.set('content-type', 'application/json');
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`https://arsaba.vercel.app${url}`, {
    method: opsi.method ?? 'GET',
    headers,
    body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
  });
}

function reqLogin(username: string, password: string) {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  return new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd });
}

async function cookieUntuk(username: string, password: string): Promise<string> {
  const res = await loginRoute(reqLogin(username, password));
  if (res.status !== 200) throw new Error(`login gagal untuk ${username}: ${res.status}`);
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M2 akun admin — K-48, tanpa bocor password', () => {
  let cookie = '';

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieUntuk('superadmin', 'test1234');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('password < 8 karakter ditolak di server', async () => {
    const res = await tambahAkun(req('/api/admin/akun', { method: 'POST', body: { username: 'pendek', password: '1234567', nama: 'Pendek', peran: 'ADMIN' }, cookie }));
    expect(res.status).toBe(400);
    expect((await res.json()).pesan).toMatch(/8 karakter/);
  });

  it('buat akun: password tampil sekali, hash tidak pernah keluar', async () => {
    const res = await tambahAkun(
      req('/api/admin/akun', { method: 'POST', body: { username: 'operator1', password: 'rahasia123', nama: 'Operator Satu', peran: 'ADMIN' }, cookie }),
    );
    expect(res.status).toBe(201);
    const data = ((await res.json()).data as { id: number; password: string });
    expect(data.password).toBe('rahasia123');

    const daftar = (await (await daftarAkun(req('/api/admin/akun', { cookie }))).json()).data as Record<string, unknown>[];
    const baris = daftar.find((a) => a['username'] === 'operator1')!;
    expect('password_hash' in baris).toBe(false);
    expect('password' in baris).toBe(false);

    const detail = await detailAkun(req(`/api/admin/akun/${data.id}`, { cookie }));
    const isi = ((await detail.json()).data as Record<string, unknown>);
    expect('password_hash' in isi).toBe(false);
  });

  it('password dan hash tidak pernah muncul di audit_log', async () => {
    const db = getDb();
    const hashRes = await db.execute({ sql: "SELECT password_hash FROM pengguna_admin WHERE username = 'operator1'", args: [] });
    const hash = String((hashRes.rows[0] as Record<string, unknown>)['password_hash']);
    const audit = await db.execute({ sql: "SELECT sebelum, sesudah, catatan FROM audit_log WHERE entitas = 'pengguna_admin'", args: [] });
    expect(audit.rows.length).toBeGreaterThan(0);
    for (const baris of audit.rows) {
      const r = baris as Record<string, unknown>;
      const gabung = `${(r['sebelum'] as string | null) ?? ''} ${(r['sesudah'] as string | null) ?? ''} ${(r['catatan'] as string | null) ?? ''}`;
      expect(gabung).not.toContain('rahasia123');
      expect(gabung).not.toContain(hash);
    }
  });

  it('reset password membatalkan seluruh sesi akun itu', async () => {
    // Dua sesi aktif untuk operator1.
    const c1 = await cookieUntuk('operator1', 'rahasia123');
    const c2 = await cookieUntuk('operator1', 'rahasia123');
    expect((await adminTest(req('/api/admin/test', { cookie: c1 }))).status).toBe(200);

    const target = (await (await daftarAkun(req('/api/admin/akun', { cookie }))).json()).data as { id: number; username: string }[];
    const id = target.find((a) => a.username === 'operator1')!.id;
    const reset = await resetPassword(req(`/api/admin/akun/${id}/reset`, { method: 'POST', body: { password: 'barubanget1' }, cookie }));
    expect(reset.status).toBe(200);
    const hasil = ((await reset.json()).data as { sesi_dibatalkan: number; password: string });
    expect(hasil.sesi_dibatalkan).toBeGreaterThanOrEqual(2);
    expect(hasil.password).toBe('barubanget1');

    // Kedua sesi lama mati.
    expect((await adminTest(req('/api/admin/test', { cookie: c1 }))).status).toBe(401);
    expect((await adminTest(req('/api/admin/test', { cookie: c2 }))).status).toBe(401);
    // Password baru berlaku, lama tidak.
    await expect(cookieUntuk('operator1', 'rahasia123')).rejects.toThrow();
    const cBaru = await cookieUntuk('operator1', 'barubanget1');
    expect((await adminTest(req('/api/admin/test', { cookie: cBaru }))).status).toBe(200);
  });

  it('nonaktifkan akun: login lalu ditolak', async () => {
    const target = (await (await daftarAkun(req('/api/admin/akun', { cookie }))).json()).data as { id: number; username: string }[];
    const id = target.find((a) => a.username === 'operator1')!.id;
    const ubah = await ubahAkun(req(`/api/admin/akun/${id}`, { method: 'PUT', body: { aktif: 0 }, cookie }));
    expect(ubah.status).toBe(200);
    await expect(cookieUntuk('operator1', 'barubanget1')).rejects.toThrow();
  });
});
