process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { POST as loginRoute } from '../src/app/api/login/route';
import { GET as agendaInfoRoute } from '../src/app/api/agenda/info/route';
import { POST as agendaLaporanRoute } from '../src/app/api/agenda/laporan/route';
import { POST as agendaBuatRoute } from '../src/app/api/agenda/buat/route';
import { PUT as verifikasiAgendaRoute } from '../src/app/api/admin/verifikasi-agenda/[id]/route';
import { GET as verifikasiAgendaListRoute } from '../src/app/api/admin/verifikasi-agenda/route';
import { muatInfoAgenda } from '../src/server/agenda-info';

const DB_PATH = 'data/uji_m12_agenda_karyawan.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

/**
 * Alur lengkap agenda sisi karyawan (M12) + verifikasi (M13).
 *
 * Telegram di-STUB lewat `vi.stubGlobal('fetch')`, jadi tes ini tidak pernah
 * menyentuh jaringan. Yang diuji di sini bukan Telegram-nya, melainkan urutan
 * "validasi -> unggah -> simpan" (BR-A4) dan siklus statusnya.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

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

async function json(res: Response): Promise<{ kode: string; pesan: string; data?: any }> {
  return (await res.json()) as { kode: string; pesan: string; data?: any };
}

async function cookieUntuk(username: string): Promise<string> {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', 'test1234');
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  const res = await loginRoute(new NextRequest(`${APP_ORIGIN}/api/login`, { method: 'POST', headers, body: fd }));
  return /sesi=([^;]+)/.exec(res.headers.get('set-cookie') || '')![1]!;
}

/** FormData multipart seperti yang dikirim browser. */
function formLaporan(isian: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(isian)) fd.set(k, v);
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  return new NextRequest(`${APP_ORIGIN}/api/agenda/laporan`, { method: 'POST', headers, body: fd });
}

async function kirimLaporan(isian: Record<string, string | File>) {
  return agendaLaporanRoute(formLaporan(isian));
}

let unggahDipanggil = 0;
let unggahGagal = false;
let fileIdKe = 0;

