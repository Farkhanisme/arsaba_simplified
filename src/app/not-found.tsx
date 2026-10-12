import Link from 'next/link';
import { CompassIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 404 untuk SELURUH aplikasi (sebelumnya Next.js memakai halaman 404 bawaannya
 * yang berbahasa Inggris — melanggar K-24 "UI Bahasa Indonesia saja").
 *
 * Sengaja TIDAK menyebutkan admin, peran, atau apa pun tentang isi aplikasi.
 * URL seperti /admin/data-master/toko-yang-salah memanggil boundary yang SAMA
 * dengan /typo-saja, jadi penyerang tidak bisa memetakan bagian mana yang ada.
 * Jangan pernah menambahkan nama halaman atau menu ke sini.
 *
 * Satu-satunya tujuan yang ditampilkan adalah "/", yang memang ada untuk semua
 * orang (termasuk karyawan yang belum punya tautan absen).
 */
export default function HalamanTidakDitemukan() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <CompassIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight">404</p>
            <p className="text-base font-medium">Halaman tidak ditemukan.</p>
            <p className="text-sm text-muted-foreground">
              Alamat yang dibuka tidak tersedia. Periksa kembali tautannya.
            </p>
          </div>
          {/* Base-ui memakai prop `render`, bukan `asChild` shadcn klasik.
              Pola yang sama sudah dipakai di src/app/admin/tautan-menu.tsx. */}
          <Button variant="outline" render={<Link href="/">
            Kembali ke halaman awal
          </Link>} />
        </CardContent>
      </Card>
    </main>
  );
}