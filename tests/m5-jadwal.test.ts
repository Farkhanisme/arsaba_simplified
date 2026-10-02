process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import type { Executor } from '../src/server/audit';
import { catatAudit } from '../src/server/audit';
import { serialisasiWIB } from '../src/server/waktu';
import { buatAtauTimpa, terapkanMassal } from '../src/server/repo/jadwal';
import { GET as grid, POST as sel } from '../src/app/api/admin/jadwal/route';
import { POST as massal } from '../src/app/api/admin/jadwal/massal/route';
import { POST as override } from '../src/app/api/admin/jadwal/override/route';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as shiftBuatRoute } from '../src/app/api/admin/master/shift/route';
import { PUT as shiftUbahRoute } from '../src/app/api/admin/master/shift/[id]/route';

const DB_PATH = 'data/uji_m5_jadwal.db';
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

async function cookieUntuk(username: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', 'test1234');
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M5 jadwal', () => {
  let admin = '';
  let superadmin = '';
  let tokoId = 0;
  let adminDbId = 0;

  async function tambahKaryawan(nama: string, toko: number, mulai: string): Promise<number> {
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [id, toko, mulai] });
    return id;
  }

  async function tambahTemplate(nama: string, tipe: string, mulai: string, selesai: string): Promise<number> {
    const res = await shiftBuatRoute(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama, tipe_hari: tipe, jam_mulai: mulai, jam_selesai: selesai }, cookie: superadmin }),
    );
    expect(res.status).toBe(201);
    return ((await res.json()).data as { id: number }).id;
  }

  const selPost = (body: unknown, cookie: string) => sel(req('/api/admin/jadwal', { method: 'POST', body, cookie }));

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko J5', sekarang] });
    tokoId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    adminDbId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    await tambahTemplate('Pagi', 'SEMUA', '07:00', '17:00');
    await tambahTemplate('Sore', 'WEEKDAY', '14:00', '22:00');
    await tambahTemplate('Sore', 'WEEKEND', '15:00', '23:00');
    await tambahTemplate('Harian', 'WEEKDAY', '08:00', '16:00');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('BR-J3: ubah template tidak mengubah jadwal lampau; slot = salinan persis', async () => {
    const kry = await tambahKaryawan('Kry Snap', tokoId, '2026-09-01');
    const buat = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-05', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect(buat.status).toBe(201);
    // Ubah template Pagi 07:00-17:00 -> 08:00-18:00.
    const db = getDb();
    const tpl = await db.execute({ sql: "SELECT id FROM shift_template WHERE toko_id = ? AND nama = 'Pagi'", args: [tokoId] });
    const tplId = Number((tpl.rows[0] as Record<string, unknown>)['id']);
    const ubah = await shiftUbahRoute(req(`/api/admin/master/shift/${tplId}`, { method: 'PUT', body: { jam_mulai: '08:00', jam_selesai: '18:00' }, cookie: superadmin }));
    expect(ubah.status).toBe(200);
    // Jadwal lampau TETAP 07:00-17:00.
    const gridRes = await grid(req(`/api/admin/jadwal?toko_id=${tokoId}&mode=hari&tanggal=2026-10-05`, { cookie: admin }));
    const data = (await gridRes.json()).data as { jadwal: { karyawan_id: number; slot: { nama: string; jam_mulai: string; jam_selesai: string }[] }[] };
    const baris = data.jadwal.find((j) => j.karyawan_id === kry)!;
    expect(baris.slot).toEqual([{ urutan: 1, nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '17:00' }]);
    // Kembalikan template agar tes lain tidak terpengaruh.
    await shiftUbahRoute(req(`/api/admin/master/shift/${tplId}`, { method: 'PUT', body: { jam_mulai: '07:00', jam_selesai: '17:00' }, cookie: superadmin }));
  });

  it('BR-J7: dua slot tumpang tindih TETAP tersimpan (200) + peringatan', async () => {
    const kry = await tambahKaryawan('Kry Overlap', tokoId, '2026-09-01');
    const res = await override(
      req('/api/admin/jadwal/override', {
        method: 'POST',
        body: { karyawan_id: kry, tanggal: '2026-10-06', aksi: 'simpan', slots: [{ nama: 'A', jam_mulai: '07:00', jam_selesai: '12:00' }, { nama: 'B', jam_mulai: '11:00', jam_selesai: '18:00' }] },
        cookie: admin,
      }),
    );
    expect(res.status).toBe(201);
    const badan = await res.json();
    expect((badan.data as { peringatan: unknown[] }).peringatan.length).toBeGreaterThan(0);
    expect(badan.pesan as string).toMatch(/tumpang tindih/);
  });

  it('K-27: 3 slot ditolak; 1 slot -> 2 boleh; lalu 3 tetap ditolak', async () => {
    const kry = await tambahKaryawan('Kry Batas', tokoId, '2026-09-01');
    const tiga = await override(
      req('/api/admin/jadwal/override', {
        method: 'POST',
        body: {
          karyawan_id: kry,
          tanggal: '2026-10-07',
          aksi: 'simpan',
          slots: [
            { nama: 'A', jam_mulai: '06:00', jam_selesai: '10:00' },
            { nama: 'B', jam_mulai: '10:00', jam_selesai: '14:00' },
            { nama: 'C', jam_mulai: '14:00', jam_selesai: '18:00' },
          ],
        },
        cookie: admin,
      }),
    );
    expect(tiga.status).toBe(400);
    expect((await tiga.json()).pesan).toMatch(/2 slot/);
    // Jadwal 1 slot -> override 2 slot BOLEH.
    await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-07', nama_template: 'Pagi', mode: 'lewati' }, admin);
    const dua = await override(
      req('/api/admin/jadwal/override', {
        method: 'POST',
        body: { karyawan_id: kry, tanggal: '2026-10-07', aksi: 'simpan', slots: [{ nama: 'A', jam_mulai: '07:00', jam_selesai: '12:00' }, { nama: 'B', jam_mulai: '18:00', jam_selesai: '23:00' }] },
        cookie: admin,
      }),
    );
    expect(dua.status).toBe(201);
    const tigaLagi = await override(
      req('/api/admin/jadwal/override', {
        method: 'POST',
        body: {
          karyawan_id: kry,
          tanggal: '2026-10-07',
          aksi: 'simpan',
          slots: [
            { nama: 'A', jam_mulai: '06:00', jam_selesai: '10:00' },
            { nama: 'B', jam_mulai: '10:00', jam_selesai: '14:00' },
            { nama: 'C', jam_mulai: '14:00', jam_selesai: '18:00' },
          ],
        },
        cookie: admin,
      }),
    );
    expect(tigaLagi.status).toBe(400);
  });

  it('BR-J4: belum ditempatkan ditolak; pindahan boleh dijadwalkan di toko lama (lampau)', async () => {
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Kry Asing', sekarang] });
    const asing = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    const tolak = await selPost({ toko_id: tokoId, karyawan_id: asing, tanggal: '2026-10-05', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect(tolak.status).toBe(409);
    expect((await tolak.json()).pesan).toBe('Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.');

    // Pindahan: A [2026-09-01..] lalu pindah ke toko lain efektif 2026-10-01.
    const kry = await tambahKaryawan('Kry Pindah', tokoId, '2026-09-01');
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko Lain', sekarang] });
    const tokoLain = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE karyawan_id = ? AND berlaku_sampai IS NULL', args: ['2026-09-30', kry] });
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [kry, tokoLain, '2026-10-01'] });
    // Lampau (2026-09-15) di toko lama BOLEH.
    const boleh = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-09-15', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect(boleh.status).toBe(201);
    // Kini (2026-10-05) di toko lama DITOLAK.
    const kini = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-05', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect(kini.status).toBe(409);
  });

  it('BR-J5: default dilewati + dilaporkan; tanpa mode ditolak; timpa eksplisit', async () => {
    const kry = await tambahKaryawan('Kry Massal', tokoId, '2026-09-01');
    await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-12', nama_template: 'Pagi', mode: 'lewati' }, admin);
    // Tanpa mode -> DITOLAK (tanpa default diam-diam).
    const tanpaMode = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-12', nama_template: 'Sore' }, admin);
    expect(tanpaMode.status).toBe(400);
    // Default lewati.
    const lewati = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-12', nama_template: 'Sore', mode: 'lewati' }, admin);
    expect(lewati.status).toBe(200);
    expect(((await lewati.json()).data as { status: string }).status).toBe('dilewati');
    // Timpa eksplisit.
    const timpa = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-12', nama_template: 'Sore', mode: 'timpa' }, admin);
    expect(timpa.status).toBe(201);
    expect(((await timpa.json()).data as { status: string }).status).toBe('ditimpa');
  });

  it('BR-J5 massal: pratinjau tanpa menulis; terapkan lapor dilewati', async () => {
    const a = await tambahKaryawan('Kry M1', tokoId, '2026-09-01');
    const b = await tambahKaryawan('Kry M2', tokoId, '2026-09-01');
    await selPost({ toko_id: tokoId, karyawan_id: a, tanggal: '2026-10-13', nama_template: 'Pagi', mode: 'lewati' }, admin);
    const pra = await massal(
      req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [a, b], dari: '2026-10-13', sampai: '2026-10-14', nama_template: 'Pagi', mode: 'lewati', pratinjau: true }, cookie: admin }),
    );
    expect(pra.status).toBe(200);
    const ringkas = ((await pra.json()).data as { baru: unknown[]; dilewati: unknown[]; ditolak: unknown[] });
    expect(ringkas.baru.length).toBe(3);
    expect(ringkas.dilewati.length).toBe(1);
    // Pratinjau TIDAK menulis: b/2026-10-13 masih kosong.
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', args: [b, '2026-10-13'] });
    expect(cek.rows.length).toBe(0);
    // Terapkan.
    const terap = await massal(
      req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [a, b], dari: '2026-10-13', sampai: '2026-10-14', nama_template: 'Pagi', mode: 'lewati' }, cookie: admin }),
    );
    expect(terap.status).toBe(201);
    const hasil = ((await terap.json()).data as { baru: unknown[]; dilewati: { karyawan_id: number; tanggal: string }[]; ditimpa: unknown[]; ditolak: unknown[] });
    expect(hasil.baru.length).toBe(3);
    expect(hasil.dilewati.length).toBe(1);
    expect(hasil.dilewati[0]).toEqual({ karyawan_id: a, tanggal: '2026-10-13' });
    expect(hasil.ditimpa).toEqual([]);
    expect(hasil.ditolak).toEqual([]);
  });

  it('BR-J2: Sabtu + template hanya WEEKDAY ditolak; SEMUA cocok; pasangan WD/WE tepat', async () => {
    const kry = await tambahKaryawan('Kry J2', tokoId, '2026-09-01');
    // 2026-10-03 = Sabtu. 'Harian' hanya WEEKDAY.
    const tolak = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-03', nama_template: 'Harian', mode: 'lewati' }, admin);
    expect(tolak.status).toBe(409);
    expect((await tolak.json()).pesan).toBe("Shift 'Harian' tidak memiliki jam untuk hari weekend.");
    // Senin boleh.
    expect((await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-05', nama_template: 'Harian', mode: 'lewati' }, admin)).status).toBe(201);
    // 'Sore' Sabtu -> versi WEEKEND 15:00-23:00.
    const sore = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-10', nama_template: 'Sore', mode: 'lewati' }, admin);
    expect(sore.status).toBe(201);
    const db = getDb();
    const slot = await db.execute({
      sql: 'SELECT jam_mulai, jam_selesai FROM jadwal_slot WHERE jadwal_id = (SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?)',
      args: [kry, '2026-10-10'],
    });
    expect(String((slot.rows[0] as Record<string, unknown>)['jam_mulai'])).toBe('15:00');
  });

  it('BR-J6: urut naik, override=1, tanggal baru, kembali standar, catatan opsional', async () => {
    const kry = await tambahKaryawan('Kry Override', tokoId, '2026-09-01');
    const simpan = await override(
      req('/api/admin/jadwal/override', {
        method: 'POST',
        body: { karyawan_id: kry, tanggal: '2026-10-20', aksi: 'simpan', slots: [{ nama: 'Malam', jam_mulai: '18:00', jam_selesai: '23:00' }, { nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '12:00' }] },
        cookie: admin,
      }),
    );
    expect(simpan.status).toBe(201);
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT id, is_override FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', args: [kry, '2026-10-20'] });
    expect(Number((cek.rows[0] as Record<string, unknown>)['is_override'])).toBe(1);
    const slot = await db.execute({ sql: 'SELECT nama FROM jadwal_slot WHERE jadwal_id = ? ORDER BY urutan ASC', args: [Number((cek.rows[0] as Record<string, unknown>)['id'])] });
    expect(slot.rows.map((r) => String((r as Record<string, unknown>)['nama']))).toEqual(['Pagi', 'Malam']);
    // Kembali ke standar.
    const kembali = await override(
      req('/api/admin/jadwal/override', { method: 'POST', body: { karyawan_id: kry, tanggal: '2026-10-20', aksi: 'kembalikan', nama_template: 'Pagi' }, cookie: admin }),
    );
    expect(kembali.status).toBe(200);
    const sesudah = await db.execute({ sql: 'SELECT is_override, shift_template_id, catatan FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', args: [kry, '2026-10-20'] });
    expect(Number((sesudah.rows[0] as Record<string, unknown>)['is_override'])).toBe(0);
    expect((sesudah.rows[0] as Record<string, unknown>)['shift_template_id']).not.toBeNull();
  });

  it('BR-J8: mengubah jadwal 3 bulan lalu diterima', async () => {
    const kry = await tambahKaryawan('Kry Lampau', tokoId, '2026-06-01');
    const res = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-07-05', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect(res.status).toBe(201);
  });

  it('BR-J9: periode terekspor — ADMIN 403, Super Admin 200', async () => {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    try {
      const kry = await tambahKaryawan('Kry Ekspor', tokoId, '2026-09-01');
      const tolak = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-21', nama_template: 'Pagi', mode: 'lewati' }, admin);
      expect(tolak.status).toBe(403);
      const boleh = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-21', nama_template: 'Pagi', mode: 'lewati' }, superadmin);
      expect(boleh.status).toBe(201);
      // Massal: sel terekspor masuk ditolak (bukan gagal total) — B-19 opsi A.
      const massalTolak = await massal(
        req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [kry], dari: '2026-10-22', sampai: '2026-10-22', nama_template: 'Pagi', mode: 'lewati' }, cookie: admin }),
      );
      expect(massalTolak.status).toBe(409);
      expect((await massalTolak.json()).kode).toBe('SEMUA_DITOLAK');
    } finally {
      await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
    }
  });

  it('audit: mutasi tercatat before/after; rollback tak berbekas', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('Kry Audit', tokoId, '2026-09-01');
    await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-25', nama_template: 'Pagi', mode: 'lewati' }, superadmin);
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'jadwal' ORDER BY id DESC LIMIT 1", args: [] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string | null; sesudah: string };
    expect(baris.aksi).toBe('JADWAL_BUAT');
    expect(JSON.parse(baris.sesudah as string).tanggal).toBe('2026-10-25');

    const kry2 = await tambahKaryawan('Kry Rollback', tokoId, '2026-09-01');
    const auditSebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
    await expect(
      denganTransaksi(async (tx) => {
        await buatAtauTimpa({ tokoId, karyawanId: kry2, tanggal: '2026-10-26', namaTemplate: 'Pagi', mode: 'lewati', pelaku: { id: adminDbId, peran: 'SUPER_ADMIN' } }, tx);
        await catatAudit({ waktu: serialisasiWIB(), pengguna_id: adminDbId, aksi: 'JADWAL_BUAT', entitas: 'jadwal' }, tx);
        throw new Error('paksa rollback');
      }),
    ).rejects.toThrow('paksa rollback');
    const cek = await db.execute({ sql: 'SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', args: [kry2, '2026-10-26'] });
    expect(cek.rows.length).toBe(0);
    const auditSesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
    expect(Number((auditSesudah.rows[0] as Record<string, unknown>)['c'])).toBe(Number((auditSebelum.rows[0] as Record<string, unknown>)['c']));
  });

  it('izin: ADMIN bisa jadwal (200); ADMIN tidak bisa template shift (403)', async () => {
    const kry = await tambahKaryawan('Kry Izin', tokoId, '2026-09-01');
    const ok = await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-10-27', nama_template: 'Pagi', mode: 'lewati' }, admin);
    expect([200, 201]).toContain(ok.status);
    const tpl = await shiftBuatRoute(
      req('/api/admin/master/shift', { method: 'POST', body: { toko_id: tokoId, nama: 'X', tipe_hari: 'SEMUA', jam_mulai: '09:00', jam_selesai: '17:00' }, cookie: admin }),
    );
    expect(tpl.status).toBe(403);
  });

  it('grid: 26 karyawan x 7 kolom; weekend ditandai benar', async () => {
    const db = getDb();
    // Top-up hingga 26 karyawan DITEMPATKAN di toko ini pada rentang uji.
    const ada = await db.execute({
      sql: 'SELECT COUNT(DISTINCT k.id) AS c FROM karyawan k JOIN karyawan_penempatan p ON p.karyawan_id = k.id WHERE k.aktif = 1 AND p.toko_id = ? AND p.berlaku_mulai <= ? AND (p.berlaku_sampai IS NULL OR p.berlaku_sampai >= ?)',
      args: [tokoId, '2026-10-04', '2026-09-28'],
    });
    const kurang = 26 - Number((ada.rows[0] as Record<string, unknown>)['c']);
    for (let i = 0; i < kurang; i++) {
      await tambahKaryawan(`Kry Grid ${i}`, tokoId, '2026-09-01');
    }
    const res = await grid(req(`/api/admin/jadwal?toko_id=${tokoId}&mode=minggu&tanggal=2026-10-03`, { cookie: admin }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data as {
      rentang: { tanggal: string; hari: string; weekend: boolean }[];
      karyawan: unknown[];
    };
    expect(data.karyawan.length).toBe(26);
    expect(data.rentang.length).toBe(7);
    const sabtu = data.rentang.find((r) => r.tanggal === '2026-10-03')!;
    const minggu = data.rentang.find((r) => r.tanggal === '2026-10-04')!;
    const senin = data.rentang.find((r) => r.tanggal === '2026-09-28')!;
    expect(senin.hari).toBe('Senin');
    expect(sabtu.weekend).toBe(true);
    expect(sabtu.hari).toBe('Sabtu');
    expect(minggu.weekend).toBe(true);
    expect(senin.weekend).toBe(false);
  });

  it('B-19 INTI: 1 karyawan keluar penempatan di sebagian tanggal -> 201, valid tersimpan, ditolak dilapor', async () => {
    const db = getDb();
    const sekarang = serialisasiWIB();
    // Karyawan pindah ke toko lain efektif 2026-10-15 (tengah rentang).
    const kry = await tambahKaryawan('Kry Sebagian', tokoId, '2026-09-01');
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko Pindah B19', sekarang] });
    const tokoLain = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE karyawan_id = ? AND berlaku_sampai IS NULL', args: ['2026-10-14', kry] });
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [kry, tokoLain, '2026-10-15'] });

    const res = await massal(
      req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [kry], dari: '2026-10-13', sampai: '2026-10-16', nama_template: 'Pagi', mode: 'lewati' }, cookie: admin }),
    );
    expect(res.status).toBe(201);
    const data = ((await res.json()).data as { baru: { karyawan_id: number; tanggal: string }[]; dilewati: unknown[]; ditimpa: unknown[]; ditolak: { tanggal: string; alasan: string }[] });
    expect(data.baru.map((b) => b.tanggal).sort()).toEqual(['2026-10-13', '2026-10-14']);
    expect(data.ditolak.map((b) => b.tanggal).sort()).toEqual(['2026-10-15', '2026-10-16']);
    expect(data.ditolak[0]!.alasan).toBe('Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.');
    // Sel valid benar-benar ada di database (bukan hanya diklaim respons).
    const cek = await db.execute({ sql: 'SELECT tanggal FROM jadwal WHERE karyawan_id = ? ORDER BY tanggal ASC', args: [kry] });
    expect(cek.rows.map((r) => String((r as Record<string, unknown>)['tanggal']))).toEqual(['2026-10-13', '2026-10-14']);
  });

  it('B-19 INVARIAN: hitungan pratinjau == hitungan apply (input sama)', async () => {
    const kry = await tambahKaryawan('Kry Invarian', tokoId, '2026-09-01');
    await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-11-02', nama_template: 'Pagi', mode: 'lewati' }, admin);
    const badan = { toko_id: tokoId, karyawan_ids: [kry, 999999], dari: '2026-11-02', sampai: '2026-11-03', nama_template: 'Pagi', mode: 'lewati' as const };
    const pra = ((await (await massal(req('/api/admin/jadwal/massal', { method: 'POST', body: { ...badan, pratinjau: true }, cookie: admin }))).json()).data as {
      baru: { karyawan_id: number; tanggal: string }[];
      dilewati: { karyawan_id: number; tanggal: string }[];
      ditimpa: { karyawan_id: number; tanggal: string }[];
      ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
    });
    const terap = await massal(req('/api/admin/jadwal/massal', { method: 'POST', body: badan, cookie: admin }));
    expect(terap.status).toBe(201);
    const hasil = ((await terap.json()).data as typeof pra);
    // 999999 = karyawan fiktif -> 2 sel ditolak di kedua jalur.
    expect(hasil.baru).toEqual(pra.baru);
    expect(hasil.dilewati).toEqual(pra.dilewati);
    expect(hasil.ditimpa).toEqual(pra.ditimpa);
    expect(hasil.ditolak).toEqual(pra.ditolak);
    expect(pra.ditolak.length).toBe(2);
  });

  it('B-19 INVARIAN mode timpa: pratinjau ditimpa == apply ditimpa', async () => {
    const kry = await tambahKaryawan('Kry Invarian Timpa', tokoId, '2026-09-01');
    await selPost({ toko_id: tokoId, karyawan_id: kry, tanggal: '2026-11-10', nama_template: 'Pagi', mode: 'lewati' }, admin);
    const badan = { toko_id: tokoId, karyawan_ids: [kry], dari: '2026-11-10', sampai: '2026-11-10', nama_template: 'Sore', mode: 'timpa' as const };
    const pra = ((await (await massal(req('/api/admin/jadwal/massal', { method: 'POST', body: { ...badan, pratinjau: true }, cookie: admin }))).json()).data as {
      ditimpa: { karyawan_id: number; tanggal: string }[];
    });
    expect(pra.ditimpa).toEqual([{ karyawan_id: kry, tanggal: '2026-11-10' }]);
    const terap = await massal(req('/api/admin/jadwal/massal', { method: 'POST', body: badan, cookie: admin }));
    expect(terap.status).toBe(201);
    const hasil = ((await terap.json()).data as { ditimpa: { karyawan_id: number; tanggal: string }[] });
    expect(hasil.ditimpa).toEqual([{ karyawan_id: kry, tanggal: '2026-11-10' }]);
    // Benar-benar tertimpa dengan Sore (15:00 versi WEEKEND? 2026-11-10 = Selasa -> WEEKDAY 14:00).
    const db = getDb();
    const slot = await db.execute({ sql: 'SELECT jam_mulai FROM jadwal_slot WHERE jadwal_id = (SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?)', args: [kry, '2026-11-10'] });
    expect(String((slot.rows[0] as Record<string, unknown>)['jam_mulai'])).toBe('14:00');
  });

  it('B-19: semua sel ditolak -> 409 + daftar alasan, tidak ada tersimpan', async () => {
    const res = await massal(
      req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [999998], dari: '2026-10-13', sampai: '2026-10-14', nama_template: 'Pagi', mode: 'lewati' }, cookie: admin }),
    );
    expect(res.status).toBe(409);
    const badan = await res.json();
    expect(badan.kode).toBe('SEMUA_DITOLAK');
    const data = badan.data as { ditolak: { alasan: string }[] };
    expect(data.ditolak.length).toBe(2);
    expect(data.ditolak[0]!.alasan).toBe('Karyawan tidak ditemukan atau nonaktif.');
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM jadwal WHERE karyawan_id = ?', args: [999998] });
    expect(Number((cek.rows[0] as Record<string, unknown>)['c'])).toBe(0);
  });

  it('B-19: error tak terduga di tengah tulis me-rollback seluruh operasi (fail-safe)', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('Kry Gagal Tulis', tokoId, '2026-09-01');
    const auditSebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
    // Executor rusak: SELECT jalan normal, INSERT slot meledak (simulasi galat I/O).
    await expect(
      denganTransaksi(async (tx) => {
        const exRusak: Executor = {
          execute: async (stmt) => {
            const sql = typeof stmt === 'string' ? stmt : stmt.sql;
            if (sql.includes('INSERT INTO jadwal_slot')) throw new Error('disk I/O simulasi');
            return tx.execute(stmt);
          },
        };
        await terapkanMassal(
          { tokoId, karyawanIds: [kry], namaTemplate: 'Pagi', mode: 'lewati', pelaku: { id: adminDbId, peran: 'SUPER_ADMIN' } },
          ['2026-12-05'],
          exRusak,
        );
      }),
    ).rejects.toThrow('disk I/O simulasi');
    // Rollback penuh: baris jadwal (yang sempat ter-INSERT) ikut hilang.
    const cek = await db.execute({ sql: 'SELECT id FROM jadwal WHERE karyawan_id = ?', args: [kry] });
    expect(cek.rows.length).toBe(0);
    const auditSesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
    expect(Number((auditSesudah.rows[0] as Record<string, unknown>)['c'])).toBe(Number((auditSebelum.rows[0] as Record<string, unknown>)['c']));
  });

  it('B-19: sel terekspor masuk ditolak, sel lain tersimpan; audit hanya yang berhasil', async () => {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    try {
      const kry = await tambahKaryawan('Kry Ekspor B19', tokoId, '2026-09-01');
      const auditSebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
      const res = await massal(
        req('/api/admin/jadwal/massal', { method: 'POST', body: { toko_id: tokoId, karyawan_ids: [kry], dari: '2026-10-24', sampai: '2026-11-02', nama_template: 'Pagi', mode: 'lewati' }, cookie: admin }),
      );
      expect(res.status).toBe(201);
      const data = ((await res.json()).data as { baru: { tanggal: string }[]; ditolak: { tanggal: string }[] });
      // Oktober terekspor -> ditolak; November bebas -> tersimpan.
      expect(data.ditolak.map((d) => d.tanggal).sort()).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
      expect(data.baru.map((d) => d.tanggal).sort()).toEqual(['2026-11-01', '2026-11-02']);
      // Audit bertambah tepat 2 (sel berhasil); 8 sel ditolak menambah 0.
      const auditSesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'jadwal'", args: [] });
      expect(Number((auditSesudah.rows[0] as Record<string, unknown>)['c']) - Number((auditSebelum.rows[0] as Record<string, unknown>)['c'])).toBe(2);
    } finally {
      await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
    }
  });
});
