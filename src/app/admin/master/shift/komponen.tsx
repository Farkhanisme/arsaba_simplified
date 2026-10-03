'use client';

/**
 * Bagian presentasional halaman Data Master — Shift (rules/05 §5.7).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
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
}

export interface Shift {
  id: number;
  toko_id: number;
  nama: string;
  tipe_hari: 'SEMUA' | 'WEEKDAY' | 'WEEKEND';
  jam_mulai: string;
  jam_selesai: string;
  aktif: number;
}

export interface FormulirShift {
  nama: string;
  tipe_hari: string;
  jam_mulai: string;
  jam_selesai: string;
}

export const LABEL_TIPE: Record<Shift['tipe_hari'], string> = {
  SEMUA: 'Semua hari',
  WEEKDAY: 'Weekday (Senin–Jumat)',
  WEEKEND: 'Weekend (Sabtu–Minggu)',
};

export function FilterTokoShift({
  tokoId,
  daftarToko,
  onUbah,
}: {
  tokoId: string;
  daftarToko: Toko[];
  onUbah: (nilai: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="filter-toko">Toko:</Label>
      <NativeSelect id="filter-toko" value={tokoId} onChange={(e) => onUbah(e.target.value)} className="w-56">
        <NativeSelectOption value="">— Pilih toko —</NativeSelectOption>
        {daftarToko.map((t) => (
          <NativeSelectOption key={t.id} value={String(t.id)}>
            {t.nama}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function BantuanShift() {
  return (
    <p className="text-sm text-muted-foreground">
      Pilih “Semua hari” bila jam sama setiap hari; buat dua baris bernama sama (Weekday &amp;
      Weekend) bila berbeda.
    </p>
  );
}

export function FormulirTambahShift({
  form,
  onUbah,
  onTambah,
}: {
  form: FormulirShift;
  onUbah: (sebagian: Partial<FormulirShift>) => void;
  onTambah: (e: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Tambah shift</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onTambah} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nama">Nama</Label>
            <Input
              id="nama"
              value={form.nama}
              onChange={(e) => onUbah({ nama: e.target.value })}
              required
              maxLength={100}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipe">Tipe hari</Label>
            <NativeSelect
              id="tipe"
              value={form.tipe_hari}
              onChange={(e) => onUbah({ tipe_hari: e.target.value })}
              className="w-40"
            >
              <NativeSelectOption value="SEMUA">Semua hari</NativeSelectOption>
              <NativeSelectOption value="WEEKDAY">Weekday</NativeSelectOption>
              <NativeSelectOption value="WEEKEND">Weekend</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mulai">Jam mulai</Label>
            <Input
              id="mulai"
              type="time"
              value={form.jam_mulai}
              onChange={(e) => onUbah({ jam_mulai: e.target.value })}
              required
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="selesai">Jam selesai</Label>
            <Input
              id="selesai"
              type="time"
              value={form.jam_selesai}
              onChange={(e) => onUbah({ jam_selesai: e.target.value })}
              required
              className="w-32"
            />
          </div>
          <Button type="submit">Tambah</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function TabelShift({
  daftar,
  adaTokoDipilih,
  onMintaSunting,
}: {
  daftar: Shift[];
  adaTokoDipilih: boolean;
  onMintaSunting: (s: Shift) => void;
}) {
  if (daftar.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {adaTokoDipilih ? 'Belum ada shift di toko ini.' : 'Pilih toko untuk melihat shift.'}
      </p>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe hari</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.nama}</TableCell>
                <TableCell>{LABEL_TIPE[s.tipe_hari]}</TableCell>
                <TableCell>
                  {s.jam_mulai}–{s.jam_selesai} WIB
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="outline" onClick={() => onMintaSunting(s)}>
                    Ubah
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function FormulirSuntingShift({
  sunting,
  onUbah,
  onBatal,
  onSimpan,
}: {
  sunting: Shift;
  onUbah: (s: Shift) => void;
  onBatal: () => void;
  onSimpan: (e: React.FormEvent) => void;
}) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Ubah shift</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSimpan} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sunting-nama">Nama</Label>
            <Input
              id="sunting-nama"
              value={sunting.nama}
              onChange={(e) => onUbah({ ...sunting, nama: e.target.value })}
              required
              maxLength={100}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sunting-tipe">Tipe hari</Label>
            <NativeSelect
              id="sunting-tipe"
              value={sunting.tipe_hari}
              onChange={(e) => onUbah({ ...sunting, tipe_hari: e.target.value as Shift['tipe_hari'] })}
              className="w-40"
            >
              <NativeSelectOption value="SEMUA">Semua hari</NativeSelectOption>
              <NativeSelectOption value="WEEKDAY">Weekday</NativeSelectOption>
              <NativeSelectOption value="WEEKEND">Weekend</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sunting-mulai">Jam mulai</Label>
            <Input
              id="sunting-mulai"
              type="time"
              value={sunting.jam_mulai}
              onChange={(e) => onUbah({ ...sunting, jam_mulai: e.target.value })}
              required
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sunting-selesai">Jam selesai</Label>
            <Input
              id="sunting-selesai"
              type="time"
              value={sunting.jam_selesai}
              onChange={(e) => onUbah({ ...sunting, jam_selesai: e.target.value })}
              required
              className="w-32"
            />
          </div>
          <Button type="submit">Simpan</Button>
          <Button type="button" variant="outline" onClick={onBatal}>
            Batal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
