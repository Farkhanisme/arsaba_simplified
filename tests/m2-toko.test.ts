process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import { catatAudit } from '../src/server/audit';
import { serialisasiWIB } from '../src/server/waktu';
import { GET as daftarToko, POST as tambahToko } from '../src/app/api/admin/master/toko/route';
import { PUT as ubahToko } from '../src/app/api/admin/master/toko/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as tambahKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { POST as pindah } from '../src/app/api/admin/master/penempatan/route';

const DB_PATH = 'data/uji_m2_toko.db';
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
  const setCookie = res.headers.get('set-cookie') || '';
  return /sesi=([^;]+)/.exec(setCookie)![1]!;
}

describe('M2 toko', () => {
  let cookie = '';

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieSuperadmin();
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('tambah toko lalu terbaca di daftar', async () => {
    const tambah = await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Mawar' }, cookie }));
    expect(tambah.status).toBe(201);
    const daftar = await daftarToko(req('/api/admin/master/toko', { cookie }));
    const nama = ((await daftar.json()).data as { nama: string }[]).map((t) => t.nama);
    expect(nama).toContain('Toko Mawar');
  });

  it('nama ganda ditolak 409 DAN oleh database langsung', async () => {
    const ulang = await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Mawar' }, cookie }));
    expect(ulang.status).toBe(409);
    expect((await ulang.json()).pesan).toBe('Nama toko sudah dipakai.');
    // Bukti database (bukan hanya aplikasi): INSERT langsung ikut ditolak.
    const db = getDb();
    await expect(
      db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko Mawar', '2026-09-30T07:00:00+07:00'] }),
    ).rejects.toThrow();
  });

  it('ubah nama dan nonaktifkan lewat PUT', async () => {
    const daftar = (await (await daftarToko(req('/api/admin/master/toko', { cookie }))).json()).data as { id: number; nama: string }[];
    const id = daftar.find((t) => t.nama === 'Toko Mawar')!.id;
    const ubah = await ubahToko(req(`/api/admin/master/toko/${id}`, { method: 'PUT', body: { nama: 'Toko Melati', aktif: 0 }, cookie }));
    expect(ubah.status).toBe(200);
    expect(((await ubah.json()).data as { nama: string }).nama).toBe('Toko Melati');
  });

  it('penempatan ke toko nonaktif ditolak', async () => {
    const kry = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Karyawan Nonaktif' }, cookie }));
    const karyawanId = ((await kry.json()).data as { id: number }).id;
    const p = await pindah(
      req('/api/admin/master/penempatan', { method: 'POST', body: { karyawan_id: karyawanId, toko_tujuan_id: 1, tanggal_efektif: '2026-09-01' }, cookie }),
    );
    // Toko id 1 = 'Toko Melati' yang sudah dinonaktifkan di tes sebelumnya.
    expect(p.status).toBe(400);
    expect((await p.json()).pesan).toMatch(/nonaktif/);
  });

  it('setiap mutasi tercatat di audit_log dengan before/after benar', async () => {
    const db = getDb();
    const tambah = await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Audit' }, cookie }));
    const id = ((await tambah.json()).data as { id: number }).id;
    const auditTambah = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'toko' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [id] });
    const baris = auditTambah.rows[0] as unknown as { aksi: string; sebelum: string | null; sesudah: string };
    expect(baris.aksi).toBe('TOKO_TAMBAH');
    expect(JSON.parse(baris.sesudah as string).nama).toBe('Toko Audit');

    await ubahToko(req(`/api/admin/master/toko/${id}`, { method: 'PUT', body: { nama: 'Toko Audit 2' }, cookie }));
    const auditUbah = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'toko' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [id] });
    const baris2 = auditUbah.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris2.aksi).toBe('TOKO_UBAH');
    expect(JSON.parse(baris2.sebelum as string).nama).toBe('Toko Audit');
    expect(JSON.parse(baris2.sesudah as string).nama).toBe('Toko Audit 2');
  });

  it('mutasi + audit yang di-ROLLBACK tidak meninggalkan jejak', async () => {
    const db = getDb();
    const hitungSebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE aksi = 'TOKO_ROLLBACK'", args: [] });
    await expect(
      denganTransaksi(async (tx) => {
        await tx.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko Batal', '2026-09-30T07:00:00+07:00'] });
        await catatAudit({ waktu: serialisasiWIB(), pengguna_id: 1, aksi: 'TOKO_ROLLBACK', entitas: 'toko' }, tx);
        throw new Error('paksa rollback');
      }),
    ).rejects.toThrow('paksa rollback');
    const toko = await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: ['Toko Batal'] });
    expect(toko.rows.length).toBe(0);
    const hitungSesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE aksi = 'TOKO_ROLLBACK'", args: [] });
    expect(Number((hitungSesudah.rows[0] as Record<string, unknown>)['c'])).toBe(
      Number((hitungSebelum.rows[0] as Record<string, unknown>)['c']),
    );
  });
});
