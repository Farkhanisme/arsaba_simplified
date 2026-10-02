/**
 * Aturan murni alur absen karyawan — tanpa akses database (rules/06 §4.2).
 * Meliputi BR-A3 (lokasi), BR-A5/A6/A7 (kuota & pasangan), BR-A10/K-29 (20 jam),
 * dan BR-A12 (snapshot toko). Batas 20 jam dihitung lewat fungsi waktu
 * (geserJamISO), bukan aritmetika manual pada string.
 */
import { geserJamISO } from '../waktu';
import type { Executor } from '../audit';

/** BR-A7: event aktif = status apa pun kecuali DITOLAK. */
export function eventAktif(status: string): boolean {
  return status !== 'DITOLAK';
}

/** Batas check-out mandiri: 20 jam sejak waktu check-in (BR-A10, K-29). */
export const BATAS_CHECKOUT_JAM = 20;

/**
 * True bila check-in masih boleh di-check-out sendiri oleh karyawan.
 * Perbandingan string ISO sah karena semua waktu ber-offset +07:00 (rules/04 §5).
 * Patch C-1: check-in bertanggal masa depan ditolak (tidak dianggap terbuka).
 */
export function dalamBatas20Jam(waktuCheckInISO: string, sekarangISO: string): boolean {
  return (
    sekarangISO >= waktuCheckInISO &&   // check-in bertanggal masa depan ditolak
    waktuCheckInISO >= geserJamISO(sekarangISO, -BATAS_CHECKOUT_JAM)
  );
}

export interface HasilCek {
  boleh: boolean;
  alasan: string;
}

/**
 * BR-A5. Check-in diizinkan bila (a) tidak ada check-in terbuka yang masih
 * dalam batas 20 jam, dan (b) jumlah check-in aktif pada tanggal itu < 2.
 */
export function bolehCheckIn(keadaan: { terbukaDalamBatas: boolean; jumlahAktifHariIni: number }): HasilCek {
  if (keadaan.terbukaDalamBatas) {
    return { boleh: false, alasan: 'Masih ada check-in yang belum check-out.' };
  }
  if (keadaan.jumlahAktifHariIni >= 2) {
    return { boleh: false, alasan: 'Batas absen hari ini sudah tercapai.' };
  }
  return { boleh: true, alasan: '' };
}

/**
 * BR-A6 + BR-A10. `dalamBatas` = ada check-in terbuka dalam 20 jam;
 * `adaTerbuka` = ada check-in terbuka tanpa memandang batas (varian admin).
 */
export function bolehCheckOut(keadaan: { dalamBatas: boolean; adaTerbuka: boolean }): HasilCek {
  if (keadaan.dalamBatas) return { boleh: true, alasan: '' };
  if (keadaan.adaTerbuka) {
    return { boleh: false, alasan: 'Batas check-out sendiri sudah habis. Hubungi admin untuk perbaikan.' };
  }
  return { boleh: false, alasan: 'Data absen berubah. Halaman dimuat ulang.' };
}

export interface RentangPenempatan {
  toko_id: number;
  mulai: string; // YYYY-MM-DD inklusif
  sampai: string | null; // inklusif; null = masih berlaku
}

/**
 * BR-A12. Toko penempatan karyawan PADA TANGGAL absensi (snapshot).
 * Mengembalikan null bila tidak ada penempatan yang mencakup tanggal itu.
 * Bila lebih dari satu cocok (data korup), yang mulai paling akhir menang
 * agar hasilnya deterministik.
 */
export function tokoPadaTanggal(riwayat: RentangPenempatan[], tanggal: string): number | null {
  const cocok = riwayat.filter((r) => r.mulai <= tanggal && (r.sampai === null || r.sampai >= tanggal));
  if (cocok.length === 0) return null;
  cocok.sort((a, b) => (a.mulai < b.mulai ? 1 : a.mulai > b.mulai ? -1 : 0));
  return cocok[0]!.toko_id;
}

export type StatusLokasi = 'TERSEDIA' | 'DITOLAK' | 'GAGAL';

function koordinatValid(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * BR-A3. Koordinat valid -> TERSEDIA. Tanpa koordinat -> ikuti klaim klien
 * (DITOLAK bila menolak izin, GAGAL bila gagal didapat); bila klaim pun tidak
 * ada/tidak dikenal -> GAGAL. Hanya lat/lng yang dipakai, tanpa data lain.
 */
export function tentukanStatusLokasi(lat: unknown, lng: unknown, klaimKlien?: string): StatusLokasi {
  if (koordinatValid(lat, lng)) return 'TERSEDIA';
  if (klaimKlien === 'DITOLAK' || klaimKlien === 'GAGAL') return klaimKlien;
  return 'GAGAL';
}

export type PeranAdmin = 'ADMIN' | 'SUPER_ADMIN';

/**
 * BR-V6 + K-36 (+ K-32/BR-R8 untuk periode terekspor). Keputusan boleh diubah
 * DISETUJUI <-> DITOLAK selama periode BELUM diekspor (kedua peran); pada
 * periode terekspor HANYA Super Admin. Tercatat di audit oleh pemanggil.
 */
export function bolehUbahKeputusan(sudahDiekspor: boolean, peran: PeranAdmin): HasilCek {
  if (!sudahDiekspor) return { boleh: true, alasan: '' };
  if (peran === 'SUPER_ADMIN') return { boleh: true, alasan: '' };
  return { boleh: false, alasan: 'Periode ini sudah diekspor. Hanya Super Admin yang boleh mengubah.' };
}

/**
 * BR-K6 + K-32. Koreksi pada periode terekspor hanya Super Admin,
 * tercatat di audit oleh pemanggil.
 */
export function bolehKoreksi(sudahDiekspor: boolean, peran: PeranAdmin): HasilCek {
  if (!sudahDiekspor) return { boleh: true, alasan: '' };
  if (peran === 'SUPER_ADMIN') return { boleh: true, alasan: '' };
  return { boleh: false, alasan: 'Periode ini sudah diekspor. Hanya Super Admin yang boleh mengoreksi.' };
}

/**
 * True bila (tanggal, toko) sudah masuk log_ekspor. READ-ONLY; M8 belum
 * membangun UI/penulisan ekspor, tapi K-32/K-36 butuh pemeriksaan ini untuk
 * menegakkan BR-V6 dan BR-K6. toko_id NULL di log = semua toko.
 */
export async function sudahDiekspor(tanggal: string, tokoId: number, ex: Executor): Promise<boolean> {
  const res = await ex.execute({
    sql: 'SELECT 1 FROM log_ekspor WHERE tanggal_mulai <= ? AND tanggal_selesai >= ? AND (toko_id IS NULL OR toko_id = ?) LIMIT 1',
    args: [tanggal, tanggal, tokoId],
  });
  return res.rows.length > 0;
}
