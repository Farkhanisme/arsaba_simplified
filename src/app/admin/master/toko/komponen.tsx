'use client';

/**
 * Bagian presentasional halaman Data Master — Toko (rules/05 §5.7).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Toko {
  id: number;
  nama: string;
  aktif: number;
  dibuat_at: string;
}

export function FormulirTambahToko({
  namaBaru,
  onUbahNama,
  onTambah,
}: {
  namaBaru: string;
  onUbahNama: (nilai: string) => void;
  onTambah: (e: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardContent>
        <form onSubmit={onTambah} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="nama-baru" className="sr-only">
              Nama toko baru
            </Label>
            <Input
              id="nama-baru"
              value={namaBaru}
              onChange={(e) => onUbahNama(e.target.value)}
              placeholder="Nama toko baru"
              required
              maxLength={100}
            />
          </div>
          <Button type="submit">Tambah</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function FilterCariToko({
  cari,
  onUbahCari,
}: {
  cari: string;
  onUbahCari: (nilai: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="cari">Cari:</Label>
      <Input
        id="cari"
        defaultValue={cari}
        onChange={(e) => onUbahCari(e.target.value)}
        placeholder="Filter nama toko"
        className="max-w-xs"
      />
    </div>
  );
}

export function LabelStatusToko({ aktif }: { aktif: number }) {
  if (aktif === 1) return <Badge>Aktif</Badge>;
  return <Badge variant="secondary">Nonaktif</Badge>;
}

export function TabelToko({
  daftar,
  suntingId,
  suntingNama,
  onUbahSuntingNama,
  onMulaiSunting,
  onBatalSunting,
  onSimpanSunting,
  onAlihAktif,
}: {
  daftar: Toko[];
  suntingId: number | null;
  suntingNama: string;
  onUbahSuntingNama: (nilai: string) => void;
  onMulaiSunting: (t: Toko) => void;
  onBatalSunting: () => void;
  onSimpanSunting: (id: number) => void;
  onAlihAktif: (t: Toko) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada toko.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  {suntingId === t.id ? (
                    <Input
                      value={suntingNama}
                      onChange={(e) => onUbahSuntingNama(e.target.value)}
                      maxLength={100}
                      aria-label="Nama toko"
                    />
                  ) : (
                    t.nama
                  )}
                </TableCell>
                <TableCell>
                  <LabelStatusToko aktif={t.aktif} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {suntingId === t.id ? (
                      <>
                        <Button type="button" size="sm" onClick={() => onSimpanSunting(t.id)}>
                          Simpan
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={onBatalSunting}>
                          Batal
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => onMulaiSunting(t)}>
                        Ubah
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => onAlihAktif(t)}>
                      {t.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
