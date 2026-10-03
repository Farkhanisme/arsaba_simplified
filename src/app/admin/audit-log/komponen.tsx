'use client';

/**
 * Bagian presentasional halaman Audit Log (rules/05 §5.10).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 * Halaman hanya-baca: tidak ada tombol Ubah, Hapus, atau Simpan di mana pun.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface BarisAudit {
  id: number;
  waktu: string;
  pengguna_id: number | null;
  pengguna_nama: string | null;
  aksi: string;
  entitas: string;
  entitas_id: number | null;
  sebelum: string | null;
  sesudah: string | null;
  catatan: string | null;
}

export interface OpsiFilterAudit {
  aksi: string[];
  entitas: string[];
  pelaku: { id: number; nama: string }[];
}

export interface NilaiFilterAudit {
  dari: string;
  sampai: string;
  pengguna_id: string;
  aksi: string;
  entitas: string;
}

/** `2026-09-02T09:00:00+07:00` -> `02/09/2026 09:00 WIB` (rules/05 §2). */
export function formatWaktuAudit(iso: string): string {
  const tanggal = iso.slice(0, 10);
  const [y, m, d] = tanggal.split('-');
  return `${d}/${m}/${y} ${iso.slice(11, 16)} WIB`;
}

/** Ringkasan satu baris: catatan bila ada, kalau tidak aksi + entitasnya. */
export function ringkasanAudit(b: BarisAudit): string {
  if (b.catatan !== null && b.catatan.trim() !== '') return b.catatan;
  const objek = b.entitas_id === null ? b.entitas : `${b.entitas} #${b.entitas_id}`;
  return `${b.aksi} · ${objek}`;
}

/**
 * Uraikan JSON sebelum/sesudah dengan aman. Tidak pernah melempar: null,
 * string kosong, dan JSON rusak semuanya menghasilkan tampilan pengganti,
 * bukan halaman kosong.
 */
export function uraikanJson(teks: string | null): { ada: boolean; cantik: string } {
  if (teks === null || teks.trim() === '') return { ada: false, cantik: '—' };
  try {
    return { ada: true, cantik: JSON.stringify(JSON.parse(teks), null, 2) };
  } catch {
    return { ada: true, cantik: teks };
  }
}

export function FilterAudit({
  nilai,
  opsi,
  onUbah,
}: {
  nilai: NilaiFilterAudit;
  opsi: OpsiFilterAudit;
  onUbah: (kunci: keyof NilaiFilterAudit, nilai: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Filter</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-dari">Dari</Label>
          <Input
            id="audit-dari"
            type="date"
            value={nilai.dari}
            onChange={(e) => onUbah('dari', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-sampai">Sampai</Label>
          <Input
            id="audit-sampai"
            type="date"
            value={nilai.sampai}
            onChange={(e) => onUbah('sampai', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-pelaku">Pelaku</Label>
          <NativeSelect
            id="audit-pelaku"
            value={nilai.pengguna_id}
            onChange={(e) => onUbah('pengguna_id', e.target.value)}
            className="w-44"
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {opsi.pelaku.map((p) => (
              <NativeSelectOption key={p.id} value={String(p.id)}>
                {p.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-aksi">Aksi</Label>
          <NativeSelect
            id="audit-aksi"
            value={nilai.aksi}
            onChange={(e) => onUbah('aksi', e.target.value)}
            className="w-44"
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {opsi.aksi.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {a}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-entitas">Entitas</Label>
          <NativeSelect
            id="audit-entitas"
            value={nilai.entitas}
            onChange={(e) => onUbah('entitas', e.target.value)}
            className="w-44"
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {opsi.entitas.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabelAudit({
  baris,
  onBuka,
}: {
  baris: BarisAudit[];
  onBuka: (id: number) => void;
}) {
  if (baris.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada catatan audit pada filter ini.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>Ringkasan</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baris.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{formatWaktuAudit(b.waktu)}</TableCell>
                <TableCell>{b.pengguna_nama ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{b.aksi}</Badge>
                </TableCell>
                <TableCell>{b.entitas}</TableCell>
                <TableCell className="max-w-72 overflow-hidden text-ellipsis">{ringkasanAudit(b)}</TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="outline" onClick={() => onBuka(b.id)} aria-label={`Lihat detail audit ${b.id}`}>
                    Lihat
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

export function NavigasiHalaman({
  offset,
  limit,
  total,
  onUbah,
}: {
  offset: number;
  limit: number;
  total: number;
  onUbah: (offset: number) => void;
}) {
  const awal = total === 0 ? 0 : offset + 1;
  const akhir = Math.min(offset + limit, total);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Menampilkan {awal}–{akhir} dari {total}
      </p>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => onUbah(Math.max(0, offset - limit))}>
          Sebelumnya
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={offset + limit >= total}
          onClick={() => onUbah(offset + limit)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

/** Isi dialog detail. Dipisah dari Dialog agar bisa diuji tanpa portal. */
export function IsiDialogDetail({ baris }: { baris: BarisAudit }) {
  const sebelum = uraikanJson(baris.sebelum);
  const sesudah = uraikanJson(baris.sesudah);
  return (
    <>
      <h2 className="text-base font-medium">
        Audit #{baris.id} · {baris.aksi}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Waktu</dt>
        <dd>{formatWaktuAudit(baris.waktu)}</dd>
        <dt className="text-muted-foreground">Pelaku</dt>
        <dd>{baris.pengguna_nama ?? '—'}</dd>
        <dt className="text-muted-foreground">Entitas</dt>
        <dd>{baris.entitas_id === null ? baris.entitas : `${baris.entitas} #${baris.entitas_id}`}</dd>
        {baris.catatan !== null && baris.catatan !== '' ? (
          <>
            <dt className="text-muted-foreground">Catatan</dt>
            <dd>{baris.catatan}</dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Sebelum</h3>
        <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-2 text-xs">{sebelum.cantik}</pre>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Sesudah</h3>
        <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-2 text-xs">{sesudah.cantik}</pre>
      </div>
    </>
  );
}

export function PanelMemuatAudit() {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function PanelGalatAudit({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
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
