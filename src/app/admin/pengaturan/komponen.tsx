'use client';

/**
 * Bagian presentasional halaman Pengaturan (rules/05 §5.9).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state hidup di `page.tsx`.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PanelPengaturan({
  ambang,
  onUbahAmbang,
  onSimpan,
}: {
  ambang: string;
  onUbahAmbang: (nilai: string) => void;
  onSimpan: (e: React.FormEvent) => void;
}) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Ambang keterlambatan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSimpan} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ambang">Ambang terlambat (menit)</Label>
            <Input
              id="ambang"
              type="number"
              min={0}
              step={1}
              value={ambang}
              onChange={(e) => onUbahAmbang(e.target.value)}
              required
              className="w-30"
            />
            <p className="text-sm text-muted-foreground">
              Check-in terlambat bila selisih menit melebihi ambang ini. Nilai bawaan: 5.
            </p>
          </div>
          <div>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function CatatanTelegram() {
  return (
    <p className="text-sm text-muted-foreground">
      Konfigurasi bot Telegram diatur lewat variabel lingkungan server dan tidak ditampilkan di
      halaman ini.
    </p>
  );
}
