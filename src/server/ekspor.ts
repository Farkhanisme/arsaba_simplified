/**
 * Susun workbook Excel rekap (M8) dengan exceljs. Tepat DUA sheet,
 * nama persis "Ringkasan" dan "Detail Harian". Waktu sudah WIB (string
 * dd/MM/yyyy dan HH:mm dari repo) — tulis apa adanya, tanpa konversi.
 * Tidak ada kolom foto/URL/token di sini.
 */
import ExcelJS from 'exceljs';
import type { KartuRingkasan } from './aturan/rekap';
import type { BarisDetail } from './repo/rekap';

const HEADER_RINGKASAN = ['Nama Karyawan', 'Toko', 'Hari Hadir', 'Hari Izin', 'Hari Tanpa Keterangan', 'Total Menit Terlambat Final'];

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
  'Catatan Koreksi',
];

/** Tepat 12 kolom sesuai BR-R5 — dijaga tes baca-balik. */
export function kolomDetail(): string[] {
  return [...HEADER_DETAIL];
}

export async function buatWorkbook(ringkasan: KartuRingkasan[], detail: BarisDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Arsaba Management Center';

  const ws1 = wb.addWorksheet('Ringkasan');
  ws1.addRow(HEADER_RINGKASAN);
  for (const r of ringkasan) {
    ws1.addRow([r.karyawan_nama, r.toko_nama, r.hari_hadir, r.hari_izin, r.hari_tanpa_keterangan, r.total_terlambat_final]);
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
      d.catatan_koreksi,
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
