process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { GET as auditLogRoute, POST as auditPost, PUT as auditPut, PATCH as auditPatch, DELETE as auditDelete } from '../src/app/api/admin/audit-log/route';
import { POST as loginRoute } from '../src/app/api/login/route';
import { catatAudit } from '../src/server/audit';
import { getDb } from '../src/server/db';
import { serialisasiWIB } from '../src/server/waktu';
import {
  daftarAuditLog,
  daftarAksiAuditLog,
  daftarEntitasAuditLog,
  daftarPelakuAuditLog,
  normalisasiBatas,
  syaratAuditLog,
} from '../src/server/repo/audit-log';

const DB_PATH = 'data/uji_m9_audit.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

function req(url: string, opsi: { method?: string; cookie?: string; origin?: string | null } = {}): NextRequest {
  const headers = new Headers();
  if (opsi.origin !== null) headers.set('origin', opsi.origin ?? APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`${APP_ORIGIN}${url}`, { method: opsi.method ?? 'GET', headers });
}

async function cookieUntuk(username: string, password: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest(`${APP_ORIGIN}/api/login`, { method: 'POST', headers, body: fd }));
  const setCookie = res.headers.get('set-cookie') || '';
  const m = /sesi=([^;]+)/.exec(setCookie);
  if (!m) throw new Error(`login ${username} gagal: ${res.status} ${(await res.clone().text()).slice(0, 200)}`);
  return m[1]!;
}

async function jumlahAudit(): Promise<number> {
  const res = await getDb().execute({ sql: 'SELECT COUNT(*) AS c FROM audit_log', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['c']);
}

describe('M9 audit log — repo baca', () => {
  let superId = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    const r = await getDb().execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] });
    superId = Number((r.rows[0] as Record<string, unknown>)['id']);
    // Tiga baris nyata lewat fungsi produksi catatAudit (bukan INSERT mentah di tes).
    // Instant UTC yang menghasilkan jam WIB yang diinginkan (01:00 UTC = 08:00 WIB).
    // Jangan mengumpan string ber-offset +07:00 ke serialisasiWIB (BUG-01: geser ganda).
    await catatAudit({ waktu: serialisasiWIB(Date.UTC(2026, 8, 1, 1, 0, 0)), pengguna_id: superId, aksi: 'TOKO_TAMBAH', entitas: 'toko', entitas_id: 1, catatan: 'Toko Melati dibuka.' });
    await catatAudit({ waktu: serialisasiWIB(Date.UTC(2026, 8, 2, 2, 0, 0)), pengguna_id: superId, aksi: 'LOGIN_BERHASIL', entitas: 'pengguna_admin', entitas_id: superId, sebelum: '{"a":1}', sesudah: '{"a":2}' });
    await catatAudit({ waktu: serialisasiWIB(Date.UTC(2026, 8, 3, 3, 0, 0)), pengguna_id: null, aksi: 'LOGIN_GAGAL', entitas: 'pengguna_admin', catatan: 'Percobaan gagal.' });
  }, 120_000);

  // Tanpa afterAll di sini: DB dipakai bersama describe route di bawah.
  // Penghapusan hanya sekali di afterAll terakhir.

  it('total dihitung dan terbaru di atas (waktu DESC, id DESC)', async () => {
    const { baris, total } = await daftarAuditLog({}, getDb());
    expect(total).toBeGreaterThanOrEqual(3);
    expect(baris.length).toBeGreaterThanOrEqual(3);
    expect(baris[0]!.waktu >= baris[1]!.waktu).toBe(true);
  });

  it('pagination: limit dan offset dihormati', async () => {
    const semua = await daftarAuditLog({}, getDb());
    const satu = await daftarAuditLog({ limit: 1, offset: 1 }, getDb());
    expect(satu.baris).toHaveLength(1);
    expect(satu.total).toBe(semua.total);
    expect(satu.baris[0]).toEqual(semua.baris[1]);
  });

  it('filter dari/sampai, pelaku, aksi, entitas menyempitkan hasil', async () => {
    const rentang = await daftarAuditLog({ dari: '2026-09-02', sampai: '2026-09-02' }, getDb());
    expect(rentang.total).toBeGreaterThanOrEqual(1);
    expect(rentang.baris.every((b) => b.waktu.startsWith('2026-09-02'))).toBe(true);
    const pelaku = await daftarAuditLog({ penggunaId: superId }, getDb());
    expect(pelaku.baris.every((b) => b.pengguna_id === superId)).toBe(true);
    const aksi = await daftarAuditLog({ aksi: 'LOGIN_GAGAL' }, getDb());
    expect(aksi.total).toBeGreaterThanOrEqual(1);
    expect(aksi.baris.every((b) => b.aksi === 'LOGIN_GAGAL')).toBe(true);
    const entitas = await daftarAuditLog({ entitas: 'toko' }, getDb());
    expect(entitas.baris.every((b) => b.entitas === 'toko')).toBe(true);
  });

  it('nama pelaku ikut dari pengguna_admin (bukan id telanjang)', async () => {
    const { baris } = await daftarAuditLog({ aksi: 'TOKO_TAMBAH' }, getDb());
    expect(baris[0]!.pengguna_nama).toBeTruthy();
  });

  it('filter diteruskan sebagai placeholder, bukan ditempel ke SQL', async () => {
    const { klausa, args } = syaratAuditLog({ dari: '2026-09-01', penggunaId: 7, aksi: "x' OR '1'='1", entitas: 'toko' });
    expect(klausa.length).toBe(4);
    expect(klausa.join(' ')).toContain('?');
    expect(klausa.join(' ')).not.toContain("OR '1'");
    expect(args).toContain("x' OR '1'='1");
  });

  it('batas di luar rentang dinormalisasi (bukan error DB)', async () => {
    expect(normalisasiBatas(0, -5)).toEqual({ limit: 50, offset: 0 });
    expect(normalisasiBatas(9999, 0)).toEqual({ limit: 200, offset: 0 });
    expect(normalisasiBatas(undefined, undefined)).toEqual({ limit: 50, offset: 0 });
  });

  it('daftar opsi filter berasal dari isi tabel', async () => {
    expect(await daftarAksiAuditLog(getDb())).toContain('LOGIN_GAGAL');
    expect(await daftarEntitasAuditLog(getDb())).toContain('toko');
    const pelaku = await daftarPelakuAuditLog(getDb());
    expect(pelaku.some((p) => p.id === superId && p.nama.length > 0)).toBe(true);
  });
});

