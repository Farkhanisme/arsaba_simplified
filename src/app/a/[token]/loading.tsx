import { Skeleton } from '@/components/ui/skeleton';

/**
 * Keadaan "memuat" untuk halaman absen karyawan (rules/05 §1.4).
 *
 * Halaman ini memanggil `muatInfoAbsen` dan `muatInfoAgenda` ke Turso sebelum
 * merender. Di jaringan seluler itu bisa beberapa detik, dan tanpa ini karyawannya
 * hanya melihat layar putih.
 *
 * SENGAJA TIDAK memuat kerangka pratinjau kamera.
 *
 * `AbsenClient` meminta `getUserMedia` di `useEffect` saat mount
 * (AbsenClient.tsx:219). Menahan render sampai data selesai berarti permintaan
 * kamera tertunda — dan permintaan izin browser ikut tertunda, karena baru
 * muncul beberapa saat setelah halaman benar-benar tampil. Efeknya karyawan
 * menunggu lebih lama justru di langkah yang paling sering gagal di perangkat
 * lama.
 *
 * Kerangka kamera sendiri juga bisa menipu: kotak abu-abu terlihat seperti
 * kamera rusak, bukan "sedang memuat".
 *
 * Yang ditampilkan di sini hanya kerangka halaman yang sudah pasti: kartu
 * jadwal di atas, lalu ruang untuk tombol dan daftar riwayat.
 */
export default function MemuatAbsen() {
  return (
    <main
      className="mx-auto flex w-full max-w-[480px] flex-col gap-4 p-4"
      aria-label="Memuat halaman absen"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>

      <span className="sr-only">Memuat halaman absen…</span>
    </main>
  );
}