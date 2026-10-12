/**
 * Aturan murni agenda — tanpa akses database (rules/06 §4.2, rules/02 §18).
 *
 * Semua keputusan murni agenda di sini supaya bisa diuji tanpa DB. Yang TIDAK ada di sini
 * adalah apa pun yang butuh database: pemanggilan token, Telegram, atau query apa pun.
 *
 * Konsep paling penting file ini: **penerima agenda bukan data yang disimpan** (BR-G2,
 * K-58). Untuk cakupan TOKO dan SEMUA, penerima dihitung ulang dari penempatan saat ini.
 * Karena itu `penerimaAgenda()` adalah fungsi murni yang menerima daftar penempatan sebagai
 * argumen — persis seperti `pilihSlot()`/`hitungN()` yang tidak menyentuh DB.
 */

export type Cakupan = 'KARYAWAN' | 'TOKO' | 'SEMUA';
export type StatusAgenda = 'AKTIF' | 'DIBATALKAN';
export type StatusLaporan = 'DRAFT' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';

/** Batas panjang judul/keterangan. Diperiksa lagi di route lewat zod. */
export const JUDUL_MAKS = 120;
export const KETERANGAN_MAKS = 500;

/** Batas jumlah karyawan eksplisit untuk cakupan KARYAWAN (proteksi beban, bukan fitur). */
export const MAKS_TUJUAN_EKPLISIT = 100;

export const CAKUPAN: readonly Cakupan[] = ['KARYAWAN', 'TOKO', 'SEMUA'];

export interface karyawanUntukAgenda {
  id: number;
  nama: string;
  /** true bila karyawan punya penempatan terbuka (berlaku_sampai IS NULL) di `toko_id`. */
  aktif: boolean;
}

/** Satu karyawan aktif beserta toko penempatan terbukanya, atau null bila belum ditempatkan. */
export interface PenempatanTerbuka {
  karyawan_id: number;
  nama: string;
  /** Toko dari penempatan yang masih terbuka, atau null bila karyawan belum ditempatkan. */
  toko_id: number | null;
  /**
   * `aktif` sengaja dibawa ke sini dan TIDAK disaring di SQL: aturan "hanya karyawan
   * aktif yang jadi penerima" (BR-G2) adalah keputusan bisnis, jadi harus bisa diuji
   * sebagai fungsi murni. Kalau difilter di query, fungsi murni tidak akan pernah bisa
   * membuktikan aturan itu.
   */
  aktif: boolean;
}

export interface AgendaUntukResolusi {
  cakupan: Cakupan;
  /** Wajib ada bila cakupan = TOKO (dicek juga oleh CHECK database). */
  toko_id: number | null;
  /** Hanya dipakai bila cakupan = KARYAWAN. */
  tujuan_karyawan_id: number[];
}

/**
 * BR-G2: resolusi penerima dari penempatan **saat ini**.
 *
 * Sengaja TIDAK memakai snapshot:
 *  - `KARYAWAN` → daftar eksplisit, tidak terpengaruh perpindahan toko.
 *  - `TOKO`     → karyawan aktif yang penempatan terbukanya di toko agenda.
 *  - `SEMUA`    → seluruh karyawan aktif, termasuk yang belum ditempatkan.
 *
 * Karyawan nonaktif tidak pernah jadi penerima. Diurutkan `id` supaya hasilnya stabil dan
 * bisa dibandingkan dalam tes.
 */
export function penerimaAgenda(
  agenda: AgendaUntukResolusi,
  penempatan: PenempatanTerbuka[],
): number[] {
  if (agenda.cakupan === 'KARYAWAN') {
    return [...new Set(agenda.tujuan_karyawan_id)].sort((a, b) => a - b);
  }
  const aktif = penempatan.filter((p) => p.aktif);
  const hasil = aktif.filter((p) => (agenda.cakupan === 'SEMUA' ? true : p.toko_id === agenda.toko_id));
  return hasil.map((p) => p.karyawan_id).sort((a, b) => a - b);
}