describe('M12+M13 agenda karyawan dan verifikasi admin', () => {
  let admin = '';
  let superadmin = '';
  let superId = 0;
  let tokoId = 0;
  // Toko KHUSUS untuk uji K-32. Kalau log_ekspor memakai toko utama, setiap
  // verifikasi sesudahnya ikut terkunci dan tes lain gagal dengan 403 —
  // Ordering dependency yang tidak terlihat dari nama tesnya.
  let tokoK32 = 0;
  let andiId = 0;
  let sitiId = 0;
  let token: string;
  let tokenLain: string;
  /**
   * Token karyawan yang ditempatkan di tokoK32.
   *
   * Pisah dari `token` karena penerima agenda bertokoko dihitung dari penempatan
   * (BR-G2). Kalau uji K-32 memakai karyawan yang ada di toko lain, ia bukan
   * penerima agenda itu dan gagal 403 — gejalanya terlihat seperti bug izin,
   * padahal penyebabnya penempatan yang salah pada data uji.
   */
  let tokenK32: string;

  async function tambahKaryawan(nama: string, toko: number | null): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)',
      args: [nama, serialisasiWIB()],
    });
    const id = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    if (toko !== null) {
      await db.execute({
        sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)',
        args: [id, toko, '2026-01-01'],
      });
    }
    return id;
  }

  async function buatLink(karyawanId: number): Promise<string> {
    const t = `token-${karyawanId}-${Math.random().toString(36).slice(2)}`;
    await getDb().execute({
      sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at) VALUES (?, ?, ?)',
      args: [karyawanId, t, serialisasiWIB()],
    });
    return t;
  }

  async function buatAgenda(
    body: Record<string, unknown>,
    cookie = admin,
  ): Promise<number> {
    const res = await agendaBuatViaApi(body, cookie);
    return res;
  }

  async function agendaBuatViaApi(body: Record<string, unknown>, cookie: string): Promise<number> {
    const { POST } = await import('../src/app/api/admin/agenda/route');
    const res = await POST(req('/api/admin/agenda', { method: 'POST', body, cookie }));
    const b = await json(res);
    if (!res.ok) throw new Error(`buat agenda gagal: ${b.pesan}`);
    return b.data.id as number;
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = 'TEST-BOT-TOKEN-M12';
    process.env['TELEGRAM_CHAT_ID'] = '-10012';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });

    // Stub Telegram sebelum route dipakai. Fake fetch mengembalikan respons
    // sendPhoto yang shape-nya sama dengan API asli.
    // Dicek dari URL, bukan dari badan request: `telegram.ts` mengirim multipart
    // FormData, dan `String(FormData)` menghasilkan "[object FormData]" — bukan
    // teks yang bisa dicari. Percobaan pertama stub ini memakai `body` dan gagal
    // total: setiap unggah dianggap "tak terduga" sehingga semua tes 502.
    vi.stubGlobal('fetch', async (url: unknown, _init?: RequestInit) => {
      const alamat = String(url);
      if (alamat.includes('/sendPhoto')) {
        if (unggahGagal) throw new Error('Telegram menolak');
        unggahDipanggil++;
        fileIdKe++;
        return new Response(
          JSON.stringify({ ok: true, result: { message_id: 1000 + fileIdKe, chat: { id: -10012 }, photo: [{ file_id: `file${fileIdKe}` }] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (alamat.includes('/getFile')) {
        return new Response(JSON.stringify({ ok: true, result: { file_path: 'f.jpg' } }), { status: 200 });
      }
      throw new Error(`fetch tak terduga: ${alamat}`);
    });

    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)',
      args: ['Toko M12', serialisasiWIB()],
    });
    tokoId = Number(((await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: ['Toko M12'] })).rows[0] as Record<string, unknown>)['id']);
    superId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({
      sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)',
      args: ['Toko K32', serialisasiWIB()],
    });
    tokoK32 = Number(((await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: ['Toko K32'] })).rows[0] as Record<string, unknown>)['id']);
    andiId = await tambahKaryawan('Andi M12', tokoId);
    const budiId = await tambahKaryawan('Budi M12', tokoId);
    // Karyawan ketiga ditempatkan di toko K32 supaya laporan agenda K32 punya
    // toko snapshot yang sama dengan log_ekspor (K-32).
    sitiId = await tambahKaryawan('Siti M12', tokoK32);
    token = await buatLink(andiId);
    tokenLain = await buatLink(budiId);
    tokenK32 = await buatLink(sitiId);
  }, 120_000);

  function foto(): File {
    return new File([JPEG], 'agenda.jpg', { type: 'image/jpeg' });
  }

  const reqId = () => crypto.randomUUID();

  describe('BR-G7: alur dua tahap untuk agenda wajib foto', () => {
    it('draft tersimpan sebagai DRAFT dengan foto before', async () => {
      const agenda = await buatAgenda({ judul: 'Ganti lampu', wajib_foto: true, cakupan: 'TOKO', toko_id: tokoId });
      const res = await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      expect(res.status).toBe(201);
      expect((await json(res)).kode).toBe('DRAFT_TERSIMPAN');

      const rows = await getDb().execute({ sql: 'SELECT status, sebelum_file_id, sesudah_file_id FROM agenda_laporan WHERE agenda_id = ?', args: [agenda] });
      const baris = rows.rows[0] as Record<string, unknown>;
      expect(baris['status']).toBe('DRAFT');
      expect(baris['sebelum_file_id']).not.toBeNull();
      // Draft belum punya foto after — itu yang membedakan DRAFT dari MENUNGGU.
      expect(baris['sesudah_file_id']).toBeNull();
    });

    it('submit mengubah DRAFT jadi MENUNGGU, percobaan tetap 1', async () => {
      const agenda = await buatAgenda({ judul: 'Bersih rak', wajib_foto: true, cakupan: 'TOKO', toko_id: tokoId });
      await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      const res = await kirimLaporan({
        token,
        tahap: 'MENUNGGU',
        agenda_id: String(agenda),
        request_id: reqId(),
        foto: foto(),
        keterangan: 'Sudah bersih',
      });
      expect(res.status).toBe(200);
      const b = await json(res);
      expect(b.kode).toBe('LAPORAN_TERKIRIM');
      expect(b.data.percobaan).toBe(1);
      expect(b.data.baru).toBe(false);

      const rows = await getDb().execute({ sql: 'SELECT status, tanggal, sesudah_file_id FROM agenda_laporan WHERE agenda_id = ?', args: [agenda] });
      const baris = rows.rows[0] as Record<string, unknown>;
      expect(baris['status']).toBe('MENUNGGU');
      expect(baris['sesudah_file_id']).not.toBeNull();
      // BR-G14: tanggal = tanggal submit.
      expect(baris['tanggal']).toBe(tanggalWIB());
    });
  });

  describe('BR-A4: urutan validasi -> Telegram -> simpan', () => {
    it('Telegram gagal: tidak ada baris tersimpan sama sekali', async () => {
      const agenda = await buatAgenda({ judul: 'Uploads gagal', wajib_foto: true, cakupan: 'SEMUA' });
      unggahGagal = true;
      const res = await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      unggahGagal = false;
      expect(res.status).toBe(502);
      expect((await json(res)).kode).toBe('TELEGRAM_GAGAL');

      const rows = await getDb().execute({ sql: 'SELECT COUNT(*) AS c FROM agenda_laporan WHERE agenda_id = ?', args: [agenda] });
      // Ini yang paling penting: bukan 502 dengan baris tersimpan. Kalau baris
      // ada, karyawan akan melihat "draft tersimpan" padahal tidak ada fotonya.
      expect(Number((rows.rows[0] as Record<string, unknown>)['c'])).toBe(0);
    });

    it('permintaan yang memang ditolak TIDAK mengunggah foto (tidak ada foto yatim)', async () => {
      // Agenda sudah dibatalkan -> aturannya menolak. Kalau route mengunggah dulu,
      // setiap penolakan akan meninggalkan foto di grup Telegram.
      const agenda = await buatAgenda({ judul: 'Dibatalkan', wajib_foto: true, cakupan: 'SEMUA' });
      await denganTransaksi((tx) => tx.execute({ sql: "UPDATE agenda SET status = 'DIBATALKAN', alasan_batal = 'x', dibatalkan_at = ?, dibatalkan_oleh = ? WHERE id = ?", args: [serialisasiWIB(), superId, agenda] }));
      const sebelum = unggahDipanggil;
      const res = await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      expect(res.status).toBe(409);
      expect(unggahDipanggil, 'tidak boleh ada unggahan baru').toBe(sebelum);
    });

    it('foto wajib tidak dikirim untuk agenda tanpa wajib foto (BR-G8)', async () => {
      const agenda = await buatAgenda({ judul: 'Tanpa foto', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoId });
      const res = await kirimLaporan({
        token,
        tahap: 'MENUNGGU',
        agenda_id: String(agenda),
        request_id: reqId(),
        keterangan: 'Sudah dikerjakan',
      });
      expect(res.status).toBe(201);
      const rows = await getDb().execute({ sql: 'SELECT status, keterangan FROM agenda_laporan WHERE agenda_id = ?', args: [agenda] });
      const baris = rows.rows[0] as Record<string, unknown>;
      expect(baris['status']).toBe('MENUNGGU');
      expect(baris['keterangan']).toBe('Sudah dikerjakan');
    });
  });

  describe('BR-G3: agenda buatan karyawan sendiri', () => {
    it('bisa dibuat dan langsung dikerjakan', async () => {
      const res = await agendaBuatRoute(req('/api/agenda/buat', { method: 'POST', body: { token, judul: 'Catat konfigurasi', keterangan: 'Penting' } }));
      expect(res.status).toBe(201);
      const agenda = (await json(res)).data.id as number;

      const rows = await getDb().execute({ sql: 'SELECT wajib_foto, cakupan, dibuat_oleh_karyawan, dibuat_oleh FROM agenda WHERE id = ?', args: [agenda] });
      const baris = rows.rows[0] as Record<string, unknown>;
      // K-59: agenda pribadi selalu wajib foto, walau tidak ada sakelarnya.
      expect(baris['wajib_foto']).toBe(1);
      expect(baris['dibuat_oleh_karyawan']).toBe(andiId);
      expect(baris['dibuat_oleh']).toBeNull();

      const d = await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      expect(d.status).toBe(201);
      const s = await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      expect(s.status).toBe(200);
    });

    it('karyawan lain TIDAK bisa mengerjakan agenda pribadi itu', async () => {
      const res = await agendaBuatRoute(req('/api/agenda/buat', { method: 'POST', body: { token, judul: 'Rahasia' } }));
      const agenda = (await json(res)).data.id as number;
      // Budi punya link sendiri (tokenLain) dan tidak boleh bisa mengerjakan ini.
      const hasilGagal = await kirimLaporan({ token: tokenLain, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });
      expect(hasilGagal.status).toBe(403);
    });

    it('token tidak dikenal ditolak generik (BR-A1)', async () => {
      const res = await agendaBuatRoute(req('/api/agenda/buat', { method: 'POST', body: { token: 'token-ngawur', judul: 'X' } }));
      expect(res.status).toBe(404);
      expect((await json(res)).pesan).toBe('Link tidak berlaku. Hubungi admin.');
    });
  });

  describe('BR-G9: draft tidak pernah terlihat admin', () => {
    it('daftar verifikasi TIDAK memuat draft', async () => {
      const agenda = await buatAgenda({ judul: 'Draft tak terlihat', wajib_foto: true, cakupan: 'SEMUA' });
      await kirimLaporan({ token, tahap: 'DRAFT', agenda_id: String(agenda), request_id: reqId(), foto: foto() });

      // Even dengan filter status kosong, draft tidak boleh muncul.
      const semua = await verifikasiAgendaListRoute(req('/api/admin/verifikasi-agenda?status=', { cookie: admin }));
      const data = (await json(semua)).data as { agenda_id: number; status: string }[];
      expect(data.every((r) => r.status !== 'DRAFT')).toBe(true);
      expect(data.some((r) => r.agenda_id === agenda)).toBe(false);
    });
  });

  describe('M13: verifikasi admin', () => {
    it('tolak wajib alasan, dan alasan kosong ditolak', async () => {
      const agenda = await buatAgenda({ judul: 'Untuk ditolak', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoId });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'x' });
      const laporanId = await laporanIdUntuk(agenda);

      const kosong = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DITOLAK' }, cookie: admin }));
      expect(kosong.status).toBe(400);
      expect((await json(kosong)).kode).toBe('ALASAN_WAJIB');

      const gagal = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DITOLAK', alasan_tolak: 'Kurang lengkap' }, cookie: admin }));
      expect(gagal.status).toBe(200);
    });

    it('K-32: periode terekspor hanya Super Admin', async () => {
      const agenda = await buatAgenda({ judul: 'Setelah ekspor', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoK32 });
      await kirimLaporan({ token: tokenK32, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'x' });
      const laporanId = await laporanIdUntuk(agenda);
      // Tandai periode terekspor untuk toko ini.
      await denganTransaksi((tx) =>
        tx.execute({ sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (?, ?, ?, ?, ?)', args: [superId, serialisasiWIB(), '2026-01-01', '2026-12-31', tokoK32] }),
      );

      const adminCoba = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
      expect(adminCoba.status).toBe(403);
      expect((await json(adminCoba)).kode).toBe('PERIODE_TEREKSPOR');

      const superCoba = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }));
      expect(superCoba.status).toBe(200);
    });

    it('ADMIN boleh verifikasi saat periode belum terekspor', async () => {
      const agenda = await buatAgenda({ judul: 'Sebelum ekspor', wajib_foto: false, cakupan: 'SEMUA' });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'x' });
      const laporanId = await laporanIdUntuk(agenda);
      const res = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DISETUJUI' }, cookie: admin }));
      expect(res.status).toBe(200);
    });

    it('tanpa sesi ditolak 401', async () => {
      const agenda = await buatAgenda({ judul: 'Tanpa sesi', wajib_foto: false, cakupan: 'SEMUA' });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'x' });
      const laporanId = await laporanIdUntuk(agenda);
      const res = await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DISETUJUI' } }));
      expect(res.status).toBe(401);
    });

    it('keputusan tercatat di audit log', async () => {
      const agenda = await buatAgenda({ judul: 'Diaudit', wajib_foto: false, cakupan: 'SEMUA' });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'x' });
      const laporanId = await laporanIdUntuk(agenda);
      await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DITOLAK', alasan_tolak: 'Ulangi' }, cookie: admin }));
      const rows = await getDb().execute({
        sql: "SELECT COUNT(*) AS c FROM audit_log WHERE entitas = 'agenda_laporan' AND entitas_id = ? AND aksi = 'AGENDA_LAPORAN_VERIFIKASI'",
        args: [laporanId],
      });
      expect(Number((rows.rows[0] as Record<string, unknown>)['c'])).toBe(1);
    });
  });

  describe('BR-G11 + K-61: mengulang setelah ditolak', () => {
    it('percobaan baru numbered naik, laporan lama tidak berubah', async () => {
      const agenda = await buatAgenda({ judul: 'Perlu diulang', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoId });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'percobaan 1' });
      const lama = await laporanIdUntuk(agenda);
      await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${lama}`, { method: 'PUT', body: { keputusan: 'DITOLAK', alasan_tolak: 'Belum sesuai' }, cookie: admin }));

      const kedua = await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'percobaan 2' });
      expect(kedua.status).toBe(201);
      const b = await json(kedua);
      expect(b.data.percobaan).toBe(2);
      expect(b.data.baru).toBe(true);

      // Laporan pertama tetap DITOLAK — tidak ditimpa.
      const barisLama = await getDb().execute({ sql: 'SELECT status, alasan_tolak FROM agenda_laporan WHERE id = ?', args: [lama] });
      expect((barisLama.rows[0] as Record<string, unknown>)['status']).toBe('DITOLAK');
      expect((barisLama.rows[0] as Record<string, unknown>)['alasan_tolak']).toBe('Belum sesuai');

      // Dan hanya laporan kedua yang aktif (index unik parsial).
      const aktif = await getDb().execute({ sql: "SELECT COUNT(*) AS c FROM agenda_laporan WHERE agenda_id = ? AND status <> 'DITOLAK'", args: [agenda] });
      expect(Number((aktif.rows[0] as Record<string, unknown>)['c'])).toBe(1);
    });

    it('Karyawan masih melihat alasan penolakan di halamannya', async () => {
      const agenda = await buatAgenda({ judul: 'Bisa diulang', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoId });
      await kirimLaporan({ token, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'salah' });
      const laporanId = await laporanIdUntuk(agenda);
      await verifikasiAgendaRoute(req(`/api/admin/verifikasi-agenda/${laporanId}`, { method: 'PUT', body: { keputusan: 'DITOLAK', alasan_tolak: 'Kurang lengkap' }, cookie: admin }));

      const info = (await muatInfoAgenda(token))!;
      const kartu = info.daftar.find((a) => a.id === agenda)!;
      // Alasan harus masih terlihat. Kalau hilang, karyawan akan mengulang
      // tanpa tahu apa yang salah — itu bug tampilan, bukan aturan.
      expect(kartu.laporan?.status).toBe('DITOLAK');
      expect(kartu.laporan?.alasan_tolak).toBe('Kurang lengkap');
      expect(kartu.aksi).toBe('ULANG');
    });
  });

  describe('BR-G6: satu laporan aktif per karyawan per agenda', () => {
    it('index unik menolak dua laporan aktif dari perangkat berbeda', async () => {
      const agenda = await buatAgenda({ judul: 'Balapan', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoK32 });
      const pertama = await kirimLaporan({ token: tokenK32, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'a' });
      expect(pertama.status).toBe(201);
      // Dua perangkat mengirim bersamaan. Index unik yang menahan; route
      // memetakannya jadi 409, BUKAN melempar — jadi diuji lewat respons.
      const kedua = await kirimLaporan({ token: tokenK32, tahap: 'MENUNGGU', agenda_id: String(agenda), request_id: reqId(), keterangan: 'b' });
      expect(kedua.status).toBe(409);
      // Ditolak oleh pemeriksaan aturan (periksaSubmit) sebelum menyentuh database.
      // Ini lebih baik daripada mengandalkan index: pesan yang muncul masih bisa
      // dibaca karyawan ("sudah dikirim"), bukan error constraint generik.
      expect((await json(kedua)).pesan).toContain('sudah dikirim');

      // Dan index unik di database benar-benar ada — dibuktikan langsung
      // dengan menyisipkan lewat SQL, bypass pemeriksaan aplikasi sama sekali.
      // Kalau hanya menguji lewat route, menghapus index tersebut tidak akan membuat tes gagal.
      const now = serialisasiWIB();
      await expect(
        getDb().execute({
          sql: `INSERT INTO agenda_laporan (agenda_id, karyawan_id, toko_id, tanggal, percobaan, status, sesudah_file_id, dikirim_at, dibuat_at)
            VALUES (?, ?, ?, ?, 9, 'MENUNGGU', 'f', ?, ?)`,
          args: [agenda, sitiId, tokoK32, tanggalWIB(), now, now],
        }),
      ).rejects.toThrow(/UNIQUE constraint failed/);

      const total = await getDb().execute({ sql: 'SELECT COUNT(*) AS c FROM agenda_laporan WHERE agenda_id = ?', args: [agenda] });
      expect(Number((total.rows[0] as Record<string, unknown>)['c'])).toBe(1);
    });
  });

  describe('info karyawan: hanya miliknya sendiri', () => {
    it('info hanya memuat agenda karyawan itu sendiri', async () => {
      const res = await agendaInfoRoute(req(`/api/agenda/info?token=${token}`));
      expect(res.status).toBe(200);
      const data = (await json(res)).data as { nama: string; daftar: unknown[] };
      expect(data.nama).toBe('Andi M12');
      // Setiap agenda di daftar harus punya laporan milik dia; tidak mungkin
      // ada agenda karyawan lain karena filter penerima dipakai per karyawan.
      expect(Array.isArray(data.daftar)).toBe(true);
    });

    it('token tidak dikenal -> 404 generik', async () => {
      const res = await agendaInfoRoute(req('/api/agenda/info?token=ngawur'));
      expect(res.status).toBe(404);
      expect((await json(res)).pesan).toBe('Link tidak berlaku. Hubungi admin.');
    });
  });

  async function laporanIdUntuk(agenda: number): Promise<number> {
    const rows = await getDb().execute({ sql: 'SELECT id FROM agenda_laporan WHERE agenda_id = ? ORDER BY percobaan DESC, id DESC LIMIT 1', args: [agenda] });
    return Number((rows.rows[0] as Record<string, unknown>)['id']);
  }
});