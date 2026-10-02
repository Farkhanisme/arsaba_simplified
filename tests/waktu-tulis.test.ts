process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB } from '../src/server/waktu';
import { POST as tambahToko } from '../src/app/api/admin/master/toko/route';
import { POST as tambahKaryawan } from '../src/app/api/admin/master/karyawan/route';
import { POST as tambahPenempatan } from '../src/app/api/admin/master/penempatan/route';
import { POST as tambahShift } from '../src/app/api/admin/master/shift/route';
import { POST as massalJadwal } from '../src/app/api/admin/jadwal/massal/route';
import { POST as tandaiTidakBerangkat } from '../src/app/api/admin/tidak-berangkat/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_waktu_tulis.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const TOLERANSI_MENIT = 5;

function req(url: string, opsi: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  headers.set('content-type', 'application/json');
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`${APP_ORIGIN}${url}`, {
    method: opsi.method ?? 'GET',
    headers,
    body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
  });
}

/**
 * Selisih menit antara waktu yang TERSIMPAN di database dan waktu nyata server.
 * Inilah yang membedakan bug ini: membandingkan nilai yang ditulis APLIKASI
 * dengan waktu nyata, bukan antar-nilai yang semuanya salah bersama.
 */
function geserMenit(nilai: string): number {
  return Math.abs(Date.parse(nilai) - Date.parse(serialisasiWIB())) / 60_000;
}

type Arg = string | number | null;
async function satuBaris(sql: string, args: Arg[] = []): Promise<Record<string, unknown>> {
  const res = await getDb().execute({ sql, args });
  return res.rows[0] as Record<string, unknown>;
}

describe('BUG-01: waktu yang ditulis aplikasi harus waktu SEKARANG, bukan +7 jam', () => {
  let cookie = '';
  let tokoId = 0;
  let karyawanId = 0;
  const hariIni = serialisasiWIB().slice(0, 10);

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });

    const fd = new FormData();
    fd.set('username', 'superadmin');
    fd.set('password', 'test1234');
    const headers = new Headers();
    headers.set('origin', APP_ORIGIN);
    const res = await loginRoute(new NextRequest(`${APP_ORIGIN}/api/login`, { method: 'POST', headers, body: fd }));
    cookie = /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('membuat seluruh data prasyarat lewat route sungguhan', async () => {
    const toko = await tambahToko(req('/api/admin/master/toko', { method: 'POST', body: { nama: 'Toko Uji Waktu' }, cookie }));
    expect(toko.status).toBe(201);
    tokoId = await satuBaris('SELECT id FROM toko WHERE nama = ?', ['Toko Uji Waktu']).then((r) => Number(r['id']));

    const kry = await tambahKaryawan(
      req('/api/admin/master/karyawan', { method: 'POST', body: { nama: 'Kry Uji Waktu' }, cookie }),
    );
    expect(kry.status).toBe(201);
    karyawanId = await satuBaris('SELECT id FROM karyawan WHERE nama = ?', ['Kry Uji Waktu']).then((r) => Number(r['id']));

    await tambahPenempatan(
      req('/api/admin/master/penempatan', {
        method: 'POST',
        body: { karyawan_id: karyawanId, toko_tujuan_id: tokoId, tanggal_efektif: '2026-01-01' },
        cookie,
      }),
    );
    const adaPenempatan = await getDb().execute({
      sql: 'SELECT COUNT(*) AS c FROM karyawan_penempatan WHERE karyawan_id = ?',
      args: [karyawanId],
    });
    expect(Number((adaPenempatan.rows[0] as Record<string, unknown>)['c'])).toBe(1);
    await tambahShift(
      req('/api/admin/master/shift', {
        method: 'POST',
        body: { toko_id: tokoId, nama: 'Pagi', tipe_hari: 'SEMUA', jam_mulai: '07:00', jam_selesai: '15:00' },
        cookie,
      }),
    );
  });

  it('toko.dibuat_at = waktu sekarang', async () => {
    const t = await satuBaris('SELECT dibuat_at FROM toko WHERE id = ?', [tokoId]);
    expect(String(t['dibuat_at'])).toMatch(/\+07:00$/);
    expect(geserMenit(String(t['dibuat_at']))).toBeLessThan(TOLERANSI_MENIT);
  });

  it('karyawan.dibuat_at = waktu sekarang', async () => {
    const t = await satuBaris('SELECT dibuat_at FROM karyawan WHERE id = ?', [karyawanId]);
    expect(geserMenit(String(t['dibuat_at']))).toBeLessThan(TOLERANSI_MENIT);
  });

  it('jadwal.dibuat_at = waktu sekarang (M5)', async () => {
    const res = await massalJadwal(
      req('/api/admin/jadwal/massal', {
        method: 'POST',
        body: {
          toko_id: tokoId,
          karyawan_ids: [karyawanId],
          dari: hariIni,
          sampai: hariIni,
          nama_template: 'Pagi',
          mode: 'lewati',
        },
        cookie,
      }),
    );
    expect(res.status).toBe(201);
    const t = await satuBaris('SELECT dibuat_at FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', [karyawanId, hariIni]);
    expect(geserMenit(String(t['dibuat_at']))).toBeLessThan(TOLERANSI_MENIT);
  });

  it('jadwal_slot memakai snapshot jam yang benar (tidak terpengaruhBUG-01)', async () => {
    const s = await satuBaris(
      'SELECT jam_mulai, jam_selesai FROM jadwal_slot WHERE jadwal_id = (SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?)',
      [karyawanId, hariIni],
    );
    expect(s['jam_mulai']).toBe('07:00');
    expect(s['jam_selesai']).toBe('15:00');
  });

  it('ketidakhadiran.dibuat_at = waktu sekarang (M6)', async () => {
    const res = await tandaiTidakBerangkat(
      req('/api/admin/tidak-berangkat', {
        method: 'POST',
        body: { karyawan_ids: [karyawanId], dari: hariIni, jenis: 'IZIN' },
        cookie,
      }),
    );
    expect(res.status).toBe(201);
    const t = await satuBaris('SELECT dibuat_at FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?', [karyawanId, hariIni]);
    expect(geserMenit(String(t['dibuat_at']))).toBeLessThan(TOLERANSI_MENIT);
  });

  it('audit_log.waktu = waktu sekarang', async () => {
    const t = await satuBaris('SELECT waktu FROM audit_log ORDER BY id DESC LIMIT 1');
    expect(geserMenit(String(t['waktu']))).toBeLessThan(TOLERANSI_MENIT);
  });

  it('penandaan M6 memakai tanggal HARI INI, bukan tanggal besok', async () => {
    // Pengaman tambahan: kalau tanggalnya bergeser satu hari, semua data masuk
    // ke tanggal yang salah dan tidak akan pernah terlihat sebagai absensi hari ini.
    const t = await satuBaris('SELECT tanggal FROM ketidakhadiran WHERE karyawan_id = ?', [karyawanId]);
    expect(String(t['tanggal'])).toBe(hariIni);
  });
});