export interface RingkasanPenerima {
  /** Jumlah penerima menurut BR-G2. */
  jumlah: number;
  /** Nama penerima, sudah diurutkan nama — untuk ditampilkan di UI. */
  nama: string[];
}

/**
 * Versi `penerimaAgenda()` yang langsung membawa nama, untuk UI daftar agenda.
 * Nama disortir dengan `localeCompare('id')` supaya urutan tampilnya seperti di sisi karyawan.
 */
export function ringkasanPenerima(
  agenda: AgendaUntukResolusi,
  penempatan: PenempatanTerbuka[],
): RingkasanPenerima {
  const ids = penerimaAgenda(agenda, penempatan);
  const peta = new Map(penempatan.map((p) => [p.karyawan_id, p.nama]));
  const namaKaryawan = (id: number): string => {
    const n = peta.get(id);
    if (n !== undefined) return n;
    // Cakupan KARYAWAN bisa menunjuk karyawan yang tidak ada di daftar penempatan
    // (mis. nonaktif, atau belum punya penempatan). Nama tidak ada -> pakai id supaya
    // baris tetap tampil, bukan hilang diam-diam.
    return `Karyawan #${id}`;
  };
  return { jumlah: ids.length, nama: ids.map(namaKaryawan).sort((a, b) => a.localeCompare(b, 'id')) };
}

export type StatusPembuatan = 'boleh' | 'ditolak';

export interface KlasifikasiPembuatan {
  status: StatusPembuatan;
  /** Alasan penolakan dalam Bahasa Indonesia; null bila boleh. */
  alasan: string | null;
}

/** Bentuk data agenda setelah normalisasi; dipakai repo untuk INSERT. */
export interface NilaiAgenda {
  [bidang: string]: unknown;
}

/**
 * Hasil validasi pembuatan agenda. Route cukup membaca `.status` dan `.alasan` —
 * tidak perlu tahu urutan pemeriksaan internalnya.
 */
export interface HasilValidasi extends KlasifikasiPembuatan {
  /** Data yang sudah dinormalisasi (trim, `null` untuk string kosong). */
  nilai: NilaiAgenda;
}

/**
 * Normalisasi input pembuatan agenda yang sudah lolos zod bentuk.
 *
 * `penyebab` diisi `null` kalau bentuk input salah (sudah ditangani zod) — pemanggil
 * memeriksa `.alasan` lebih dulu, jadi pemisahan ini tidak menggantungkan keputusan bisnis.
 */
