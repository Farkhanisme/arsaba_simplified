import type { Peran } from '../../server/izin';

export interface ItemMenu {
  label: string;
  href?: string;
  /** Menu milestone lain: tampil nonaktif dengan label "Segera". */
  segera?: boolean;
}

export interface KelompokMenu {
  judul: string;
  item: ItemMenu[];
}

/**
 * Susunan menu sidebar admin (rules/05 §4, prompt M2 §4a).
 * Fungsi murni agar bisa diuji: ADMIN tidak boleh menerima menu Super Admin.
 */
export function menuUntukPeran(peran: Peran): KelompokMenu[] {
  const kerja: KelompokMenu = {
    judul: 'Kerja Harian',
    item: [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Verifikasi Absensi', href: '/admin/verifikasi' },
      { label: 'Jadwal', href: '/admin/jadwal' },
      { label: 'Tandai Tidak Berangkat', href: '/admin/tidak-berangkat' },
      { label: 'Rekap & Ekspor', href: '/admin/rekap' },
    ],
  };

  const kelompok: KelompokMenu[] = [kerja];

  if (peran === 'SUPER_ADMIN') {
    kelompok.push({
      judul: 'Data Master',
      item: [
        { label: 'Toko', href: '/admin/master/toko' },
        { label: 'Shift', href: '/admin/master/shift' },
        { label: 'Karyawan', href: '/admin/master/karyawan' },
      ],
    });
    kelompok.push({
      judul: 'Sistem',
      item: [
        { label: 'Akun Admin', href: '/admin/akun' },
        { label: 'Pengaturan', href: '/admin/pengaturan' },
        { label: 'Audit Log', segera: true },
      ],
    });
  }

  kelompok.push({
    judul: 'Akun Saya',
    item: [
      { label: 'Ubah Password', href: '/admin/ubah-password' },
      { label: 'Keluar' },
    ],
  });

  return kelompok;
}
