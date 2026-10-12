import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangleIcon } from 'lucide-react';

/**
 * Halaman untuk link absen yang tak dikenal atau sudah dicabut (BR-A1).
 *
 * Ini halaman yang dilihat karyawan BIASA, bukan admin: orangnya sedang
 * berdiri di depan toko, memegang HP, dan ingin absen. Karena itu pesannya
 * harus langsung jelas dan tidak perlu bernavigasi ke mana pun.
 *
 * SEJAK 2026-10-12 memakai Card + token shadcn. Sebelumnya 100% inline style
 * dengan warna literal — penyebabnya bug yang sama seperti BUG-UI-07: panel
 * tetap terang saat mode gelap aktif. Warna sekarang datang dari token CSS,
 * jadi gelap dan terang keduanya benar tanpa kode tambahan.
 *
 * Teks "Link tidak berlaku. Hubungi admin." TIDAK BOLEH diubah: dikunci tes
 * di tests/m3-absen.test.ts dan tests/m12-agenda-karyawan.test.ts.
 */
export default function LinkTidakBerlaku() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangleIcon className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-medium">Link tidak berlaku. Hubungi admin.</p>
          <p className="text-sm text-muted-foreground">
            Tautan ini sudah dicabut atau salah. Minta tautan baru kepada admin.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}