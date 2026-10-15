/**
 * M16 — Sheet kalender per karyawan di ekspor Excel (K-68 / BR-R9).
 *
 * Tiga lapis yang diuji BERBEDA, dan tidak boleh saling menggantikan:
 *   1. fungsi murni `aturan/kalender.ts` (tanpa DB) — klasifikasi sel & grid;
 *   2. repo `kalenderPeriode()` — query apa saja yang sampai ke kalender;
 *   3. file .xlsx yang dibaca balik — isi sel, warna, nama sheet.
 *
 * Pelajaran dari repo ini (AGENTS.md): salinan logika di dalam tes hampir tidak
 * pernah menguji apa pun. Karena itu koordinat sel dihitung dengan fungsi
 * produksi (`awalMinggu`/`rentangTanggal`), bukan dengan ulangannya, dan
 *warnanya dibaca dari FILE, bukan dari objek yang sama yang diuji.
 */
process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import ExcelJS from 'exceljs';
import type { Workbook, Worksheet } from 'exceljs';
import { getDb } from '../src/server/db';
import { serialisasiWIB } from '../src/server/waktu';
import {
  klasifikasiSel,
  susunKalenderKaryawan,
  formatTanggalSel,
  type PasanganKalender,
} from '../src/server/aturan/kalender';
import { awalMinggu, rentangTanggal, urutanHariSenin } from '../src/server/aturan/jadwal';
import { WARNA_SEL, namaSheetKalender, buatWorkbook } from '../src/server/ekspor';
import { kalenderPeriode, susunRekap } from '../src/server/repo/rekap';
import { POST as EKSPOR } from '../src/app/api/admin/rekap/ekspor/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m16_kalender.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

// 2026-10-01 = Kamis. Rentang 01-07 Oktober memotong dua pekan: pekan pertama
// mulai 29 September, peek terakhir berakhir 11 Oktober -> ada sel di luar
// rentang di KEDUA sisi, dan 2026-10-05 (Senin) ada di kolom 0.
const DARI = '2026-10-01';
const SAMPAI = '2026-10-07';
const BARIS_GRID = 5;

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

function pasangan(checkin: string, checkout: string | null, final: number | null = null): PasanganKalender {
  return { checkin, checkout, final_menit: final };
}

