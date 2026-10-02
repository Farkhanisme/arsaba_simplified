process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { sehariSebelum } from '../src/server/aturan/penempatan';
import { ubahAmbang, bacaAmbang } from '../src/server/repo/pengaturan';
import { metrikPerToko, antreanVerifikasi, angkaBanding } from '../src/server/repo/dashboard';
import { GET as dashboardRoute } from '../src/app/api/admin/dashboard/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m7_dashboard.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

function req(url: string, opsi: { method?: string; cookie?: string } = {}) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`https://arsaba.vercel.app${url}`, { method: opsi.method ?? 'GET', headers });
}

async function cookieUntuk(username: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', 'test1234');
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M7 dashboard', () => {
  let admin = '';
  let superadmin = '';
  let superId = 0;
  // Tanggal DINAMIS mengikuti hari server: fixture selalu "hari ini".
  const H = tanggalWIB();
  const KEMARIN = sehariSebelum(H);
  const toko: Record<string, number> = {};
  const kry: Record<string, number> = {};

  async function tambahKaryawan(nama: string, tokoId: number, mulai: string): Promise<number> {
    const db = getDb();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, serialisasiWIB()] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [id, tokoId, mulai] });
    return id;
  }

  async function tambahTemplate(tokoId: number, nama: string, tipe: string, mulai: string, selesai: string): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      args: [tokoId, nama, tipe, mulai, selesai, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  async function tambahJadwal(karyawanId: number, tokoId: number, tanggal: string, tplId: number | null, override: boolean, slots: { nama: string; mulai: string; selesai: string }[]): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [karyawanId, tokoId, tanggal, tplId, override ? 1 : 0, superId, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    let urutan = 1;
    for (const s of slots) {
      await db.execute({
        sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, ?, ?, ?, ?)',
        args: [id, urutan++, s.nama, s.mulai, s.selesai],
      });
    }
  }

  async function tambahCheckin(karyawanId: number, tokoId: number, tanggal: string, jam: string, status = 'MENUNGGU', final: number | null = null, alasan: string | null = null): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, alasan_tolak, keterlambatan_final_menit, dibuat_at) VALUES (?, ?, ?, ?, 'CHECKIN', ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', ?, ?, ?, ?)",
      args: [randomUUID(), karyawanId, tokoId, tanggal, `${tanggal}T${jam}+07:00`, status, alasan, final, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  async function tambahTanda(karyawanId: number, tokoId: number, tanggal: string, jenis = 'IZIN'): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [karyawanId, tokoId, tanggal, jenis, superId, serialisasiWIB()],
    });
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    superId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    const sekarang = serialisasiWIB();
    for (const nama of ['Toko A', 'Toko B', 'Toko C']) {
      await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
      const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
      toko[nama] = Number((r.rows[0] as Record<string, unknown>)['id']);
    }
    const tplA = await tambahTemplate(toko['Toko A']!, 'Pagi', 'SEMUA', '07:00', '17:00');
    const tplB = await tambahTemplate(toko['Toko B']!, 'Pagi', 'SEMUA', '07:00', '17:00');

    // Toko A: K1 (07:03 + final 30, DISETUJUI), K2 (07:20 + final 0, DISETUJUI),
    // K3 (1 check-in MENUNGGU), K4 (DITOLAK, tanpa jadwal), K5 (jadwal saja),
    // K6 (jadwal + tanda), K9 (override 2 slot + 2 check-in).
    kry['K1'] = await tambahKaryawan('K1', toko['Toko A']!, '2026-09-01');
    kry['K2'] = await tambahKaryawan('K2', toko['Toko A']!, '2026-09-01');
    kry['K3'] = await tambahKaryawan('K3', toko['Toko A']!, '2026-09-01');
    kry['K4'] = await tambahKaryawan('K4', toko['Toko A']!, '2026-09-01');
    kry['K5'] = await tambahKaryawan('K5', toko['Toko A']!, '2026-09-01');
    kry['K6'] = await tambahKaryawan('K6', toko['Toko A']!, '2026-09-01');
    kry['K9'] = await tambahKaryawan('K9', toko['Toko A']!, '2026-09-01');
    for (const k of ['K1', 'K2', 'K3', 'K5', 'K6']) {
      await tambahJadwal(kry[k]!, toko['Toko A']!, H, tplA, false, [{ nama: 'Pagi', mulai: '07:00', selesai: '17:00' }]);
    }
    await tambahJadwal(kry['K9']!, toko['Toko A']!, H, null, true, [
      { nama: 'S1', mulai: '07:00', selesai: '12:00' },
      { nama: 'S2', mulai: '18:00', selesai: '23:00' },
    ]);
    await tambahCheckin(kry['K1']!, toko['Toko A']!, H, '07:03:00', 'DISETUJUI', 30);
    await tambahCheckin(kry['K2']!, toko['Toko A']!, H, '07:20:00', 'DISETUJUI', 0);
    await tambahCheckin(kry['K3']!, toko['Toko A']!, H, '07:00:00');
    await tambahCheckin(kry['K4']!, toko['Toko A']!, H, '07:00:00', 'DITOLAK', null, 'Foto buram');
    await tambahTanda(kry['K6']!, toko['Toko A']!, H);
    await tambahCheckin(kry['K9']!, toko['Toko A']!, H, '07:05:00');
    await tambahCheckin(kry['K9']!, toko['Toko A']!, H, '18:06:00');

    // Toko B: K7 (07:10), K10 (2 slot + 2 ci), K11 (1 slot + ci2 20:00),
    // K12 (ci1 DITOLAK + ci2 18:05 + jadwal 2 slot), K13 (override 09:00 + ci 09:03),
    // K14 (pindahan A->B hari ini; jadwal B hari ini + jadwal A kemarin).
    kry['K7'] = await tambahKaryawan('K7', toko['Toko B']!, '2026-09-01');
    kry['K10'] = await tambahKaryawan('K10', toko['Toko B']!, '2026-09-01');
    kry['K11'] = await tambahKaryawan('K11', toko['Toko B']!, '2026-09-01');
    kry['K12'] = await tambahKaryawan('K12', toko['Toko B']!, '2026-09-01');
    kry['K13'] = await tambahKaryawan('K13', toko['Toko B']!, '2026-09-01');
    kry['K14'] = await tambahKaryawan('K14', toko['Toko A']!, '2026-09-01');
    await db.execute({ sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE karyawan_id = ?', args: [KEMARIN, kry['K14']!] });
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [kry['K14']!, toko['Toko B']!, H] });
    await tambahJadwal(kry['K7']!, toko['Toko B']!, H, tplB, false, [{ nama: 'Pagi', mulai: '07:00', selesai: '17:00' }]);
    await tambahJadwal(kry['K10']!, toko['Toko B']!, H, null, true, [
      { nama: 'S1', mulai: '07:00', selesai: '12:00' },
      { nama: 'S2', mulai: '18:00', selesai: '23:00' },
    ]);
    await tambahJadwal(kry['K11']!, toko['Toko B']!, H, tplB, false, [{ nama: 'Pagi', mulai: '07:00', selesai: '17:00' }]);
    await tambahJadwal(kry['K12']!, toko['Toko B']!, H, null, true, [
      { nama: 'S1', mulai: '07:00', selesai: '12:00' },
      { nama: 'S2', mulai: '18:00', selesai: '23:00' },
    ]);
    await tambahJadwal(kry['K13']!, toko['Toko B']!, H, null, true, [{ nama: 'X', mulai: '09:00', selesai: '12:00' }]);
    await tambahJadwal(kry['K14']!, toko['Toko B']!, H, tplB, false, [{ nama: 'Pagi', mulai: '07:00', selesai: '17:00' }]);
    await tambahJadwal(kry['K14']!, toko['Toko A']!, KEMARIN, tplA, false, [{ nama: 'Pagi', mulai: '07:00', selesai: '17:00' }]);
    await tambahCheckin(kry['K7']!, toko['Toko B']!, H, '07:10:00');
    await tambahCheckin(kry['K10']!, toko['Toko B']!, H, '07:05:00');
    await tambahCheckin(kry['K10']!, toko['Toko B']!, H, '18:06:00');
    await tambahCheckin(kry['K11']!, toko['Toko B']!, H, '07:00:00');
    await tambahCheckin(kry['K11']!, toko['Toko B']!, H, '20:00:00');
    await tambahCheckin(kry['K12']!, toko['Toko B']!, H, '07:00:00', 'DITOLAK', null, 'Foto buram');
    await tambahCheckin(kry['K12']!, toko['Toko B']!, H, '18:05:00');
    await tambahCheckin(kry['K13']!, toko['Toko B']!, H, '09:03:00');

    // Kemarin: 1 MENUNGGU (K8) — antrean menghitung semua tanggal.
    kry['K8'] = await tambahKaryawan('K8', toko['Toko A']!, '2026-09-01');
    await tambahCheckin(kry['K8']!, toko['Toko A']!, KEMARIN, '07:00:00');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  function kartu<T extends { toko_nama: string }>(data: { kartu: T[] }, nama: string): T {
    const k = data.kartu.find((x) => x.toko_nama === nama)!;
    expect(k, `kartu ${nama} harus ada`).toBeDefined();
    return k;
  }

  const idkry = (s: string): number => kry[s]!;

  it('route 200 untuk ADMIN dan Super Admin; 3 kartu termasuk toko kosong', async () => {
    for (const cookie of [admin, superadmin]) {
      const res = await dashboardRoute(req('/api/admin/dashboard', { cookie }));
      expect(res.status).toBe(200);
      const data = (await res.json()).data as { tanggal: string; kartu: { toko_nama: string }[]; antrean: number };
      expect(data.kartu.length).toBe(3);
      expect(data.tanggal).toBe(H);
    }
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terjadwal: number; sudah_absen: number; terlambat: number; belum_absen: number }[] };
    const c = kartu(data, 'Toko C');
    expect(c).toEqual({ toko_id: toko['Toko C']!, toko_nama: 'Toko C', terjadwal: 0, sudah_absen: 0, terlambat: 0, belum_absen: 0 });
  });

  it('kasus 1: final 30 tapi tidak terlambat sistem -> terlambat 0 untuknya', async () => {
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terlambat: number }[] };
    // K1 (07:03, final 30) bukan terlambat; K2 dan K9 terlambat.
    expect(kartu(data, 'Toko A').terlambat).toBe(2);
  });

  it('kasus 2: final 0 tapi terlambat sistem -> tetap terlambat', async () => {
    // K2: selisih 20 > 5 dengan final 0 dari admin — sudah dibuktikan di atas (terlambat 2 mencakup K2).
    const db = getDb();
    const r = await db.execute({ sql: 'SELECT keterlambatan_final_menit AS m FROM absensi WHERE karyawan_id = ? AND tanggal = ?', args: [kry['K2']!, H] });
    expect(Number((r.rows[0] as Record<string, unknown>)['m'])).toBe(0);
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terjadwal: number; sudah_absen: number; terlambat: number; belum_absen: number }[] };
    const a = kartu(data, 'Toko A');
    expect(a).toEqual({ toko_id: toko['Toko A']!, toko_nama: 'Toko A', terjadwal: 6, sudah_absen: 4, terlambat: 2, belum_absen: 1 });
  });

  it('angka penuh per toko + bertanda tidak di kolom mana pun', async () => {
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terjadwal: number; sudah_absen: number; terlambat: number; belum_absen: number }[] };
    // A: terjadwal {K1,K2,K3,K5,K6,K9}=6; sudah {K1,K2,K3,K9}=4 (K9 dihitung 1 walau 2 ci; K4 DITOLAK tak masuk);
    // terlambat {K2,K9}=2 (K1 selisih 3 + final 30 diabaikan); bertanda {K6} tak di kolom mana pun; belum = 6-4-1 = 1 (K5).
    expect(kartu(data, 'Toko A')).toEqual({ toko_id: toko['Toko A']!, toko_nama: 'Toko A', terjadwal: 6, sudah_absen: 4, terlambat: 2, belum_absen: 1 });
    // B: terjadwal {K7,K10,K11,K12,K13,K14}=6; sudah {K7,K10,K11,K12,K13}=5; terlambat {K7,K10,K11,K12}=4
    // (K13 09:03 vs snapshot 09:00 = 3, bukan template 07:00); belum = 6-5-0 = 1 (K14).
    expect(kartu(data, 'Toko B')).toEqual({ toko_id: toko['Toko B']!, toko_nama: 'Toko B', terjadwal: 6, sudah_absen: 5, terlambat: 4, belum_absen: 1 });
    // Hitung ORANG bukan event: K9 punya 2 check-in aktif tapi sudah_absen A tetap 4
    // (dibuktikan eksplisit: DISTINCT karyawan check-in aktif A = {K1,K2,K3,K9}).
    const db = getDb();
    const distinct = await db.execute({
      sql: "SELECT COUNT(DISTINCT karyawan_id) AS c FROM absensi WHERE toko_id = ? AND tanggal = ? AND jenis = 'CHECKIN' AND status <> 'DITOLAK'",
      args: [toko['Toko A']!, H],
    });
    expect(Number((distinct.rows[0] as Record<string, unknown>)['c'])).toBe(4);
    const segar = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const segarData = (await segar.json()).data as { kartu: { toko_nama: string; sudah_absen: number }[] };
    expect(kartu(segarData, 'Toko A').sudah_absen).toBe(4);
  });

  it('pindahan tidak bocor ke kartu toko lama', async () => {
    // K14 kemarin dijadwalkan di A; hari ini hanya di B. A.terjadwal tetap 6 di atas.
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terjadwal: number }[] };
    expect(kartu(data, 'Toko A').terjadwal).toBe(6);
    expect(kartu(data, 'Toko B').terjadwal).toBe(6);
  });

  it('ambang 5 -> 30 mengubah tanda data lama; final tak berubah', async () => {
    const db = getDb();
    const siapa = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    await ubahAmbang(30, siapa, serialisasiWIB(), db);
    expect(await bacaAmbang(db)).toBe(30);
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    const data = (await res.json()).data as { kartu: { toko_nama: string; terlambat: number }[] };
    // K2 (20), K9 (6), K7 (10), K10 (6) padam; K11 (780) dan K12 (vs 07:00 besar) tetap.
    expect(kartu(data, 'Toko A').terlambat).toBe(0);
    expect(kartu(data, 'Toko B').terlambat).toBe(2);
    await ubahAmbang(5, siapa, serialisasiWIB(), db);
    // Final admin utuh.
    const r = await db.execute({ sql: 'SELECT karyawan_id, keterlambatan_final_menit AS m FROM absensi WHERE karyawan_id IN (?, ?) AND tanggal = ?', args: [idkry('K1'), idkry('K2'), H] });
    const peta = new Map((r.rows as unknown as { karyawan_id: number; m: number }[]).map((x) => [x.karyawan_id, x.m]));
    expect(peta.get(idkry('K1'))).toBe(30);
    expect(peta.get(idkry('K2'))).toBe(0);
  });

  it('antrean menghitung MENUNGGU semua tanggal; bukan DISETUJUI/DITOLAK', async () => {
    // MENUNGGU: K3, K8 kemarin, K7, K9x2, K10x2, K11x2, K12, K13 = 11.
    const res = await dashboardRoute(req('/api/admin/dashboard', { cookie: admin }));
    expect(((await res.json()).data as { antrean: number }).antrean).toBe(11);
    expect(await antreanVerifikasi(getDb())).toBe(11);
  });

  it('angkaBanding sama persis dengan metrikPerToko', async () => {
    const db = getDb();
    expect(await angkaBanding(H, db)).toEqual(await metrikPerToko(H, db));
  });

  it('tanggal parameter: metrikPerToko(2000-01-01) nol semua; route abaikan ?tanggal=', async () => {
    const db = getDb();
    const kosong = await metrikPerToko('2000-01-01', db);
    expect(kosong.length).toBe(3);
    for (const k of kosong) {
      expect(k).toEqual({ toko_id: k.toko_id, toko_nama: k.toko_nama, terjadwal: 0, sudah_absen: 0, terlambat: 0, belum_absen: 0 });
    }
    const res = await dashboardRoute(req('/api/admin/dashboard?tanggal=2000-01-01', { cookie: admin }));
    const data = (await res.json()).data as { tanggal: string; kartu: { toko_nama: string; terjadwal: number }[] };
    expect(data.tanggal).toBe(H);
    expect(data.kartu.find((x) => x.toko_nama === 'Toko A')!.terjadwal).toBe(6);
  });
});
