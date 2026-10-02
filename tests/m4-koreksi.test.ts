process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB, geserJamISO } from '../src/server/waktu';
import { POST as koreksi } from '../src/app/api/admin/koreksi/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m4_koreksi.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const TGL = '2026-10-03';

function req(body: unknown, cookie: string) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  headers.set('content-type', 'application/json');
  headers.set('cookie', `sesi=${cookie}`);
  return new NextRequest('https://arsaba.vercel.app/api/admin/koreksi', { method: 'POST', headers, body: JSON.stringify(body) });
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

describe('M4 koreksi manual (BR-K1..K6)', () => {
  let admin = '';
  let superadmin = '';
  let adminId = 0;
  let tokoId = 0;
  let kryId = 0;

  async function tambahCheckinTerbuka(waktu: string, tanggal = TGL): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, dibuat_at) VALUES (?, ?, ?, ?, 'CHECKIN', ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', 'MENUNGGU', ?)",
      args: [randomUUID(), kryId, tokoId, tanggal, waktu, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko K4', sekarang] });
    tokoId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Kry K4', sekarang] });
    kryId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [kryId, tokoId, '2026-10-01'] });
    adminId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'admin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('tanpa alasan ditolak (BR-K1)', async () => {
    const ci = await tambahCheckinTerbuka(`${TGL}T07:00:00+07:00`);
    const res = await koreksi(req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T17:00:00+07:00` }, admin));
    expect(res.status).toBe(400);
    expect((await res.json()).pesan).toBe('Alasan koreksi wajib diisi.');
  });

  it('tambah check-out: KOREKSI_ADMIN, tanpa foto, TIDAK_ADA, DISETUJUI pelaku (BR-K1/K2)', async () => {
    const ci = await tambahCheckinTerbuka(`${TGL}T07:01:00+07:00`);
    const res = await koreksi(
      req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T17:01:00+07:00`, alasan: 'Lupa check-out' }, admin),
    );
    expect(res.status).toBe(200);
    const id = ((await res.json()).data as { id: number }).id;
    const db = getDb();
    const row = (await db.execute({ sql: 'SELECT * FROM absensi WHERE id = ?', args: [id] })).rows[0] as Record<string, unknown>;
    expect(String(row['sumber'])).toBe('KOREKSI_ADMIN');
    expect(row['foto_file_id']).toBeNull();
    expect(String(row['lokasi_status'])).toBe('TIDAK_ADA');
    expect(String(row['status'])).toBe('DISETUJUI');
    expect(Number(row['diverifikasi_oleh'])).toBe(adminId);
    expect(Number(row['checkin_id'])).toBe(ci);
    expect(Number(row['dikoreksi_oleh'])).toBe(adminId);
    expect(String(row['alasan_koreksi'])).toBe('Lupa check-out');
  });

  it('BR-K3: tambah check-out untuk check-in lewat 20 jam berhasil', async () => {
    const ci = await tambahCheckinTerbuka(`${TGL}T07:02:00+07:00`);
    const db = getDb();
    const lama = await db.execute({ sql: 'SELECT waktu FROM absensi WHERE id = ?', args: [ci] });
    await db.execute({ sql: 'UPDATE absensi SET waktu = ? WHERE id = ?', args: [geserJamISO(String((lama.rows[0] as Record<string, unknown>)['waktu']), -21), ci] });
    const res = await koreksi(
      req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T17:02:00+07:00`, alasan: 'Lewat batas, ditutup admin' }, admin),
    );
    expect(res.status).toBe(200);
  });

  it('BR-K4: check-out kedua untuk check-in sama ditolak', async () => {
    const db = getDb();
    const punya = await db.execute({
      sql: "SELECT ci.id FROM absensi ci WHERE ci.karyawan_id = ? AND ci.jenis = 'CHECKIN' AND EXISTS (SELECT 1 FROM absensi co WHERE co.checkin_id = ci.id AND co.status <> 'DITOLAK') LIMIT 1",
      args: [kryId],
    });
    const ci = Number((punya.rows[0] as Record<string, unknown>)['id']);
    const res = await koreksi(
      req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T18:00:00+07:00`, alasan: 'Ganda' }, admin),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).pesan).toBe('Check-in ini sudah memiliki check-out.');
  });

  it('BR-K4: koreksi yang membuat 3 check-in aktif ditolak', async () => {
    await tambahCheckinTerbuka(`${TGL}T07:03:00+07:00`);
    await tambahCheckinTerbuka(`${TGL}T13:03:00+07:00`);
    const res = await koreksi(
      req({ operasi: 'tambah_checkin', karyawan_id: kryId, waktu: `${TGL}T18:03:00+07:00`, alasan: 'Kelebihan' }, admin),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).pesan).toBe('Karyawan sudah memiliki 2 check-in aktif pada tanggal ini.');
  });

  it('tambah check-in koreksi memakai snapshot toko + tercatat audit', async () => {
    const db = getDb();
    const res = await koreksi(
      req({ operasi: 'tambah_checkin', karyawan_id: kryId, waktu: `2026-10-04T07:00:00+07:00`, alasan: 'Tertinggal catat' }, superadmin),
    );
    expect(res.status).toBe(200);
    const id = ((await res.json()).data as { id: number }).id;
    const row = (await db.execute({ sql: 'SELECT tanggal, toko_id, sumber, status FROM absensi WHERE id = ?', args: [id] })).rows[0] as Record<string, unknown>;
    expect(String(row['tanggal'])).toBe('2026-10-04');
    expect(Number(row['toko_id'])).toBe(tokoId);
    expect(String(row['sumber'])).toBe('KOREKSI_ADMIN');
    const audit = (await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'absensi' AND entitas_id = ?", args: [id] })).rows[0] as unknown as { aksi: string; sebelum: string | null; sesudah: string };
    expect(audit.aksi).toBe('KOREKSI_TAMBAH_CHECKIN');
    expect(JSON.parse(audit.sesudah as string).tanggal).toBe('2026-10-04');
  });

  it('ubah waktu check-in: tanggal ikut + anak check-out cascade', async () => {
    const db = getDb();
    const ci = await tambahCheckinTerbuka(`2026-10-05T07:00:00+07:00`, '2026-10-05');
    await koreksi(req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `2026-10-05T17:00:00+07:00`, alasan: 'Pasangan' }, superadmin));
    const res = await koreksi(
      req({ operasi: 'ubah_waktu', event_id: ci, waktu: `2026-10-06T08:00:00+07:00`, alasan: 'Salah tanggal' }, superadmin),
    );
    expect(res.status).toBe(200);
    const anak = await db.execute({ sql: 'SELECT tanggal FROM absensi WHERE checkin_id = ?', args: [ci] });
    expect(String((anak.rows[0] as Record<string, unknown>)['tanggal'])).toBe('2026-10-06');
  });

  it('BR-K6: koreksi pada periode terekspor — ADMIN ditolak, Super Admin boleh', async () => {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    const ci = await tambahCheckinTerbuka(`${TGL}T07:04:00+07:00`);
    const tolak = await koreksi(
      req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T17:04:00+07:00`, alasan: 'Coba admin' }, admin),
    );
    expect(tolak.status).toBe(403);
    const boleh = await koreksi(
      req({ operasi: 'tambah_checkout', checkin_id: ci, waktu: `${TGL}T17:04:00+07:00`, alasan: 'Oleh super' }, superadmin),
    );
    expect(boleh.status).toBe(200);
    await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
  });

  it('BR-K5: pembatalan = DITOLAK dengan alasan, baris tetap ada', async () => {
    const db = getDb();
    const id = ((await koreksi(
      req({ operasi: 'tambah_checkin', karyawan_id: kryId, waktu: `2026-10-07T07:00:00+07:00`, alasan: 'Sementara' }, superadmin),
    ).then((r) => r.json())).data as { id: number }).id;
    await db.execute({ sql: "UPDATE absensi SET status = 'DITOLAK', alasan_tolak = ? WHERE id = ?", args: ['Batal oleh admin', id] });
    const cek = await db.execute({ sql: 'SELECT id, status FROM absensi WHERE id = ?', args: [id] });
    expect(cek.rows.length).toBe(1);
    expect(String((cek.rows[0] as Record<string, unknown>)['status'])).toBe('DITOLAK');
  });
});
