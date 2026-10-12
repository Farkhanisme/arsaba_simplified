process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as adminAgenda } from '../src/app/api/admin/agenda/route';
import { PUT as verifikasiAgenda } from '../src/app/api/admin/verifikasi-agenda/[id]/route';
import { PRATINJAU as rekapPratinjau, PERIKSA as rekapPeriksa, EKSPOR } from '../src/app/api/admin/rekap/rute';
import { GET as dashboardRoute } from '../src/app/api/admin/dashboard/route';
import { kolomDetailAgenda } from '../src/server/ekspor';
import { susunRekap } from '../src/server/repo/rekap';

const DB_PATH = 'data/uji_m14_agenda_ekspor.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const HARI_INI = tanggalWIB();

/**
 * M14: agenda masuk rekap dan memblokir ekspor (K-63/BR-G15), sheet `Detail Agenda`,
 * kolom aggregate di `Ringkasan`, dan metrik dashboard (BR-G17).
 *
 * Yang paling mungkin hilang diam-diam di sini: `periksaSyaratEkspor()` dipakai
 * pratinjau DAN ekspor, jadi kalau hanya salah satu yang ditambah syarat agenda,
 * admin bisa melihat "boleh ekspor" lalu tetap gagal saat mengunduh. Kedua jalur
 * diuji di bawah.
 */

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

