/**
 * Aturan murni sheet kalender per karyawan (K-68 / BR-R9) — tanpa akses
 * database (rules/06 §4.2).
 *
 * Fungsi di sini TIDAK melempar: tanggal tidak valid atau rentang terbalik
 * menghasilkan grid kosong. Ini sengaja — `klasifikasiSel()` dipakai pratinjau
 * maupun penulisan file, jadi keduanya tidak boleh bisa berbeda jalur
 * (pola anti-B-19 yang sudah dipakai `klasifikasiSel` verifikasi).
 *
 * ARAH DATA: fungsi ini TIDAK menghitung "hadir" sendiri. Ia hanya
 * mengklasifikasi apa yang diterimanya. Definisi hari hadir tetap milik
 * `aturan/rekap.ts` (BR-H1) supaya tidak ada dua definisi hadir di repo.
 *
 * ARITMETIKA TANGGAL: sengaja memakai ulang `awalMinggu()` dan
 * `rentangTanggal()` dari `aturan/jadwal.ts` (pola `Date.UTC` + `getUTC*`).
 * Tidak ada `new Date(tanggal).getDay()` di mana pun — kelas bug B-13/B-18.
 */
import { awalMinggu, rentangTanggal, tanggalBerikutnya } from './jadwal';
import { tanggalValid } from './penempatan';
import type { JenisTidakBerangkat } from './ketidakhadiran';

/** Klasifikasi satu sel kalender. Satu nilai per sel, berurutan dari atas. */
export type JenisSel =
  | 'LUAR_RENTANG'
  | 'IZIN'
  | 'TANPA_KETERANGAN'
  | 'HADIR'
  | 'TERLAMBAT'
  | 'PARSIAL'
  | 'KOSONG';

/**
 * Satu pasangan check-in/check-out milik satu karyawan pada satu tanggal.
 * `checkout` hanya terisi bila check-out-nya berstatus aktif (`<> 'DITOLAK'`).
 */
export interface PasanganKalender {
  checkin: string;
  checkout: string | null;
  /** Angka FINAL admin (BR-L3). NULL berarti belum diisi — bukan berarti nol. */
  final_menit: number | null;
}

export interface KehadiranKalender {
  karyawan_id: number;
  /** YYYY-MM-DD — tanggal check-in, sama seperti kolom `tanggal` di `absensi`. */
  tanggal: string;
  pasangan: PasanganKalender[];
}

export interface PenandaanKalender {
  karyawan_id: number;
  tanggal: string;
  jenis: JenisTidakBerangkat;
}

export interface SelKalender {
  /** Selalu terisi, termasuk untuk sel di luar rentang filter. */
  tanggal: string;
  dalamRentang: boolean;
  jenis: JenisSel;
  /** Isi sel multi-baris, sudah termasuk tanggal sebagai baris pertama. */
  baris: string[];
}

export interface KalenderKaryawan {
  karyawan_id: number;
  karyawan_nama: string;
  /** Bisa lebih dari satu bila karyawan berpindah toko di tengah periode. */
  toko_nama: string[];
  /** Rentang filter, dipakai baris judul sheet. */
  dari: string;
  sampai: string;
  /** Baris = pekan; tiap pekan selalu 7 sel, Senin di indeks 0. */
  pekan: SelKalender[][];
}

/** Teks penandaan yang tampil di dalam sel. */
const TEKS_PENANDAAN: Record<JenisTidakBerangkat, string> = {
  IZIN: 'Izin',
  TANPA_KETERANGAN: 'Tanpa Keterangan',
};

/** `YYYY-MM-DD` -> `dd/mm`. Selalu dipakai sebagai baris pertama sel. */
export function formatTanggalSel(tanggal: string): string {
  const bagian = tanggal.split('-');
  if (bagian.length !== 3) return tanggal;
  return `${bagian[2]}/${bagian[1]}`;
}

export function teksPenandaan(jenis: JenisTidakBerangkat): string {
  return TEKS_PENANDAAN[jenis] ?? jenis;
}

/**
 * Klasifikasi satu sel. NON-MELEMPAR — tanggal tidak sah menghasilkan
 * `LUAR_RENTANG` supaya grid tetap bisa dirender tanpa try/catch di sheet.
 *
 * Aturan (BR-R9), berurutan dari atas:
 *   1. di luar rentang filter        -> LUAR_RENTANG (sel kosong)
 *   2. ada penandaan                 -> IZIN / TANPA_KETERANGAN
 *   3. ada pasangan lengkap          -> HADIR, atau TERLAMBAT bila final > 0
 *   4. ada check-in tanpa pasangan   -> PARSIAL (jam tetap tampil, sel putih)
 *   5. selain itu                    -> KOSONG
 *
 * Nomor 3 memakai `checkout !== null`, bukan `pasanganValid()` dari
 * `aturan/rekap.ts`: pemanggil sudah menyaring `DITOLAK`, jadi berpasangan di
 * sini berarti keduanya `DISETUJUI` (BR-V4). `final_menit` yang dipakai untuk
 * warna adalah angka FINAL (BR-L3), BUKAN selisih sistem M7.
 */
