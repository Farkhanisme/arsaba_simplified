process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb, denganTransaksi } from '../src/server/db';
import { serialisasiWIB } from '../src/server/waktu';
import {
  buatAgenda,
  batalkanAgenda,
  gantiTujuanAgenda,
  daftarAgenda,
  agendaDenganPenerima,
  penempatanTerbuka,
  GalatAgenda,
} from '../src/server/repo/agenda';
import { GET as agendaGET, POST as agendaPOST } from '../src/app/api/admin/agenda/route';
import { PUT as agendaPUT } from '../src/app/api/admin/agenda/[id]/route';
import * as modulAgendaId from '../src/app/api/admin/agenda/[id]/route';
import { POST as loginRoute } from '../src/app/api/login/route';

const DB_PATH = 'data/uji_m11_agenda.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

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

async function json(res: Response): Promise<{ kode: string; pesan: string; data?: unknown }> {
  return (await res.json()) as { kode: string; pesan: string; data?: unknown };
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

describe('M11 agenda — admin', () => {
  let admin = '';
  let superadmin = '';
  let superId = 0;
  let tokoA = 0;
  let tokoB = 0;
  /**
   * Id karyawan yang dipakai tes. Tipe eksplisit (bukan `Record<string, number>`) karena
   * akses `kry.x` pada map menghasilkan `number | undefined` di bawah noUncheckedIndexedAccess,
   * yang tidak bisa masuk `args` SQL — dan lebih penting,出了一个 "Undefined" yang akan
   * menulis NULL ke kolom bertipe INTEGER, bukan gagal di compile.
   */
  const kry = {
    andi: 0,
    budi: 0,
    citra: 0,
    dina: 0,
    eka: 0,
  } as { andi: number; budi: number; citra: number; dina: number; eka: number };

  async function tambahKaryawan(nama: string, toko: number | null, mulai = '2026-01-01'): Promise<number> {
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    const id = Number(((await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
    if (toko !== null) {
      await db.execute({
        sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)',
        args: [id, toko, mulai],
      });
    }
    return id;
  }

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = 'TEST-BOT-TOKEN-M11';
    process.env['TELEGRAM_CHAT_ID'] = '-10011';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    admin = await cookieUntuk('admin');
    superadmin = await cookieUntuk('superadmin');
    const db = getDb();
    const sekarang = serialisasiWIB();
    for (const nama of ['Toko A', 'Toko B']) {
      await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    }
    const tA = Number(((await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: ['Toko A'] })).rows[0] as Record<string, unknown>)['id']);
    const tB = Number(((await db.execute({ sql: 'SELECT id FROM toko WHERE nama = ?', args: ['Toko B'] })).rows[0] as Record<string, unknown>)['id']);
    tokoA = tA;
    tokoB = tB;
    superId = Number(((await db.execute({ sql: "SELECT id FROM pengguna_admin WHERE username = 'superadmin'", args: [] })).rows[0] as Record<string, unknown>)['id']);
    kry['andi'] = await tambahKaryawan('Andi', tA);
    kry['budi'] = await tambahKaryawan('Budi', tA);
    kry['citra'] = await tambahKaryawan('Citra', tB);
    kry['dina'] = await tambahKaryawan('Dina', tA);
    kry['eka'] = await tambahKaryawan('Eka', null);
    await db.execute({ sql: 'UPDATE karyawan SET aktif = 0 WHERE id = ?', args: [kry['dina']] });
  }, 120_000);

  async function buat(body: Record<string, unknown>, cookie = admin): Promise<Response> {
    return agendaPOST(req('/api/admin/agenda', { method: 'POST', body, cookie }));
  }

  describe('POST /api/admin/agenda — BR-G1..G3', () => {
    it('ADMIN boleh membuat agenda (BR-G20: izin agenda dua peran)', async () => {
      const res = await buat({ judul: 'Bersih rak 1', wajib_foto: true, cakupan: 'SEMUA' });
      expect(res.status).toBe(201);
      expect((await json(res)).kode).toBe('AGENDA_DISIMPAN');
    });

    it('Super Admin juga boleh', async () => {
      const res = await buat({ judul: 'Cek generator', wajib_foto: false, cakupan: 'TOKO', toko_id: tokoA }, superadmin);
      expect(res.status).toBe(201);
    });

    it('tanpa sesi ditolak 401', async () => {
      const res = await agendaPOST(req('/api/admin/agenda', { method: 'POST', body: { judul: 'X', wajib_foto: true, cakupan: 'SEMUA' } }));
      expect(res.status).toBe(401);
    });

    it('judul kosong ditolak 400 di server (bukan hanya UI)', async () => {
      const res = await buat({ judul: '   ', wajib_foto: true, cakupan: 'SEMUA' });
      expect(res.status).toBe(400);
      expect((await json(res)).pesan).toBe('Judul agenda wajib diisi.');
    });

    it('TOKO tanpa toko_id ditolak', async () => {
      const res = await buat({ judul: 'A', wajib_foto: true, cakupan: 'TOKO' });
      expect(res.status).toBe(400);
      expect((await json(res)).pesan).toBe('Pilih toko penerima agenda.');
    });

    it('KARYAWAN tanpa daftar ditolak', async () => {
      const res = await buat({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [] });
      expect(res.status).toBe(400);
      expect((await json(res)).pesan).toBe('Pilih minimal satu karyawan.');
    });

    it('karyawan nonaktif ditolak', async () => {
      const res = await buat({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [kry['dina']] });
      expect(res.status).toBe(400);
    });

    it('judul melebihi batas ditolak zod', async () => {
      const res = await buat({ judul: 'x'.repeat(121), wajib_foto: true, cakupan: 'SEMUA' });
      expect(res.status).toBe(400);
    });

    it('target_tanggal opsional: kosong diterima dan disimpan NULL', async () => {
      const res = await buat({ judul: 'Tanpa target', wajib_foto: true, cakupan: 'SEMUA' });
      const id = ((await json(res)).data as { id: number }).id;
      const a = (await agendaDenganPenerima(id, getDb()))!;
      expect(a.agenda.target_tanggal).toBeNull();
    });

    it('target_tanggal tidak valid ditolak', async () => {
      const res = await buat({ judul: 'A', wajib_foto: true, cakupan: 'SEMUA', target_tanggal: '2026-13-45' });
      expect(res.status).toBe(400);
    });

    it('database menolak agenda tanpa pembuat (CHECK tepat satu pembuat)', async () => {
      const db = getDb();
      await expect(
        db.execute({
          sql: "INSERT INTO agenda (judul, wajib_foto, cakupan, dibuat_at) VALUES ('X', 1, 'SEMUA', ?)",
          args: [serialisasiWIB()],
        }),
      ).rejects.toThrow();
    });

    it('database menolak cakupan TOKO tanpa toko_id', async () => {
      const db = getDb();
      await expect(
        db.execute({
          sql: "INSERT INTO agenda (judul, wajib_foto, cakupan, dibuat_oleh, dibuat_at) VALUES ('X', 1, 'TOKO', ?, ?)",
          args: [superId, serialisasiWIB()],
        }),
      ).rejects.toThrow();
    });
  });

  describe('BR-G2: penerima dihitung dari penempatan saat ini', () => {
    it('TOKO: hanya karyawan aktif di toko itu', async () => {
      const id = Number(((await json(await buat({ judul: 'Per toko', wajib_foto: true, cakupan: 'TOKO', toko_id: tokoA }))).data as { id: number }).id);
      const a = (await agendaDenganPenerima(id, getDb()))!;
      expect(a.penerimaIds.sort((x, y) => x - y)).toEqual([kry['andi'], kry['budi']].sort((x, y) => x - y));
    });

    it('SEMUA termasuk karyawan tanpa penempatan, tapi KECUALI nonaktif', async () => {
      const id = Number(((await json(await buat({ judul: 'Semua', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      const a = (await agendaDenganPenerima(id, getDb()))!;
      expect(a.penerimaIds).toContain(kry['eka']);
      expect(a.penerimaIds).not.toContain(kry['dina']);
    });

    it('MEMINDAHKAN karyawan mengubah penerima agenda tanpa ada baris yang ditulis (K-58)', async () => {
      const id = Number(((await json(await buat({ judul: 'Dinamis', wajib_foto: true, cakupan: 'TOKO', toko_id: tokoB }))).data as { id: number }).id);
      const sebelum = (await agendaDenganPenerima(id, getDb()))!.penerimaIds;
      expect(sebelum).toEqual([kry['citra']]);

      // Pindahkan Citra dari Toko B ke Toko A. Tidak ada penulisan ke tabel agenda.
      const db = getDb();
      await db.execute({
        sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE karyawan_id = ? AND berlaku_sampai IS NULL',
        args: ['2026-06-30', kry['citra']],
      });
      await db.execute({
        sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)',
        args: [kry['citra'], tokoA, '2026-07-01'],
      });

      // Citra LEPAS dari agenda Toko B. Ini konsekuensi K-58 yang disengaja: penerima
      // dihitung ulang, jadi memindahkan karyawan diam-diam mengubah siapa yang punya
      // agenda. Kalau tes ini gagal berarti resolutionssnapshot, bukan dinamis.
      const sesudah = (await agendaDenganPenerima(id, getDb()))!.penerimaIds;
      expect(sesudah).not.toContain(kry['citra']);
      expect(sesudah).toEqual([]);

      // Kembalikan Citra ke Toko B dengan kondisi yang tidak ambigu: hapus semua
      // penempatan lalu buat satu yang terbuka. UPDATE tanpa ORDER BY pada dua baris
      // penempatan terbuka bisa menutup baris yang salah.
      await db.execute({ sql: 'DELETE FROM karyawan_penempatan WHERE karyawan_id = ?', args: [kry['citra']] });
      await db.execute({
        sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)',
        args: [kry['citra'], tokoB, '2026-01-01'],
      });
      const balik = (await agendaDenganPenerima(id, getDb()))!.penerimaIds;
      expect(balik).toEqual([kry['citra']]);
    });

    it('KARYAWAN: daftar eksplisit tidak berubah oleh perpindahan toko', async () => {
      const id = Number(
        ((await json(await buat({ judul: 'Eksplisit', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [kry['eka'], kry['citra']] }))).data as { id: number }).id,
      );
      const a = (await agendaDenganPenerima(id, getDb()))!;
      expect(a.penerimaIds.sort((x, y) => x - y)).toEqual([kry['eka'], kry['citra']].sort((x, y) => x - y));
    });
  });

  describe('K-62: pembatalan', () => {
    it('berhasil membatalkan dengan alasan', async () => {
      const id = Number(((await json(await buat({ judul: 'Akan dibatal', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      const res = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'Sudah tidak relevan' }, cookie: admin }));
      expect(res.status).toBe(200);
      const a = (await agendaDenganPenerima(id, getDb()))!.agenda;
      expect(a.status).toBe('DIBATALKAN');
      expect(a.alasan_batal).toBe('Sudah tidak relevan');
      expect(a.dibatalkan_at).not.toBeNull();
    });

    it('tanpa alasan ditolak 400', async () => {
      const id = Number(((await json(await buat({ judul: 'Tanpa alasan', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      const res = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: '' }, cookie: admin }));
      expect(res.status).toBe(400);
    });

    it('agenda yang sudah dibatalkan tidak bisa dibatalkan lagi (409)', async () => {
      const id = Number(((await json(await buat({ judul: 'Dobel', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'Satu kali' }, cookie: admin }));
      const kedua = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'Lagi' }, cookie: admin }));
      expect(kedua.status).toBe(409);
      expect((await json(kedua)).pesan).toBe('Agenda ini sudah dibatalkan.');
    });

    it('id agenda tidak ada -> 404', async () => {
      const res = await agendaPUT(req('/api/admin/agenda/999999', { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'x' }, cookie: admin }));
      expect(res.status).toBe(404);
    });

    it('TIDAK ada hapus permanen: modul route tidak mengekspor DELETE sama sekali', () => {
      // Membaca daftar export modul, bukan instanceof — ini yang membuktikan tidak ada
      // jalur hapus di lapisan HTTP sama sekali (K-62).
      // Diperluas ke Record<string, unknown> supaya properti yang TIDAK ada pun bisa
      // diperiksa. Tanpa itu, TypeScript sendiri yang menolak `DELETE` — artinya tes ini
      // membuktikannya lewat compiler, bukan lewat assertion.
      const diekspor = modulAgendaId as unknown as Record<string, unknown>;
      expect(diekspor['DELETE']).toBeUndefined();
      expect(typeof modulAgendaId['PUT']).toBe('function');
      expect(Object.keys(modulAgendaId).sort()).toEqual(['PUT']);
    });
  });

  describe('K-62/BR-G5: ubah penerima', () => {
    it('ganti dari SEMUA ke TOKO berhasil', async () => {
      const id = Number(((await json(await buat({ judul: 'Ganti', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      const res = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'TUJUAN', cakupan: 'TOKO', toko_id: tokoB }, cookie: admin }));
      expect(res.status).toBe(200);
      const a = (await agendaDenganPenerima(id, getDb()))!;
      expect(a.agenda.cakupan).toBe('TOKO');
      expect(a.penerimaIds).toEqual([kry['citra']]);
    });

    it('agenda dibatalkan tidak bisa ganti penerima', async () => {
      const id = Number(((await json(await buat({ judul: 'Batal dulu', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'x' }, cookie: admin }));
      const res = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'TUJUAN', cakupan: 'TOKO', toko_id: tokoB }, cookie: admin }));
      expect(res.status).toBe(409);
    });

    it('agenda milik karyawan sendiri tidak bisa ganti penerima', async () => {
      const id = await denganTransaksi(async (tx) =>
        tx.execute({
          sql: "INSERT INTO agenda (judul, wajib_foto, cakupan, dibuat_oleh_karyawan, dibuat_at) VALUES ('Pribadi', 1, 'KARYAWAN', ?, ?)",
          args: [kry['andi'], serialisasiWIB()],
        }).then(async () => Number(((await tx.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id'])),
      );
      const res = await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'TUJUAN', cakupan: 'SEMUA' }, cookie: admin }));
      expect(res.status).toBe(409);
      expect((await json(res)).pesan).toContain('karyawan sendiri');
    });

    it('database menolak agenda_tujuan untuk agenda karyawan (trigger)', async () => {
      const id = await denganTransaksi(async (tx) => {
        await tx.execute({
          sql: "INSERT INTO agenda (judul, wajib_foto, cakupan, dibuat_oleh_karyawan, dibuat_at) VALUES ('Pribadi 2', 1, 'KARYAWAN', ?, ?)",
          args: [kry['budi'], serialisasiWIB()],
        });
        return Number(((await tx.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
      });
      await expect(
        getDb().execute({ sql: 'INSERT INTO agenda_tujuan (agenda_id, karyawan_id, dibuat_at) VALUES (?, ?, ?)', args: [id, kry['citra'], serialisasiWIB()] }),
      ).rejects.toThrow(/karyawan sendiri/);
    });
  });

  describe('audit log (BR-G19)', () => {
    it('membuat agenda tercatat', async () => {
      const id = Number(((await json(await buat({ judul: 'Diaudit', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      const rows = await getDb().execute({ sql: "SELECT aksi FROM audit_log WHERE entitas = 'agenda' AND entitas_id = ?", args: [id] });
      expect(rows.rows.length).toBeGreaterThan(0);
      expect(String((rows.rows[0] as Record<string, unknown>)['aksi'])).toBe('AGENDA_TAMBAH');
    });

    it('pembatalan tercatat dengan nilai sebelum/sesudah', async () => {
      const id = Number(((await json(await buat({ judul: 'Audit batal', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: 'Alasan tercatat' }, cookie: admin }));
      const rows = await getDb().execute({
        sql: "SELECT sebelum, sesudah, catatan FROM audit_log WHERE entitas = 'agenda' AND entitas_id = ? AND aksi = 'AGENDA_BATALKAN'",
        args: [id],
      });
      expect(rows.rows.length).toBe(1);
      const baris = rows.rows[0] as Record<string, unknown>;
      expect(String(baris['sebelum'])).toContain('AKTIF');
      // Alasan pembatalan tercatat di `sesudah` (nilai setelah), `catatan` cuma ringkasan.
      expect(String(baris['sesudah'])).toContain('DIBATALKAN');
      expect(String(baris['sesudah'])).toContain('Alasan tercatat');
      expect(String(baris['catatan'])).toContain('Audit batal');
    });

    it('ganti penerima tercatat', async () => {
      const id = Number(((await json(await buat({ judul: 'Audit tujuan', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'TUJUAN', cakupan: 'TOKO', toko_id: tokoB }, cookie: admin }));
      const rows = await getDb().execute({
        sql: "SELECT COUNT(*) AS n FROM audit_log WHERE entitas = 'agenda' AND entitas_id = ? AND aksi = 'AGENDA_GANTI_TUJUAN'",
        args: [id],
      });
      expect(Number((rows.rows[0] as Record<string, unknown>)['n'])).toBe(1);
    });

    it('gagalkan pembatalan TIDAK menulis audit (transaksi rollback)', async () => {
      const id = Number(((await json(await buat({ judul: 'Tanpa jejak', wajib_foto: true, cakupan: 'SEMUA' }))).data as { id: number }).id);
      await agendaPUT(req(`/api/admin/agenda/${id}`, { method: 'PUT', body: { aksi: 'BATALKAN', alasan: '' }, cookie: admin }));
      const rows = await getDb().execute({
        sql: "SELECT COUNT(*) AS n FROM audit_log WHERE entitas = 'agenda' AND entitas_id = ? AND aksi = 'AGENDA_BATALKAN'",
        args: [id],
      });
      expect(Number((rows.rows[0] as Record<string, unknown>)['n'])).toBe(0);
    });
  });

  describe('GET /api/admin/agenda', () => {
    it('memuat daftar + penerima', async () => {
      const res = await agendaGET(req('/api/admin/agenda', { cookie: admin }));
      expect(res.status).toBe(200);
      const data = (await json(res)).data as { agenda: { judul: string }; namaPenerima: string[] }[];
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]!.namaPenerima.length).toBeGreaterThan(0);
    });

    it('filter status bekerja', async () => {
      const semua = (await json(await agendaGET(req('/api/admin/agenda', { cookie: admin })))).data as { agenda: { status: string } }[];
      const adaAktif = semua.some((x) => x.agenda.status === 'AKTIF');
      expect(adaAktif).toBe(true);
      const batal = (await json(await agendaGET(req('/api/admin/agenda?status=DIBATALKAN', { cookie: admin })))).data as { agenda: { status: string } }[];
      expect(batal.every((x) => x.agenda.status === 'DIBATALKAN')).toBe(true);
    });

    it('filter status tak dikenal ditolak 400', async () => {
      const res = await agendaGET(req('/api/admin/agenda?status=NGGAWUR', { cookie: admin }));
      expect(res.status).toBe(400);
    });

    it('filter cakupan tak dikenal ditolak 400', async () => {
      const res = await agendaGET(req('/api/admin/agenda?cakupan=APASJA', { cookie: admin }));
      expect(res.status).toBe(400);
    });

    it('tanpa sesi 401', async () => {
      const res = await agendaGET(req('/api/admin/agenda'));
      expect(res.status).toBe(401);
    });
  });

  describe('penempatanTerbuka', () => {
    it('mengembalikan karyawan nonaktif dengan aktif=false (agar aturan diuji di fungsi murni)', async () => {
      const daftar = await penempatanTerbuka(getDb());
      const dina = daftar.find((p) => p.karyawan_id === kry['dina']);
      expect(dina).toBeDefined();
      expect(dina!.aktif).toBe(false);
    });
  });

  describe('GalatAgenda', () => {
    it('buatAgenda melempar GalatAgenda untuk judul kosong', async () => {
      await expect(
        denganTransaksi((tx) => buatAgenda({ judul: '', wajib_foto: true, cakupan: 'SEMUA', dibuatOleh: superId }, tx)),
      ).rejects.toBeInstanceOf(GalatAgenda);
    });
  });
});