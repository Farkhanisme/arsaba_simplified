/**
 * Susun workbook Excel rekap (M8 + M14) dengan exceljs. TIGA sheet:
 * "Ringkasan", "Detail Harian", dan "Detail Agenda" (BR-G16).
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

export async function buatWorkbook(
  ringkasan: KartuRingkasan[],
  detail: BarisDetail[],
  detailAgenda: BarisDetailAgenda[] = [],
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

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
