process.loadEnvFile('.env.local');
/**
 * M15 — Keterangan absensi (K-66, BR-A13).
 *
 * Sifat paling penting dari fitur ini, dan yang diuji paling banyak di bawah:
 * keterangan itu INFORMASI SAJA. Tidak ada satu pun aturan lama yang boleh
 * berubah karena ada kolom ini — kuota, status, keterlambatan, pasangan,
 * idempotensi, dan blokir semuanya harus persis seperti absen tanpa
 * keterangan. Itu yang diuji di blok "TIDAK memengaruhi aturan".
 *
 * Bukti bahwa tes di sini benar-benar menguji sesuatu: lihat bagian AKHIR file
 * ini, blok `MUTASI` — tiap aturan dimatikan sementara lalu tes dijalankan lagi.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../src/server/db';
import { serialisasiWIB, tanggalWIB } from '../src/server/waktu';
import { pindahKaryawan } from '../src/server/repo/penempatan';
import { buatTokenLink, buatLink } from '../src/server/repo/link';
import { rapikanKeterangan, KETERANGAN_MAKS } from '../src/server/aturan/absensi';
import { daftarEvent } from '../src/server/repo/verifikasi';
import { barisDetail } from '../src/server/repo/rekap';
import { buatWorkbook, kolomDetail } from '../src/server/ekspor';
import { POST as absenRoute } from '../src/app/api/absen/route';
import { GET as infoRoute } from '../src/app/api/absen/info/route';
import { KartuVerifikasi, type Baris } from '../src/app/admin/verifikasi/komponen';
import { IsiModalFoto } from '../src/app/a/[token]/AbsenClient';
import { DaftarRiwayat } from '../src/app/a/[token]/page';

const DB_PATH = 'data/uji_m15_keterangan.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

/** Berapa kali stub fetch menyentuh endpoint sendPhoto Telegram. */
let kirimFoto = 0;

function stubTelegramSukses() {
  kirimFoto = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith('/sendPhoto')) {
        kirimFoto += 1;
        return new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 7, chat: { id: -1001 }, photo: [{ file_id: 'KECIL' }, { file_id: 'BESAR' }] },
          }),
          { status: 200 },
        );
      }
      return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
    }),
  );
}

function reqForm(url: string, form: FormData) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  return new NextRequest(`https://arsaba.vercel.app${url}`, { method: 'POST', headers, body: form });
}

function reqGet(url: string) {
  const headers = new Headers();
  headers.set('origin', APP_ORIGIN);
  return new NextRequest(`https://arsaba.vercel.app${url}`, { method: 'GET', headers });
}

function formAbsen(isi: { token: string; jenis?: string; request_id?: string; keterangan?: string }): FormData {
  const fd = new FormData();
  fd.set('token', isi.token);
  fd.set('jenis', isi.jenis ?? 'CHECKIN');
  fd.set('request_id', isi.request_id ?? randomUUID());
  fd.set('foto', new File([new Uint8Array(1000)], 'foto.jpg', { type: 'image/jpeg' }));
  if (isi.keterangan !== undefined) fd.set('keterangan', isi.keterangan);
  return fd;
}

async function jumlahEvent(): Promise<number> {
  const r = await getDb().execute({ sql: 'SELECT COUNT(*) AS c FROM absensi', args: [] });
  return Number((r.rows[0] as Record<string, unknown>)['c']);
}

async function keteranganEventTerakhir(): Promise<string | null> {
  const r = await getDb().execute({ sql: 'SELECT keterangan FROM absensi ORDER BY id DESC LIMIT 1', args: [] });
  const b = r.rows[0] as Record<string, unknown> | undefined;
  return b ? (b['keterangan'] as string | null) : null;
}

describe('M15 keterangan absensi — Aturan murni', () => {
  it('batas panjang 500, sama dengan keterangan agenda', () => {
    expect(KETERANGAN_MAKS).toBe(500);
  });

  it('rapikanKeterangan: trim, kosong/spasi jadi NULL, undefined jadi NULL', () => {
    expect(rapikanKeterangan('  Macet di jalan  ')).toBe('Macet di jalan');
    expect(rapikanKeterangan('Macet')).toBe('Macet');
    expect(rapikanKeterangan('   ')).toBeNull();
    expect(rapikanKeterangan('')).toBeNull();
    expect(rapikanKeterangan(undefined)).toBeNull();
  });

  it('rapikanKeterangan tidak boleh mengubah isi selain tepi', () => {
    // Spasi DI DALAM teks tidak boleh hilang — "di  jalan" tetap dua spasi.
    expect(rapikanKeterangan('macet di  jalan')).toBe('macet di  jalan');
  });
});

