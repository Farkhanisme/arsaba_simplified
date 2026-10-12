import { Skeleton } from '@/components/ui/skeleton';

/**
 * Keadaan "memuat" untuk transisi rute di seluruh /admin (rules/05 §1.4:
 * "setiap layar punya keadaan: memuat, kosong, error, sukses").
 *
 * Tanpa berkas ini, menekan menu lain di sidebar mengganti seluruh isi layar
 * jadi kosong tanpa penjelasan sampai server selesai merender — di jaringan
 * seluler atau Turso yang lambat, itu beberapa detik layar hampa.
 *
 * BUKAN skeleton untuk fetch. Halaman-halaman admin sudah punya skeleton
 * sendiri setelah data tiba (PanelMemuat per halaman). Ini untuk SELANG
 * ANTAR RUTE, yang sebelumnya sama sekali tidak punya apa pun.
 *
 * Sengaja tidak memuat judul halaman: judul ada di tiap page.tsx, dan
 * mengulangnya di sini berarti dua sumber kebenaran yang bisa berbeda.
 */
export default function MemuatAdmin() {
  return (
    <div className="flex flex-col gap-4" aria-label="Memuat halaman" role="status" aria-live="polite">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}