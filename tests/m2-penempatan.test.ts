process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as tambahToko } from '../src/app/api/admin/master/toko/route';
import { POST as tambahKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { GET as riwayat, POST as pindah } from '../src/app/api/admin/master/penempatan/route';

const DB_PATH = 'data/uji_m2_penempatan.db';
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

async function buatKaryawan(cookie: string, nama: string): Promise<number> {
  const res = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama }, cookie }));
  return ((await res.json()).data as { id: number }).id;
}

async function pindahkan(cookie: string, karyawanId: number, tokoId: number, tanggal: string) {
  return pindah(req('/api/admin/master/penempatan', { method: 'POST', body: { karyawan_id: karyawanId, toko_tujuan_id: tokoId, tanggal_efektif: tanggal }, cookie }));
}

describe('M2 penempatan — BR-P1, BR-P2, BR-P3/K-35', () => {
  let cookie = '';
  let tokoA = 0;
  let tokoB = 0;
  let kry = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieSuperadmin();
    tokoA = ((await (await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko A' }, cookie }))).json()).data as { id: number }).id;
    tokoB = ((await (await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko B' }, cookie }))).json()).data as { id: number }).id;
    kry = await buatKaryawan(cookie, 'Karyawan Pindah');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('penempatan awal dibuat; pindah menutup lama dan membuka baru', async () => {
    const awal = await pindahkan(cookie, kry, tokoA, '2026-09-01');
    expect(awal.status).toBe(201);
    const dataAwal = ((await awal.json()).data as { lama: null; baru: { berlaku_mulai: string; berlaku_sampai: string | null } });
    expect(dataAwal.lama).toBeNull();
    expect(dataAwal.baru.berlaku_mulai).toBe('2026-09-01');
    expect(dataAwal.baru.berlaku_sampai).toBeNull();

    const pindahB = await pindahkan(cookie, kry, tokoB, '2026-10-01');
    expect(pindahB.status).toBe(201);
    const dataB = ((await pindahB.json()).data as { lama: { berlaku_sampai: string }; baru: { toko_id: number } });
    expect(dataB.lama.berlaku_sampai).toBe('2026-09-30');
    expect(dataB.baru.toko_id).toBe(tokoB);

    // Tepat satu penempatan terbuka.
    const db = getDb();
    const terbuka = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM karyawan_penempatan WHERE karyawan_id = ? AND berlaku_sampai IS NULL', args: [kry] });
    expect(Number((terbuka.rows[0] as Record<string, unknown>)['c'])).toBe(1);
  });

  it('BR-P1: database menolak penempatan terbuka kedua', async () => {
    const db = getDb();
    await expect(
      db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai, berlaku_sampai) VALUES (?, ?, ?, NULL)', args: [kry, tokoA, '2026-11-01'] }),
    ).rejects.toThrow();
  });

  it('BR-P2: tanggal efektif harus setelah mulai berjalan; overlap riwayat ditolak', async () => {
    // Efektif sama dengan mulai berjalan → ditolak lebih dulu.
    const dini = await pindahkan(cookie, kry, tokoA, '2026-10-01');
    expect(dini.status).toBe(400);
    expect((await dini.json()).pesan).toMatch(/setelah tanggal mulai/);

    // Sisipkan riwayat tertutup di masa depan, lalu pindah menabraknya.
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai, berlaku_sampai) VALUES (?, ?, ?, ?)',
      args: [kry, tokoA, '2026-12-01', '2026-12-31'],
    });
    const tabrak = await pindahkan(cookie, kry, tokoA, '2026-12-15');
    expect(tabrak.status).toBe(400);
    expect((await tabrak.json()).pesan).toMatch(/tumpang tindih/);
    await db.execute({ sql: 'DELETE FROM karyawan_penempatan WHERE karyawan_id = ? AND berlaku_mulai = ?', args: [kry, '2026-12-01'] });
  });

  it('BR-P3/K-35: pindah DIBLOKIR saat masih ada jadwal di toko lama', async () => {
    const db = getDb();
    const admin = await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] });
    const adminId = Number((admin.rows[0] as Record<string, unknown>)['id']);
    // Sisipkan jadwal langsung (tanpa membangun fitur jadwal M5).
    await db.execute({
      sql: "INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, '2026-10-05', NULL, 1, ?, '2026-09-30T07:00:00+07:00')",
      args: [kry, tokoB, adminId],
    });

    const res = await pindahkan(cookie, kry, tokoA, '2026-10-03');
    expect(res.status).toBe(409);
    expect((await res.json()).pesan).toMatch(/masih memiliki jadwal di toko lama/);
  });

  it('BR-P3/K-35: setelah jadwal dihapus, pemindahan BERJALAN', async () => {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM jadwal WHERE karyawan_id = ? AND toko_id = ?', args: [kry, tokoB] });
    const res = await pindahkan(cookie, kry, tokoA, '2026-10-03');
    expect(res.status).toBe(201);

    const daftar = (await (await riwayat(req(`/api/admin/master/penempatan?karyawan_id=${kry}`, { cookie }))).json()).data as { toko_id: number; berlaku_sampai: string | null }[];
    const terbuka = daftar.filter((p) => p.berlaku_sampai === null);
    expect(terbuka.length).toBe(1);
    expect(terbuka[0]!.toko_id).toBe(tokoA);
  });

  it('pemindahan tercatat di audit dengan before/after', async () => {
    const db = getDb();
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'karyawan_penempatan' ORDER BY id DESC LIMIT 1", args: [] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris.aksi).toBe('PENEMPATAN_PINDAH');
    expect(JSON.parse(baris.sebelum as string).toko_id).toBe(tokoB);
    expect(JSON.parse(baris.sesudah as string).toko_id).toBe(tokoA);
  });
});