describe('M15 keterangan absensi — route /api/absen', () => {
  let tokoId = 0;
  let urut = 0;

  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    process.env['TELEGRAM_BOT_TOKEN'] = 'TEST-BOT-TOKEN-M15';
    process.env['TELEGRAM_CHAT_ID'] = '-1001';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
    const db = getDb();
    const sekarang = serialisasiWIB();
    await db.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: ['Toko M15', sekarang] });
    const t = await db.execute({ sql: 'SELECT id FROM toko ORDER BY id DESC LIMIT 1', args: [] });
    tokoId = Number((t.rows[0] as Record<string, unknown>)['id']);
  }, 120_000);

  beforeEach(() => {
    stubTelegramSukses();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  /**
   * Karyawan BARU untuk setiap tes. Ini bukan sekadar formalitas: kuota BR-A5b
   * menghitung check-in AKTIF per karyawan per tanggal, jadi satu karyawan
   * yang dipakai beberapa tes akan saling memblokir dan tes ikut bergantung
   * pada urutan jalan.
   */
  async function karyawanBaru(): Promise<string> {
    const db = getDb();
    const sekarang = serialisasiWIB();
    const nama = `Kry M15 ${++urut}`;
    await db.execute({ sql: 'INSERT INTO karyawan (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, sekarang] });
    const r = await db.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    const id = Number((r.rows[0] as Record<string, unknown>)['id']);
    await pindahKaryawan(id, tokoId, tanggalWIB(sekarang), db);
    const link = await buatLink(id, buatTokenLink(), 1, sekarang, db);
    return link.token;
  }

  it('BR-A13: keterangan <= 500 tersimpan apa adanya (201)', async () => {
    const token = await karyawanBaru();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'Macet di jalan, telat 20 menit.' })));
    expect(res.status).toBe(201);
    expect(await keteranganEventTerakhir()).toBe('Macet di jalan, telat 20 menit.');
  });

  it('BR-A13: tepat 500 karakter diterima', async () => {
    const token = await karyawanBaru();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'a'.repeat(KETERANGAN_MAKS) })));
    expect(res.status).toBe(201);
    expect((await keteranganEventTerakhir())?.length).toBe(KETERANGAN_MAKS);
  });

  it('BR-A13: 501 karakter DITOLAK 400, tanpa record baru dan tanpa unggah ke Telegram', async () => {
    const token = await karyawanBaru();
    const jumlahSebelum = await jumlahEvent();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'a'.repeat(KETERANGAN_MAKS + 1) })));
    expect(res.status).toBe(400);
    const badan = await res.json();
    expect(badan.kode).toBe('INPUT_TIDAK_VALID');
    expect(badan.pesan).toBe('Keterangan maksimal 500 karakter.');
    // Tidak ada record: keterangan yang tidak valid tidak boleh meninggalkan
    // baris setengah jadi di database.
    expect(await jumlahEvent()).toBe(jumlahSebelum);
    // Dan tidak boleh ada foto yang sudah terunggah ke Telegram lalu sia-sia.
    expect(kirimFoto).toBe(0);
  });

  it('BR-A13: keterangan hanya spasi -> NULL, bukan string kosong', async () => {
    const token = await karyawanBaru();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: '     ' })));
    expect(res.status).toBe(201);
    const nilai = await keteranganEventTerakhir();
    expect(nilai).toBeNull();
    expect(nilai, 'bukan string kosong').not.toBe('');
  });

  it('BR-A13: tepi spasi dibersihkan sebelum disimpan', async () => {
    const token = await karyawanBaru();
    await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: '  Hujan deras  ' })));
    expect(await keteranganEventTerakhir()).toBe('Hujan deras');
  });

  it('BR-A13: tanpa field keterangan tetap 201 dan NULL — fitur ini opsional', async () => {
    const token = await karyawanBaru();
    const res = await absenRoute(reqForm('/api/absen', formAbsen({ token })));
    expect(res.status).toBe(201);
    expect(await keteranganEventTerakhir()).toBeNull();
  });

  it('BR-A11: request_id yang sama tidak membuat record kedua dan tidak menimpa keterangan', async () => {
    const token = await karyawanBaru();
    const requestId = randomUUID();
    const pertama = await absenRoute(reqForm('/api/absen', formAbsen({ token, request_id: requestId, keterangan: 'Macet' })));
    expect(pertama.status).toBe(201);
    const jumlahSebelum = await jumlahEvent();
    // Pengulangan dengan keterangan BERBEDA: yang tersimpan tetap yang pertama.
    const kedua = await absenRoute(reqForm('/api/absen', formAbsen({ token, request_id: requestId, keterangan: 'Banjir' })));
    expect(kedua.status).toBe(200);
    expect(await jumlahEvent()).toBe(jumlahSebelum);
    expect(await keteranganEventTerakhir()).toBe('Macet');
  });

  describe('TIDAK memengaruhi aturan yang sudah ada', () => {
    it('BR-A5b: kuota 2 check-in aktif tetap berlaku meski tiap check-in ber-keterangan', async () => {
      const token = await karyawanBaru();
      const post = (jenis: string) => absenRoute(reqForm('/api/absen', formAbsen({ token, jenis, keterangan: 'Macet' })));
      // Dua pasang penuh: check-in -> check-out -> check-in -> check-out.
      // Check-in kedua harus didahului check-out; kalau tidak BR-A5a (check-in
      // masih terbuka) yang menolak lebih dulu dan kuota 2 orang tidak pernah
      // ikut tersentuh — tesnya jadi hijau tanpa pernah menguji kuota.
      expect((await post('CHECKIN')).status).toBe(201);
      expect((await post('CHECKOUT')).status).toBe(201);
      expect((await post('CHECKIN')).status).toBe(201);
      expect((await post('CHECKOUT')).status).toBe(201);
      // Yang ketiga tetap ditolak — keterangan bukan cara melewati kuota.
      const c = await post('CHECKIN');
      expect(c.status).toBe(409);
      expect((await c.json()).kode).toBe('CHECKIN_DITOLAK');
    });

    it('status tetap MENUNGGU dan keterlambatan_final_menit tetap NULL', async () => {
      const token = await karyawanBaru();
      await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'Macet parah' })));
      const r = await getDb().execute({
        sql: 'SELECT status, keterlambatan_final_menit, diverifikasi_oleh FROM absensi ORDER BY id DESC LIMIT 1',
        args: [],
      });
      const b = r.rows[0] as Record<string, unknown>;
      expect(b['status']).toBe('MENUNGGU');
      expect(b['keterlambatan_final_menit']).toBeNull();
      expect(b['diverifikasi_oleh']).toBeNull();
    });

    it('BR-A9: penandaan tidak berangkat tetap memblokir meskipun ada keterangan', async () => {
      const db = getDb();
      const token = await karyawanBaru();
      const id = await db.execute({ sql: 'SELECT karyawan_id FROM karyawan_link WHERE token = ?', args: [token] });
      const karyawanId = Number((id.rows[0] as Record<string, unknown>)['karyawan_id']);
      const hari = tanggalWIB(serialisasiWIB());
      await db.execute({
        sql: "INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, 'IZIN', 1, ?)",
        args: [karyawanId, tokoId, hari, serialisasiWIB()],
      });
      const res = await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'Macet, izin sudah diambil' })));
      expect(res.status).toBe(409);
      expect((await res.json()).kode).toBe('TANGGAL_BERTANDA');
    });
  });

  describe('tampil kembali ke karyawan di "Absen hari ini"', () => {
    it('info memuat keterangan yang tersimpan', async () => {
      const token = await karyawanBaru();
      await absenRoute(reqForm('/api/absen', formAbsen({ token, keterangan: 'Macet di Jalan Suitama' })));
      const res = await infoRoute(reqGet(`/api/absen/info?token=${encodeURIComponent(token)}`));
      expect(res.status).toBe(200);
      const badan = await res.json();
      const baris = (badan.data as { riwayat: { keterangan: string | null }[] }).riwayat;
      expect(baris.at(-1)?.keterangan).toBe('Macet di Jalan Suitama');
    });
  });
});

