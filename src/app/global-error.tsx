'use client';

import './globals.css';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Boundary TERAKHIR: menangkap error di luar layout root, termasuk error saat
 * layout root sendiri gagal dirender. Next.js mewajibkan berkas ini merender
 * <html> dan <body>-nya sendiri, karena layout root yang biasanya menyediakan
 * itu ikut sudah gagal.
 *
 * globals.css DI-IMPORT DI SINI karena layout root — yang mengimpornya — ikut
 * sudah gagal. Tanpa import ini halaman tampil tanpa Tailwind sama sekali.
 *
 * Tidak ada reset() yang dipakai di sini: kalau layout root sudah rusak,
 * merender ulang subtree tidak akan menolong. Satu-satunya jalan adalah muat
 * ulang browser, jadi pesannya mengarah ke sana.
 */
export default function KesalahanFatal({
  onRetry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  onRetry?: () => void;
}) {
  const cobaLagi = onRetry ?? (() => window.location.reload());

  return (
    <html lang="id">
      <body className="bg-muted/40">
        <main className="flex min-h-svh items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="space-y-1">
                <p className="text-base font-medium">Aplikasi gagal berjalan.</p>
                <p className="text-sm text-muted-foreground">
                  Muat ulang halaman. Kalau tetap gagal, hubungi developer dengan kode di bawah.
                </p>
              </div>
              <button
                type="button"
                onClick={cobaLagi}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                Muat ulang
              </button>
            </CardContent>
          </Card>
        </main>
      </body>
    </html>
  );
}