export function klasifikasiSel(input: {
  tanggal: string;
  dari: string;
  sampai: string;
  pasangan: PasanganKalender[];
  penandaan: JenisTidakBerangkat | null;
}): { jenis: JenisSel; baris: string[] } {
  const { tanggal, dari, sampai, pasangan, penandaan } = input;
  if (!tanggalValid(tanggal) || tanggal < dari || tanggal > sampai) {
    return { jenis: 'LUAR_RENTANG', baris: [] };
  }
  if (penandaan !== null) {
    return { jenis: penandaan, baris: [formatTanggalSel(tanggal), teksPenandaan(penandaan)] };
  }
  if (pasangan.length === 0) {
    return { jenis: 'KOSONG', baris: [formatTanggalSel(tanggal)] };
  }
  // Dua pasangan sehari (kuota K-27) tampil dua baris. Check-out yang tidak ada
  // ditulis sebagai jam check-in saja, tanpa tanda hubung.
  const jam = pasangan.map((p) => (p.checkout === null ? p.checkin : `${p.checkin}–${p.checkout}`));
  const adaPasanganLengkap = pasangan.some((p) => p.checkout !== null);
  const terlambat = pasangan.some((p) => (p.final_menit ?? 0) > 0);
  const jenis: JenisSel = adaPasanganLengkap ? (terlambat ? 'TERLAMBAT' : 'HADIR') : 'PARSIAL';
  return { jenis, baris: [formatTanggalSel(tanggal), ...jam] };
}

/** Enam hari setelah `tanggal`, dihitung dengan `tanggalBerikutnya` (K-45). */
function akhirPekan(tanggal: string): string {
  let t = tanggal;
  for (let i = 0; i < 6; i++) t = tanggalBerikutnya(t);
  return t;
}

export interface InputKalenderKaryawan {
  dari: string;
  sampai: string;
  karyawan_id: number;
  karyawan_nama: string;
  toko_nama: string[];
  kehadiran: KehadiranKalender[];
  penandaan: PenandaanKalender[];
}

/**
 * Grid mingguan satu karyawan: baris = pekan, kolom = Senin..Minggu.
 * Grid membentang dari Senin yang memuat `dari` sampai Minggu yang memuat
 * `sampai`, jadi tanggal di luar rentang otomatis punya sel (abu).
 */
export function susunKalenderKaryawan(input: InputKalenderKaryawan): KalenderKaryawan {
  const { dari, sampai, karyawan_id, karyawan_nama, toko_nama } = input;
  const kosong: KalenderKaryawan = {
    karyawan_id,
    karyawan_nama,
    toko_nama,
    dari,
    sampai,
    pekan: [],
  };
  if (!tanggalValid(dari) || !tanggalValid(sampai) || dari > sampai) return kosong;

  const kehadiran = new Map<string, PasanganKalender[]>();
  for (const k of input.kehadiran) {
    if (k.karyawan_id !== karyawan_id) continue;
    const daftar = kehadiran.get(k.tanggal) ?? [];
    daftar.push(...k.pasangan);
    kehadiran.set(k.tanggal, daftar);
  }
  const tanda = new Map<string, JenisTidakBerangkat>();
  for (const p of input.penandaan) {
    if (p.karyawan_id !== karyawan_id) continue;
    tanda.set(p.tanggal, p.jenis);
  }

  const semua = rentangTanggal(awalMinggu(dari), akhirPekan(awalMinggu(sampai)));
  const pekan: SelKalender[][] = [];
  for (let i = 0; i + 6 < semua.length; i += 7) {
    const baris: SelKalender[] = [];
    for (let kolom = 0; kolom < 7; kolom++) {
      const tanggal = semua[i + kolom]!;
      const { jenis, baris: isi } = klasifikasiSel({
        tanggal,
        dari,
        sampai,
        pasangan: kehadiran.get(tanggal) ?? [],
        penandaan: tanda.get(tanggal) ?? null,
      });
      baris.push({ tanggal, dalamRentang: tanggal >= dari && tanggal <= sampai, jenis, baris: isi });
    }
    pekan.push(baris);
  }
  return { ...kosong, pekan };
}