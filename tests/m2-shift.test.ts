process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { GET as daftarShift, POST as tambahShift } from '../src/app/api/admin/master/shift/route';
import { PUT as ubahShift } from '../src/app/api/admin/master/shift/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as tambahToko } from '../src/app/api/admin/master/toko/route';

const DB_PATH = 'data/uji_m2_shift.db';
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

describe('M2 shift — BR-T3 dan BR-J1', () => {
  let cookie = '';
  let tokoId = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieSuperadmin();
    const t = await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Shift' }, cookie }));
    tokoId = ((await t.json()).data as { id: number }).id;
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('BR-T3: jam_mulai = jam_selesai DITOLAK', async () => {
    const res = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Pagi', tipe_hari: 'SEMUA', jam_mulai: '07:00', jam_selesai: '07:00' }, cookie }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).pesan).toMatch(/tidak boleh sama/);
  });

  it('BR-T3: jam_selesai < jam_mulai DITERIMA (lintas tengah malam)', async () => {
    const res = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Malam', tipe_hari: 'SEMUA', jam_mulai: '22:00', jam_selesai: '06:00' }, cookie }),
    );
    expect(res.status).toBe(201);
  });

  it('BR-J1: SEMUA + WEEKDAY bernama sama DITOLAK', async () => {
    const semua = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Pagi', tipe_hari: 'SEMUA', jam_mulai: '07:00', jam_selesai: '17:00' }, cookie }),
    );
    expect(semua.status).toBe(201);
    const weekday = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Pagi', tipe_hari: 'WEEKDAY', jam_mulai: '07:00', jam_selesai: '17:00' }, cookie }),
    );
    expect(weekday.status).toBe(409);
    expect((await weekday.json()).pesan).toMatch(/Semua Hari/);
  });

  it('BR-J1: WEEKDAY + WEEKEND bernama sama DITERIMA', async () => {
    const wd = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Sore', tipe_hari: 'WEEKDAY', jam_mulai: '14:00', jam_selesai: '22:00' }, cookie }),
    );
    expect(wd.status).toBe(201);
    const we = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Sore', tipe_hari: 'WEEKEND', jam_mulai: '15:00', jam_selesai: '23:00' }, cookie }),
    );
    expect(we.status).toBe(201);
  });

  it('PUT menjadi tipe bentrok ditolak', async () => {
    const daftar = (await (await daftarShift(req(`/api/admin/master/shift?toko_id=${tokoId}`, { cookie }))).json()).data as { id: number; nama: string; tipe_hari: string }[];
    const soreWeekend = daftar.find((s) => s.nama === 'Sore' && s.tipe_hari === 'WEEKEND')!;
    // Ubah "Sore/WEEKEND" menjadi SEMUA — bentrok dengan "Sore/WEEKDAY".
    const res = await ubahShift(req(`/api/admin/master/shift/${soreWeekend.id}`, { method: 'PUT', body: { tipe_hari: 'SEMUA' }, cookie }));
    expect(res.status).toBe(409);
  });

  it('database menolak duplikat (toko, nama, tipe) dan jam sama via CHECK', async () => {
    const db = getDb();
    await expect(
      db.execute({
        sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, 'Unik', 'SEMUA', '07:00', '17:00', 1, '2026-09-30T07:00:00+07:00')",
        args: [tokoId],
      }),
    ).resolves.toBeTruthy();
    await expect(
      db.execute({
        sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, 'Unik', 'SEMUA', '08:00', '18:00', 1, '2026-09-30T07:00:00+07:00')",
        args: [tokoId],
      }),
    ).rejects.toThrow();
    await expect(
      db.execute({
        sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, 'Cek', 'SEMUA', '07:00', '07:00', 1, '2026-09-30T07:00:00+07:00')",
        args: [tokoId],
      }),
    ).rejects.toThrow();
  });

  it('mutasi shift tercatat di audit dengan isi benar', async () => {
    const db = getDb();
    const res = await tambahShift(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'Audit', tipe_hari: 'SEMUA', jam_mulai: '08:00', jam_selesai: '16:00' }, cookie }),
    );
    const id = ((await res.json()).data as { id: number }).id;
    const audit = await db.execute({ sql: "SELECT aksi, sesudah FROM audit_log WHERE entitas = 'shift_template' AND entitas_id = ?", args: [id] });
    const baris = audit.rows[0] as unknown as { aksi: string; sesudah: string };
    expect(baris.aksi).toBe('SHIFT_TAMBAH');
    const sesudah = JSON.parse(baris.sesudah as string) as { nama: string; jam_mulai: string };
    expect(sesudah.nama).toBe('Audit');
    expect(sesudah.jam_mulai).toBe('08:00');
  });
});
