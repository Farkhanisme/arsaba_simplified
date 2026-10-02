process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import type { Executor } from '../src/server/audit';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { buatTokenLink, buatLink } from '../src/server/repo/link';
import { terapkanMassal } from '../src/server/repo/ketidakhadiran';
import { GET as daftar, POST as tandai } from '../src/app/api/admin/tidak-berangkat/route';
import { PUT as ubah } from '../src/app/api/admin/tidak-berangkat/[id]/route';
import { DELETE as hapus } from '../src/app/api/admin/tidak-berangkat/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as absenRoute } from '../src/app/api/absen/route';

const DB_PATH = 'data/uji_m6_tidak_berangkat.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const PESAN_X3 = 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.';

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

async function cookieUntuk(username: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', 'test1234');
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M6 tandai tidak berangkat', () => {
  let admin = '';
  let superadmin = '';
  let superId = 0;
  let tokoId = 0;
  let kryId = 0;

  async function tambahKaryawan(nama: string, toko: number, mulai: string): Promise<number> {
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [id, toko, mulai] });
    return id;
  }

  async function tambahEvent(karyawan: number, tanggal: string, status: string, jenis = 'CHECKIN', alasan: string | null = null): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, alasan_tolak, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', ?, ?, ?)",
      args: [randomUUID(), karyawan, tokoId, tanggal, jenis, `${tanggal}T07:00:00+07:00`, status, alasan, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  const tandaiPost = (body: unknown, cookie: string) => tandai(req('/api/admin/tidak-berangkat', { method: 'POST', body, cookie }));

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = 'TEST-BOT-TOKEN-M6';
    process.env['TELEGRAM_CHAT_ID'] = '-1006';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko M6', sekarang] });
    tokoId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    superId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    kryId = await tambahKaryawan('Kry M6', tokoId, '2026-09-01');
  }, 120_000);

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/sendPhoto')) {
          return new Response(JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: -1006 }, photo: [{ file_id: 'K' }] } }), { status: 200 });
        }
        return new Response(new Uint8Array([1]), { status: 200 });
      }),
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    delete process.env['TELEGRAM_BOT_TOKEN'];
    delete process.env['TELEGRAM_CHAT_ID'];
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('BR-X3: MENUNGGU memblokir dengan pesan persis §5.5', async () => {
    await tambahEvent(kryId, '2026-10-01', 'MENUNGGU');
    const res = await tandaiPost({ karyawan_ids: [kryId], dari: '2026-10-01', jenis: 'IZIN' }, admin);
    expect(res.status).toBe(409);
    const badan = await res.json();
    expect(badan.kode).toBe('SEMUA_DITOLAK');
    expect(badan.data.ditolak[0].alasan).toBe('Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.');
  });

  it('BR-X3: DISETUJUI memblokir; DITOLAK saja tidak', async () => {
    await tambahEvent(kryId, '2026-10-02', 'DISETUJUI');
    const tolak = await tandaiPost({ karyawan_ids: [kryId], dari: '2026-10-02', jenis: 'IZIN' }, admin);
    expect(tolak.status).toBe(409);
    const kry2 = await tambahKaryawan('Kry Ditolak Saja', tokoId, '2026-09-01');
    await tambahEvent(kry2, '2026-10-02', 'DITOLAK', 'CHECKIN', 'Foto buram');
    const boleh = await tandaiPost({ karyawan_ids: [kry2], dari: '2026-10-02', jenis: 'IZIN' }, admin);
    expect(boleh.status).toBe(201);
    // DITOLAK tidak kehitung aktif: hanya 1 baris penandaan untuk kry2.
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry2] });
    expect(Number((cek.rows[0] as Record<string, unknown>)['c'])).toBe(1);
  });

  it('BR-X3: event tanggal lain / karyawan lain tidak memblokir; gagal tanpa audit', async () => {
    const db = getDb();
    const sebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    const ok = await tandaiPost({ karyawan_ids: [kryId], dari: '2026-10-03', jenis: 'TANPA_KETERANGAN' }, admin);
    expect(ok.status).toBe(201);
    const sesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    expect(Number((sesudah.rows[0] as Record<string, unknown>)['c'])).toBe(Number((sebelum.rows[0] as Record<string, unknown>)['c']) + 1);
    // Gagal BR-X3: audit tidak bertambah.
    const s2 = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    await tandaiPost({ karyawan_ids: [kryId], dari: '2026-10-01', jenis: 'IZIN' }, admin);
    const s3 = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    expect(Number((s3.rows[0] as Record<string, unknown>)['c'])).toBe(Number((s2.rows[0] as Record<string, unknown>)['c']));
  });

  it('BR-X2: ganda ditolak Bahasa Indonesia; constraint DB menahan', async () => {
    const kry = await tambahKaryawan('Kry Ganda', tokoId, '2026-09-01');
    expect((await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-04', jenis: 'IZIN' }, admin)).status).toBe(201);
    const ulang = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-04', jenis: 'IZIN' }, admin);
    expect(ulang.status).toBe(409);
    expect((await ulang.json()).data.ditolak[0].alasan).toMatch(/sudah ada.*Ubah/);
    // Backstop database: INSERT langsung ikut ditolak.
    const db = getDb();
    await expect(
      db.execute({ sql: 'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, 1, ?)', args: [kry, tokoId, '2026-10-04', 'IZIN', serialisasiWIB()] }),
    ).rejects.toThrow();
  });

  it('BR-X4: ubah jenis + catatan tersimpan dengan before/after', async () => {
    const kry = await tambahKaryawan('Kry Ubah', tokoId, '2026-09-01');
    const buat = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-05', jenis: 'IZIN', catatan: 'Sakit' }, admin);
    expect(buat.status).toBe(201);
    const db = getDb();
    const row = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?', args: [kry, '2026-10-05'] });
    const id = Number((row.rows[0] as Record<string, unknown>)['id']);
    const res = await ubah(req(`/api/admin/tidak-berangkat/${id}`, { method: 'PUT', body: { jenis: 'TANPA_KETERANGAN', catatan: 'Tanpa kabar' }, cookie: admin }));
    expect(res.status).toBe(200);
    const data = ((await res.json()).data as { jenis: string; catatan: string });
    expect(data.jenis).toBe('TANPA_KETERANGAN');
    expect(data.catatan).toBe('Tanpa kabar');
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'ketidakhadiran' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [id] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris.aksi).toBe('TIDAK_BERANGKAT_UBAH');
    expect(JSON.parse(baris.sebelum as string).jenis).toBe('IZIN');
    expect(JSON.parse(baris.sesudah as string).jenis).toBe('TANPA_KETERANGAN');
  });

  it('BR-X4: hapus membuka blokir — absen tak lagi TANGGAL_BERTANDA + audit', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('Kry Hapus Blokir', tokoId, '2026-09-01');
    const sekarang = serialisasiWIB();
    const link = await buatLink(kry, buatTokenLink(), superId, sekarang, db);
    // Absen route memeriksa penandaan pada TANGGAL HARI INI (server).
    const hariIni = tanggalWIB(sekarang);
    // Tandai dulu (tak ada event) — perlu penempatan mencakup hari ini? pakai tanggal tetap.
    const buat = await tandaiPost({ karyawan_ids: [kry], dari: hariIni, jenis: 'IZIN' }, admin);
    expect(buat.status).toBe(201);
    const fd = new FormData();
    fd.set('token', link.token);
    fd.set('jenis', 'CHECKIN');
    fd.set('request_id', randomUUID());
    fd.set('foto', new File([new Uint8Array(100)], 'foto.jpg', { type: 'image/jpeg' }));
    const headers = new Headers();
    headers.set('origin', APP_ORIGIN);
    const blocked = await absenRoute(new NextRequest('https://arsaba.vercel.app/api/absen', { method: 'POST', headers, body: fd }));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).kode).toBe('TANGGAL_BERTANDA');
    // Hapus penandaan.
    const row = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?', args: [kry, hariIni] });
    const id = Number((row.rows[0] as Record<string, unknown>)['id']);
    expect((await hapus(req(`/api/admin/tidak-berangkat/${id}`, { method: 'DELETE', cookie: admin }))).status).toBe(200);
    // Absen lagi: tidak lagi TANGGAL_BERTANDA (lolos ke 201 via stub Telegram).
    const fd2 = new FormData();
    fd2.set('token', link.token);
    fd2.set('jenis', 'CHECKIN');
    fd2.set('request_id', randomUUID());
    fd2.set('foto', new File([new Uint8Array(100)], 'foto.jpg', { type: 'image/jpeg' }));
    const headers2 = new Headers();
    headers2.set('origin', APP_ORIGIN);
    const lolos = await absenRoute(new NextRequest('https://arsaba.vercel.app/api/absen', { method: 'POST', headers: headers2, body: fd2 }));
    expect(lolos.status).toBe(201);
    const audit = await db.execute({ sql: "SELECT aksi FROM audit_log WHERE entitas = 'ketidakhadiran' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [id] });
    expect(String((audit.rows[0] as Record<string, unknown>)['aksi'])).toBe('TIDAK_BERANGKAT_HAPUS');
  });

  it('BR-X5: rentang 3 hari -> 3 penandaan', async () => {
    const kry = await tambahKaryawan('Kry Rentang', tokoId, '2026-09-01');
    const res = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-07', sampai: '2026-10-09', jenis: 'IZIN' }, admin);
    expect(res.status).toBe(201);
    expect(((await res.json()).data as { dibuat: unknown[] }).dibuat.length).toBe(3);
  });

  it('BATCH SEPARUH: 1 terblokir -> 201, lain tersimpan, ditolak dilapor + GET buktikan', async () => {
    const a = await tambahKaryawan('Kry Batch A', tokoId, '2026-09-01');
    const b = await tambahKaryawan('Kry Batch B', tokoId, '2026-09-01');
    await tambahEvent(a, '2026-10-10', 'MENUNGGU');
    const res = await tandaiPost({ karyawan_ids: [a, b], dari: '2026-10-10', jenis: 'IZIN' }, admin);
    expect(res.status).toBe(201);
    const data = ((await res.json()).data as { dibuat: { karyawan_id: number }[]; ditolak: { karyawan_id: number; alasan: string }[] });
    expect(data.dibuat.map((d) => d.karyawan_id)).toEqual([b]);
    expect(data.ditolak.map((d) => d.karyawan_id)).toEqual([a]);
    expect(data.ditolak[0]!.alasan).toBe(PESAN_X3);
    const daftarRes = await daftar(req(`/api/admin/tidak-berangkat?dari=2026-10-10&sampai=2026-10-10`, { cookie: admin }));
    const daftarData = ((await daftarRes.json()).data as { karyawan_id: number }[]);
    expect(daftarData.map((d) => d.karyawan_id)).toEqual([b]);
  });

  it('semua ditolak -> 409 + alasan, nol tersimpan', async () => {
    const a = await tambahKaryawan('Kry Nol A', tokoId, '2026-09-01');
    await tambahEvent(a, '2026-10-11', 'DISETUJUI');
    const res = await tandaiPost({ karyawan_ids: [a], dari: '2026-10-11', jenis: 'IZIN' }, admin);
    expect(res.status).toBe(409);
    const badan = await res.json();
    expect(badan.kode).toBe('SEMUA_DITOLAK');
    expect(badan.data.ditolak.length).toBe(1);
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?', args: [a, '2026-10-11'] });
    expect(cek.rows.length).toBe(0);
  });

  it('403 K-32 FAIL-FAST: Admin gagal total walau sel lain di luar periode', async () => {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    try {
      const kry = await tambahKaryawan('Kry Ekspor', tokoId, '2026-09-01');
      const res = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-20', sampai: '2026-11-02', jenis: 'IZIN' }, admin);
      expect(res.status).toBe(403);
      // Sel November (di luar periode) TIDAK ikut tersimpan.
      const cek = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry] });
      expect(cek.rows.length).toBe(0);
      const ok = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-20', sampai: '2026-11-02', jenis: 'IZIN' }, superadmin);
      expect(ok.status).toBe(201);
    } finally {
      await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
    }
  });

  it('error tak terduga me-rollback seluruh operasi', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('Kry Gagal Tulis', tokoId, '2026-09-01');
    await expect(
      denganTransaksi(async (tx) => {
        const exRusak: Executor = {
          execute: async (stmt) => {
            const sql = typeof stmt === 'string' ? stmt : stmt.sql;
            if (sql.includes('INSERT INTO ketidakhadiran')) throw new Error('disk I/O simulasi');
            return tx.execute(stmt);
          },
        };
        await terapkanMassal({ karyawanIds: [kry], jenis: 'IZIN', catatan: null, pelaku: { id: superId, peran: 'SUPER_ADMIN' } }, ['2026-12-05'], exRusak);
      }),
    ).rejects.toThrow('disk I/O simulasi');
    const cek = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry] });
    expect(cek.rows.length).toBe(0);
  });

  it('penandaan lama di tengah rentang -> hanya sel itu ditolak', async () => {
    const kry = await tambahKaryawan('Kry Tengah', tokoId, '2026-09-01');
    await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-13', jenis: 'IZIN' }, admin);
    const res = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-12', sampai: '2026-10-14', jenis: 'IZIN' }, admin);
    expect(res.status).toBe(201);
    const data = ((await res.json()).data as { dibuat: { tanggal: string }[]; ditolak: { tanggal: string }[] });
    expect(data.dibuat.map((d) => d.tanggal).sort()).toEqual(['2026-10-12', '2026-10-14']);
    expect(data.ditolak.map((d) => d.tanggal)).toEqual(['2026-10-13']);
  });

  it('K-32: ADMIN 403 buat/ubah/hapus; Super Admin 200', async () => {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    try {
      const kry = await tambahKaryawan('Kry K32', tokoId, '2026-09-01');
      expect((await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-22', jenis: 'IZIN' }, admin)).status).toBe(403);
      const ok = await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-22', jenis: 'IZIN' }, superadmin);
      expect(ok.status).toBe(201);
      const row = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry] });
      const id = Number((row.rows[0] as Record<string, unknown>)['id']);
      expect((await ubah(req(`/api/admin/tidak-berangkat/${id}`, { method: 'PUT', body: { catatan: 'x' }, cookie: admin }))).status).toBe(403);
      expect((await ubah(req(`/api/admin/tidak-berangkat/${id}`, { method: 'PUT', body: { catatan: 'y' }, cookie: superadmin }))).status).toBe(200);
      expect((await hapus(req(`/api/admin/tidak-berangkat/${id}`, { method: 'DELETE', cookie: admin }))).status).toBe(403);
      expect((await hapus(req(`/api/admin/tidak-berangkat/${id}`, { method: 'DELETE', cookie: superadmin }))).status).toBe(200);
    } finally {
      await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
    }
  });

  it('audit: buat/ubah/hapus tercatat; rollback tak berbekas', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('Kry Audit', tokoId, '2026-09-01');
    await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-23', jenis: 'IZIN', catatan: 'Sakit' }, superadmin);
    const row = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry] });
    const id = Number((row.rows[0] as Record<string, unknown>)['id']);
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'ketidakhadiran' AND entitas_id = ?", args: [id] });
    expect(audit.rows.length).toBe(1);
    expect(JSON.parse(((audit.rows[0] as Record<string, unknown>)['sesudah'] as string)).tanggal).toBe('2026-10-23');

    const sebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    const kry2 = await tambahKaryawan('Kry Audit Rollback', tokoId, '2026-09-01');
    await expect(
      denganTransaksi(async (tx) => {
        await terapkanMassal({ karyawanIds: [kry2], jenis: 'IZIN', catatan: null, pelaku: { id: superId, peran: 'SUPER_ADMIN' } }, ['2026-12-06'], tx);
        throw new Error('paksa rollback');
      }),
    ).rejects.toThrow('paksa rollback');
    const cek = await db.execute({ sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ?', args: [kry2] });
    expect(cek.rows.length).toBe(0);
    const sesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'ketidakhadiran'", args: [] });
    expect(Number((sesudah.rows[0] as Record<string, unknown>)['c'])).toBe(Number((sebelum.rows[0] as Record<string, unknown>)['c']));
  });

  it('izin: ADMIN bisa membuat penandaan (K-22)', async () => {
    const kry = await tambahKaryawan('Kry Izin Admin', tokoId, '2026-09-01');
    expect((await tandaiPost({ karyawan_ids: [kry], dari: '2026-10-24', jenis: 'IZIN' }, admin)).status).toBe(201);
  });
});
