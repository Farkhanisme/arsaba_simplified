process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { izinDiperlukan } from '../src/server/izin';
import { GET as adminTestRoute } from '../src/app/api/admin/test/route';

const DB_PATH = 'data/uji_izin.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

function req(headers: Record<string, string> = {}) {
  return new NextRequest(`${APP_ORIGIN}/api/admin/test`, { headers });
}

describe('izin M1', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('endpoint admin/test menolak tanpa cookie', async () => {
    // Dijalankan sungguhan lewat route handler, bukan membaca teks file.
    const res = await adminTestRoute(req({ origin: APP_ORIGIN }));
    expect(res.status).toBe(401);
    expect((await res.json()).kode).toBe('TANPA_SESI');
  });

  it('endpoint admin/test menolak cookie yang bukan id sesi valid', async () => {
    const res = await adminTestRoute(req({ origin: APP_ORIGIN, cookie: 'sesi=-token-palsu-yang-ngawur' }));
    expect(res.status).toBe(401);
    expect((await res.json()).kode).toBe('SESI_TIDAK_VALID');
  });

  it('cek Origin dijalankan lewat route, bukan dibaca dari teks file', async () => {
    // BUG-UI-05: GET same-origin tidak membawa Origin, jadi Origin kosong pada GET
    // lanjut ke pemeriksaan sesi (401 TANPA_SESI), bukan 403.
    const tanpaOrigin = await adminTestRoute(req());
    expect(tanpaOrigin.status).toBe(401);
    expect((await tanpaOrigin.json()).kode).toBe('TANPA_SESI');

    // Kalau Origin DIKIRIM, samanya harus persis — untuk GET maupun mutasi.
    const berawalanSama = await adminTestRoute(req({ origin: `${APP_ORIGIN}.penyerang.com` }));
    expect(berawalanSama.status).toBe(403);
    expect((await berawalanSama.json()).kode).toBe('ORIGIN_TIDAK_VALID');

    const httpBukanHttps = await adminTestRoute(req({ origin: APP_ORIGIN.replace('https://', 'http://') }));
    expect(httpBukanHttps.status).toBe(403);
    expect((await httpBukanHttps.json()).kode).toBe('ORIGIN_TIDAK_VALID');
  });

  it('matriks izin sesuai rules/02 §13', () => {
    // Kemampuan yang boleh untuk kedua peran (rules/02 §13)
    for (const fitur of ['dashboard', 'verifikasi', 'jadwal', 'tidak_berangkat', 'koreksi', 'rekap', 'ekspor']) {
      expect(izinDiperlukan(fitur, 'ADMIN')).toBe(true);
      expect(izinDiperlukan(fitur, 'SUPER_ADMIN')).toBe(true);
    }

    // Kemampuan khusus Super Admin
    for (const fitur of [
      'master_toko',
      'master_shift',
      'master_karyawan',
      'master_penempatan',
      'master_akun',
      'link_karyawan',
      'pengaturan',
      'audit_log',
      'ubah_data_terekspor',
    ]) {
      expect(izinDiperlukan(fitur, 'ADMIN')).toBe(false);
      expect(izinDiperlukan(fitur, 'SUPER_ADMIN')).toBe(true);
    }
  });

  it('fitur yang tidak dikenal di matriks selalu ditolak', () => {
    // Diamankan: nama fitur salah tikus harus menolak, bukan menerima.
    expect(izinDiperlukan('fitur_tidak_ada', 'SUPER_ADMIN')).toBe(false);
    expect(izinDiperlukan('test_admin', 'SUPER_ADMIN')).toBe(false);
  });
});