describe('M15 keterangan absensi — sisi admin', () => {
  it('daftarEvent mengembalikan keterangan apa adanya', async () => {
    const db = getDb();
    const daftar = await daftarEvent({}, db);
    const ada = daftar.find((b) => b.keterangan === 'Macet di jalan, telat 20 menit.');
    expect(ada, 'baris ber-keterangan ada di daftar verifikasi').toBeTruthy();
    expect(ada?.karyawan_nama).toBeTruthy();
  });

  it('daftarEvent juga mengembalikan NULL untuk yang tanpa keterangan', async () => {
    const daftar = await daftarEvent({}, getDb());
    expect(daftar.some((b) => b.keterangan === null)).toBe(true);
  });

  function barisUi(ubah: Partial<Baris> = {}): Baris {
    return {
      id: 1,
      karyawan_id: 1,
      karyawan_nama: 'Siti Rahma',
      toko_id: 1,
      toko_nama: 'Toko Melati',
      tanggal: '2026-10-14',
      jenis: 'CHECKIN',
      checkin_id: null,
      waktu: '2026-10-14T07:12:00+07:00',
      sumber: 'KARYAWAN',
      foto_file_id: 'abc',
      lat: -6.2,
      lng: 106.8,
      lokasi_status: 'TERSEDIA',
      status: 'MENUNGGU',
      alasan_tolak: null,
      keterangan: null,
      keterlambatan_final_menit: null,
      alasan_koreksi: null,
      keterlambatan: null,
      ...ubah,
    };
  }

  function htmlKartu(b: Baris): string {
    return renderToStaticMarkup(
      createElement(KartuVerifikasi, {
        b,
        terpilih: false,
        onPilih: () => {},
        onLihatFoto: () => {},
        nilaiFinal: '',
        onUbahFinal: () => {},
        onSetujui: () => {},
        onTolak: () => {},
        onKoreksi: () => {},
      }),
    );
  }

  it('kartu verifikasi menampilkan keterangan karyawan', () => {
    const html = htmlKartu(barisUi({ keterangan: 'Macet di jalan.' }));
    expect(html).toContain('Macet di jalan.');
    expect(html).toContain('Keterangan karyawan');
  });

  it('tanpa keterangan, tidak ada baris keterangan sama sekali', () => {
    const html = htmlKartu(barisUi());
    expect(html).not.toContain('Keterangan karyawan');
  });

  it('keterangan DITOLAK tampil berdampingan dengan alasan penolakan, tidak menggantikan', () => {
    const html = htmlKartu(barisUi({ keterangan: 'Macet.', status: 'DITOLAK', alasan_tolak: 'Foto tidak jelas.' }));
    expect(html).toContain('Keterangan karyawan: Macet.');
    expect(html).toContain('Ditolak: Foto tidak jelas.');
  });
});

