'use client';

/**
 * Bagian presentasional halaman Dashboard (rules/05 §5.2).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state hidup di `page.tsx`.
 */

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { KartuToko } from '../../server/aturan/dashboard';

export interface DataDashboard {
  tanggalPanjang: string;
  kartu: KartuToko[];
  antrean: number;
}

const configHadir: ChartConfig = {
  Terjadwal: { label: 'Terjadwal', color: 'var(--chart-1)' },
  SudahAbsen: { label: 'Sudah absen', color: 'var(--chart-2)' },
};

const configTerlambat: ChartConfig = {
  Terlambat: { label: 'Terlambat', color: 'var(--chart-4)' },
};

/** Panel presentasional: 10 kartu + antrean dengan tautan, tanpa pemilih tanggal. */
export function PanelDashboard({ data }: { data: DataDashboard }) {
  const batangHadir = data.kartu.map((k) => ({ toko: k.toko_nama, Terjadwal: k.terjadwal, SudahAbsen: k.sudah_absen }));
  const batangTerlambat = data.kartu.map((k) => ({ toko: k.toko_nama, Terlambat: k.terlambat }));
  return (
    <div className="flex flex-col gap-3">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Dashboard — {data.tanggalPanjang}</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Antrean verifikasi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="text-3xl font-bold">{data.antrean}</div>
          <Link href="/admin/verifikasi" className="text-sm underline underline-offset-4">
            Buka Verifikasi
          </Link>
        </CardContent>
      </Card>

      <section aria-label="Grafik kehadiran per toko" className="mb-3">
        <h2 className="text-base font-medium">Terjadwal vs Sudah absen per toko</h2>
        <ChartContainer config={configHadir} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={batangHadir}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="toko" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="Terjadwal" fill="var(--chart-1)" radius={4}>
              <LabelList dataKey="Terjadwal" position="top" fontSize={11} />
            </Bar>
            <Bar dataKey="SudahAbsen" fill="var(--chart-2)" radius={4} name="Sudah absen">
              <LabelList dataKey="SudahAbsen" position="top" fontSize={11} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </section>

      <section aria-label="Grafik keterlambatan per toko" className="mb-3">
        <h2 className="text-base font-medium">Keterlambatan per toko</h2>
        <ChartContainer config={configTerlambat} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={batangTerlambat}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="toko" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="Terlambat" fill="var(--chart-4)" radius={4}>
              <LabelList dataKey="Terlambat" position="top" fontSize={11} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </section>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {data.kartu.map((k) => (
          <Card key={k.toko_id} aria-label={`Toko ${k.toko_nama}`}>
            <CardHeader>
              <CardTitle className="text-base">{k.toko_nama}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-1 text-sm">
                <dt>Terjadwal</dt>
                <dd className="m-0 font-bold">{k.terjadwal}</dd>
                <dt>Sudah absen</dt>
                <dd className="m-0 font-bold">{k.sudah_absen}</dd>
                <dt>Terlambat</dt>
                <dd className="m-0">
                  <Badge variant="outline">▲ {k.terlambat}</Badge>
                </dd>
                <dt>Belum absen</dt>
                <dd className="m-0">
                  <Badge variant="destructive">● {k.belum_absen}</Badge>
                </dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
