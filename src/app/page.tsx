import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Halaman akar publik.
 *
 * Ini hanya jadi pintu masuk: karyawan diarahkan ke tautan absen miliknya
 * (diberikan admin), admin diarahkan ke /login. Tidak ada fitur di sini.
 *
 * Sebelumnya 100% inline style dengan `fontFamily: 'system-ui'` — satu-satunya
 * inline style yang tersisa di src/app/ (BUG-UI-01). Sekarang memakai Card +
 * token shadcn, jadi ikut mode gelap dan konsisten dengan halaman lain.
 *
 * UKURAN FONT: halaman ini dibaca orang yang belum login, jadi teks isi memakai
 * `text-base` seperti halaman karyawan (rules/05 §2). Bukan property admin yang
 * boleh kecil-kecil.
 */
export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Arsaba Management Center</CardTitle>
          <CardDescription>Aplikasi internal untuk absensi karyawan Arsaba.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-base text-muted-foreground">
            Karyawan membuka tautan absen pribadi dari admin. Admin mengelola jadwal,
            verifikasi, dan rekap setelah masuk.
          </p>
          <Button className="w-full" render={<Link href="/login">
            Masuk sebagai admin
          </Link>} />
          <p className="text-sm text-muted-foreground">
            Belum punya tautan absen? Hubungi admin di toko Anda.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}