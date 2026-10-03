'use client';

/**
 * Bagian presentasional halaman Rekap & Ekspor (rules/05 §5.6).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 */

import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import type { KartuRingkasan } from '../../../server/aturan/rekap';

export interface HasilPemeriksaan {
  boleh: boolean;
  jumlahMenunggu: number;
  jumlahCheckinTerbuka: number;
  peringatan: number;
}

export interface DataRekap {
  filter: { dari: string; sampai: string; tokoId: number | null };
  pemeriksaan: HasilPemeriksaan;
  ringkasan: KartuRingkasan[];
}

export function PanelRekap({ data, mengunduh, onUnduh }: { data: DataRekap; mengunduh: boolean; onUnduh: () => void }) {
  const { pemeriksaan, ringkasan, filter } = data;
  const bisaEkspor = pemeriksaan.boleh;
  const verifikasiHref =
    `/admin/verifikasi?status=MENUNGGU&dari=${filter.dari}&sampai=${filter.sampai}` +
    (filter.tokoId === null ? '' : `&toko_id=${filter.tokoId}`);
  return (
    <div className="flex flex-col gap-3">
      {pemeriksaan.boleh ? (
        <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>Semua absensi pada periode ini sudah diverifikasi.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              Ekspor belum bisa dilakukan: masih ada {pemeriksaan.jumlahMenunggu} absensi menunggu
              verifikasi dan {pemeriksaan.jumlahCheckinTerbuka} check-in tanpa check-out.
            </span>
            <Link href={verifikasiHref} className="underline underline-offset-4">
              Buka Verifikasi
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {pemeriksaan.peringatan > 0 ? (
        <Alert className="border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
          <AlertDescription>
            Peringatan: {pemeriksaan.peringatan} karyawan terjadwal tanpa absen dan tanpa penandaan.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Toko</TableHead>
                <TableHead>Hari Hadir</TableHead>
                <TableHead>Izin</TableHead>
                <TableHead>Tanpa Keterangan</TableHead>
                <TableHead>Total Menit Terlambat Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ringkasan.map((r) => (
                <TableRow key={`${r.karyawan_id}-${r.toko_id}`}>
                  <TableCell>{r.karyawan_nama}</TableCell>
                  <TableCell>{r.toko_nama}</TableCell>
                  <TableCell>{r.hari_hadir}</TableCell>
                  <TableCell>{r.hari_izin}</TableCell>
                  <TableCell>{r.hari_tanpa_keterangan}</TableCell>
                  <TableCell>{r.total_terlambat_final}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div>
        <Button type="button" onClick={onUnduh} disabled={!bisaEkspor || mengunduh}>
          {mengunduh ? 'Mengunduh…' : 'Unduh Excel (.xlsx)'}
        </Button>
      </div>
    </div>
  );
}

export function FilterRekap({
  dari,
  sampai,
  tokoId,
  tokoList,
  memuat,
  onUbah,
  onPeriksa,
}: {
  dari: string;
  sampai: string;
  tokoId: string;
  tokoList: { id: number; nama: string }[];
  memuat: boolean;
  onUbah: (kunci: string, nilai: string) => void;
  onPeriksa: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Filter rekap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-dari">Dari</Label>
          <Input
            id="r-dari"
            type="date"
            value={dari}
            onChange={(e) => onUbah('dari', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-sampai">Sampai</Label>
          <Input
            id="r-sampai"
            type="date"
            value={sampai}
            onChange={(e) => onUbah('sampai', e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-toko">Toko</Label>
          <NativeSelect
            id="r-toko"
            value={tokoId}
            onChange={(e) => onUbah('toko_id', e.target.value)}
            className="w-44"
          >
            <NativeSelectOption value="">Semua toko</NativeSelectOption>
            {tokoList.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" onClick={onPeriksa} disabled={memuat}>
          {memuat ? 'Memeriksa…' : 'Periksa & Buat Rekap'}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PanelMemuatRekap() {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function PanelGalatRekap({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
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
