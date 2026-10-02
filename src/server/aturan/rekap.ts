/**
 * Aturan murni rekap — tanpa akses database (rules/06 §4.2).
 * PERINGATAN ARAH (Jebakan 1): rekap memakai angka FINAL admin (BR-L3),
 * kebalikan dari dashboard M7 yang memakai sistem. Fungsi di sini HANYA
 * menjumlahkan kolom final; penentuan "terlambat" TIDAK ada di file ini.
 */
export interface PasanganAbsen {
  tanggal: string;
  checkinStatus: string;
  checkoutStatus: string | null;
}

/**
 * BR-V4 + BR-V5: pasangan sah hanya bila check-in DAN check-out
 * sama-sama DISETUJUI. Tanpa check-out, check-out DITOLAK/MENUNGGU,
 * atau check-in DITOLAK (check-out-nya berdiri sendiri) -> bukan pasangan.
 */
export function pasanganValid(checkinStatus: string, checkoutStatus: string | null): boolean {
  return checkinStatus === 'DISETUJUI' && checkoutStatus === 'DISETUJUI';
}

/**
 * BR-H1/H2: tanggal-tanggal unik yang punya >= 1 pasangan valid.
 * Dua pasangan valid di tanggal sama tetap 1 hari hadir.
 */
export function hitungHariHadir(pasangan: PasanganAbsen[]): Set<string> {
  const hadir = new Set<string>();
  for (const p of pasangan) {
    if (pasanganValid(p.checkinStatus, p.checkoutStatus)) hadir.add(p.tanggal);
  }
  return hadir;
}

export interface InputRingkasan {
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggalHadir: Set<string>;
  hariIzin: number;
  hariTanpaKeterangan: number;
  /** Jumlah angka final check-in (NULL sudah dijadikan 0 oleh pemanggil). */
  totalFinal: number;
}

export interface KartuRingkasan {
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  hari_hadir: number;
  hari_izin: number;
  hari_tanpa_keterangan: number;
  total_terlambat_final: number;
}

/** BR-R4: satu baris per karyawan per toko. WAJIB pakai angka FINAL. */
export function rekapKaryawan(input: InputRingkasan): KartuRingkasan {
  return {
    karyawan_id: input.karyawan_id,
    karyawan_nama: input.karyawan_nama,
    toko_id: input.toko_id,
    toko_nama: input.toko_nama,
    hari_hadir: input.tanggalHadir.size,
    hari_izin: input.hariIzin,
    hari_tanpa_keterangan: input.hariTanpaKeterangan,
    total_terlambat_final: input.totalFinal,
  };
}

/**
 * BR-R3: karyawan terjadwal TANPA absen (event apa pun) DAN TANPA penandaan.
 * Dihitung dari himpunan — hitungan saja tidak cukup (butuh irisan).
 */
export function hitungPeringatan(terjadwal: Set<number>, adaEvent: Set<number>, bertanda: Set<number>): number {
  let n = 0;
  for (const k of terjadwal) {
    if (!adaEvent.has(k) && !bertanda.has(k)) n++;
  }
  return n;
}
