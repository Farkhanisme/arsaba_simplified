'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogInIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Formulir login admin.
 *
 * WAJIB klien: kalau form ini pakai `action="/api/login" method="POST"` biasa,
 * browser akan MENDAILIH ke /api/login dan menampilkan JSON mentah di address
 * bar — meskipun sesi sebenarnya sudah berhasil. Form harus memanggil route lewat
 * fetch lalu mengarahkan ke /admin (BUG-UI-04).
 *
 * Pesan error ditampilkan apa adanya dari server. Untuk Origin yang salah,
 * route login sengaja membalas "Username atau password salah." supaya penyerang
 * tidak bisa membedakan kegagalan Origin dari kegagalan kredensial (BR-AUTH).
 */
export default function LoginPage() {
  const router = useRouter();
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function masuk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGalat(null);
    setMengirim(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const res = await fetch('/api/login', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => null)) as { kode?: string; pesan?: string } | null;
      if (!res.ok) {
        setGalat(data?.pesan ?? 'Gagal masuk. Coba lagi.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setGalat('Tidak ada koneksi ke server. Sambungkan lalu coba lagi.');
    } finally {
      setMengirim(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Masuk — Arsaba</CardTitle>
          <CardDescription>Management Center</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={masuk} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                required
                disabled={mengirim}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={mengirim}
              />
            </div>

            {galat ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={mengirim}>
              {mengirim ? 'Memeriksa…' : (<><LogInIcon />Masuk</>)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