async function json(res: Response): Promise<any> {
  return (await res.json()) as any;
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

describe('M14 rekap, ekspor, dan dashboard agenda', () => {
  let admin = '';
  /**
   * Satu toko PER SKENARIO, bukan satu toko untuk semua tes.
   *
   * Alasannya bukan kerapian: `periksaSyaratEkspor()` menghitung seluruh laporan
   * pada rentang+toko. Kalau semua tes memakai toko yang sama, laporan MENUNGGU
   * dari tes pertama ikut terhitung di tes "DRAFT tidak memblokir", dan tes itu
   * gagal bukan karena aturan draft salah — melainkan karena urutan tes. Tes yang
   * bergantung urutan akan ikut salah saat ada tes yang dipecah atau diurutkan ulang.
   */
  const toko = { a: 0, b: 0, draft: 0, sudah: 0, antrean: 0, tolak: 0 };

  /** Sisipkan laporan agenda langsung ke DB (melewati Telegram & route karyawan). */
  async function laporan(
    opts: { agenda: number; karyawan: number; toko: number; status: string; tanggal?: string; keterangan?: string },
  ): Promise<number> {
    const db = getDb();
    const now = serialisasiWIB();
    const terkirim = opts.status === 'DRAFT' ? null : now;
    const tanggal = opts.tanggal ?? HARI_INI;
    const wajibFoto = Number(
      ((await db.execute({ sql: 'SELECT wajib_foto FROM agenda WHERE id = ?', args: [opts.agenda] })).rows[0] as Record<string, unknown>)['wajib_foto'],
    );
    await db.execute({
      sql: `INSERT INTO agenda_laporan (agenda_id, karyawan_id, toko_id, tanggal, percobaan, status, keterangan,
        sebelum_file_id, sesudah_file_id, dikirim_at, diverifikasi_oleh, diverifikasi_at, alasan_tolak, dibuat_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        opts.agenda,
        opts.karyawan,
        // BR-G14: DRAFT belum punya tanggal submit maupun toko snapshot — keduanya
        // baru diketahui saat kirim. Mengisi salah satunya di sini melanggar CHECK.
        opts.status === 'DRAFT' ? null : opts.toko,
        opts.status === 'DRAFT' ? null : tanggal,
        opts.status,
        opts.keterangan ?? null,
        wajibFoto === 1 ? 'f-before' : null,
        opts.status === 'DRAFT' ? null : 'f-after',
        terkirim,
        opts.status === 'MENUNGGU' ? null : 1,
        opts.status === 'MENUNGGU' ? null : now,
        opts.status === 'DITOLAK' ? 'Kurang lengkap' : null,
        now,
      ],
    });
    return Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
  }

  async function agenda(judul: string, wajibFoto: boolean, tokoId: number | null): Promise<number> {
    const { POST } = await import('../src/app/api/admin/agenda/route');
    const body: Record<string, unknown> = { judul, wajib_foto: wajibFoto, cakupan: tokoId === null ? 'SEMUA' : 'TOKO' };
    if (tokoId !== null) body['toko_id'] = tokoId;
    const res = await POST(req('/api/admin/agenda', { method: 'POST', body, cookie: admin }));
    return (await json(res)).data.id as number;
  }

  async function karyawan(nama: string, toko: number | null): Promise<number> {
    const db = getDb();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, serialisasiWIB()] });
    const id = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    if (toko !== null) {
      await db.execute({
        sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)',
        args: [id, toko, '2026-01-01'],
      });
    }
    return id;
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    vi.stubGlobal('fetch', async () => {
      throw new Error('tidak ada panggilan jaringan yang diharapkan');
    });
    admin = await cookieUntuk('admin');
    const db = getDb();
    for (const kunci of Object.keys(toko) as (keyof typeof toko)[]) {
      const nama = `Toko ${kunci.toUpperCase()}`;
      await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, serialisasiWIB()] });
      toko[kunci] = Number(((await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: [nama] })).rows[0] as Record<string, unknown>)['id']);
    }
  }, 120_000);

  describe('BR-G15: laporan MENUNGGU memblokir ekspor (K-63)', () => {
    it('MENUNGGU pada rentang+toko terpilih -> ekspor DITOLAK', async () => {
      const a = await agenda('Menunggu', false, toko.a);
      const k = await karyawan('K Menunggu', toko.a);
      await laporan({ agenda: a, karyawan: k, toko: toko.a, status: 'MENUNGGU' });

      const periksa = await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.a }, cookie: admin }));
      const b = await json(periksa);
      expect(b.data.boleh).toBe(false);
      expect(b.data.jumlahAgendaMenunggu).toBe(1);

      const ekspor = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.a }, cookie: admin }));
      expect(ekspor.status).toBe(409);
      expect((await json(ekspor)).kode).toBe('EKSPOR_DIBLOKIR');
    });

    it('pratinjau dan ekspor sepakat (anti-B-19)', async () => {
      // Kalau hanya pratinjau yang ditambah syarat agenda, admin melihat "boleh"
      // lalu tetap gagal mengunduh — dua jalan berbeda untuk satu keputusan.
      const a = await agenda('Menunggu 2', false, toko.b);
      const k = await karyawan('K Menunggu 2', toko.b);
      await laporan({ agenda: a, karyawan: k, toko: toko.b, status: 'MENUNGGU' });

      const prev = await json(await rekapPratinjau(req(`/api/admin/rekap?dari=${HARI_INI}&sampai=${HARI_INI}&toko_id=${toko.b}`, { cookie: admin })));
      const ekspor = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.b }, cookie: admin }));
      expect(prev.data.pemeriksaan.boleh).toBe(false);
      expect(ekspor.status).toBe(409);
    });

    it('DRAFT TIDAK memblokir — inilah alasan K-63 memilihnya', async () => {
      const a = await agenda('Draft menggantung', false, toko.draft);
      const k = await karyawan('K Draft', toko.draft);
      await laporan({ agenda: a, karyawan: k, toko: toko.draft, status: 'DRAFT' });

      const b = await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.draft }, cookie: admin })));
      // Kalau draft ikut memblokir, satu karyawan yang meninggalkan draft
      // bisa menahan seluruh ekspor toko itu.
      expect(b.data.jumlahAgendaMenunggu).toBe(0);
    });

    it('DISETUJUI dan DITOLAK tidak memblokir', async () => {
      const a = await agenda('Sudah diverifikasi', false, toko.sudah);
      const k1 = await karyawan('K Sudah 1', toko.sudah);
      const k2 = await karyawan('K Sudah 2', toko.sudah);
      await laporan({ agenda: a, karyawan: k1, toko: toko.sudah, status: 'DISETUJUI' });
      await laporan({ agenda: a, karyawan: k2, toko: toko.sudah, status: 'DITOLAK' });
      const b = await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.sudah }, cookie: admin })));
      expect(b.data.jumlahAgendaMenunggu).toBe(0);
      // Export harus LOLOS: kedua status sudah final.
      const ekspor = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.sudah }, cookie: admin }));
      expect(ekspor.status).toBe(200);
    });

    it('periode lain tidak terpengaruh laporan hari ini', async () => {
      // Jendela waktu benar-benar dipakai: laporan hari ini tidak memblokir
      // ekspor bulan depan.
      const lain = '2026-12-01';
      const b = await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: lain, sampai: lain, toko_id: toko.a }, cookie: admin })));
      expect(b.data.jumlahAgendaMenunggu).toBe(0);
    });

    it('toko lain tidak terpengaruh (toko_id dipakai)', async () => {
      // Toko B punya MENUNGGU, Toko A tidak. Laporan menyimpan snapshot toko
      // (BR-G14), jadi filter toko benar-benar memisahkannya.
      expect((await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.b }, cookie: admin })))).data.jumlahAgendaMenunggu).toBe(1);
      expect((await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.a }, cookie: admin })))).data.jumlahAgendaMenunggu).toBe(1);
      // Toko yang tidak punya laporan sama sekali.
      expect((await json(await rekapPeriksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI, toko_id: toko.sudah }, cookie: admin })))).data.jumlahAgendaMenunggu).toBe(0);
    });
  });

  describe('BR-G16: sheet Detail Agenda + kolom Ringkasan', () => {
    it('kolomDetailAgenda tepat 10 dan bernama sesuai', () => {
      expect(kolomDetailAgenda()).toEqual([
        'Tanggal Submit', 'Karyawan', 'Toko', 'Judul Agenda', 'Foto',
        'Percobaan Ke', 'Status', 'Keterangan', 'Alasan Tolak', 'Diverifikasi Oleh',
      ]);
    });

    it('file .xlsx punya tiga sheet dan baris agenda masuk', async () => {
      // Tutup semua pemblokir lebih dulu supaya ekspor benar-benar jadi file.
      await getDb().execute({ sql: "UPDATE agenda_laporan SET status = 'DISETUJUI', diverifikasi_oleh = 1, diverifikasi_at = ? WHERE status = 'MENUNGGU'", args: [serialisasiWIB()] });

      const res = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: HARI_INI, sampai: HARI_INI }, cookie: admin }));
      expect(res.status).toBe(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await res.arrayBuffer());
      expect(wb.worksheets.map((w) => w.name)).toEqual(['Ringkasan', 'Detail Harian', 'Detail Agenda']);

      const ws = wb.getWorksheet('Detail Agenda')!;
      const header: unknown[] = [];
      ws.getRow(1).eachCell((c) => header.push(c.value));
      expect(header).toEqual(kolomDetailAgenda());

      // Isi baris benar-benar terbaca balik.
      const isi: unknown[][] = [];
      ws.eachRow((row, n) => {
        if (n === 1) return;
        isi.push([row.getCell(1).value, row.getCell(2).value, row.getCell(4).value, row.getCell(7).value]);
      });
      expect(isi.length).toBeGreaterThan(0);
      // Tanggal sudah format WIB dd/MM/yyyy, bukan ISO.
      expect(String(isi[0]![0])).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      // Draft tidak boleh muncul di sheet sama sekali (BR-G9).
      expect(isi.every((r) => r[3] !== 'DRAFT')).toBe(true);
    });

    it('Ringkasan punya kolom Agenda Selesai dan Agenda Ditolak', async () => {
      // Hanya toko.sudah: baris Ringkasan dibangun dari karyawan yang punya
      // laporan di cakupan, jadi filter ke satu toko membuat angkanya bisa
      // dibandingkan dengan COUNT tanpa menghitung laporan toko lain.
      const { ringkasan } = await susunRekap({ dari: HARI_INI, sampai: HARI_INI, tokoId: toko.sudah }, getDb());
      expect(ringkasan.length).toBeGreaterThan(0);
      for (const r of ringkasan) {
        expect(typeof r.agenda_selesai).toBe('number');
        expect(typeof r.agenda_ditolak).toBe('number');
      }
      // Total DISETUJUI di seluruh toko = jumlah baris DISETUJUI di sheet.
      const totalSelesai = ringkasan.reduce((s, r) => s + r.agenda_selesai, 0);
      // Dihitung lewat COUNT, bukan lewat array yang difilter sendiri: kalau
      // filternya keliru, kedua sisi salah dengan cara yang sama dan tes hijau.
      const rows = await getDb().execute({
        sql: "SELECT COUNT(*) AS c FROM agenda_laporan WHERE status = 'DISETUJUI' AND tanggal = ? AND toko_id = ?",
        args: [HARI_INI, toko.sudah],
      });
      expect(totalSelesai).toBe(Number((rows.rows[0] as Record<string, unknown>)['c']));
      expect(totalSelesai).toBeGreaterThan(0);
    });

    it('foto TIDAK masuk Excel (URL Telegram mengandung token bot)', async () => {
      const isiKolom = kolomDetailAgenda();
      expect(isiKolom.join(' ')).not.toMatch(/telegram|api\.telegram\.org|http/i);
    });
  });

  describe('BR-G17: metrik dashboard', () => {
    it('kartu toko punya tiga angka agenda', async () => {
      const b = await json(await dashboardRoute(req('/api/admin/dashboard', { cookie: admin })));
      expect(typeof b.data.antreanAgenda).toBe('number');
      for (const k of b.data.kartu) {
        expect(typeof k.agenda.menunggu).toBe('number');
        expect(typeof k.agenda.selesai).toBe('number');
        expect(typeof k.agenda.ditolak).toBe('number');
      }
    });

    it('antrean agenda menghitung MENUNGGU saja', async () => {
      await laporan({ agenda: await agenda('Antrean', false, toko.antrean), karyawan: await karyawan('K Antrean', toko.antrean), toko: toko.antrean, status: 'MENUNGGU' });
      const b = await json(await dashboardRoute(req('/api/admin/dashboard', { cookie: admin })));
      const nyata = await getDb().execute({ sql: "SELECT COUNT(*) AS c FROM agenda_laporan WHERE status = 'MENUNGGU'", args: [] });
      expect(b.data.antreanAgenda).toBe(Number((nyata.rows[0] as Record<string, unknown>)['c']));
      // Dan DRAFT tidak masuk hitungan.
      expect(b.data.antreanAgenda).toBeGreaterThan(0);
    });
  });

  describe('verifikasi lewat route menutup celah penguncian', () => {
    it('laporan MENUNGGU yang ditolak benar-benar berubah di DB', async () => {
      // Tanggal LAMPau, bukan hari ini: tes lain mengekspor periode hari ini
      // (dengan toko_id NULL = semua toko), dan K-32 mengunci seluruh periode itu
      // untuk semua toko. Pakai hari ini membuat tes ini gagal 403 karena urutan,
      // bukan karena route verifikasi salah.
      const lampau = '2026-06-15';
      const a = await agenda('Ditolak route', false, toko.tolak);
      const k = await karyawan('K Ditolak Route', toko.tolak);
      const id = await laporan({ agenda: a, karyawan: k, toko: toko.tolak, status: 'MENUNGGU', tanggal: lampau });
      const res = await verifikasiAgenda(req(`/api/admin/verifikasi-agenda/${id}`, { method: 'PUT', body: { keputusan: 'DITOLAK', alasan_tolak: 'Foto kurang jelas' }, cookie: admin }));
      expect(res.status).toBe(200);
      const baris = await getDb().execute({ sql: 'SELECT status, alasan_tolak, diverifikasi_oleh FROM agenda_laporan WHERE id = ?', args: [id] });
      const r = baris.rows[0] as Record<string, unknown>;
      expect(r['status']).toBe('DITOLAK');
      expect(r['alasan_tolak']).toBe('Foto kurang jelas');
      expect(r['diverifikasi_oleh']).not.toBeNull();
    });
  });
});