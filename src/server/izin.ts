export type Peran = 'ADMIN' | 'SUPER_ADMIN';

export const IZIN_MATRIX: Record<string, Peran[]> = {
  dashboard: ['ADMIN', 'SUPER_ADMIN'],
  verifikasi: ['ADMIN', 'SUPER_ADMIN'],
  jadwal: ['ADMIN', 'SUPER_ADMIN'],
  tidak_berangkat: ['ADMIN', 'SUPER_ADMIN'],
  koreksi: ['ADMIN', 'SUPER_ADMIN'],
  rekap: ['ADMIN', 'SUPER_ADMIN'],
  ekspor: ['ADMIN', 'SUPER_ADMIN'],
  master_toko: ['SUPER_ADMIN'],
  master_shift: ['SUPER_ADMIN'],
  master_karyawan: ['SUPER_ADMIN'],
  master_penempatan: ['SUPER_ADMIN'],
  master_akun: ['SUPER_ADMIN'],
  link_karyawan: ['SUPER_ADMIN'],
  pengaturan: ['SUPER_ADMIN'],
  audit_log: ['SUPER_ADMIN'],
  ubah_data_terekspor: ['SUPER_ADMIN'],
};

export function izinDiperlukan(fitur: string, peranPengguna: Peran): boolean {
  const izin = IZIN_MATRIX[fitur];
  if (!izin) return false;
  return izin.includes(peranPengguna);
}
