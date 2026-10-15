/**
 * Susun workbook Excel rekap (M8 + M14 + M16) dengan exceljs. TIGA sheet tetap:
 * "Ringkasan", "Detail Harian", dan "Detail Agenda" (BR-G16), ditambah SATU
 * sheet kalender per karyawan (K-68/BR-R9).
 * Waktu sudah WIB (string dd/MM/yyyy dan HH:mm dari repo) — tulis apa adanya,
 * tanpa konversi.
 *
 * TIDAK ada kolom foto/URL Telegram: URL unduhan Telegram mengandung token bot
 * dan tidak boleh sampai ke klien (rules/03 §7). Detail Agenda karena itu hanya
 * teks: judul, status, alasan, dan siapa yang memverifikasi.
 */
import ExcelJS from 'exceljs';
import type { KartuRingkasan } from './aturan/rekap';
import type { BarisDetail } from './repo/rekap';
import type { BarisDetailAgenda } from './repo/agenda-laporan';
import type { KalenderKaryawan, SelKalender } from './aturan/kalender';
import type { Workbook } from 'exceljs';
import { urutanHariSenin } from './aturan/jadwal';

const HEADER_RINGKASAN = [
  'Nama Karyawan',
  'Toko',
  'Hari Hadir',
  'Hari Izin',
  'Hari Tanpa Keterangan',
  'Total Menit Terlambat Final',
  'Agenda Selesai',
  'Agenda Ditolak',
];

const HEADER_DETAIL = [
  'Tanggal',
  'Karyawan',
  'Toko',
  'Slot Jadwal Acuan',
  'Waktu Check-in',
  'Waktu Check-out',
  'Status Check-in',
  'Status Check-out',
  'Selisih Sistem (menit)',
  'Keterlambatan Final (menit)',
  'Penandaan',
  'Keterangan Karyawan',
  'Catatan Koreksi',
];

const HEADER_DETAIL_AGENDA = [
  'Tanggal Submit',
  'Karyawan',
  'Toko',
  'Judul Agenda',
  'Foto',
  'Percobaan Ke',
  'Status',
  'Keterangan',
  'Alasan Tolak',
  'Diverifikasi Oleh',
];

/** Tepat 13 kolom sesuai BR-R5 (12 + BR-A13) — dijaga tes baca-balik. */
export function kolomDetail(): string[] {
  return [...HEADER_DETAIL];
}

/** Tepat 10 kolom sesuai BR-G16 — dijaga tes baca-balik. */
export function kolomDetailAgenda(): string[] {
  return [...HEADER_DETAIL_AGENDA];
}

// ---------------------------------------------------------------------------
// K-68 / BR-R9 — sheet kalender per karyawan
// ---------------------------------------------------------------------------

/**
 * Warna sel sesuai klasifikasi `SelKalender`. Dijaga tes baca-balik dari file
 * .xlsx, jadi nilai ARGB di sini TIDAK boleh diubah diam-diam.
 * `PUTIH` dipakai untuk KOSONG dan PARSIAL — keduanya sengaja tidak diberi
 * warna supaya tidak terbaca sebagai hadir.
 */
export const WARNA_SEL: Record<SelKalender['jenis'], string> = {
  HADIR: 'FFE2EFDA',
  TERLAMBAT: 'FFFCE4D6',
  IZIN: 'FFDDEBF7',
  TANPA_KETERANGAN: 'FFFFC7CE',
  LUAR_RENTANG: 'FFF2F2F2',
  PARSIAL: 'FFFFFFFF',
  KOSONG: 'FFFFFFFF',
};

/** Legenda yang dicetak di baris 3 tiap sheet kalender. */
const LEGENDA: { jenis: SelKalender['jenis']; label: string }[] = [
  { jenis: 'HADIR', label: 'Hadir' },
  { jenis: 'TERLAMBAT', label: 'Terlambat' },
  { jenis: 'IZIN', label: 'Izin' },
  { jenis: 'TANPA_KETERANGAN', label: 'Tanpa Keterangan' },
  { jenis: 'LUAR_RENTANG', label: 'Di luar periode' },
];

/** Batas nama sheet Excel: 31 karakter dan tanpa `[]:*?/\`. */
const MAKS_NAMA_SHEET = 31;

/**
 * Nama sheet dari nama karyawan: karakter terlarang dihapus, dipotong 31
 * karakter, dan nama kembar diberi akhiran ` (2)`, ` (3)`, ... supaya dua
 * karyawan dengan nama sama tidak menimpa satu sama lain.
 */
