process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as tambahKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { GET as lihatLink, POST as buatLink } from '../src/app/api/admin/master/link/route';
import { POST as buatUlang } from '../src/app/api/admin/master/link/buat-ulang/route';
import { POST as cabut } from '../src/app/api/admin/master/link/cabut/route';
import { buatUlangLink } from '../src/server/repo/link';

const DB_PATH = 'data/uji_m2_link.db';
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

async function cookieSuperadmin(): Promise<string> {
  const fd = new FormData();
  fd.set('username', 'superadmin');
  fd.set('password', 'test1234');
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M2 link — BR-LK1, BR-LK2, BR-LK3', () => {
  let cookie = '';
  let kry = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieSuperadmin();
    const res = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Karyawan Link' }, cookie }));
    kry = ((await res.json()).data as { id: number }).id;
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('buat link: URL /a/{token}, token 32 byte; link kedua ditolak', async () => {
    const buat = await buatLink(req('/api/admin/master/link', { method: 'POST', body: { karyawan_id: kry }, cookie }));
    expect(buat.status).toBe(201);
    const data = ((await buat.json()).data as { url: string });
    expect(data.url).toMatch(/^https:\/\/arsaba\.vercel\.app\/a\//);

    const db = getDb();
    const simpan = await db.execute({ sql: 'SELECT token FROM karyawan_link WHERE karyawan_id = ? AND dicabut_at IS NULL', args: [kry] });
    const token = String((simpan.rows[0] as Record<string, unknown>)['token']);
    // BR-LK1: minimal 32 byte.
    expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(32);

    const kedua = await buatLink(req('/api/admin/master/link', { method: 'POST', body: { karyawan_id: kry }, cookie }));
    expect(kedua.status).toBe(409);
  });

  it('database menolak link aktif kedua (partial unique index)', async () => {
    const db = getDb();
    await expect(
      db.execute({ sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at) VALUES (?, ?, ?, 1, NULL)', args: [kry, 'token-lain', '2026-09-30T07:00:00+07:00'] }),
    ).rejects.toThrow();
  });

  it('buat ulang: mencabut lama DAN membuat baru; hanya satu aktif', async () => {
    const lihatLama = (await (await lihatLink(req(`/api/admin/master/link?karyawan_id=${kry}`, { cookie }))).json()).data as { url: string };
    const ulang = await buatUlang(req('/api/admin/master/link/buat-ulang', { method: 'POST', body: { karyawan_id: kry }, cookie }));
    expect(ulang.status).toBe(201);
    const urlBaru = ((await ulang.json()).data as { url: string }).url;
    expect(urlBaru).not.toBe(lihatLama.url);

    const db = getDb();
    const aktif = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM karyawan_link WHERE karyawan_id = ? AND dicabut_at IS NULL', args: [kry] });
    expect(Number((aktif.rows[0] as Record<string, unknown>)['c'])).toBe(1);
    const semua = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM karyawan_link WHERE karyawan_id = ?', args: [kry] });
    expect(Number((semua.rows[0] as Record<string, unknown>)['c'])).toBe(2);
  });

  it('satu transaksi: bila pembuatan baru gagal, link lama TIDAK ikut tercabut', async () => {
    const db = getDb();
    // Karyawan kedua dengan token yang akan dipakai menabrak UNIQUE.
    const res2 = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Karyawan Tabrakan' }, cookie }));
    const kry2 = ((await res2.json()).data as { id: number }).id;
    await buatLink(req('/api/admin/master/link', { method: 'POST', body: { karyawan_id: kry2 }, cookie }));
    const token2Res = await db.execute({ sql: 'SELECT token FROM karyawan_link WHERE karyawan_id = ?', args: [kry2] });
    const token2 = String((token2Res.rows[0] as Record<string, unknown>)['token']);
    const tokenLamaRes = await db.execute({ sql: 'SELECT token FROM karyawan_link WHERE karyawan_id = ? AND dicabut_at IS NULL', args: [kry] });
    const tokenLama = String((tokenLamaRes.rows[0] as Record<string, unknown>)['token']);

    // Paksa INSERT baru gagal (token duplikat) di dalam SATU transaksi —
    // persis pola yang dipakai route buat-ulang.
    await expect(
      denganTransaksi(async (tx) => {
        await buatUlangLink(kry, token2, 1, '2026-09-30T07:00:00+07:00', tx);
      }),
    ).rejects.toThrow();

    // Link lama masih aktif dan tidak berubah.
    const masih = await db.execute({ sql: 'SELECT token FROM karyawan_link WHERE karyawan_id = ? AND dicabut_at IS NULL', args: [kry] });
    expect(masih.rows.length).toBe(1);
    expect(String((masih.rows[0] as Record<string, unknown>)['token'])).toBe(tokenLama);
  });

  it('BR-LK3: token tidak pernah masuk audit_log', async () => {
    const db = getDb();
    const semuaToken = await db.execute({ sql: 'SELECT token FROM karyawan_link', args: [] });
    const daftarToken = semuaToken.rows.map((r) => String((r as Record<string, unknown>)['token']));
    expect(daftarToken.length).toBeGreaterThan(0);
    const audit = await db.execute({ sql: "SELECT sebelum, sesudah, catatan FROM audit_log WHERE entitas = 'karyawan_link'", args: [] });
    expect(audit.rows.length).toBeGreaterThan(0);
    for (const baris of audit.rows) {
      const r = baris as Record<string, unknown>;
      const gabung = `${(r['sebelum'] as string | null) ?? ''} ${(r['sesudah'] as string | null) ?? ''} ${(r['catatan'] as string | null) ?? ''}`;
      for (const token of daftarToken) {
        expect(gabung).not.toContain(token);
      }
    }
  });

  it('cabut link lalu buat baru (bukan buat ulang) berjalan', async () => {
    const cabutRes = await cabut(req('/api/admin/master/link/cabut', { method: 'POST', body: { karyawan_id: kry }, cookie }));
    expect(cabutRes.status).toBe(200);
    const lihat = await lihatLink(req(`/api/admin/master/link?karyawan_id=${kry}`, { cookie }));
    expect(((await lihat.json()).data as null)).toBeNull();
    const buat = await buatLink(req('/api/admin/master/link', { method: 'POST', body: { karyawan_id: kry }, cookie }));
    expect(buat.status).toBe(201);
  });
});