describe('M9 audit log — route GET /api/admin/audit-log', () => {
  let admin = '';
  let superadmin = '';

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    admin = await cookieUntuk('admin', 'test1234');
    superadmin = await cookieUntuk('superadmin', 'test1234');
  }, 120_000);

  it('ADMIN mendapat 403 AKSES_DITOLAK', async () => {
    const res = await auditLogRoute(req('/api/admin/audit-log', { cookie: admin }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { kode: string }).kode).toBe('AKSES_DITOLAK');
  });

  it('SUPER_ADMIN mendapat 200 dengan baris, total, dan opsi filter', async () => {
    const res = await auditLogRoute(req('/api/admin/audit-log', { cookie: superadmin }));
    expect(res.status).toBe(200);
    const badan = (await res.json()) as {
      kode: string;
      data: { baris: unknown[]; total: number; filter: { aksi: string[]; entitas: string[]; pelaku: unknown[] } };
    };
    expect(badan.kode).toBe('OK');
    expect(badan.data.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(badan.data.filter.aksi)).toBe(true);
    expect(Array.isArray(badan.data.filter.entitas)).toBe(true);
  });

  it('tanpa sesi mendapat 401, bukan 500', async () => {
    const res = await auditLogRoute(req('/api/admin/audit-log'));
    expect(res.status).toBe(401);
  });

  it('GET tanpa Origin diteruskan ke cek sesi (BUG-UI-05)', async () => {
    const tanpaSesi = await auditLogRoute(req('/api/admin/audit-log', { origin: null }));
    expect(tanpaSesi.status).toBe(401);
    const denganSesi = await auditLogRoute(req('/api/admin/audit-log', { cookie: superadmin, origin: null }));
    expect(denganSesi.status).toBe(200);
  });

  it('POST, PUT, PATCH, DELETE ditolak 405 dan tidak menambah baris', async () => {
    const sebelum = await jumlahAudit();
    for (const panggil of [auditPost, auditPut, auditPatch, auditDelete]) {
      const res = await panggil();
      expect(res.status).toBe(405);
      const badan = (await res.json()) as { kode: string; pesan: string };
      expect(badan.kode).toBe('METODE_TIDAK_DIIZINKAN');
      expect(badan.pesan.length).toBeGreaterThan(0);
    }
    expect(await jumlahAudit()).toBe(sebelum);
  });

  it('limit dan tanggal di luar rentang memberi 400 berbahasa Indonesia', async () => {
    for (const url of [
      '/api/admin/audit-log?limit=0',
      '/api/admin/audit-log?limit=999',
      '/api/admin/audit-log?dari=2026-13-40',
      '/api/admin/audit-log?dari=2026-09-05&sampai=2026-09-01',
      '/api/admin/audit-log?offset=-1',
    ]) {
      const res = await auditLogRoute(req(url, { cookie: superadmin }));
      expect(res.status, url).toBe(400);
      const badan = (await res.json()) as { kode: string; pesan: string };
      expect(badan.kode, url).toBe('INPUT_TIDAK_VALID');
      expect(badan.pesan.length, url).toBeGreaterThan(0);
    }
  });

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });
});
