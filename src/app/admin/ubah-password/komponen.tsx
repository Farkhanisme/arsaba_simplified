'use client';

/**
 * Bagian presentasional halaman Ubah Password (rules/05 §5.11).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PanelUbahPassword({
  mengirim,
  galat,
  sukses,
  onKirim,
}: {
  mengirim: boolean;
  galat: string | null;
  sukses: boolean;
  onKirim: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Ubah Password</CardTitle>
        <p className="text-sm text-muted-foreground">
          Setelah diganti, seluruh sesi akun ini berakhir dan Anda harus masuk kembali.
        </p>
      </CardHeader>
      <CardContent>
        {sukses ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-300">
            Password berhasil diubah. Silakan masuk kembali.
          </p>
        ) : (
          <form onSubmit={onKirim} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordSaatIni">Password saat ini</Label>
              <Input
                id="passwordSaatIni"
                name="passwordSaatIni"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordBaru">Password baru</Label>
              <Input
                id="passwordBaru"
                name="passwordBaru"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="konfirmasi">Konfirmasi password baru</Label>
              <Input
                id="konfirmasi"
                name="konfirmasi"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {galat ? (
              <Alert variant="destructive">
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={mengirim}>
              {mengirim ? 'Mengirim…' : 'Simpan'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
