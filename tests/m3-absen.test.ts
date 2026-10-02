process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { tanggalWIB, serialisasiWIB, geserJamISO } from '../src/server/waktu';
import { sehariSebelum } from '../src/server/aturan/penempatan';
import { buatTokenLink, buatLink } from '../src/server/repo/link';
import { pindahKaryawan } from '../src/server/repo/penempatan';
import { POST as absenRoute } from '../src/app/api/absen/route';
import { GET as infoRoute } from '../src/app/api/absen/info/route';
import { GET as fotoRoute } from '../src/app/api/foto/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m3_absen.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const PESAN_LINK = 'Link tidak berlaku. Hubungi admin.';

function reqForm(url: string, form: FormData, opsi: { cookie?: string; origin?: string | null } = {}) {
  const headers = new Headers();
  if (opsi.origin !== null) headers.set('origin', opsi.origin ?? APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`https://arsaba.vercel.app${url}`, { method: 'POST', headers, body: form });
}

function reqGet(url: string, opsi: { cookie?: string } = {}) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`https://arsaba.vercel.app${url}`, { method: 'GET', headers });
}

function formAbsen(isi: {
  token: string;
  jenis: string;
  request_id?: string;
  foto?: boolean;
  tipeFoto?: string;
  ukuranFoto?: number;
  lat?: string;
  lng?: string;
  lokasi_status?: string;
}): FormData {
  const fd = new FormData();
  fd.set('token', isi.token);
  fd.set('jenis', isi.jenis);
  fd.set('request_id', isi.request_id ?? randomUUID());
  if (isi.foto !== false) {
    const n = isi.ukuranFoto ?? 1000;
    fd.set('foto', new File([new Uint8Array(n)], 'foto.jpg', { type: isi.tipeFoto ?? 'image/jpeg' }));
  }
  if (isi.lat !== undefined) fd.set('lat', isi.lat);
  if (isi.lng !== undefined) fd.set('lng', isi.lng);
  if (isi.lokasi_status !== undefined) fd.set('lokasi_status', isi.lokasi_status);
  return fd;
}

function stubTelegramSukses(fileId = 'BESAR') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith('/sendPhoto')) {
        return new Response(
          JSON.stringify({ ok: true, result: { message_id: 7, chat: { id: -1001 }, photo: [{ file_id: 'KECIL' }, { file_id: fileId }] } }),
          { status: 200 },
        );
      }
      if (u.endsWith('/getFile')) {
        return new Response(JSON.stringify({ ok: true, result: { file_id: fileId, file_path: 'p/foto.jpg' } }), { status: 200 });
      }
      return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
    }),
  );
}

