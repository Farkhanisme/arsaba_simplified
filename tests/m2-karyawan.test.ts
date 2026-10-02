process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { GET as daftarKaryawan, POST as tambahKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { GET as detailKaryawan, PUT as ubahKaryawan } from '../src/app/api/admin/master/karyawan/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m2_karyawan.db';
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

describe('M2 karyawan — K-34 enam field', () => {
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

  it('enam field tersimpan dan terbaca persis, termasuk berisi spasi', async () => {
    const badan = {
      nama: 'Budi  Santoso',
      nik: '3174 0501 9001',
      jabatan: 'Kasir  Senior',
      alamat: 'Jl. Mawar  No. 10',
      nomor_hp: '0812 3456 7890',
      kontak_darurat: 'Ibu  Ani - 0819 0000 1111',
    };
    const tambah = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: badan, cookie }));
    expect(tambah.status).toBe(201);
    const id = ((await tambah.json()).data as { id: number }).id;
    const detail = await detailKaryawan(req(`/api/admin/master/karyawan/${id}`, { cookie }));
    const baca = ((await detail.json()).data as Record<string, unknown>);
    expect(baca['nama']).toBe(badan.nama);
    expect(baca['nik']).toBe(badan.nik);
    expect(baca['jabatan']).toBe(badan.jabatan);
    expect(baca['alamat']).toBe(badan.alamat);
    expect(baca['nomor_hp']).toBe(badan.nomor_hp);
    expect(baca['kontak_darurat']).toBe(badan.kontak_darurat);
  });

  it('NIK ganda ditolak; NIK kosong pada dua karyawan diterima', async () => {
    const a = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Tanpa NIK Satu' }, cookie }));
    expect(a.status).toBe(201);
    const b = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Tanpa NIK Dua', nik: null }, cookie }));
    expect(b.status).toBe(201);

    const c = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Ber-NIK', nik: 'NIK-UNIK-1' }, cookie }));
    expect(c.status).toBe(201);
    const d = await tambahKaryawan(req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'NIK Sama', nik: 'NIK-UNIK-1' }, cookie }));
    expect(d.status).toBe(409);
    expect((await d.json()).pesan).toBe('NIK sudah dipakai karyawan lain.');

    // Bukti database: NIK ganda ditolak constraint, NULL ganda diterima.
    const db = getDb();
    await expect(
      db.execute({ sql: "INSERT INTO karyawan (nama, nik, aktif, dibuat_at) VALUES ('X', 'NIK-UNIK-1', 1, '2026-09-30T07:00:00+07:00')", args: [] }),
    ).rejects.toThrow();
    await db.execute({ sql: "INSERT INTO karyawan (nama, nik, aktif, dibuat_at) VALUES ('Y', NULL, 1, '2026-09-30T07:00:00+07:00')", args: [] });
    await db.execute({ sql: "INSERT INTO karyawan (nama, nik, aktif, dibuat_at) VALUES ('Z', NULL, 1, '2026-09-30T07:00:00+07:00')", args: [] });
  });

  it('ubah + nonaktifkan, tercatat audit before/after', async () => {
    const daftar = (await (await daftarKaryawan(req('/api/admin/master/karyawan', { cookie }))).json()).data as { id: number; nama: string }[];
    const target = daftar.find((k) => k.nama === 'Ber-NIK')!;
    const ubah = await ubahKaryawan(req(`/api/admin/master/karyawan/${target.id}`, { method: 'PUT', body: { jabatan: 'SPG', aktif: 0 }, cookie }));
    expect(ubah.status).toBe(200);
    const sesudah = ((await ubah.json()).data as { jabatan: string; aktif: number });
    expect(sesudah.jabatan).toBe('SPG');
    expect(sesudah.aktif).toBe(0);

    const db = getDb();
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'karyawan' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [target.id] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris.aksi).toBe('KARYAWAN_UBAH');
    expect(JSON.parse(baris.sebelum as string).aktif).toBe(1);
    expect(JSON.parse(baris.sesudah as string).aktif).toBe(0);
  });
});