describe('M16 · fungsi murni kalender (tanpa database)', () => {
  it('klasifikasi sel: luar rentang didahulukan, lalu penandaan, lalu kehadiran', () => {
    // 1. Di luar rentang wins Even though ada penandaan dan kehadiran.
    const luar = klasifikasiSel({
      tanggal: '2026-09-30',
      dari: DARI,
      sampai: SAMPAI,
      pasangan: [pasangan('07:00', '17:00', 30)],
      penandaan: 'IZIN',
    });
    expect(luar).toEqual({ jenis: 'LUAR_RENTANG', baris: [] });

    // 2. Penandaan menang atas kehadiran.
    const izin = klasifikasiSel({
      tanggal: '2026-10-02',
      dari: DARI,
      sampai: SAMPAI,
      pasangan: [pasangan('07:00', '17:00')],
      penandaan: 'IZIN',
    });
    expect(izin.jenis).toBe('IZIN');
    expect(izin.baris).toEqual(['02/10', 'Izin']);

    const tanpa = klasifikasiSel({
      tanggal: '2026-10-03',
      dari: DARI,
      sampai: SAMPAI,
      pasangan: [],
      penandaan: 'TANPA_KETERANGAN',
    });
    expect(tanpa.jenis).toBe('TANPA_KETERANGAN');
    expect(tanpa.baris).toEqual(['03/10', 'Tanpa Keterangan']);
  });

  it('klasifikasi sel: hadir, terlambat (FINAL > 0), parsial, kosong', () => {
    const dasar = { dari: DARI, sampai: SAMPAI };

    const hadir = klasifikasiSel({ ...dasar, tanggal: '2026-10-05', pasangan: [pasangan('07:00', '17:00')], penandaan: null });
    expect(hadir.jenis).toBe('HADIR');
    expect(hadir.baris).toEqual(['05/10', '07:00–17:00']);

    // final NULL bukan berarti terlambat (BR-L3: NULL = 0).
    const nullFinal = klasifikasiSel({ ...dasar, tanggal: '2026-10-05', pasangan: [pasangan('07:00', '17:00', null)], penandaan: null });
    expect(nullFinal.jenis).toBe('HADIR');

    // final > 0 = terlambat. Angka final, BUKAN selisih sistem.
    const final = klasifikasiSel({ ...dasar, tanggal: '2026-10-05', pasangan: [pasangan('06:55', '17:00', 25)], penandaan: null });
    expect(final.jenis).toBe('TERLAMBAT');
    expect(final.baris).toEqual(['05/10', '06:55–17:00']);

    // Pasangan setengah: jam check-in tampil, tanpa tanda hubung.
    const parsial = klasifikasiSel({ ...dasar, tanggal: '2026-10-05', pasangan: [pasangan('07:10', null)], penandaan: null });
    expect(parsial.jenis).toBe('PARSIAL');
    expect(parsial.baris).toEqual(['05/10', '07:10']);

    const kosong = klasifikasiSel({ ...dasar, tanggal: '2026-10-05', pasangan: [], penandaan: null });
    expect(kosong.jenis).toBe('KOSONG');
    expect(kosong.baris).toEqual(['05/10']);
  });

  it('dua pasangan sehari (kuota K-27) tampil DUA baris, kronologis', () => {
    const sel = klasifikasiSel({
      tanggal: '2026-10-05',
      dari: DARI,
      sampai: SAMPAI,
      pasangan: [pasangan('07:01', '15:32'), pasangan('13:00', '20:10')],
      penandaan: null,
    });
    expect(sel.jenis).toBe('HADIR');
    expect(sel.baris).toEqual(['05/10', '07:01–15:32', '13:00–20:10']);
  });

  it('satu hari terlambat di antara dua pasangan -> sel terlambat', () => {
    const sel = klasifikasiSel({
      tanggal: '2026-10-05',
      dari: DARI,
      sampai: SAMPAI,
      pasangan: [pasangan('07:01', '15:32'), pasangan('13:00', '20:10', 12)],
      penandaan: null,
    });
    expect(sel.jenis).toBe('TERLAMBAT');
  });

  it('grid: kolom 0 = Senin, 7 sel per pekan, hari luar rentang dibuangi', () => {
    const kal = susunKalenderKaryawan({
      dari: DARI,
      sampai: SAMPAI,
      karyawan_id: 1,
      karyawan_nama: 'Uji',
      toko_nama: ['Toko A'],
      kehadiran: [{ karyawan_id: 1, tanggal: '2026-10-05', pasangan: [pasangan('07:00', '17:00')] }],
      penandaan: [],
    });
    expect(kal.pekan.length).toBe(2);
    for (const pekan of kal.pekan) expect(pekan.length).toBe(7);

    // Pekan kedua dimulai Senin 2026-10-05 -> kolom 0.
    const filepath = kal.pekan[1]!;
    expect(filepath[0]!.tanggal).toBe('2026-10-05');
    expect(filepath[0]!.dalamRentang).toBe(true);
    expect(filepath[0]!.jenis).toBe('HADIR');

    // Awal pekan pertama masih September -> di luar rentang.
    expect(kal.pekan[0]![0]!.tanggal).toBe('2026-09-28');
    expect(kal.pekan[0]![0]!.jenis).toBe('LUAR_RENTANG');
    expect(kal.pekan[0]![0]!.baris).toEqual([]);
    // 01-04 Oktober di dalam rentang (Kamis-Minggu).
    expect(kal.pekan[0]![3]!.dalamRentang).toBe(true);
    // Akhir pekan kedua: 08-11 Oktober di luar rentang.
    expect(kal.pekan[1]![6]!.tanggal).toBe('2026-10-11');
    expect(kal.pekan[1]![6]!.jenis).toBe('LUAR_RENTANG');
  });

  it('hanya barisyang milik karyawan itu yang terpakai', () => {
    const kal = susunKalenderKaryawan({
      dari: DARI,
      sampai: SAMPAI,
      karyawan_id: 1,
      karyawan_nama: 'Milik',
      toko_nama: ['Toko A'],
      kehadiran: [
        { karyawan_id: 1, tanggal: '2026-10-05', pasangan: [pasangan('07:00', '17:00')] },
        { karyawan_id: 2, tanggal: '2026-10-05', pasangan: [pasangan('09:00', '19:00')] },
        { karyawan_id: 1, tanggal: '2026-10-06', pasangan: [pasangan('08:00', '18:00')] },
      ],
      penandaan: [{ karyawan_id: 2, tanggal: '2026-10-06', jenis: 'IZIN' }],
    });
    const txt = JSON.stringify(kal.pekan);
    expect(txt).not.toContain('09:00');
    expect(txt).not.toContain('Izin');
    expect(txt).toContain('07:00');
    expect(txt).toContain('08:00');
  });

  it('tanggal tidak sah atau rentang terbalik -> grid kosong, TIDAK melempar', () => {
    const dasar = { karyawan_id: 1, karyawan_nama: 'Uji', toko_nama: ['Toko A'], kehadiran: [], penandaan: [] };
    expect(susunKalenderKaryawan({ ...dasar, dari: SAMPAI, sampai: DARI }).pekan).toEqual([]);
    expect(susunKalenderKaryawan({ ...dasar, dari: 'bukan-tanggal', sampai: SAMPAI }).pekan).toEqual([]);
    expect(klasifikasiSel({ tanggal: 'x', dari: DARI, sampai: SAMPAI, pasangan: [], penandaan: null }).jenis).toBe('LUAR_RENTANG');
  });

  it('formatTanggalSel memakai dd/mm dari YYYY-MM-DD', () => {
    expect(formatTanggalSel('2026-10-05')).toBe('05/10');
  });
});