export function normalisasiPembuatan(
  mentah: {
    judul: string;
    keterangan?: string;
    wajib_foto: boolean;
    cakupan: Cakupan;
    toko_id?: number;
    target_tanggal?: string;
    karyawan_ids?: number[];
  },
  pemeriksa: {
    tokoAda: (id: number) => boolean;
    karyawanAktif: (id: number) => boolean;
  },
): HasilValidasi {
  const judul = mentah.judul.trim();
  const keterangan = mentah.keterangan?.trim() ? mentah.keterangan.trim() : null;

  if (judul.length === 0) {
    return { status: 'ditolak', alasan: 'Judul agenda wajib diisi.', nilai: {} };
  }
  if (judul.length > JUDUL_MAKS) {
    return { status: 'ditolak', alasan: `Judul maksimal ${JUDUL_MAKS} karakter.`, nilai: {} };
  }
  if (keterangan !== null && keterangan.length > KETERANGAN_MAKS) {
    return { status: 'ditolak', alasan: `Keterangan maksimal ${KETERANGAN_MAKS} karakter.`, nilai: {} };
  }

  // Cakupan KARYAWAN: daftar eksplisit wajib ada, minimal satu.
  if (mentah.cakupan === 'KARYAWAN') {
    const ids = [...new Set(mentah.karyawan_ids ?? [])].sort((a, b) => a - b);
    if (ids.length === 0) {
      return { status: 'ditolak', alasan: 'Pilih minimal satu karyawan.', nilai: {} };
    }
    if (ids.length > MAKS_TUJUAN_EKPLISIT) {
      return {
        status: 'ditolak',
        alasan: `Maksimal ${MAKS_TUJUAN_EKPLISIT} karyawan sekaligus.`,
        nilai: {},
      };
    }
    const tidakAktif = ids.filter((id) => !pemeriksa.karyawanAktif(id));
    if (tidakAktif.length > 0) {
      return { status: 'ditolak', alasan: 'Ada karyawan yang tidak ditemukan atau nonaktif.', nilai: {} };
    }
    return {
      status: 'boleh',
      alasan: null,
      nilai: { judul, keterangan, wajib_foto: mentah.wajib_foto ? 1 : 0, cakupan: 'KARYAWAN', toko_id: null, target_tanggal: mentah.target_tanggal ?? null, karyawan_ids: ids },
    };
  }

  // Cakupan TOKO wajib punya toko yang ada. SEMUA tidak memakai toko sama sekali.
  if (mentah.cakupan === 'TOKO') {
    const tokoId = mentah.toko_id;
    if (tokoId === undefined) {
      return { status: 'ditolak', alasan: 'Pilih toko penerima agenda.', nilai: {} };
    }
    if (!pemeriksa.tokoAda(tokoId)) {
      return { status: 'ditolak', alasan: 'Toko tidak ditemukan atau nonaktif.', nilai: {} };
    }
    return {
      status: 'boleh',
      alasan: null,
      nilai: { judul, keterangan, wajib_foto: mentah.wajib_foto ? 1 : 0, cakupan: 'TOKO', toko_id: tokoId, target_tanggal: mentah.target_tanggal ?? null, karyawan_ids: [] },
    };
  }

  return {
    status: 'boleh',
    alasan: null,
    nilai: { judul, keterangan, wajib_foto: mentah.wajib_foto ? 1 : 0, cakupan: 'SEMUA', toko_id: null, target_tanggal: mentah.target_tanggal ?? null, karyawan_ids: [] },
  };
}

/**
 * K-62/BR-G4: pembatalan hanya mungkin selagi agenda masih `AKTIF`.
 * `DIBATALKAN` bersifat terminal — tidak ada jalan mengaktifkan kembali (tidak ada
 * keputusan pemilik yang memperbolehkannya, jadi tidak diimplementasikan).
 */
export function bolehBatalkan(status: string): KlasifikasiPembuatan {
  if (status !== 'AKTIF') {
    return { status: 'ditolak', alasan: 'Agenda ini sudah dibatalkan.' };
  }
  return { status: 'boleh', alasan: null };
}

/**
 * K-62/BR-G5: daftar tujuan hanya boleh diubah selagi `AKTIF` **dan** agenda dibuat admin.
 * Agenda buatan karyawan sendiri adalah milik dia; mengubah tujuannya berarti mengarang
 * penerima, jadi ditolak.
 */
export function bolehUbahTujuan(status: string, dibuatOlehKaryawan: number | null): KlasifikasiPembuatan {
  if (status !== 'AKTIF') {
    return { status: 'ditolak', alasan: 'Agenda ini sudah dibatalkan.' };
  }
  if (dibuatOlehKaryawan !== null) {
    return { status: 'ditolak', alasan: 'Agenda milik karyawan sendiri tidak bisa diubah penerima.' };
  }
  return { status: 'boleh', alasan: null };
}

/**
 * BR-G9: draft tidak pernah terlihat admin dan tidak memblokir apa pun.
 * Fungsi ini satu-satunya tempat yang memutuskan apa yang terlihat — jangan menyaring
 * `DRAFT` langsung di SQL: daftar admin harus memanggilnya, bukan jadi duanya sendiri.
 */
export function terlihatUntukAdmin(status: string): boolean {
  return status !== 'DRAFT';
}

/** Label Bahasa Indonesia untuk badge status agenda. */
export function labelStatusAgenda(status: string): string {
  return status === 'DIBATALKAN' ? 'Dibatalkan' : 'Aktif';
}

/** Label Bahasa Indonesia untuk badge status laporan agenda. */
export function labelStatusLaporan(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'MENUNGGU':
      return 'Menunggu';
    case 'DISETUJUI':
      return 'Disetujui';
    case 'DITOLAK':
      return 'Ditolak';
    default:
      return status;
  }
}