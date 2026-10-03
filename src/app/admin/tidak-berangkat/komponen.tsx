'use client';

/**
 * Bagian presentasional halaman Tandai Tidak Berangkat (rules/05 §5.5).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Penandaan {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggal: string;
  jenis: 'IZIN' | 'TANPA_KETERANGAN';
  catatan: string | null;
}

export interface HasilTandai {
  dibuat: { karyawan_id: number; tanggal: string }[];
  ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
}

export interface FormulirTandai {
  karyawan: number[];
  dari: string;
  sampai: string;
  jenis: string;
  catatan: string;
}

export const PESAN_X3 = 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.';

export function tanggalPendek(t: string): string {
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

export function LabelJenis({ jenis }: { jenis: Penandaan['jenis'] }) {
  if (jenis === 'IZIN') return <Badge>Izin</Badge>;
  return <Badge variant="destructive">Tanpa Keterangan</Badge>;
}

export function PanelHasilTandai({ hasil }: { hasil: HasilTandai }) {
  return (
    <Alert>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {hasil.dibuat.length} tersimpan, {hasil.ditolak.length} ditolak.
        </span>
        {hasil.ditolak.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {hasil.ditolak.map((d, i) => (
              <li key={i}>
                Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}: {d.alasan}{' '}
                {d.alasan === PESAN_X3 ? <Link href="/admin/verifikasi" className="underline underline-offset-4">Buka Verifikasi</Link> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function FormulirTandai({
  pilihanKaryawan,
  form,
  onUbah,
  onKirim,
}: {
  pilihanKaryawan: { id: number; nama: string }[];
  form: FormulirTandai;
  onUbah: (f: FormulirTandai) => void;
  onKirim: (e: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Tandai tidak berangkat</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onKirim} className="flex flex-col gap-3">
          <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto">
            {pilihanKaryawan.map((k) => (
              <label key={k.id} htmlFor={`tandai-${k.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  id={`tandai-${k.id}`}
                  checked={form.karyawan.includes(k.id)}
                  onCheckedChange={(c) =>
                    onUbah({
                      ...form,
                      karyawan: c ? [...form.karyawan, k.id] : form.karyawan.filter((x) => x !== k.id),
                    })
                  }
                />
                {k.nama}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tandai-dari">Tanggal</Label>
              <Input
                id="tandai-dari"
                type="date"
                value={form.dari}
                onChange={(e) => onUbah({ ...form, dari: e.target.value })}
                required
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tandai-sampai">Sampai (opsional)</Label>
              <Input
                id="tandai-sampai"
                type="date"
                value={form.sampai}
                onChange={(e) => onUbah({ ...form, sampai: e.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tandai-jenis">Jenis</Label>
              <NativeSelect
                id="tandai-jenis"
                value={form.jenis}
                onChange={(e) => onUbah({ ...form, jenis: e.target.value })}
                className="w-44"
              >
                <NativeSelectOption value="IZIN">Izin</NativeSelectOption>
                <NativeSelectOption value="TANPA_KETERANGAN">Tanpa Keterangan</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tandai-catatan">Catatan (opsional)</Label>
              <Input
                id="tandai-catatan"
                value={form.catatan}
                onChange={(e) => onUbah({ ...form, catatan: e.target.value })}
                maxLength={500}
                className="w-52"
              />
            </div>
            <Button type="submit" disabled={form.karyawan.length === 0 || !form.dari}>
              Simpan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function FilterTidakBerangkat({
  tokoId,
  dari,
  sampai,
  pilihanToko,
  onUbah,
}: {
  tokoId: string;
  dari: string;
  sampai: string;
  pilihanToko: { id: number; nama: string }[];
  onUbah: (kunci: string, nilai: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-toko">Toko</Label>
          <NativeSelect
            id="s-toko"
            value={tokoId}
            onChange={(e) => onUbah('toko_id', e.target.value)}
            className="w-44"
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {pilihanToko.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-dari">Dari</Label>
          <Input
            id="s-dari"
            type="date"
            value={dari}
            onChange={(e) => onUbah('dari', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-sampai">Sampai</Label>
          <Input
            id="s-sampai"
            type="date"
            value={sampai}
            onChange={(e) => onUbah('sampai', e.target.value)}
            className="w-40"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function TabelPenandaan({
  daftar,
  onMintaUbah,
  onHapus,
}: {
  daftar: Penandaan[];
  onMintaUbah: (d: Penandaan) => void;
  onHapus: (id: number) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada penandaan ketidakhadiran.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Karyawan</TableHead>
              <TableHead>Toko</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{tanggalPendek(d.tanggal)}</TableCell>
                <TableCell>{d.karyawan_nama}</TableCell>
                <TableCell>{d.toko_nama}</TableCell>
                <TableCell>
                  <LabelJenis jenis={d.jenis} />
                </TableCell>
                <TableCell>{d.catatan ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" onClick={() => onMintaUbah(d)}>
                      Ubah
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onHapus(d.id)}>
                      Hapus
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

export function IsiDialogUbah({
  ubah,
  onUbah,
  onBatal,
  onSimpan,
}: {
  ubah: { id: number; jenis: 'IZIN' | 'TANPA_KETERANGAN'; catatan: string };
  onUbah: (u: { id: number; jenis: 'IZIN' | 'TANPA_KETERANGAN'; catatan: string }) => void;
  onBatal: () => void;
  onSimpan: () => void;
}) {
  return (
    <>
      <h2 className="text-base font-medium">Ubah penandaan</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ubah-jenis">Jenis</Label>
        <NativeSelect
          id="ubah-jenis"
          value={ubah.jenis}
          onChange={(e) => onUbah({ ...ubah, jenis: e.target.value as 'IZIN' | 'TANPA_KETERANGAN' })}
        >
          <NativeSelectOption value="IZIN">Izin</NativeSelectOption>
          <NativeSelectOption value="TANPA_KETERANGAN">Tanpa Keterangan</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ubah-catatan">Catatan</Label>
        <Textarea
          id="ubah-catatan"
          value={ubah.catatan}
          onChange={(e) => onUbah({ ...ubah, catatan: e.target.value })}
          rows={2}
          maxLength={500}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBatal}>
          Batal
        </Button>
        <Button type="button" onClick={onSimpan}>
          Simpan
        </Button>
      </div>
    </>
  );
}

export function PanelMemuat() {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function PanelGalat({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{pesan}</span>
        <Button size="sm" variant="outline" onClick={onCobaLagi}>
          Coba lagi
        </Button>
      </AlertDescription>
    </Alert>
  );
}