describe('M15 keterangan absensi — Excel rekap (BR-R5)', () => {
  it('kolom detail tepat 13 dan bernama "Keterangan Karyawan"', () => {
    const kolom = kolomDetail();
    expect(kolom.length).toBe(13);
    expect(kolom).toContain('Keterangan Karyawan');
    // Letaknya tepat sebelum Catatan Koreksi, seperti di rules/02 BR-R5.
    expect(kolom.indexOf('Keterangan Karyawan')).toBe(kolom.indexOf('Catatan Koreksi') - 1);
  });

  it('isi keterangan benar-benar terbaca balik dari file .xlsx', async () => {
    const hari = tanggalWIB(serialisasiWIB());
    const baris = await barisDetail({ dari: hari, sampai: hari, tokoId: null }, getDb());
    const ada = baris.find((b) => b.keterangan);
    expect(ada, 'ada baris detail ber-keterangan di periode hari ini').toBeTruthy();

    const buf = await buatWorkbook([], baris);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as Buffer);
    const ws = wb.getWorksheet('Detail Harian')!;
    const header: unknown[] = [];
    ws.getRow(1).eachCell((c) => header.push(c.value));
    expect(header).toEqual(kolomDetail());

    const isi: unknown[][] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      // getCell itu 1-based: kolom ke-12 = "Keterangan Karyawan".
      isi.push([row.getCell(2).value, row.getCell(12).value]);
    });
    expect(isi.some((r) => r[1] === ada!.keterangan), 'keterangan masuk ke sel yang benar').toBe(true);
  });
});

