'use client';

import { useEffect } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Boundary error untuk seluruh halaman admin (rules/05 §1.4 "setiap layar punya
 * keadaan: memuat, kosong, error, sukses").
 *
 * Sebelumnya tidak ada boundary sama sekali: satu error saja membuat admin
 * melihat halaman error bawaan Next.js — berbahasa Inggris dan tanpa tombol
 * apa pun. Untuk Super Admin yang bukan programmer, itu jalan buntu: tidak ada
 * jalan keluar kecuali menekan F5 dan hoping.
 *
 * reset() dari props adalah jalan KELUAR yang benar. Jangan pakai
 * router.refresh() atau Location.reload(): reset() hanya merender ulang batas
 * subtree yang gagal, sehingga state router dan scroll posisi ikut terjaga.
 *
 * Isi error SENGAJA tidak ditampilkan ke layar. Detail error bisa memuat nama
 * kolom, potongan SQL, atau jalur berkas — dan ini halaman yang terbuka di
 * laptop bersama. Detail tetap masuk ke log server.
 *
 * `error.digest` ditampilkan karena satu-satunya yang berguna untuk melapor ke
 * devs, dan isinya hanya identifier opaque dari Next.js — bukan isi error.
 */
export default function KesalahanAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Tidak ada logger di klien. Ini sengaja: menulis error ke konsol browser
    // hanya berguna untuk devs yang sudah punya devtools terbuka, sedangkan
    // server sudah mencatatnya sendiri.
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="space-y-1">
            <p className="text-base font-medium">Halaman ini gagal dimuat.</p>
            <p className="text-sm text-muted-foreground">
              Data Anda tidak berubah. Coba muat ulang; kalau tetap gagal, hubungi developer
              dengan kode di bawah.
            </p>
          </div>
          <Button onClick={reset}>
            <RefreshCwIcon aria-hidden="true" />
            Coba lagi
          </Button>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Kode: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}