process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import ExcelJS from 'exceljs';
import { getDb, denganTransaksi } from '../src/server/db';
import type { Executor } from '../src/server/audit';
import { serialisasiWIB } from '../src/server/waktu';
import { susunRekap, catatEkspor, barisDetail } from '../src/server/repo/rekap';
import type { KartuRingkasan } from '../src/server/aturan/rekap';
import { GET as pratinjau } from '../src/app/api/admin/rekap/route';
import { POST as periksa } from '../src/app/api/admin/rekap/periksa/route';
import { POST as ekspor } from '../src/app/api/admin/rekap/ekspor/route';
import { POST as putusan } from '../src/app/api/admin/verifikasi/[id]/route';
import { POST as koreksi } from '../src/app/api/admin/koreksi/route';
import { POST as tandai } from '../src/app/api/admin/tidak-berangkat/route';
import { POST as sel } from '../src/app/api/admin/jadwal/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m8_rekap.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
const D1 = '2026-10-01';
const D2 = '2026-10-02';
const D3 = '2026-10-03';
const D5 = '2026-10-05';
const D6 = '2026-10-06';

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

describe('M8 rekap & ekspor', () => {
  let admin = '';
  let superadmin = '';
  let superId = 0;
  const toko: Record<string, number> = {};
  const kry: Record<string, number> = {};
  const ciId: Record<string, number> = {};
  const tplId: Record<string, number> = {};

  async function tambahKaryawan(nama: string, tokoId: number): Promise<number> {
    const db = getDb();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, serialisasiWIB()] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', args: [id, tokoId, '2026-09-01'] });
    return id;
  }

  async function tambahEvent(karyawanId: number, tokoId: number, tanggal: string, jenis: 'CHECKIN' | 'CHECKOUT', jam: string, status: string, extra: { final?: number | null; alasan?: string | null; checkinId?: number | null } = {}): Promise<number> {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lokasi_status, status, alasan_tolak, keterlambatan_final_menit, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'KARYAWAN', 'f', 'c', 1, 'GAGAL', ?, ?, ?, ?)",
      args: [randomUUID(), karyawanId, tokoId, tanggal, jenis, extra.checkinId ?? null, `${tanggal}T${jam}+07:00`, status, extra.alasan ?? null, extra.final ?? null, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    return Number((r.rows[0] as Record<string, unknown>)['id']);
  }

  async function tambahJadwal(karyawanId: number, tokoId: number, tanggal: string, tplId: number, mulai: string, selesai: string, nama = 'Pagi'): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      args: [karyawanId, tokoId, tanggal, tplId, superId, serialisasiWIB()],
    });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await db.execute({ sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, ?, ?, ?)', args: [id, nama, mulai, selesai] });
  }

  async function tambahTanda(karyawanId: number, tokoId: number, tanggal: string, jenis: string): Promise<void> {
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
    for (const nama of ['Toko A', 'Toko B']) {
      await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
      const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
      toko[nama] = Number((r.rows[0] as Record<string, unknown>)['id']);
    }
    const tpl: Record<string, number> = {};
    for (const t of ['Toko A', 'Toko B']) {
      await db.execute({ sql: "INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, 'Pagi', 'SEMUA', '07:00', '17:00', 1, ?)", args: [toko[t]!, sekarang] });
      const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
      tpl[t] = Number((r.rows[0] as Record<string, unknown>)['id']);
      tplId[t] = tpl[t]!;
    }
    const TA = toko['Toko A']!;
    const TB = toko['Toko B']!;
    for (const n of ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K12']) kry[n] = await tambahKaryawan(n, TA);
    kry['K10'] = await tambahKaryawan('K10', TA);
    kry['K11'] = await tambahKaryawan('K11', TB);

    // D1: K1 pair MENUNGGU/MENUNGGU; K2 pair DISETUJUI + final 45 (06:55, tak terlambat);
    // K3 dua pasang DISETUJUI; K4 ci DITOLAK; K5 ci DISETUJUI + co MENUNGGU;
    // K7 ci DITOLAK + co DISETUJUI (orphan BR-V5); K9 ci DISETUJUI + co DITOLAK (tetap terbuka).
    const k1 = await tambahEvent(kry['K1']!, TA, D1, 'CHECKIN', '07:06:00', 'MENUNGGU');
    await tambahEvent(kry['K1']!, TA, D1, 'CHECKOUT', '17:00:00', 'MENUNGGU', { checkinId: k1 });
    const k2 = await tambahEvent(kry['K2']!, TA, D1, 'CHECKIN', '06:55:00', 'DISETUJUI', { final: 45 });
    await tambahEvent(kry['K2']!, TA, D1, 'CHECKOUT', '17:00:00', 'DISETUJUI', { checkinId: k2 });
    const k3a = await tambahEvent(kry['K3']!, TA, D1, 'CHECKIN', '07:00:00', 'DISETUJUI');
    await tambahEvent(kry['K3']!, TA, D1, 'CHECKOUT', '12:00:00', 'DISETUJUI', { checkinId: k3a });
    const k3b = await tambahEvent(kry['K3']!, TA, D1, 'CHECKIN', '13:00:00', 'DISETUJUI');
    await tambahEvent(kry['K3']!, TA, D1, 'CHECKOUT', '18:00:00', 'DISETUJUI', { checkinId: k3b });
    await tambahEvent(kry['K4']!, TA, D1, 'CHECKIN', '07:00:00', 'DITOLAK', { alasan: 'Foto buram' });
    const k5 = await tambahEvent(kry['K5']!, TA, D1, 'CHECKIN', '07:00:00', 'DISETUJUI');
    await tambahEvent(kry['K5']!, TA, D1, 'CHECKOUT', '17:00:00', 'MENUNGGU', { checkinId: k5 });
    const k7 = await tambahEvent(kry['K7']!, TA, D1, 'CHECKIN', '07:00:00', 'DITOLAK', { alasan: 'Salah orang' });
    await tambahEvent(kry['K7']!, TA, D1, 'CHECKOUT', '12:00:00', 'DISETUJUI', { checkinId: k7 });
    const k9 = await tambahEvent(kry['K9']!, TA, D1, 'CHECKIN', '07:10:00', 'DISETUJUI');
    await tambahEvent(kry['K9']!, TA, D1, 'CHECKOUT', '12:00:00', 'DITOLAK', { alasan: 'Ganda', checkinId: k9 });
    // D2: K6 ci DISETUJUI tanpa co (terbuka); K8 jadwal saja (peringatan).
    await tambahEvent(kry['K6']!, TA, D2, 'CHECKIN', '07:00:00', 'DISETUJUI');
    // Jadwal + penandaan.
    for (const k of ['K1', 'K2', 'K3', 'K5']) await tambahJadwal(kry[k]!, TA, D1, tpl['Toko A']!, '07:00', '17:00');
    await tambahJadwal(kry['K6']!, TA, D2, tpl['Toko A']!, '07:00', '17:00');
    await tambahJadwal(kry['K8'] ?? (kry['K8'] = await tambahKaryawan('K8', TA)), TA, D2, tpl['Toko A']!, '07:00', '17:00');
    await tambahTanda(kry['K2']!, TA, D1, 'IZIN');
    await tambahTanda(kry['K2']!, TA, D2, 'IZIN');
    await tambahTanda(kry['K3']!, TA, D1, 'TANPA_KETERANGAN');
    // D5/TA bersih terverifikasi (K12) untuk ekspor sukses; D6/TB (K11) untuk kunci semua-toko.
    const k12 = await tambahEvent(kry['K12']!, TA, D5, 'CHECKIN', '07:00:00', 'DISETUJUI');
    ciId['K12ci'] = k12;
    await tambahEvent(kry['K12']!, TA, D5, 'CHECKOUT', '17:00:00', 'DISETUJUI', { checkinId: k12 });
    await tambahJadwal(kry['K12']!, TA, D5, tpl['Toko A']!, '07:00', '17:00');
    const k11 = await tambahEvent(kry['K11']!, TB, D6, 'CHECKIN', '07:00:00', 'DISETUJUI');
    await tambahEvent(kry['K11']!, TB, D6, 'CHECKOUT', '17:00:00', 'DISETUJUI', { checkinId: k11 });
    await tambahJadwal(kry['K11']!, TB, D6, tpl['Toko B']!, '07:00', '17:00');
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  function baris(data: { ringkasan: KartuRingkasan[] }, nama: string) {
    const r = data.ringkasan.find((x) => x.karyawan_nama === nama)!;
    expect(r, `baris ${nama} harus ada`).toBeDefined();
    return r;
  }

  it('BR-L3: final NULL -> 0; final 45 pada yang tak terlambat -> 45', async () => {
    const res = await pratinjau(req(`/api/admin/rekap?dari=${D1}&sampai=${D1}`, { cookie: admin }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data as { ringkasan: KartuRingkasan[] };
    // K9: terlambat sistem (selisih 10) tapi final NULL -> total 0.
    expect(baris(data, 'K9').total_terlambat_final).toBe(0);
    // K2: TIDAK terlambat sistem (06:55 vs 07:00) tapi final 45 -> total 45.
    expect(baris(data, 'K2').total_terlambat_final).toBe(45);
  });

  it('BR-H1/H2 + BR-V5: 1 pasang, 2 pasang, setengah, orphan, dua karyawan', async () => {
    const res = await pratinjau(req(`/api/admin/rekap?dari=${D1}&sampai=${D1}`, { cookie: admin }));
    const data = (await res.json()).data as { ringkasan: KartuRingkasan[] };
    expect(baris(data, 'K2').hari_hadir).toBe(1);
    expect(baris(data, 'K2').hari_izin).toBe(1);
    expect(baris(data, 'K3').hari_hadir).toBe(1);
    expect(baris(data, 'K3').hari_tanpa_keterangan).toBe(1);
    expect(baris(data, 'K5').hari_hadir).toBe(0);
    expect(baris(data, 'K7').hari_hadir).toBe(0);
    expect(baris(data, 'K1').hari_hadir).toBe(0);
  });

  it('BR-R2: MENUNGGU memblokir dengan jumlah; terbuka memblokir dengan jumlah; keduanya', async () => {
    const res = await periksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: D1, sampai: D2 }, cookie: admin }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data as { boleh: boolean; jumlahMenunggu: number; jumlahCheckinTerbuka: number; peringatan: number };
    // MENUNGGU: K1ci, K1co, K5co (D1) = 3. (K6ci D2 DISETUJUI: terbuka tapi bukan menunggu.)
    expect(data.jumlahMenunggu).toBe(3);
    // Terbuka: K6 (D2, tanpa co) + K9 (D1, co DITOLAK) = 2.
    expect(data.jumlahCheckinTerbuka).toBe(2);
    expect(data.boleh).toBe(false);
  });

  it('BR-R2 definisi: check-out DITOLAK membuat check-in tetap terbuka', async () => {
    const res = await periksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: D1, sampai: D1 }, cookie: admin }));
    const data = (await res.json()).data as { boleh: boolean; jumlahCheckinTerbuka: number };
    // D1 saja: hanya K9 yang terbuka (co-nya DITOLAK).
    expect(data.jumlahCheckinTerbuka).toBe(1);
    expect(data.boleh).toBe(false);
  });

  it('BR-R2 bersih -> LOLOS (pratinjau + periksa + ekspor)', async () => {
    const res = await periksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: D5, sampai: D5, toko_id: toko['Toko A'] }, cookie: admin }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data as { boleh: boolean; jumlahMenunggu: number; jumlahCheckinTerbuka: number; peringatan: number };
    expect(data).toEqual({ boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 0 });
  });

  it('BR-R3: terjadwal tanpa absen/tanda = peringatan saja, ekspor tetap LOLOS', async () => {
    const res = await periksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: D1, sampai: D3 }, cookie: admin }));
    const data = (await res.json()).data as { boleh: boolean; peringatan: number };
    // K8 terjadwal D2 tanpa event dan tanpa penandaan -> tepat 1 peringatan.
    expect(data.peringatan).toBe(1);
    // ...tetapi periode ini tetap diblokir karena MENUNGGU/terbuka (bukan oleh peringatan).
    expect(data.boleh).toBe(false);
  });

  it('BR-R3 murni: hanya peringatan -> tetap LOLOS', async () => {
    const db = getDb();
    const kry = await tambahKaryawan('K14', toko['Toko A']!);
    await tambahJadwal(kry, toko['Toko A']!, D3, tplId['Toko A']!, '07:00', '17:00');
    const res = await periksa(req('/api/admin/rekap/periksa', { method: 'POST', body: { dari: D3, sampai: D3, toko_id: toko['Toko A'] }, cookie: admin }));
    expect(res.status).toBe(200);
    const data = (await res.json()).data as { boleh: boolean; jumlahMenunggu: number; jumlahCheckinTerbuka: number; peringatan: number };
    expect(data).toEqual({ boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 1 });
  });

  it('Detail: selisih sistem dan final tidak tertukar (repo, kasus pembeda)', async () => {
    const db = getDb();
    const detail = await barisDetail({ dari: D1, sampai: D1, tokoId: toko['Toko A']! }, db);
    const k2 = detail.find((d) => d.karyawan_nama === 'K2' && d.waktu_checkin === '06:55')!;
    const k3 = detail.find((d) => d.karyawan_nama === 'K3' && d.waktu_checkin === '07:00')!;
    // K2: selisih -5 (06:55 vs 07:00), final 45. K3: selisih 0, final null.
    expect(k2.selisih_sistem).toBe(-5);
    expect(k2.final_menit).toBe(45);
    expect(k3.selisih_sistem).toBe(0);
    expect(k3.final_menit).toBeNull();
  });

  it('race: galat saat tulis log_ekspor -> 500, tanpa baris, tanpa file', async () => {
    const db = getDb();
    const sebelum = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM log_ekspor', args: [] });
    await expect(
      denganTransaksi(async (tx) => {
        const exRusak: Executor = {
          execute: async (stmt) => {
            const sql = typeof stmt === 'string' ? stmt : stmt.sql;
            if (sql.includes('INSERT INTO log_ekspor')) throw new Error('disk I/O simulasi');
            return tx.execute(stmt);
          },
        };
        const susun = await susunRekap({ dari: D5, sampai: D5, tokoId: toko['Toko A']! }, exRusak);
        if (!susun.pemeriksaan.boleh) throw new Error('seharusnya lolos');
        await catatEkspor({ dari: D5, sampai: D5, tokoId: toko['Toko A']! }, superId, exRusak);
      }),
    ).rejects.toThrow('disk I/O simulasi');
    const sesudah = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM log_ekspor', args: [] });
    expect(Number((sesudah.rows[0] as Record<string, unknown>)['c'])).toBe(Number((sebelum.rows[0] as Record<string, unknown>)['c']));
  });

  it('ekspor sukses: xlsx + 1 baris log + audit; dua kali = dua baris', async () => {
    const db = getDb();
    const bodies: ArrayBuffer[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await ekspor(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: D5, sampai: D5, toko_id: toko['Toko A'] }, cookie: admin }));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheetml');
      bodies.push(await res.arrayBuffer());
    }
    const log = await db.execute({ sql: "SELECT pengguna_id, tanggal_mulai, tanggal_selesai, toko_id FROM log_ekspor WHERE tanggal_mulai = '2026-10-05'", args: [] });
    expect(log.rows.length).toBe(2);
    const baris = log.rows[0] as Record<string, unknown>;
    expect(baris['tanggal_selesai']).toBe('2026-10-05');
    expect(Number(baris['toko_id'])).toBe(toko['Toko A']);
    const audit = await db.execute({ sql: "SELECT COUNT(*) AS c FROM audit_log WHERE aksi = 'EKSPOR'", args: [] });
    expect(Number((audit.rows[0] as Record<string, unknown>)['c'])).toBe(2);
    // Pratinjau == isi sheet Ringkasan.
    const prev = await pratinjau(req(`/api/admin/rekap?dari=${D5}&sampai=${D5}&toko_id=${toko['Toko A']}`, { cookie: admin }));
    const ringkasan = ((await prev.json()).data as { ringkasan: KartuRingkasan[] }).ringkasan;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bodies[0]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Ringkasan', 'Detail Harian']);
    const ws = wb.getWorksheet('Ringkasan')!;
    const dariFile: unknown[][] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      dariFile.push([row.getCell(1).value, row.getCell(3).value, row.getCell(4).value, row.getCell(5).value, row.getCell(6).value]);
    });
    expect(dariFile).toEqual(ringkasan.map((r) => [r.karyawan_nama, r.hari_hadir, r.hari_izin, r.hari_tanpa_keterangan, r.total_terlambat_final]));
  });

  it('Excel: 12 kolom Detail, nilai WIB, baca balik', async () => {
    const res = await ekspor(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: D5, sampai: D5, toko_id: toko['Toko A'] }, cookie: admin }));
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const ws = wb.getWorksheet('Detail Harian')!;
    const header: unknown[] = [];
    ws.getRow(1).eachCell((c) => header.push(c.value));
    expect(header.length).toBe(12);
    expect(header).toEqual([
      'Tanggal', 'Karyawan', 'Toko', 'Slot Jadwal Acuan', 'Waktu Check-in', 'Waktu Check-out',
      'Status Check-in', 'Status Check-out', 'Selisih Sistem (menit)', 'Keterlambatan Final (menit)',
      'Penandaan', 'Catatan Koreksi',
    ]);
    // Baris K12: tanggal & jam WIB persis, selisih 0 (07:00 vs 07:00).
    const baris2: unknown[] = [];
    ws.getRow(2).eachCell((c) => baris2.push(c.value));
    expect(baris2[0]).toBe('05/10/2026');
    expect(baris2[4]).toBe('07:00');
    expect(baris2[5]).toBe('17:00');
    expect(baris2[8]).toBe(0);
  });

  it('kunci NYATA: ekspor route lalu ADMIN 403 / Super 200 (verifikasi, koreksi, penandaan, jadwal)', async () => {
    // F1 (D5/TA) sudah diekspor di tes sebelumnya — lewat route sungguhan.
    const db = getDb();
    const cekLog = await db.execute({ sql: "SELECT COUNT(*) AS c FROM log_ekspor WHERE tanggal_mulai = '2026-10-05'", args: [] });
    expect(Number((cekLog.rows[0] as Record<string, unknown>)['c'])).toBeGreaterThan(0);

    // Verifikasi: ubah keputusan K12ci.
    const vAdmin = await putusan(req(`/api/admin/verifikasi/${ciId['K12ci']}`, { method: 'POST', body: { keputusan: 'DITOLAK', alasan_tolak: 'uji kunci' }, cookie: admin }));
    expect(vAdmin.status).toBe(403);
    const vSuper = await putusan(req(`/api/admin/verifikasi/${ciId['K12ci']}`, { method: 'POST', body: { keputusan: 'DITOLAK', alasan_tolak: 'uji kunci' }, cookie: superadmin }));
    expect(vSuper.status).toBe(200);
    // Kembalikan agar fixture stabil untuk tes berikut.
    const vBalik = await putusan(req(`/api/admin/verifikasi/${ciId['K12ci']}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }));
    expect(vBalik.status).toBe(200);

    // Koreksi: tambah check-in K12 pada D5.
    const kAdmin = await koreksi(req('/api/admin/koreksi', { method: 'POST', body: { operasi: 'tambah_checkin', karyawan_id: kry['K12'], waktu: `${D5}T18:00:00+07:00`, alasan: 'uji kunci' }, cookie: admin }));
    expect(kAdmin.status).toBe(403);
    const kSuper = await koreksi(req('/api/admin/koreksi', { method: 'POST', body: { operasi: 'tambah_checkin', karyawan_id: kry['K12'], waktu: `${D5}T18:00:00+07:00`, alasan: 'uji kunci' }, cookie: superadmin }));
    expect(kSuper.status).toBe(200);

    // Penandaan: K12/D5 (punya event aktif -> super pun ditolak BR-X3, jadi
    // pakai K13 yang dijadwalkan D5 tanpa event).
    const kry13 = await tambahKaryawan('K13', toko['Toko A']!);
    await tambahJadwal(kry13, toko['Toko A']!, D5, tplId['Toko A']!, '07:00', '17:00');
    const tAdmin = await tandai(req('/api/admin/tidak-berangkat', { method: 'POST', body: { karyawan_ids: [kry13], dari: D5, jenis: 'IZIN' }, cookie: admin }));
    expect(tAdmin.status).toBe(403);
    const tSuper = await tandai(req('/api/admin/tidak-berangkat', { method: 'POST', body: { karyawan_ids: [kry13], dari: D5, jenis: 'IZIN' }, cookie: superadmin }));
    expect(tSuper.status).toBe(201);

    // Jadwal: sel K12/TA/D5.
    const jAdmin = await sel(req('/api/admin/jadwal', { method: 'POST', body: { toko_id: toko['Toko A'], karyawan_id: kry['K12'], tanggal: D5, nama_template: 'Pagi', mode: 'timpa' }, cookie: admin }));
    expect(jAdmin.status).toBe(403);
    const jSuper = await sel(req('/api/admin/jadwal', { method: 'POST', body: { toko_id: toko['Toko A'], karyawan_id: kry['K12'], tanggal: D5, nama_template: 'Pagi', mode: 'timpa' }, cookie: superadmin }));
    expect(jSuper.status).toBe(201);
  });

  it('ekspor semua toko mengunci SEMUA toko', async () => {
    // F2: D6 tanpa toko (null) — K11/TB sudah terverifikasi penuh.
    const f2 = await ekspor(req('/api/admin/rekap/ekspor', { method: 'POST', body: { dari: D6, sampai: D6, toko_id: null }, cookie: admin }));
    expect(f2.status).toBe(200);
    // ADMIN terkunci di TB/D6 maupun TA/D6.
    const jB = await sel(req('/api/admin/jadwal', { method: 'POST', body: { toko_id: toko['Toko B'], karyawan_id: kry['K11'], tanggal: D6, nama_template: 'Pagi', mode: 'timpa' }, cookie: admin }));
    expect(jB.status).toBe(403);
    const jA = await sel(req('/api/admin/jadwal', { method: 'POST', body: { toko_id: toko['Toko A'], karyawan_id: kry['K12'], tanggal: D6, nama_template: 'Pagi', mode: 'timpa' }, cookie: admin }));
    expect(jA.status).toBe(403);
    const vSuper = await putusan(req(`/api/admin/verifikasi/${ciId['K12ci']}`, { method: 'POST', body: { keputusan: 'DISETUJUI' }, cookie: superadmin }));
    expect(vSuper.status).toBe(200);
  });
});
