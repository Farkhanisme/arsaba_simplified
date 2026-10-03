'use client';

/**
 * Bagian presentasional halaman Data Master — Karyawan (rules/05 §5.7).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import { Badge } from '@/components/ui/badge';
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

export interface Karyawan {
  id: number;
  nama: string;
  nik: string | null;
  jabatan: string | null;
  alamat: string | null;
  nomor_hp: string | null;
  kontak_darurat: string | null;
  aktif: number;
}

export interface Toko {
  id: number;
  nama: string;
  aktif: number;
}

export interface InfoLink {
  dibuat_at: string;
  url: string;
}

export interface FormulirKaryawan {
  nama: string;
  nik: string;
  jabatan: string;
  alamat: string;
  nomor_hp: string;
  kontak_darurat: string;
}

export const KOSONG: FormulirKaryawan = {
  nama: '',
  nik: '',
  jabatan: '',
  alamat: '',
  nomor_hp: '',
  kontak_darurat: '',
};

export function FormulirTambahKaryawan({
  form,
  onUbah,
  onTambah,
}: {
  form: FormulirKaryawan;
  onUbah: (sebagian: Partial<FormulirKaryawan>) => void;
  onTambah: (e: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Tambah karyawan</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onTambah}
          className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-nama">Nama</Label>
            <Input
              id="kry-nama"
              value={form.nama}
              onChange={(e) => onUbah({ nama: e.target.value })}
              required
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-nik">NIK</Label>
            <Input
              id="kry-nik"
              value={form.nik}
              onChange={(e) => onUbah({ nik: e.target.value })}
              maxLength={50}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-jabatan">Jabatan</Label>
            <Input
              id="kry-jabatan"
              value={form.jabatan}
              onChange={(e) => onUbah({ jabatan: e.target.value })}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-alamat">Alamat</Label>
            <Input
              id="kry-alamat"
              value={form.alamat}
              onChange={(e) => onUbah({ alamat: e.target.value })}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-hp">Nomor HP</Label>
            <Input
              id="kry-hp"
              value={form.nomor_hp}
              onChange={(e) => onUbah({ nomor_hp: e.target.value })}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kry-darurat">Kontak darurat</Label>
            <Input
              id="kry-darurat"
              value={form.kontak_darurat}
              onChange={(e) => onUbah({ kontak_darurat: e.target.value })}
              maxLength={500}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit">Tambah</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function FilterCariKaryawan({
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
        placeholder="Filter nama/NIK"
        className="max-w-xs"
      />
    </div>
  );
}

export function TabelKaryawan({
  daftar,
  tokoKaryawan,
  linkKaryawan,
  suntingId,
  sunting,
  onUbahSunting,
  onMulaiSunting,
  onBatalSunting,
  onSimpanSunting,
  onAlihAktif,
  onMintaPindah,
  onBuatLink,
  onSalin,
  onBuatUlangLink,
  onCabutLink,
}: {
  daftar: Karyawan[];
  tokoKaryawan: Record<number, string>;
  linkKaryawan: Record<number, InfoLink | null>;
  suntingId: number | null;
  sunting: FormulirKaryawan;
  onUbahSunting: (s: FormulirKaryawan) => void;
  onMulaiSunting: (k: Karyawan) => void;
  onBatalSunting: () => void;
  onSimpanSunting: (id: number) => void;
  onAlihAktif: (k: Karyawan) => void;
  onMintaPindah: (k: Karyawan) => void;
  onBuatLink: (id: number) => void;
  onSalin: (url: string) => void;
  onBuatUlangLink: (id: number) => void;
  onCabutLink: (id: number) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada karyawan.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>NIK</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>No. HP</TableHead>
              <TableHead>Toko saat ini</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((k) => {
              const link = linkKaryawan[k.id];
              return (
                <TableRow key={k.id}>
                  <TableCell>
                    {suntingId === k.id ? (
                      <Input
                        value={sunting.nama}
                        onChange={(e) => onUbahSunting({ ...sunting, nama: e.target.value })}
                        aria-label="Nama karyawan"
                        className="w-40"
                      />
                    ) : (
                      <span>
                        {k.nama} {k.aktif === 1 ? null : <em>(Nonaktif)</em>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{k.nik ?? '—'}</TableCell>
                  <TableCell>{k.jabatan ?? '—'}</TableCell>
                  <TableCell>{k.nomor_hp ?? '—'}</TableCell>
                  <TableCell>{tokoKaryawan[k.id] ?? '…'}</TableCell>
                  <TableCell className="max-w-55 overflow-hidden text-ellipsis">
                    {link ? (
                      <span title={link.url} className="text-xs">
                        {link.url}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Belum ada link</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {suntingId === k.id ? (
                        <>
                          <Button type="button" size="sm" onClick={() => onSimpanSunting(k.id)}>
                            Simpan
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={onBatalSunting}>
                            Batal
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => onMulaiSunting(k)}>
                          Ubah
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => onAlihAktif(k)}>
                        {k.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onMintaPindah(k)}>
                        Pindahkan
                      </Button>
                      {link ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => onSalin(link.url)}>
                            Salin
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => onBuatUlangLink(k.id)}>
                            Buat Ulang
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => onCabutLink(k.id)}>
                            Cabut
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => onBuatLink(k.id)}>
                          Buat Link
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function FormulirPindah({
  daftarToko,
  pindah,
  onUbah,
  onBatal,
  onKirim,
}: {
  daftarToko: Toko[];
  pindah: { id: number; toko: string; tanggal: string };
  onUbah: (p: { id: number; toko: string; tanggal: string }) => void;
  onBatal: () => void;
  onKirim: (e: React.FormEvent) => void;
}) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Pindahkan karyawan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onKirim} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pindah-toko">Toko tujuan</Label>
            <NativeSelect
              id="pindah-toko"
              value={pindah.toko}
              onChange={(e) => onUbah({ ...pindah, toko: e.target.value })}
              required
              className="w-48"
            >
              <NativeSelectOption value="">— Pilih —</NativeSelectOption>
              {daftarToko
                .filter((t) => t.aktif === 1)
                .map((t) => (
                  <NativeSelectOption key={t.id} value={String(t.id)}>
                    {t.nama}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pindah-tanggal">Tanggal efektif</Label>
            <Input
              id="pindah-tanggal"
              type="date"
              value={pindah.tanggal}
              onChange={(e) => onUbah({ ...pindah, tanggal: e.target.value })}
              required
              className="w-40"
            />
          </div>
          <Button type="submit">Pindah</Button>
          <Button type="button" variant="outline" onClick={onBatal}>
            Batal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function LabelStatusKaryawan({ aktif }: { aktif: number }) {
  if (aktif === 1) return <Badge>Aktif</Badge>;
  return <Badge variant="secondary">Nonaktif</Badge>;
}