async function cookieUntuk(username: string, password: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest('https://arsaba.vercel.app/api/login', { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

describe('M3 absen — route /api/absen', () => {
  let tokoA = 0;
  let tokoB = 0;
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let kryA = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = 'TEST-BOT-TOKEN-M3';
    process.env['TELEGRAM_CHAT_ID'] = '-1001';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    const db = getDb();
    const sekarang = serialisasiWIB();
    for (const nama of ['Toko A3', 'Toko B3']) {
      await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    }
    const toko = await db.execute({ sql: 'SELECT id, nama FROM toko ORDER BY id ASC', args: [] });
    tokoA = Number((toko.rows[0] as Record<string, unknown>)['id']);
    tokoB = Number((toko.rows[1] as Record<string, unknown>)['id']);

    async function karyawanDenganLink(nama: string): Promise<{ id: number; token: string }> {
      await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
      const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
      const id = Number((r.rows[0] as Record<string, unknown>)['id']);
      const hariIni = tanggalWIB(sekarang);
      await pindahKaryawan(id, tokoA, hariIni, db);
      const link = await buatLink(id, buatTokenLink(), 1, sekarang, db);
      return { id, token: link.token };
    }
    const a = await karyawanDenganLink('Kry A');
    kryA = a.id;
    tokenA = a.token;
    tokenB = (await karyawanDenganLink('Kry B')).token;
    tokenC = (await karyawanDenganLink('Kry C')).token;
  }, 120_000);

  beforeEach(() => {
    stubTelegramSukses();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  async function hitungAbsensi(): Promise<number> {
    const r = await getDb().execute({ sql: 'SELECT COUNT(*) AS c FROM absensi', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['c']);
  }

  it('BR-A1: token tak dikenal, dicabut, dan nonaktif -> pesan IDENTIK', async () => {
    const db = getDb();
    const r1 = await absenRoute(reqForm('/api/absen', formAbsen({ token: 'token-ngawur', jenis: 'CHECKIN' })));
    expect(r1.status).toBe(404);
    // Cabut link B.
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'UPDATE karyawan_link SET dicabut_at = ? WHERE token = ?', args: [sekarang, tokenB] });
    const r2 = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenB, jenis: 'CHECKIN' })));
    // Nonaktifkan karyawan C.
    await db.execute({ sql: 'UPDATE karyawan SET aktif = 0 WHERE id = (SELECT karyawan_id FROM karyawan_link WHERE token = ?)', args: [tokenC] });
    const r3 = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenC, jenis: 'CHECKIN' })));
    const p1 = (await r1.json()).pesan;
    const p2 = (await r2.json()).pesan;
    const p3 = (await r3.json()).pesan;
    expect(p1).toBe(PESAN_LINK);
    expect(p2).toBe(p1);
    expect(p3).toBe(p1);
  });

  it('BR-A1: karyawan aktif bisa lanjut (201 + kolom foto terisi)', async () => {
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKIN', lat: '-6.2', lng: '106.8' })));
    expect(res.status).toBe(201);
    const badan = await res.json();
    expect(badan.data.status).toBe('MENUNGGU');
    const db = getDb();
    const semua = await db.execute({ sql: 'SELECT foto_file_id, foto_chat_id, foto_message_id, lokasi_status, lat, lng FROM absensi ORDER BY id DESC LIMIT 1', args: [] });
    const b = semua.rows[0] as Record<string, unknown>;
    expect(b['foto_file_id']).toBe('BESAR');
    expect(b['foto_chat_id']).toBe('-1001');
    expect(b['foto_message_id']).toBe(7);
    expect(b['lokasi_status']).toBe('TERSEDIA');
  });

  it('BR-A4: Telegram gagal -> TIDAK ADA record', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    );
    // Karyawan segar agar pasti lolos validasi aturan dan sampai ke Telegram.
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry Telegram', 1, ?)", args: [sekarang] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await pindahKaryawan(id, tokoA, tanggalWIB(sekarang), db);
    const link = await buatLink(id, buatTokenLink(), 1, sekarang, db);
    const sebelum = await hitungAbsensi();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })));
    expect(res.status).toBe(502);
    expect((await res.json()).pesan).toBe('Absen gagal dikirim dan tidak tersimpan. Silakan coba lagi.');
    expect(await hitungAbsensi()).toBe(sebelum);
  });

  it('BR-A11: request_id sama dua kali -> SATU record, hasil sama', async () => {
    const rid = randomUUID();
    const r1 = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKOUT', request_id: rid })));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    const r2 = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKOUT', request_id: rid })));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual(j1);
    const db = getDb();
    const c = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM absensi WHERE request_id = ?', args: [rid] });
    expect(Number((c.rows[0] as Record<string, unknown>)['c'])).toBe(1);
  });

  it('kuota: 2 pasang boleh, check-in ketiga ditolak; DITOLAK tak makan kuota', async () => {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry Kuota', 1, '2026-10-03T07:00:00+07:00')", args: [] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const hariIni = tanggalWIB(serialisasiWIB());
    await pindahKaryawan(id, tokoA, hariIni, db);
    const link = await buatLink(id, buatTokenLink(), 1, serialisasiWIB(), db);
    const post = (jenis: string, rid?: string) =>
      absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis, request_id: rid })));

    expect((await post('CHECKIN')).status).toBe(201);
    const co1 = await post('CHECKOUT');
    expect(co1.status).toBe(201);
    const co1b = await co1.json();
    expect(co1b.pesan).toMatch(/checkout/);
    // checkin_id terisi dan mewarisi tanggal + toko check-in.
    const coRow = await db.execute({ sql: 'SELECT checkin_id, tanggal, toko_id FROM absensi WHERE karyawan_id = ? AND jenis = ?', args: [id, 'CHECKOUT'] });
    const ciRow = await db.execute({ sql: 'SELECT id, tanggal, toko_id FROM absensi WHERE karyawan_id = ? AND jenis = ? ORDER BY id ASC', args: [id, 'CHECKIN'] });
    expect(Number((coRow.rows[0] as Record<string, unknown>)['checkin_id'])).toBe(
      Number((ciRow.rows[0] as Record<string, unknown>)['id']),
    );
    expect(String((coRow.rows[0] as Record<string, unknown>)['tanggal'])).toBe(String((ciRow.rows[0] as Record<string, unknown>)['tanggal']));

    expect((await post('CHECKIN')).status).toBe(201);
    expect((await post('CHECKOUT')).status).toBe(201);
    const ketiga = await post('CHECKIN');
    expect(ketiga.status).toBe(409);
    expect((await ketiga.json()).pesan).toBe('Batas absen hari ini sudah tercapai.');

    // Tolak check-in kedua -> kuota kembali 1 -> check-in boleh lagi.
    const ci2q = await db.execute({ sql: 'SELECT id FROM absensi WHERE karyawan_id = ? AND jenis = ? ORDER BY id ASC', args: [id, 'CHECKIN'] });
    const ci2 = Number((ci2q.rows[1] as Record<string, unknown>)['id']);
    await db.execute({ sql: "UPDATE absensi SET status = 'DITOLAK', alasan_tolak = ? WHERE id = ?", args: ['Foto buram', ci2] });
    expect((await post('CHECKIN')).status).toBe(201);
  });

  it('20 jam: check-in 21 jam lalu tak dianggap terbuka; check-in baru boleh', async () => {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry 20Jam', 1, '2026-10-03T07:00:00+07:00')", args: [] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const hariIni = tanggalWIB(serialisasiWIB());
    await pindahKaryawan(id, tokoA, hariIni, db);
    const link = await buatLink(id, buatTokenLink(), 1, serialisasiWIB(), db);
    const ci = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })));
    expect(ci.status).toBe(201);
    // Geser waktu check-in ke 21 jam lalu.
    const ciRow = await db.execute({ sql: 'SELECT id, waktu FROM absensi WHERE karyawan_id = ? AND jenis = ?', args: [id, 'CHECKIN'] });
    const ciId = Number((ciRow.rows[0] as Record<string, unknown>)['id']);
    const waktuAsli = String((ciRow.rows[0] as Record<string, unknown>)['waktu']);
    await db.execute({ sql: 'UPDATE absensi SET waktu = ? WHERE id = ?', args: [geserJamISO(waktuAsli, -21), ciId] });

    const co = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKOUT' })));
    expect(co.status).toBe(409);
    expect((await co.json()).pesan).toMatch(/Hubungi admin/);

    // Tombol kembali ke Check-in: check-in baru BOLEH.
    const ciBaru = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })));
    expect(ciBaru.status).toBe(201);
  });

  it('BR-A9: tanggal bertanda diblokir; setelah dihapus berjalan', async () => {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry Tanda', 1, '2026-10-03T07:00:00+07:00')", args: [] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const hariIni = tanggalWIB(serialisasiWIB());
    await pindahKaryawan(id, tokoA, hariIni, db);
    const link = await buatLink(id, buatTokenLink(), 1, serialisasiWIB(), db);
    await db.execute({
      sql: 'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, 1, ?)',
      args: [id, tokoA, hariIni, 'IZIN', serialisasiWIB()],
    });
    const tolak = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })));
    expect(tolak.status).toBe(409);
    expect((await tolak.json()).pesan).toBe('Tanggal ini ditandai tidak berangkat. Hubungi admin.');
    await db.execute({ sql: 'DELETE FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?', args: [id, hariIni] });
    expect((await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })))).status).toBe(201);
  });

  it('BR-A12: event memakai toko penempatan pada tanggal absensi', async () => {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry Pindah', 1, '2026-10-03T07:00:00+07:00')", args: [] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const hariIni = tanggalWIB(serialisasiWIB());
    const kemarin = sehariSebelum(hariIni);
    const besok = tanggalWIB(geserJamISO(`${hariIni}T12:00:00+07:00`, 24));
    await pindahKaryawan(id, tokoA, kemarin, db);
    await pindahKaryawan(id, tokoB, hariIni, db);
    const link = await buatLink(id, buatTokenLink(), 1, serialisasiWIB(), db);
    expect((await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })))).status).toBe(201);
    const ev = await db.execute({ sql: 'SELECT toko_id FROM absensi WHERE karyawan_id = ?', args: [id] });
    expect(Number((ev.rows[0] as Record<string, unknown>)['toko_id'])).toBe(tokoB);
    // Pindah lagi (efektif besok): snapshot event TIDAK berubah.
    await pindahKaryawan(id, tokoA, besok, db);
    const ev2 = await db.execute({ sql: 'SELECT toko_id FROM absensi WHERE karyawan_id = ?', args: [id] });
    expect(Number((ev2.rows[0] as Record<string, unknown>)['toko_id'])).toBe(tokoB);
  });

  it('lintas tengah malam: checkout mewarisi tanggal check-in', async () => {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES ('Kry Malam', 1, '2026-10-03T07:00:00+07:00')", args: [] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const hariIni = tanggalWIB(serialisasiWIB());
    const kemarin = sehariSebelum(hariIni);
    await pindahKaryawan(id, tokoA, kemarin, db);
    const link = await buatLink(id, buatTokenLink(), 1, serialisasiWIB(), db);
    expect((await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKIN' })))).status).toBe(201);
    // Mundurkan check-in ke kemarin 23:50 (masih dalam 20 jam bila kini < 19:50; paksa 1 jam agar pasti).
    const ci = await db.execute({ sql: 'SELECT id FROM absensi WHERE karyawan_id = ? AND jenis = ?', args: [id, 'CHECKIN'] });
    const ciId = Number((ci.rows[0] as Record<string, unknown>)['id']);
    const sejamLalu = geserJamISO(serialisasiWIB(), -1);
    await db.execute({ sql: 'UPDATE absensi SET waktu = ?, tanggal = ? WHERE id = ?', args: [sejamLalu, kemarin, ciId] });
    const co = await absenRoute(reqForm('/api/absen', formAbsen({ token: link.token, jenis: 'CHECKOUT' })));
    expect(co.status).toBe(201);
    const coRow = await db.execute({ sql: 'SELECT tanggal, toko_id, checkin_id FROM absensi WHERE karyawan_id = ? AND jenis = ?', args: [id, 'CHECKOUT'] });
    expect(String((coRow.rows[0] as Record<string, unknown>)['tanggal'])).toBe(kemarin);
    expect(Number((coRow.rows[0] as Record<string, unknown>)['checkin_id'])).toBe(ciId);
  });

  it('validasi: tanpa foto / bukan JPEG / terlalu besar / tanpa origin', async () => {
    const tanpaFoto = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKIN', foto: false })));
    expect(tanpaFoto.status).toBe(400);
    const bukanJpeg = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKIN', tipeFoto: 'image/png' })));
    expect(bukanJpeg.status).toBe(400);
    const besar = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKIN', ukuranFoto: 10 * 1024 * 1024 + 1 })));
    expect(besar.status).toBe(413);
    expect((await besar.json()).pesan).toBe('Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.');
    const tanpaOrigin = await absenRoute(reqForm('/api/absen', formAbsen({ token: tokenA, jenis: 'CHECKIN' }), { origin: null }));
    expect(tanpaOrigin.status).toBe(403);
  });

  it('info: data halaman + pesan link sama dengan POST', async () => {
    const ok = await infoRoute(reqGet(`/api/absen/info?token=${tokenA}`));
    expect(ok.status).toBe(200);
    const data = (await ok.json()).data as { nama: string; toko: string; aksi: string; riwayat: unknown[] };
    expect(data.nama).toBe('Kry A');
    expect(data.toko).toBe('Toko A3');
    expect(Array.isArray(data.riwayat)).toBe(true);
    const ngawur = await infoRoute(reqGet('/api/absen/info?token=salah'));
    expect(ngawur.status).toBe(404);
    expect((await ngawur.json()).pesan).toBe(PESAN_LINK);
  });

  it('proxy foto: butuh sesi admin; URL Telegram tak sampai klien', async () => {
    const db = getDb();
    const ev = await db.execute({ sql: 'SELECT id FROM absensi WHERE foto_file_id IS NOT NULL ORDER BY id ASC LIMIT 1', args: [] });
    const id = Number((ev.rows[0] as Record<string, unknown>)['id']);
    const tanpaSesi = await fotoRoute(reqGet(`/api/foto/${id}`));
    expect(tanpaSesi.status).toBe(401);

    const cookieAdmin = await cookieUntuk('admin', 'test1234');
    const res = await fotoRoute(reqGet(`/api/foto/${id}`, { cookie: cookieAdmin }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private');
    const isi = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(isi)).toEqual([9, 9, 9]);
  });

  it('proxy foto: event tanpa foto -> 404', async () => {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (karyawan_id, toko_id, tanggal, jenis, waktu, sumber, lokasi_status, status, alasan_koreksi, dikoreksi_oleh, dibuat_at) VALUES (?, ?, '2026-10-03', 'CHECKIN', '2026-10-03T07:00:00+07:00', 'KOREKSI_ADMIN', 'TIDAK_ADA', 'DISETUJUI', 'lupa', 1, '2026-10-03T07:00:00+07:00')",
      args: [kryA, tokoA],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    const cookieAdmin = await cookieUntuk('admin', 'test1234');
    const res = await fotoRoute(reqGet(`/api/foto/${id}`, { cookie: cookieAdmin }));
    expect(res.status).toBe(404);
  });
});