export function namaSheetKalender(nama: string, dipakai: Set<string>): string {
  const bersih = nama
    .replace(/[[\]*?:/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAKS_NAMA_SHEET)
    .trim();
  const dasar = bersih === '' ? 'Karyawan' : bersih;
  let kandidat = dasar;
  let nomor = 2;
  while (dipakai.has(kandidat)) {
    const akhiran = ` (${nomor})`;
    kandidat = `${dasar.slice(0, MAKS_NAMA_SHEET - akhiran.length)}${akhiran}`;
    nomor++;
  }
  dipakai.add(kandidat);
  return kandidat;
}

/** `YYYY-MM-DD` -> `dd/MM/yyyy`, untuk baris judul periode. */
function tanggalPenuh(tanggal: string): string {
  const [y, m, d] = tanggal.split('-');
  return `${d}/${m}/${y}`;
}

const GARI_SISIP = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
const LEBAR_KOLOM = 18;
const BARIS_MULAI_GRID = 5;

/** Tulis satu sheet kalender untuk satu karyawan. */
function tulisSheetKalender(wb: Workbook, kal: KalenderKaryawan, dipakai: Set<string>): void {
  const ws = wb.addWorksheet(namaSheetKalender(kal.karyawan_nama, dipakai));

  const judul = ws.getRow(1);
  judul.getCell(1).value = kal.karyawan_nama;
  judul.getCell(1).style = { font: { bold: true, size: 13 } };
  judul.height = 22;

  const sub = ws.getRow(2);
  sub.getCell(1).value = `Periode ${tanggalPenuh(kal.dari)} – ${tanggalPenuh(kal.sampai)} · Toko ${kal.toko_nama.join(', ')}`;
  sub.height = 16;

  const leg = ws.getRow(3);
  LEGENDA.forEach((item, i) => {
    const c = leg.getCell(i + 1);
    c.value = item.label;
    c.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA_SEL[item.jenis] } }, border: GARI_SISIP };
  });
  leg.height = 16;

  const hari = ws.getRow(BARIS_MULAI_GRID - 1);
  urutanHariSenin().forEach((nama, i) => {
    const c = hari.getCell(i + 1);
    c.value = nama;
    c.style = { font: { bold: true }, border: GARI_SISIP };
  });
  hari.height = 18;

  kal.pekan.forEach((pekan, baris) => {
    const nomor = BARIS_MULAI_GRID + baris;
    const row = ws.getRow(nomor);
    let barisTerpanjang = 1;
    pekan.forEach((sel, kolom) => {
      const c = row.getCell(kolom + 1);
      c.value = sel.baris.length === 0 ? null : sel.baris.join('\n');
      c.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA_SEL[sel.jenis] } },
        alignment: { wrapText: true, vertical: 'top' },
        border: GARI_SISIP,
      };
      if (sel.baris.length > barisTerpanjang) barisTerpanjang = sel.baris.length;
    });
    row.height = barisTerpanjang * 14 + 6;
  });

  for (let kolom = 1; kolom <= 7; kolom++) ws.getColumn(kolom).width = LEBAR_KOLOM;
}

export async function buatWorkbook(
  ringkasan: KartuRingkasan[],
  detail: BarisDetail[],
  detailAgenda: BarisDetailAgenda[] = [],
  kalender: KalenderKaryawan[] = [],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Arsaba Management Center';

  const ws1 = wb.addWorksheet('Ringkasan');
  ws1.addRow(HEADER_RINGKASAN);
  for (const r of ringkasan) {
    ws1.addRow([
      r.karyawan_nama,
      r.toko_nama,
      r.hari_hadir,
      r.hari_izin,
      r.hari_tanpa_keterangan,
      r.total_terlambat_final,
      r.agenda_selesai,
      r.agenda_ditolak,
    ]);
  }

  const ws2 = wb.addWorksheet('Detail Harian');
  ws2.addRow(HEADER_DETAIL);
  for (const d of detail) {
    ws2.addRow([
      d.tanggal,
      d.karyawan_nama,
      d.toko_nama,
      d.slot,
      d.waktu_checkin,
      d.waktu_checkout,
      d.status_checkin,
      d.status_checkout,
      d.selisih_sistem,
      d.final_menit,
      d.penandaan,
      d.keterangan,
      d.catatan_koreksi,
    ]);
  }

  // Sheet ketiga (BR-G16). Selalu dibuat walau kosong, supaya pembaca yang
  // mengecek "ada sheet Detail Agenda" tidak perlu menangani kasus kosong.
  const ws3 = wb.addWorksheet('Detail Agenda');
  ws3.addRow(HEADER_DETAIL_AGENDA);
  for (const a of detailAgenda) {
    ws3.addRow([
      a.tanggal,
      a.karyawan_nama,
      a.toko_nama ?? '—',
      a.judul_agenda,
      a.wajib_foto,
      a.percobaan,
      a.status,
      a.keterangan,
      a.alasan_tolak,
      a.diverifikasi_nama,
    ]);
  }

  // K-68/BR-R9: satu sheet kalender per karyawan, setelah tiga sheet tetap.
  // Nama sheet dijaga unik lewat Set yang sama, karena dua karyawan bisa
  // bernama sama dan Excel tidak menerima nama sheet kembar. Nama tiga sheet
  // tetap ditulis sebagai literal, bukan dibaca dari worksheet — `name` tidak
  // ada di deklarasi minimal exceljs repo ini.
  const dipakai = new Set<string>(['Ringkasan', 'Detail Harian', 'Detail Agenda']);
  for (const kal of kalender) tulisSheetKalender(wb, kal, dipakai);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
