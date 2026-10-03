process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Layout dirender langsung: cookies()/redirect()/Link dimock agar bisa
// dipanggil di luar request Next sungguhan.
const holder = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nama: string) => (holder.cookie !== undefined && nama === 'sesi' ? { value: holder.cookie } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('next/link', () => ({ default: () => null }));

import { menuUntukPeran } from '../src/app/admin/menu';
import AdminLayout from '../src/app/admin/layout';
import { POST as loginRoute } from '../src/app/api/login/route';
import { GET as getToko, POST as postToko } from '../src/app/api/admin/master/toko/route';
import { GET as getTokoId, PUT as putTokoId } from '../src/app/api/admin/master/toko/[id]/route';
import { GET as getShift, POST as postShift } from '../src/app/api/admin/master/shift/route';
import { GET as getShiftId, PUT as putShiftId } from '../src/app/api/admin/master/shift/[id]/route';
import { GET as getKaryawan, POST as postKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { GET as getKaryawanId, PUT as putKaryawanId } from '../src/app/api/admin/master/karyawan/[id]/route';
import { GET as getPenempatan, POST as postPenempatan } from '../src/app/api/admin/master/penempatan/route';
import { GET as getLink, POST as postLink } from '../src/app/api/admin/master/link/route';
import { POST as postBuatUlang } from '../src/app/api/admin/master/link/buat-ulang/route';
import { POST as postCabut } from '../src/app/api/admin/master/link/cabut/route';
import { GET as getAkun, POST as postAkun } from '../src/app/api/admin/akun/route';
import { GET as getAkunId, PUT as putAkunId } from '../src/app/api/admin/akun/[id]/route';
import { POST as postReset } from '../src/app/api/admin/akun/[id]/reset/route';
import { POST as postBukaKunci } from '../src/app/api/admin/akun/buka-kunci/route';
import { GET as getPengaturan, PUT as putPengaturan } from '../src/app/api/admin/pengaturan/route';

const DB_PATH = 'data/uji_m2_izin.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

type Panggil = (cookie: string) => Promise<Response>;

function json(url: string, method: string, body: unknown): Panggil {
  return (cookie: string) => {
    const headers = new Headers();
    headers.set('origin', APP_ORIGIN);
    headers.set('content-type', 'application/json');
    headers.set('cookie', `sesi=${cookie}`);
    return (async () => {
      const r = new NextRequest(`https://arsaba.vercel.app${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return panggilRoute(url, method, r);
    })();
  };
}

// Menyalurkan ke handler yang sesuai (dipetakan sekali di bawah).
const PETA: Record<string, (r: NextRequest) => Promise<Response>> = {};

function daftarkan() {
  PETA['GET /api/admin/master/toko'] = getToko as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/toko'] = postToko as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/toko/1'] = getTokoId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['PUT /api/admin/master/toko/1'] = putTokoId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/shift'] = getShift as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/shift'] = postShift as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/shift/1'] = getShiftId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['PUT /api/admin/master/shift/1'] = putShiftId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/karyawan'] = getKaryawan as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/karyawan'] = postKaryawan as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/karyawan/1'] = getKaryawanId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['PUT /api/admin/master/karyawan/1'] = putKaryawanId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/penempatan'] = getPenempatan as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/penempatan'] = postPenempatan as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/master/link'] = getLink as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/link'] = postLink as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/link/buat-ulang'] = postBuatUlang as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/master/link/cabut'] = postCabut as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/akun'] = getAkun as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/akun'] = postAkun as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/akun/1'] = getAkunId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['PUT /api/admin/akun/1'] = putAkunId as unknown as (r: NextRequest) => Promise<Response>;
  PETA['POST /api/admin/akun/1/reset'] = postReset as unknown as (r: NextRequest) => Promise<Response>;
  PETA['GET /api/admin/pengaturan'] = getPengaturan as unknown as (r: NextRequest) => Promise<Response>;
  PETA['PUT /api/admin/pengaturan'] = putPengaturan as unknown as (r: NextRequest) => Promise<Response>;
}

async function panggilRoute(url: string, method: string, r: NextRequest): Promise<Response> {
  const kunci = `${method} ${url.split('?')[0]}`;
  const handler = PETA[kunci];
  if (!handler) throw new Error(`route belum terdaftar di tes: ${kunci}`);
  return handler(r);
}

const SEMUA_PANGGILAN: { method: string; url: string; body: unknown }[] = [
  { method: 'GET', url: '/api/admin/master/toko', body: undefined },
  { method: 'POST', url: '/api/admin/master/toko', body: {} },
  { method: 'GET', url: '/api/admin/master/toko/1', body: undefined },
  { method: 'PUT', url: '/api/admin/master/toko/1', body: { nama: 'x' } },
  { method: 'GET', url: '/api/admin/master/shift', body: undefined },
  { method: 'POST', url: '/api/admin/master/shift', body: {} },
  { method: 'GET', url: '/api/admin/master/shift/1', body: undefined },
  { method: 'PUT', url: '/api/admin/master/shift/1', body: {} },
  { method: 'GET', url: '/api/admin/master/karyawan', body: undefined },
  { method: 'POST', url: '/api/admin/master/karyawan', body: {} },
  { method: 'GET', url: '/api/admin/master/karyawan/1', body: undefined },
  { method: 'PUT', url: '/api/admin/master/karyawan/1', body: {} },
  { method: 'GET', url: '/api/admin/master/penempatan?karyawan_id=1', body: undefined },
  { method: 'POST', url: '/api/admin/master/penempatan', body: {} },
  { method: 'GET', url: '/api/admin/master/link?karyawan_id=1', body: undefined },
  { method: 'POST', url: '/api/admin/master/link', body: {} },
  { method: 'POST', url: '/api/admin/master/link/buat-ulang', body: {} },
  { method: 'POST', url: '/api/admin/master/link/cabut', body: {} },
  { method: 'GET', url: '/api/admin/akun', body: undefined },
  { method: 'POST', url: '/api/admin/akun', body: {} },
  { method: 'GET', url: '/api/admin/akun/1', body: undefined },
  { method: 'PUT', url: '/api/admin/akun/1', body: {} },
  { method: 'POST', url: '/api/admin/akun/1/reset', body: {} },
  { method: 'GET', url: '/api/admin/pengaturan', body: undefined },
  { method: 'PUT', url: '/api/admin/pengaturan', body: {} },
];

async function cookieUntuk(username: string, password: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M2 izin dan layout', () => {
  let admin = '';
  let superadmin = '';

  beforeAll(async () => {
    daftarkan();
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin', 'test1234');
    superadmin = await cookieUntuk('superadmin', 'test1234');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('ADMIN mendapat 403 di SETIAP route Super Admin', async () => {
    for (const p of SEMUA_PANGGILAN) {
      const res = await json(p.url, p.method, p.body)(admin);
      expect(res.status, `${p.method} ${p.url}`).toBe(403);
      expect(((await res.json()) as { kode: string }).kode, `${p.method} ${p.url}`).toBe('AKSES_DITOLAK');
    }
  });

  it('ADMIN juga 403 di buka-kunci (master_akun)', async () => {
    const fd = new FormData();
    fd.set('username', 'admin');
    const headers = new Headers();
    headers.set('origin', APP_ORIGIN);
    headers.set('cookie', `sesi=${admin}`);
    const res = await postBukaKunci(new NextRequest('https://arsaba.vercel.app/api/admin/akun/buka-kunci', { method: 'POST', headers, body: fd }));
    expect(res.status).toBe(403);
  });

  it('Super Admin lolos guard di route baca (bukan 403)', async () => {
    expect((await json('/api/admin/master/toko', 'GET', undefined)(superadmin)).status).toBe(200);
    expect((await json('/api/admin/pengaturan', 'GET', undefined)(superadmin)).status).toBe(200);
    expect((await json('/api/admin/akun', 'GET', undefined)(superadmin)).status).toBe(200);
  });

  it('menu Super Admin tidak dirender untuk ADMIN', () => {
    const teksAdmin = JSON.stringify(menuUntukPeran('ADMIN'));
    expect(teksAdmin).not.toContain('/admin/master/toko');
    expect(teksAdmin).not.toContain('/admin/master/shift');
    expect(teksAdmin).not.toContain('/admin/master/karyawan');
    expect(teksAdmin).not.toContain('/admin/akun');
    expect(teksAdmin).not.toContain('/admin/pengaturan');
    expect(teksAdmin).toContain('/admin/ubah-password');
    // Label "Segera" dipasang saat render (layout); di data mentah yang ada
    // hanya flag segera:true — 0 item kerja harian untuk ADMIN
    // (Verifikasi M4, Jadwal M5, Tandai Tidak Berangkat M6, Dashboard M7, Rekap M8).
    expect(teksAdmin).toContain('/admin/verifikasi');
    expect(teksAdmin).toContain('/admin/jadwal');
    expect(teksAdmin).toContain('/admin/tidak-berangkat');
    expect(teksAdmin).toContain('"/admin"');
    expect(teksAdmin).toContain('/admin/rekap');
    expect((teksAdmin.match(/"segera":true/g) || []).length).toBe(0);

    const teksSuper = JSON.stringify(menuUntukPeran('SUPER_ADMIN'));
    expect(teksSuper).toContain('/admin/master/toko');
    expect(teksSuper).toContain('/admin/master/shift');
    expect(teksSuper).toContain('/admin/master/karyawan');
    expect(teksSuper).toContain('/admin/akun');
    expect(teksSuper).toContain('/admin/pengaturan');
    expect(teksSuper).toContain('/admin/verifikasi');
    expect(teksSuper).toContain('/admin/jadwal');
    expect(teksSuper).toContain('/admin/tidak-berangkat');
    expect(teksSuper).toContain('"/admin"');
    expect(teksSuper).toContain('/admin/rekap');
    // M9: Audit Log bukan lagi placeholder — segera:true menjadi 0 dan
    // tautannya muncul untuk SUPER_ADMIN.
    expect((teksSuper.match(/"segera":true/g) || []).length).toBe(0);
    expect(teksSuper).toContain('/admin/audit-log');
  });

  it('layout mengarahkan tanpa sesi ke /login', async () => {
    holder.cookie = undefined;
    await expect(AdminLayout({ children: null })).rejects.toThrow('/login');
  });

  it('layout merender menu sesuai peran', async () => {
    holder.cookie = superadmin;
    const superHtml = JSON.stringify(await AdminLayout({ children: null }));
    expect(superHtml).toContain('/admin/master/toko');
    expect(superHtml).toContain('/admin/akun');
    // M9: tidak ada lagi penanda "(Segera)"; Audit Log aktif untuk SUPER_ADMIN.
    expect(superHtml).not.toContain('Segera');
    expect(superHtml).toContain('/admin/audit-log');

    holder.cookie = admin;
    const adminHtml = JSON.stringify(await AdminLayout({ children: null }));
    expect(adminHtml).not.toContain('/admin/master/toko');
    expect(adminHtml).not.toContain('/admin/akun');
    // M9: ADMIN tidak melihat menu Audit Log (dan endpoint menolak di server).
    expect(adminHtml).not.toContain('/admin/audit-log');
    expect(adminHtml).toContain('/admin/ubah-password');
    expect(adminHtml).toContain('/admin/verifikasi');
    holder.cookie = undefined;
  });
});