describe('M16 · repo kalender + file .xlsx', () => {
  let admin = '';
  let superId = 0;
  let tokoA = 0;
  let tokoB = 0;
  let tplA = 0;
  const kry: Record<string, number> = {};
  let namaPanjang = '';

  async function tambahKaryawan(nama: string): Promise<number> {
    const db = getDb();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, serialisasiWIB()] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [id, tokoA, '2026-09-01'] });
    return id;
  }

  /**
   * `waktu` ditulis penuh agar bisa menyimulasikan check-out yang lewat tengah
   * malam: tanggal check-out mewarisi tanggal check-in, jamnya sudah 00:30.
   */
  async function tambahEvent(
    karyawanId: number,
    tanggal: string,
    jenis: 'CHECKIN' | 'CHECKOUT',
    waktu: string,
    status: string,
    extra: { final?: number | null; alasan?: string | null; checkinId?: number | null; tokoId?: number } = {},
  ): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, alasan_tolak, keterlambatan_final_menit, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', ?, ?, ?, ?)",
      args: [
        randomUUID(), karyawanId, extra.tokoId ?? tokoA, tanggal, jenis, extra.checkinId ?? null, waktu, status,
        extra.alasan ?? null, extra.final ?? null, serialisasiWIB(),
      ],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  async function tambahJadwal(karyawanId: number, tanggal: string, mulai = '07:00'): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      args: [karyawanId, tokoA, tanggal, tplA, superId, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    await db.execute({ sql: "INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, 'Pagi', ?, ?)", args: [Number((r.rows[0] as Record<string, unknown>)['id']), mulai, '17:00'] });
  }

  async function tambahTanda(karyawanId: number, tanggal: string, jenis: string): Promise<void> {
    await getDb().execute({
      sql: 'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [karyawanId, tokoA, tanggal, jenis, superId, serialisasiWIB()],
    });
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    const db = getDb();
    superId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko A', sekarang] });
    tokoA = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko B', sekarang] });
    tokoB = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, 'Pagi', 'SEMUA', '07:00', '17:00', 1, ?)", args: [tokoA, sekarang] });
    tplA = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);

    // Andi: dua pasang sah di 01/10 (dua baris) + izin di 02/10.
    kry['Andi'] = await tambahKaryawan('Andi');
    const a1 = await tambahEvent(kry['Andi'], '2026-10-01', 'CHECKIN', '2026-10-01T07:01:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Andi'], '2026-10-01', 'CHECKOUT', '2026-10-01T15:32:00+07:00', 'DISETUJUI', { checkinId: a1 });
    const a2 = await tambahEvent(kry['Andi'], '2026-10-01', 'CHECKIN', '2026-10-01T13:00:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Andi'], '2026-10-01', 'CHECKOUT', '2026-10-01T20:10:00+07:00', 'DISETUJUI', { checkinId: a2 });
    await tambahTanda(kry['Andi'], '2026-10-02', 'IZIN');

    // Budi: terlambat FINAL (jadwal 07:00, check-in 06:55 -> tak terlambat sistem).
    kry['Budi'] = await tambahKaryawan('Budi');
    await tambahJadwal(kry['Budi'], '2026-10-05');
    const b1 = await tambahEvent(kry['Budi'], '2026-10-05', 'CHECKIN', '2026-10-05T06:55:00+07:00', 'DISETUJUI', { final: 25 });
    await tambahEvent(kry['Budi'], '2026-10-05', 'CHECKOUT', '2026-10-05T17:00:00+07:00', 'DISETUJUI', { checkinId: b1 });

    // Dini: terlambat SISTEM (jadwal 07:00, check-in 07:20) tapi final NULL -> hijau.
    kry['Dini'] = await tambahKaryawan('Dini');
    await tambahJadwal(kry['Dini'], '2026-10-06');
    const d1 = await tambahEvent(kry['Dini'], '2026-10-06', 'CHECKIN', '2026-10-06T07:20:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Dini'], '2026-10-06', 'CHECKOUT', '2026-10-06T17:00:00+07:00', 'DISETUJUI', { checkinId: d1 });

    // Hadi: hanya event DITOLAK + checkout orphan -> kalender harus kosong.
    kry['Hadi'] = await tambahKaryawan('Hadi');
    const h1 = await tambahEvent(kry['Hadi'], '2026-10-06', 'CHECKIN', '2026-10-06T07:30:00+07:00', 'DITOLAK', { alasan: 'Foto buram' });
    await tambahEvent(kry['Hadi'], '2026-10-06', 'CHECKOUT', '2026-10-06T12:00:00+07:00', 'DISETUJUI', { checkinId: h1 });

    // Gita: check-out lewat tengah malam (waktu 08/10 00:30, tanggal mewaris 07/10).
    kry['Gita'] = await tambahKaryawan('Gita');
    const g1 = await tambahEvent(kry['Gita'], '2026-10-07', 'CHECKIN', '2026-10-07T20:00:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Gita'], '2026-10-07', 'CHECKOUT', '2026-10-08T00:30:00+07:00', 'DISETUJUI', { checkinId: g1 });

    // Dua karyawan bernama sama -> dua sheet, nama harus dibedakan.
    kry['Fajar1'] = await tambahKaryawan('Fajar');
    kry['Fajar2'] = await tambahKaryawan('Fajar');
    const f1 = await tambahEvent(kry['Fajar1'], '2026-10-05', 'CHECKIN', '2026-10-05T07:10:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Fajar1'], '2026-10-05', 'CHECKOUT', '2026-10-05T17:10:00+07:00', 'DISETUJUI', { checkinId: f1 });
    const f2 = await tambahEvent(kry['Fajar2'], '2026-10-06', 'CHECKIN', '2026-10-06T07:20:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Fajar2'], '2026-10-06', 'CHECKOUT', '2026-10-06T17:20:00+07:00', 'DISETUJUI', { checkinId: f2 });

    // Nama > 31 karakter + karakter terlarang untuk nama sheet.
    namaPanjang = 'Rombongan [Tim] Operasional *Karyawan* accommodates 1234567890';
    kry['Panjang'] = await tambahKaryawan(namaPanjang);
    const p1 = await tambahEvent(kry['Panjang'], '2026-10-05', 'CHECKIN', '2026-10-05T07:40:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Panjang'], '2026-10-05', 'CHECKOUT', '2026-10-05T17:40:00+07:00', 'DISETUJUI', { checkinId: p1 });

    // Indah: hanya jadwal -> masuk cakupan Ringkasan, kalender kosong semua.
    kry['Indah'] = await tambahKaryawan('Indah');
    await tambahJadwal(kry['Indah'], '2026-10-05');

    // Rina: pindah toko di tengah periode (penempatan lama ditutup, yang baru
    // dibuka) lalu hadir di kedua toko. Sheet Ringkasan punya dua barisnya,
    // tapi sheet kalender harus tepat satu.
    kry['Rina'] = await tambahKaryawan('Rina');
    await getDb().execute({
      sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE karyawan_id = ?',
      args: ['2026-10-05', kry['Rina']],
    });
    await getDb().execute({
      sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai, berlaku_sampai) VALUES (?, ?, ?, NULL)',
      args: [kry['Rina'], tokoB, '2026-10-06'],
    });
    const r1 = await tambahEvent(kry['Rina'], '2026-10-05', 'CHECKIN', '2026-10-05T07:00:00+07:00', 'DISETUJUI');
    await tambahEvent(kry['Rina'], '2026-10-05', 'CHECKOUT', '2026-10-05T17:00:00+07:00', 'DISETUJUI', { checkinId: r1 });
    const r2 = await tambahEvent(kry['Rina'], '2026-10-06', 'CHECKIN', '2026-10-06T07:00:00+07:00', 'DISETUJUI', { tokoId: tokoB });
    await tambahEvent(kry['Rina'], '2026-10-06', 'CHECKOUT', '2026-10-06T17:00:00+07:00', 'DISETUJUI', { checkinId: r2, tokoId: tokoB });
  }, 120_000);

  afterAll(() => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  /** Koordinat sel dihitung dengan fungsi produksi, bukan ditiru ulang. */
  function selUntuk(ws: Worksheet, tanggal: string): { nilai: unknown; argb: string | undefined } {
    const semua = rentangTanggal(awalMinggu(DARI), '2026-10-11');
    const indeks = semua.indexOf(tanggal);
    expect(indeks, `tanggal ${tanggal} ada di grid`).toBeGreaterThanOrEqual(0);
    const baris = BARIS_GRID + Math.floor(indeks / 7);
    const kolom = (indeks % 7) + 1;
    const cell = ws.getRow(baris).getCell(kolom);
    return { nilai: cell.value, argb: cell.style?.fill?.fgColor?.argb };
  }

  async function eksporKeWorkbook(): Promise<Workbook> {
    const res = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: DARI, sampai: SAMPAI, toko_id: tokoA }, cookie: admin }));
    expect(res.status, 'ekspor tidak diblokir (data uji bersih)').toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    return wb;
  }

  it('repo: event DITOLAK tidak pernah masuk data kalender', async () => {
    const { kehadiran } = await kalenderPeriode({ dari: DARI, sampai: SAMPAI, tokoId: tokoA }, getDb());
    // Hadi hanya punya check-in DITOLAK -> tidak boleh muncul sama sekali.
    expect(
      kehadiran.some((k) => k.karyawan_id === kry['Hadi']),
      'check-in DITOLAK harus tersaring di SQL',
    ).toBe(false);
    expect(
      kehadiran.some((k) => k.karyawan_id === kry['Dini']),
      'check-in DISETUJUI harus masuk',
    ).toBe(true);
    // Jam check-in DITOLAK tidak boleh muncul sebagai milik siapa pun.
    expect(kehadiran.some((k) => k.pasangan.some((p) => p.checkin === '07:30'))).toBe(false);
  });

  it('repo: pasangan dikelompokkan per tanggal dan urut kronologis', async () => {
    const { kehadiran } = await kalenderPeriode({ dari: DARI, sampai: SAMPAI, tokoId: tokoA }, getDb());
    const andi = kehadiran.filter((k) => k.karyawan_id === kry['Andi'] && k.tanggal === '2026-10-01');
    expect(andi.length, 'satu baris per karyawan per tanggal').toBe(1);
    expect(andi[0]!.pasangan.map((p) => p.checkin)).toEqual(['07:01', '13:00']);
    expect(andi[0]!.pasangan.map((p) => p.checkout)).toEqual(['15:32', '20:10']);

    // Penandaan hari tanpa absensi pun harus ikut (query terpisah).
    const { penandaan } = await kalenderPeriode({ dari: DARI, sampai: SAMPAI, tokoId: tokoA }, getDb());
    expect(penandaan).toEqual([{ karyawan_id: kry['Andi'], tanggal: '2026-10-02', jenis: 'IZIN' }]);
  });

  it('file: tiga sheet tetap + satu sheet per karyawan cakupan Ringkasan, urut sama', async () => {
    const wb = await eksporKeWorkbook();
    const { ringkasan } = await susunRekap({ dari: DARI, sampai: SAMPAI, tokoId: tokoA }, getDb());
    // Satu sheet per KARYAWAN (karyawan_id), bukan per nama: dua karyawan bernama
    // sama tetap dapat dua sheet, hanya nama sheet-nya yang dibedakan akhiran.
    const idUnik = [...new Map(ringkasan.map((r) => [r.karyawan_id, r.karyawan_nama])).values()];
    expect(idUnik.length, 'ada lebih dari satu karyawan di cakupan').toBeGreaterThan(5);
    const dipakai = new Set<string>(['Ringkasan', 'Detail Harian', 'Detail Agenda']);
    const diharapkan = idUnik.map((nama) => namaSheetKalender(nama, dipakai));

    const nyata = wb.worksheets.map((w) => w.name);
    // Tiga sheet tetap TIDAK boleh hilang, berubah nama, atau tergeser.
    expect(nyata.slice(0, 3)).toEqual(['Ringkasan', 'Detail Harian', 'Detail Agenda']);
    // Sisanya persis daftar karyawan cakupan Ringkasan, urutan sama.
    expect(nyata.slice(3)).toEqual(diharapkan);
    expect(daftarSama(nyata.slice(3), diharapkan)).toBe(true);
  });

  it('file: isi sel dan warnanya terbaca balik persis dari .xlsx', async () => {
    const wb = await eksporKeWorkbook();

    // Dua pasangan -> tiga baris dalam satu sel.
    const andi = wb.getWorksheet('Andi')!;
    const sel01 = selUntuk(andi, '2026-10-01');
    expect(sel01.nilai).toBe('01/10\n07:01–15:32\n13:00–20:10');
    expect(sel01.argb).toBe(WARNA_SEL.HADIR);

    // Izin -> teks + warna biru.
    const sel02 = selUntuk(andi, '2026-10-02');
    expect(sel02.nilai).toBe('02/10\nIzin');
    expect(sel02.argb).toBe(WARNA_SEL.IZIN);

    // Terlambat ditentukan angka FINAL: Budi check-in 06:55 (tak terlambat sistem), final 25.
    const selBudi = selUntuk(wb.getWorksheet('Budi')!, '2026-10-05');
    expect(selBudi.nilai).toBe('05/10\n06:55–17:00');
    expect(selBudi.argb, 'final > 0 = or walau tak terlambat sistem').toBe(WARNA_SEL.TERLAMBAT);

    // Dini terlambat sistem (07:20 vs jadwal 07:00) tapi final NULL -> hijau.
    const selDini = selUntuk(wb.getWorksheet('Dini')!, '2026-10-06');
    expect(selDini.argb, 'final NULL tidak boleh diwarnai terlambat').toBe(WARNA_SEL.HADIR);

    // Hanya DITOLAK -> jamnya tidak boleh muncul di kalender.
    const selHadi = selUntuk(wb.getWorksheet('Hadi')!, '2026-10-06');
    expect(String(selHadi.nilai)).not.toContain('07:30');
    expect(String(selHadi.nilai)).not.toContain('12:00');
    expect(selHadi.argb).toBe(WARNA_SEL.KOSONG);

    // Check-out lewat tengah malam ditulis apa adanya (00:30).
    const selGita = selUntuk(wb.getWorksheet('Gita')!, '2026-10-07');
    expect(selGita.nilai).toBe('07/10\n20:00–00:30');

    // Hari di luar rentang -> abu dan tanpa isi.
    const luar = selUntuk(andi, '2026-10-11');
    expect(luar.argb).toBe(WARNA_SEL.LUAR_RENTANG);
    expect(luar.nilai ?? '').toBe('');
  });

  it('file: sheet karyawan tanpa absensi tetap ada dan kosong', async () => {
    const wb = await eksporKeWorkbook();
    const ws = wb.getWorksheet('Indah')!;
    expect(ws, 'karyawan cakupan-via-jadwal tetap dapat sheet').toBeDefined();
    const isi = JSON.stringify(ws.getRow(BARIS_GRID).getCell(1).value);
    expect(isi).not.toContain('07:00');
  });

  it('file: header Senin..Minggu dan legenda warna ada di tiap sheet', async () => {
    const wb = await eksporKeWorkbook();
    const ws = wb.getWorksheet('Andi')!;
    const header: unknown[] = [];
    ws.getRow(BARIS_GRID - 1).eachCell((c) => header.push(c.value));
    expect(header).toEqual(urutanHariSenin());
    expect(header[0]).toBe('Senin');

    const legenda: unknown[] = [];
    ws.getRow(3).eachCell((c) => legenda.push(c.value));
    expect(legenda).toEqual(['Hadir', 'Terlambat', 'Izin', 'Tanpa Keterangan', 'Di luar periode']);
    expect(ws.getRow(3).getCell(1).style?.fill?.fgColor?.argb).toBe(WARNA_SEL.HADIR);

    // Baris 1 = nama, baris 2 = periode + toko.
    expect(ws.getRow(1).getCell(1).value).toBe('Andi');
    expect(String(ws.getRow(2).getCell(1).value)).toContain('Periode 01/10/2026 – 07/10/2026');
    expect(String(ws.getRow(2).getCell(1).value)).toContain('Toko A');
  });

  it('file: nama kembar dibedakan dan nama terlarang dipotong 31 karakter', async () => {
    const wb = await eksporKeWorkbook();
    const nama = wb.worksheets.map((w) => w.name);
    expect(nama.filter((n) => n === 'Fajar').length, 'ada sheet Fajar').toBe(1);
    expect(nama.filter((n) => n.startsWith('Fajar')).length, 'Fajar dapat dua sheet').toBe(2);
    expect(new Set(nama).size, 'semua nama sheet unik').toBe(nama.length);

    const terpanjang = nama.reduce((a, b) => (b.length > a.length ? b : a), '');
    expect(terpanjang.length).toBeLessThanOrEqual(31);
    for (const n of nama) {
      expect(n, `nama sheet "${n}" bebas karakter terlarang`).not.toMatch(/[[\]*?:/\\]/);
    }
    // Nama terlarang dihilang, sisanya dipotong 31 karakter. Yang dibandingkan
    // adalah hasil aturan penamaan, BUKAN awalan nama mentah (karakter `[`/`*`
    // justru dihapus, jadi awalannya memang berbeda).
    const terambil = namaSheetKalender(namaPanjang, new Set<string>());
    expect(terambil.length).toBe(31);
    expect(nama).toContain(terambil);
    expect(terambil).not.toContain('[');
    expect(terambil).not.toContain('*');
  });

  it('namaSheetKalender: sanitize + akhiran untuk nama kembar', () => {
    const dipakai = new Set<string>(['Ringkasan']);
    expect(namaSheetKalender('Rombongan [Tim] KARYAWAN*', dipakai)).toBe('Rombongan Tim KARYAWAN');
    expect(namaSheetKalender('Rombongan Tim KARYAWAN', dipakai)).toBe('Rombongan Tim KARYAWAN (2)');
    expect(namaSheetKalender('   ', dipakai)).toBe('Karyawan');
    expect(namaSheetKalender('Ringkasan', dipakai), 'nama sheet tetap tidak ditimpa').toBe('Ringkasan (2)');
    expect(namaSheetKalender('x'.repeat(40), dipakai).length).toBe(31);
  });

  it('karyawan di dua toko dapat SATU sheet, dua nama toko di judul', async () => {
    // Rina pindah toko di tengah periode. Sheet Ringkasan punya 2 barisnya
    // (satu per toko), tapi sheet kalender harus TEPAT SATU, dan kedua nama
    // toko muncul di baris judul. Dicedah dengan ekspor SEMUA toko; kalau
    // diekspor per toko, hanya baris toko itu yang boleh ikut.
    const { ringkasan } = await susunRekap({ dari: DARI, sampai: SAMPAI, tokoId: null }, getDb());
    const barisRina = ringkasan.filter((r) => r.karyawan_id === kry['Rina']);
    expect(barisRina.length, 'Ringkasan tetap satu baris per karyawan per toko').toBe(2);

    const res = await EKSPOR(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: DARI, sampai: SAMPAI }, cookie: admin }));
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const sheetsRina = wb.worksheets.filter((w) => w.name.startsWith('Rina'));
    expect(sheetsRina.length, 'satu sheet untuk dua toko').toBe(1);
    const judul = String(sheetsRina[0]!.getRow(2).getCell(1).value);
    expect(judul).toContain('Toko A');
    expect(judul).toContain('Toko B');

    // Kedua hari kerja tetap tampil di sheet yang sama, di kolom yang benar
    // (05/10 dan 06/10 jatuh di pekan kedua, kolom Senin dan Selasa).
    const ws = sheetsRina[0]!;
    expect(selUntuk(ws, '2026-10-05').nilai).toBe('05/10\n07:00–17:00');
    expect(selUntuk(ws, '2026-10-06').nilai).toBe('06/10\n07:00–17:00');
  });

  it('konsistensi: jumlah hari hadir di kalender == kolom Hari Hadir di Ringkasan', async () => {
    const wb = await eksporKeWorkbook();
    const { ringkasan, kalender } = await susunRekap({ dari: DARI, sampai: SAMPAI, tokoId: tokoA }, getDb());
    for (const r of ringkasan) {
      const kal = kalender.find((k) => k.karyawan_id === r.karyawan_id)!;
      const hadir = kal.pekan.flat().filter((s) => s.jenis === 'HADIR' || s.jenis === 'TERLAMBAT').length;
      expect(hadir, `hari hadir ${r.karyawan_nama} sama dengan Ringkasan`).toBe(r.hari_hadir);
      // Sheet-nya benar-benar ada di file, bukan cuma di hasil repo.
      expect(wb.worksheets.map((w) => w.name)).toContain(
        wb.worksheets.slice(3).find((w) => w.getRow(1).getCell(1).value === r.karyawan_nama)?.name ?? 'tidak-ada',
      );
    }
  });

  it('buatWorkbook tanpa kalender tetap menulis tepat tiga sheet', async () => {
    const buf = await buatWorkbook([], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Ringkasan', 'Detail Harian', 'Detail Agenda']);
  });
});

/** Perbandingan daftar nama sheet dengan urutan yang diharapkan. */
function daftarSama(nyata: string[], diharapkan: string[]): boolean {
  if (nyata.length !== diharapkan.length) return false;
  return nyata.every((n, i) => n === diharapkan[i]);
}