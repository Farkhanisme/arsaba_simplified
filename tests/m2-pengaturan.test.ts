process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { POST as loginRoute } from '../src/app/api/login/route';
import { GET as bacaPengaturan, PUT as ubahPengaturan } from '../src/app/api/admin/pengaturan/route';
import { GET as daftarToko, POST as tambahToko } from '../src/app/api/admin/master/toko/route';
import { GET as daftarShift } from '../src/app/api/admin/master/shift/route';
import { GET as daftarKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { GET as riwayatPenempatan } from '../src/app/api/admin/master/penempatan/route';
import { GET as lihatLink } from '../src/app/api/admin/master/link/route';
import { GET as daftarAkun } from '../src/app/api/admin/akun/route';

const DB_PATH = 'data/uji_m2_pengaturan.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const RAHASIA_BOT = 'R4HASIA-BOT-TOKEN-UNTUK-TES';

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

describe('M2 pengaturan', () => {
  let cookie = '';

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = RAHASIA_BOT;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    cookie = await cookieSuperadmin();
  }, 120_000);

  afterAll(async () => {
    delete process.env['TELEGRAM_BOT_TOKEN'];
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('bawaan 5; nilai negatif ditolak; nol diterima', async () => {
    const awal = ((await (await bacaPengaturan(req('/api/admin/pengaturan', { cookie }))).json()).data as { ambang_terlambat_menit: number });
    expect(awal.ambang_terlambat_menit).toBe(5);

    const negatif = await ubahPengaturan(req('/api/admin/pengaturan', { method: 'PUT', body: { ambang_terlambat_menit: -1 }, cookie }));
    expect(negatif.status).toBe(400);

    const nol = await ubahPengaturan(req('/api/admin/pengaturan', { method: 'PUT', body: { ambang_terlambat_menit: 0 }, cookie }));
    expect(nol.status).toBe(200);
    expect(((await nol.json()).data as { ambang_terlambat_menit: number }).ambang_terlambat_menit).toBe(0);

    const sepuluh = await ubahPengaturan(req('/api/admin/pengaturan', { method: 'PUT', body: { ambang_terlambat_menit: 10 }, cookie }));
    expect(sepuluh.status).toBe(200);
  });

  it('perubahan tercatat di audit dengan before/after', async () => {
    const db = getDb();
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'pengaturan' ORDER BY id DESC LIMIT 1", args: [] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris.aksi).toBe('PENGATURAN_UBAH');
    expect(JSON.parse(baris.sebelum as string)).toEqual({ ambang_terlambat_menit: 0 });
    expect(JSON.parse(baris.sesudah as string)).toEqual({ ambang_terlambat_menit: 10 });
  });

  it('token bot tidak pernah ada di respons mana pun', async () => {
    // Buat data agar respons berisi isi.
    await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Respons' }, cookie }));
    const semua: Response[] = [
      await bacaPengaturan(req('/api/admin/pengaturan', { cookie })),
      await daftarToko(req('/api/admin/master/toko', { cookie })),
      await daftarShift(req('/api/admin/master/shift', { cookie })),
      await daftarKaryawan(req('/api/admin/master/karyawan', { cookie })),
      await riwayatPenempatan(req('/api/admin/master/penempatan?karyawan_id=1', { cookie })),
      await lihatLink(req('/api/admin/master/link?karyawan_id=1', { cookie })),
      await daftarAkun(req('/api/admin/akun', { cookie })),
      await ubahPengaturan(req('/api/admin/pengaturan', { method: 'PUT', body: { ambang_terlambat_menit: 5 }, cookie })),
    ];
    for (const res of semua) {
      expect(JSON.stringify(await res.json())).not.toContain(RAHASIA_BOT);
    }
  });
});
