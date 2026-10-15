"use client";

/**
 * Toaster untuk halaman admin (UI-7).
 *
 * Kenapa berkas terpisah: `src/app/admin/layout.tsx` adalah SERVER component
 * karena memanggil `cookies()`. Berkas ini tidak boleh diberi 'use client' —
 * lebih dulu, karena layout itu memanggil `cookies()`; kalau diberi directive itu,
 * build gagal. Jadi Toaster diletakkan di komponen client kecil ini lalu
 * diimpor dari layout.
 *
 * Posisi **bottom-right**, bukan top-center seperti halaman karyawan: admin
 * desktop-first, dan top-center akan menutupi tabel jadwal di tengah layar.
 *
 * Isi, ikon, dan warna diambil dari `components/ui/sonner` — komponen itu dipakai
 * halaman karyawan dan TIDAK diubah oleh UI-7, supaya kedua tempat tetap sama.
 */
import { Toaster } from '@/components/ui/sonner';

export default function ToasterAdmin() {
  // `containerAriaLabel` replacing label bawaan sonner ("Notifications alt+T").
  // Label itu dibaca pembaca layar, jadi kata Inggrisnya terlihat pengguna dan
  // melanggar K-24. Di sini hanya; `components/ui/sonner.tsx` tidak disentuh
  // karena halaman karyawan memakainya.
  return <Toaster position="bottom-right" containerAriaLabel="Notifikasi" />;
}