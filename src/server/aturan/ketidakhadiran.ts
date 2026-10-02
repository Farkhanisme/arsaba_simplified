/**
 * Aturan murni ketidakhadiran — tanpa akses database (rules/06 §4.2).
 * BR-X3 memakai eventAktif() M3 (MENUNGGU/DISETUJUI aktif, DITOLAK bukan).
 * Rentang memakai rentangTanggal() aturan jadwal (reuse, bukan tulis ulang).
 */
import { eventAktif } from './absensi';
import { rentangTanggal } from './jadwal';

export type JenisTidakBerangkat = 'IZIN' | 'TANPA_KETERANGAN';

/**
 * BR-X3: true bila TIDAK ADA event aktif pada tanggal itu.
 * DITOLAK bukan event aktif -> penandaan tetap boleh (K-19).
 */
export function bolehTandai(statusEvent: string[]): boolean {
  return !statusEvent.some((s) => eventAktif(s));
}

/**
 * BR-X5: satu tanggal atau rentang. Mengembalikan daftar tanggal inklusif;
 * input tak valid -> daftar kosong (route menjawab 400).
 */
export function bentukRentang(dari: string, sampai?: string): string[] {
  return rentangTanggal(dari, sampai ?? dari);
}

export type StatusPenandaan = 'dibuat' | 'ditolak';

export interface KlasifikasiPenandaan {
  status: StatusPenandaan;
  /** Alasan penolakan (hanya bila ditolak); null bila lolos. */
  alasan: string | null;
  /** Status HTTP padanan (hanya bila ditolak); null bila lolos. */
  http: number | null;
}

export interface KeadaanPenandaan {
  adaPenandaan: boolean;
  statusEvent: string[];
  /** Toko penempatan pada tanggal itu; null bila tidak ditempatkan. */
  tokoId: number | null;
}

/**
 * Klasifikasi satu sel — TIDAK MELEMPAR untuk penolakan (pola B-19 opsi A).
 * Urutan: penandaan ganda (BR-X2, arahkan ke Ubah) dulu, lalu event aktif
 * (BR-X3), lalu penempatan. Cek K-32/ekspor FAIL-FAST di repo, bukan di sini.
 */
export function klasifikasiPenandaan(keadaan: KeadaanPenandaan): KlasifikasiPenandaan {
  if (keadaan.adaPenandaan) {
    return {
      status: 'ditolak',
      alasan: 'Penandaan untuk tanggal ini sudah ada. Ubah penandaan yang ada.',
      http: 409,
    };
  }
  if (!bolehTandai(keadaan.statusEvent)) {
    return {
      status: 'ditolak',
      alasan: 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.',
      http: 409,
    };
  }
  if (keadaan.tokoId === null) {
    return {
      status: 'ditolak',
      alasan: 'Karyawan tidak ditempatkan di toko mana pun pada tanggal ini.',
      http: 409,
    };
  }
  return { status: 'dibuat', alasan: null, http: null };
}
