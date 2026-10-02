process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import { serialisasiWIB } from '../src/server/waktu';
import { terapkanKeputusan } from '../src/server/repo/verifikasi';
import { daftarPasangan, adalahPasanganValid } from '../src/server/repo/verifikasi';
import { sudahDiekspor } from '../src/server/aturan/absensi';
import { GET as daftar } from '../src/app/api/admin/verifikasi/route';
import { POST as putusan } from '../src/app/api/admin/verifikasi/[id]/route';
import { POST as massal } from '../src/app/api/admin/verifikasi/massal/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m4_verifikasi.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const TGL = '2026-10-03';

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

describe('M4 verifikasi', () => {
  let admin = '';
  let superadmin = '';
  let tokoId = 0;
  let kryId = 0;
  let adminId = 0;

  async function tambahEvent(o: {
    jenis: 'CHECKIN' | 'CHECKOUT';
    waktu: string;
    tanggal?: string;
    status?: string;
    alasan?: string;
    checkinId?: number;
    final?: number;
  }): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, alasan_tolak, keterlambatan_final_menit, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', ?, ?, ?, ?)",
      args: [randomUUID(), kryId, tokoId, o.tanggal ?? TGL, o.jenis, o.checkinId ?? null, o.waktu, o.status ?? 'MENUNGGU', o.alasan ?? null, o.final ?? null, serialisasiWIB()],
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
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko V4', sekarang] });
    tokoId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Kry V4', sekarang] });
    kryId = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [kryId, tokoId, '2026-10-01'] });
    adminId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    // Jadwal snapshot: satu slot Pagi 07:00–17:00.
    await db.execute({ sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, NULL, 1, ?, ?)', args: [kryId, tokoId, TGL, adminId, sekarang] });
    const j = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const jadwalId = Number((j.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: "INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, 'Pagi', '07:00', '17:00')", args: [jadwalId] });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('selisih dihitung saat tampil: 07:06 vs 07:00 -> selisih 6, terlambat', async () => {
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:06:00+07:00` });
    const res = await daftar(req('/api/admin/verifikasi?status=MENUNGGU', { cookie: admin }));
    expect(res.status).toBe(200);
    const rows = ((await res.json()).data as { id: number; keterlambatan: { n: number; selisih: number; terlambatSistem: boolean; slot: { jam_mulai: string } } }[]);
    const baris = rows.find((r) => r.id === id)!;
    expect(baris.keterlambatan.n).toBe(1);
    expect(baris.keterlambatan.selisih).toBe(6);
    expect(baris.keterlambatan.terlambatSistem).toBe(true);
    expect(baris.keterlambatan.slot.jam_mulai).toBe('07:00');
  });

  it('BR-L4: ambang 5 -> 30 mengubah tanda data lama; final tak berubah', async () => {
    const db = getDb();
    await db.execute({ sql: "UPDATE pengaturan SET nilai = '30' WHERE kunci = 'ambang_terlambat_menit'", args: [] });
    const res = await daftar(req('/api/admin/verifikasi?status=MENUNGGU', { cookie: admin }));
    const rows = ((await res.json()).data as { keterlambatan: { selisih: number; terlambatSistem: boolean } }[]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      if (r.keterlambatan.selisih !== null && r.keterlambatan.selisih === 6) {
        expect(r.keterlambatan.terlambatSistem).toBe(false);
      }
    }
    // Final yang sudah diisi admin tidak ikut berubah.
    await db.execute({ sql: 'UPDATE absensi SET keterlambatan_final_menit = 6 WHERE tanggal = ?', args: [TGL] });
    await db.execute({ sql: "UPDATE pengaturan SET nilai = '5' WHERE kunci = 'ambang_terlambat_menit'", args: [] });
    const cek = await db.execute({ sql: "SELECT keterlambatan_final_menit AS m FROM absensi WHERE tanggal = ? LIMIT 1", args: [TGL] });
    expect(Number((cek.rows[0] as Record<string, unknown>)['m'])).toBe(6);
    await db.execute({ sql: 'UPDATE absensi SET keterlambatan_final_menit = NULL WHERE tanggal = ?', args: [TGL] });
  });

  it('BR-V2: tolak tanpa alasan ditolak aplikasi DAN constraint database', async () => {
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T08:00:00+07:00` });
    const res = await putusan(req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DITOLAK' }, cookie: admin }));
    expect(res.status).toBe(400);
    expect((await res.json()).pesan).toBe('Alasan penolakan wajib diisi.');
    const db = getDb();
    await expect(
      db.execute({ sql: 'UPDATE absensi SET status = ? WHERE id = ?', args: ['DITOLAK', id] }),
    ).rejects.toThrow();
  });

  it('BR-V7: setujui terlambat tanpa final ditolak; dengan 0 eksplisit berhasil', async () => {
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:06:00+07:00` });
    const tanpa = await putusan(req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
    expect(tanpa.status).toBe(400);
    const nol = await putusan(
      req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI', keterlambatan_final_menit: 0 }, cookie: admin }),
    );
    expect(nol.status).toBe(200);
    expect(((await nol.json()).data as { keterlambatan_final_menit: number }).keterlambatan_final_menit).toBe(0);
  });

  it('K-54: 1440 diterima; 1441, -1, 5000 ditolak di SERVER', async () => {
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:06:00+07:00` });
    const ok = await putusan(
      req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI', keterlambatan_final_menit: 1440 }, cookie: admin }),
    );
    expect(ok.status).toBe(200);
    for (const buruk of [1441, -1, 5000]) {
      const res = await putusan(
        req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI', keterlambatan_final_menit: buruk }, cookie: superadmin }),
      );
      expect(res.status, `final=${buruk}`).toBe(400);
      expect((await res.json()).pesan).toBe('Menit terlambat harus antara 0 dan 1440.');
    }
  });

  it('setujui check-in TIDAK terlambat tanpa final berhasil', async () => {
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T06:50:00+07:00` });
    const res = await putusan(req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
    expect(res.status).toBe(200);
  });

  it('BR-V4: verifikasi check-out tidak mengubah status check-in', async () => {
    const ci = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:00:00+07:00` });
    const co = await tambahEvent({ jenis: 'CHECKOUT', waktu: `${TGL}T17:00:00+07:00`, checkinId: ci });
    const res = await putusan(req(`/api/admin/verifikasi/${co}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
    expect(res.status).toBe(200);
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT status FROM absensi WHERE id = ?', args: [ci] });
    expect(String((cek.rows[0] as Record<string, unknown>)['status'])).toBe('MENUNGGU');
  });

  it('BR-V5: check-out dari check-in DITOLAK berdiri sendiri', async () => {
    const ci = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:00:00+07:00` });
    await putusan(req(`/api/admin/verifikasi/${ci}`, { method: 'POST', body: { keputusan: 'DITOLAK', alasan_tolak: 'Foto buram' }, cookie: superadmin }));
    const co = await tambahEvent({ jenis: 'CHECKOUT', waktu: `${TGL}T17:00:00+07:00`, checkinId: ci });
    const res = await putusan(req(`/api/admin/verifikasi/${co}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }));
    expect(res.status).toBe(200);
    // Bukan pasangan valid: check-in DITOLAK tidak masuk daftar pasangan.
    const db = getDb();
    const pasangan = await daftarPasangan(kryId, TGL, db);
    const terkait = pasangan.filter((p) => p.checkin_id === ci);
    expect(terkait.length).toBe(0);
  });

  it('BR-V6: keputusan bisa diubah sebelum ekspor; ADMIN ditolak setelah ekspor', async () => {
    const db = getDb();
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:01:00+07:00` });
    await putusan(req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
    const ubah = await putusan(
      req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DITOLAK', alasan_tolak: 'Salah orang' }, cookie: admin }),
    );
    expect(ubah.status).toBe(200);
    // Tandai periode terekspor.
    await db.execute({
      sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (1, ?, ?, ?, ?)',
      args: [serialisasiWIB(), '2026-10-01', '2026-10-31', tokoId],
    });
    expect(await sudahDiekspor(TGL, tokoId, db)).toBe(true);
    const tolakAdmin = await putusan(
      req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: admin }),
    );
    expect(tolakAdmin.status).toBe(403);
    const bolehSuper = await putusan(
      req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }),
    );
    expect(bolehSuper.status).toBe(200);
    await db.execute({ sql: 'DELETE FROM log_ekspor', args: [] });
  });

  it('massal: setujui 2 sekaligus; tolak massal satu alasan bersama', async () => {
    const a = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T06:40:00+07:00` });
    const b = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T06:41:00+07:00` });
    const setuju = await massal(req('/api/admin/verifikasi/massal', { method: 'POST', body: { ids: [a, b], keputusan: 'DISETUJUI' }, cookie: admin }));
    expect(setuju.status).toBe(200);
    expect(((await setuju.json()).data as { jumlah: number }).jumlah).toBe(2);
    const c = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T06:42:00+07:00` });
    const d = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T06:43:00+07:00` });
    const tanpaAlasan = await massal(req('/api/admin/verifikasi/massal', { method: 'POST', body: { ids: [c, d], keputusan: 'DITOLAK' }, cookie: admin }));
    expect(tanpaAlasan.status).toBe(400);
    const tolak = await massal(
      req('/api/admin/verifikasi/massal', { method: 'POST', body: { ids: [c, d], keputusan: 'DITOLAK', alasan_tolak: 'Bukan shiftnya' }, cookie: admin }),
    );
    expect(tolak.status).toBe(200);
    const db = getDb();
    const cek = await db.execute({ sql: 'SELECT status, alasan_tolak FROM absensi WHERE id IN (?, ?)', args: [c, d] });
    for (const baris of cek.rows) {
      const r = baris as Record<string, unknown>;
      expect(String(r['status'])).toBe('DITOLAK');
      expect(String(r['alasan_tolak'])).toBe('Bukan shiftnya');
    }
  });

  it('BR-H1/H2: pasangan valid, setengah, dan dua pasang per tanggal', async () => {
    const db = getDb();
    const ci1 = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:00:00+07:00`, status: 'DISETUJUI' });
    await tambahEvent({ jenis: 'CHECKOUT', waktu: `${TGL}T12:00:00+07:00`, checkinId: ci1, status: 'DISETUJUI' });
    const ci2 = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T13:00:00+07:00`, status: 'DISETUJUI' });
    await tambahEvent({ jenis: 'CHECKOUT', waktu: `${TGL}T18:00:00+07:00`, checkinId: ci2, status: 'MENUNGGU' });
    const pasangan = await daftarPasangan(kryId, TGL, db);
    const p1 = pasangan.find((p) => p.checkin_id === ci1)!;
    const p2 = pasangan.find((p) => p.checkin_id === ci2)!;
    expect(adalahPasanganValid(p1)).toBe(true);
    expect(adalahPasanganValid(p2)).toBe(false);
    expect(pasangan.filter((p) => adalahPasanganValid(p)).length).toBeGreaterThanOrEqual(1);
  });

  it('audit: setiap keputusan tercatat before/after; rollback tak berbekas', async () => {
    const db = getDb();
    const id = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:02:00+07:00` });
    await putusan(req(`/api/admin/verifikasi/${id}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }));
    const audit = await db.execute({ sql: "SELECT aksi, sebelum, sesudah FROM audit_log WHERE entitas = 'absensi' AND entitas_id = ? ORDER BY id DESC LIMIT 1", args: [id] });
    const baris = audit.rows[0] as unknown as { aksi: string; sebelum: string; sesudah: string };
    expect(baris.aksi).toBe('VERIFIKASI');
    expect(JSON.parse(baris.sebelum as string).status).toBe('MENUNGGU');
    expect(JSON.parse(baris.sesudah as string).status).toBe('DISETUJUI');

    const id2 = await tambahEvent({ jenis: 'CHECKIN', waktu: `${TGL}T07:03:00+07:00` });
    const auditSebelum = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'absensi' AND entitas_id = ?", args: [id2] });
    await expect(
      denganTransaksi(async (tx) => {
        await terapkanKeputusan(id2, { keputusan: 'DISETUJUI' }, { id: adminId, peran: 'SUPER_ADMIN' }, tx);
        throw new Error('paksa rollback');
      }),
    ).rejects.toThrow('paksa rollback');
    const status = await db.execute({ sql: 'SELECT status FROM absensi WHERE id = ?', args: [id2] });
    expect(String((status.rows[0] as Record<string, unknown>)['status'])).toBe('MENUNGGU');
    const auditSesudah = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'absensi' AND entitas_id = ?", args: [id2] });
    expect(Number((auditSesudah.rows[0] as Record<string, unknown>)['c'])).toBe(
      Number((auditSebelum.rows[0] as Record<string, unknown>)['c']),
    );
  });
});