describe('M15 keterangan absensi — halaman karyawan', () => {
  it('DaftarRiwayat menampilkan keterangan milik karyawan itu sendiri', () => {
    const html = renderToStaticMarkup(
      createElement(DaftarRiwayat, {
        riwayat: [
          { jenis: 'CHECKIN', waktu: '07:05', status: 'DISETUJUI', alasan_tolak: null, keterangan: 'Macet di jalan' },
        ],
      }),
    );
    expect(html).toContain('Keterangan: Macet di jalan');
  });

  it('DaftarRiwayat tanpa keterangan tidak menambah baris kosong', () => {
    const html = renderToStaticMarkup(
      createElement(DaftarRiwayat, {
        riwayat: [{ jenis: 'CHECKIN', waktu: '07:05', status: 'DISETUJUI', alasan_tolak: null, keterangan: null }],
      }),
    );
    expect(html).not.toContain('Keterangan:');
  });

  function htmlModal(ubah: Partial<{ keterangan: string; mengirim: boolean; aksi: string }> = {}): string {
    return renderToStaticMarkup(
      createElement(IsiModalFoto, {
        src: 'blob:x',
        aksi: 'CHECKOUT',
        mengirim: false,
        keterangan: '',
        onUbahKeterangan: () => {},
        onFotoUlang: () => {},
        onKirim: () => {},
        ...ubah,
      }),
    );
  }

  it('modal punya textarea keterangan berlabel dan berlimit 500', () => {
    const html = htmlModal();
    expect(html).toMatch(/<label[^>]*for="absen-keterangan"/);
    expect(html).toContain('Keterangan (opsional)');
    // React 19 menulis atribut ini apa adanya sebagai "maxLength", jadi pola
    // dibuat tahan huruf besar-kecil — bukan seperti "disabled:" yang muncul
    // di kelas dasar Button.
    expect(html).toMatch(/<textarea[^>]*maxlength="500"/i);
  });

  it('teks yang diketik muncul sebagai isi textarea (isi elemen, bukan atribut value)', () => {
    const html = htmlModal({ keterangan: 'Macet parah' });
    expect(html).toContain('Macet parah');
  });

  it('tombol kirim tetap aktif saat keterangan kosong — keterangan bukan syarat', () => {
    const html = htmlModal({ keterangan: '' });
    // Penanda benar Presence atribut disabled="", bukan kata "disabled" yang
    // juga muncul di kelas dasar Button shadcn.
    const tombolKirim = /<button[^>]*>[\s\S]*?<\/button>/g;
    const semua = html.match(tombolKirim) ?? [];
    const tombolKirimAbsen = semua.find((t) => t.includes('Check-out'));
    expect(tombolKirimAbsen, 'tombol absen check-out ada').toBeTruthy();
    expect(tombolKirimAbsen).not.toMatch(/disabled=""/);
  });

  it('modal punya batas tinggi + scroll supaya muat di HP kecil', () => {
    const isi = fs.readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(isi, 'DialogContent modal punya batas tinggi + scroll').toMatch(
      /<DialogContent\s+showCloseButton=\{false\}[\s\S]{0,300}?className="max-h-\[85dvh\] overflow-y-auto"/,
    );
    expect(isi, 'foto dibatasi max-h').toMatch(/max-h-\[45dvh\]/);
  });

  it('keterangan TIDAK ikut terhapus saat kirim gagal, tapi dibersihkan setelah sukses', () => {
    const isi = fs.readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    const awalBuangFoto = isi.indexOf('function buangFoto()');
    const akhirBuangFoto = isi.indexOf('async function ambilFoto()');
    const badanBuangFoto = isi.slice(awalBuangFoto, akhirBuangFoto);
    // buangFoto() = foto + request_id saja. Kalau setKeterangan ikut ada di
    // sini, keterangan ikut hilang setiap kirim gagal — persis yang diputuskan
    // pemilik TIDAK boleh terjadi.
    expect(badanBuangFoto).not.toContain('setKeterangan');
    expect(badanBuangFoto, 'foto tetap dibuang').toContain('setRequestId(null)');

    // Dan pembersihan HARUS ada di jalur sukses.
    expect(isi).toMatch(/toast\.success\([\s\S]{0,200}?setKeterangan\(''\)/);
  });
});
