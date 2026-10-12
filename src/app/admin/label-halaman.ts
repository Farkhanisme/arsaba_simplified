import type { Peran } from '../../server/izin';
import { menuUntukPeran } from './menu';

/**
 * Label halaman untuk judul di header admin.
 *
 * Fungsi murni: tanpa akses server, tanpa React. Dipisah ke berkas sendiri
 * supaya bisa diuji langsung — bukan dengan menyalin logikanya ke file tes,
 * yang bisa menyimpang diam-diam lalu tes tetap hijau.
 *
 * Label diambil dari `menu.ts` yang SAMA dengan sidebar, jadi tidak mungkin
 * berbeda antara sidebar dan header.
 *
 * HANYA kecocokan persis. Dulu ada fallback "prefix terpanjang" supaya
 * `/admin/verifikasi/123` dapat label; setelah diperiksa, TIDAK ADA satu pun
 * route halaman turunan di src/app/admin — semua halaman ada tepat satu level.
 * (Yang `[id]` itu milik src/app/api, bukan halaman.) Fallback itu tidak pernah
 * dipakai, dan justru merusak: `/admin/akun` untuk admin biasa jatuh ke
 * `/admin` (Dashboard), sehingga header menampilkan "Dashboard" di halaman yang
 * ditolak server — membocorkan halaman Super Admin.
 */
export function labelHalaman(pathname: string, peran: Peran): string | null {
  const semua = menuUntukPeran(peran).flatMap((k) => k.item);
  return semua.find((i) => i.href === pathname)?.label ?? null;
}