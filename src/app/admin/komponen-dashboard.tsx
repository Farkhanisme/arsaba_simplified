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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { KartuToko } from '../../server/aturan/dashboard';

export interface DataDashboard {
  tanggalPanjang: string;
  kartu: KartuToko[];
  antrean: number;
  /** BR-G17: laporan agenda MENUNGGU dari semua tanggal. */
  antreanAgenda: number;
}

const configHadir: ChartConfig = {
  Terjadwal: { label: 'Terjadwal', color: 'var(--chart-1)' },
  SudahAbsen: { label: 'Sudah absen', color: 'var(--chart-2)' },
};

const configTerlambat: ChartConfig = {
  Terlambat: { label: 'Terlambat', color: 'var(--chart-4)' },
};

/**
 * Panel presentasional — REDESAIN B2f (disetujui pemilik 2026-10-15).
 * Urutan mengikuti alur kerja pagi hari: ringkasan → tindakan → toko → grafik.
 *
 * Yang TIDAK berubah: `DataDashboard` (total/persen/jumlah toko lengkap
 * dihitung di render), fetch, href, teks tautan, badge angka, judul + tinggi
 * grafik, dan tidak ada input tanggal. Kartu: 4 ringkasan + 2 antrean + 10
 * toko = 16 `group/card` (kunci tes UI-2 "12" diperbarui dengan alasan ini).
 */
export function PanelDashboard({ data }: { data: DataDashboard }) {
  const batangHadir = data.kartu.map((k) => ({ toko: k.toko_nama, Terjadwal: k.terjadwal, SudahAbsen: k.sudah_absen }));
  const batangTerlambat = data.kartu.map((k) => ({ toko: k.toko_nama, Terlambat: k.terlambat }));
  const total = data.kartu.reduce(
    (acc, k) => ({
      terjadwal: acc.terjadwal + k.terjadwal,
      sudahAbsen: acc.sudahAbsen + k.sudah_absen,
      terlambat: acc.terlambat + k.terlambat,
      belumAbsen: acc.belumAbsen + k.belum_absen,
    }),
    { terjadwal: 0, sudahAbsen: 0, terlambat: 0, belumAbsen: 0 },
  );
  const tokoLengkap = data.kartu.filter(
    (k) => k.belum_absen === 0 && k.terlambat === 0 && k.sudah_absen === k.terjadwal,
  ).length;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Dashboard — {data.tanggalPanjang}</h1>

      <section aria-label="Ringkasan hari ini" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Sudah absen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-3xl font-bold">
              {total.sudahAbsen}
              <span className="text-base font-medium text-muted-foreground"> / {total.terjadwal}</span>
            </div>
            <BilahPersen sudah={total.sudahAbsen} terjadwal={total.terjadwal} />
            <div className="text-sm text-muted-foreground">dari {total.terjadwal} Terjadwal</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Terlambat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total.terlambat}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Belum absen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total.belumAbsen}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Toko lengkap</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-3xl font-bold">
              {tokoLengkap}
              <span className="text-base font-medium text-muted-foreground"> / {data.kartu.length}</span>
            </div>
            <div className="text-sm text-muted-foreground">tanpa terlambat &amp; belum absen</div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Antrean verifikasi absensi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-3xl font-bold">{data.antrean}</div>
            <Button size="sm" className="w-full" render={<Link href="/admin/verifikasi">Buka Verifikasi →</Link>} />
          </CardContent>
        </Card>
        {/* BR-G17: antrean agenda terpisah karena halamannya terpisah (BR-G10),
            dan angka ini ikut menentukan apakah ekspor bisa dilakukan (K-63). */}
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Antrean verifikasi agenda</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-3xl font-bold">{data.antreanAgenda}</div>
            <Button size="sm" className="w-full" render={<Link href="/admin/verifikasi-agenda">Buka Verifikasi Agenda →</Link>} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {data.kartu.map((k) => {
          const lengkap = k.belum_absen === 0 && k.terlambat === 0 && k.sudah_absen === k.terjadwal;
          return (
            <Card key={k.toko_id} aria-label={`Toko ${k.toko_nama}`}>
              <CardHeader>
                <CardTitle className="text-base">{k.toko_nama}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Sudah absen</div>
                  <div className="text-3xl font-bold">
                    {k.sudah_absen}
                    <span className="text-base font-medium text-muted-foreground"> / {k.terjadwal}</span>
                  </div>
                  <BilahPersen sudah={k.sudah_absen} terjadwal={k.terjadwal} />
                </div>
                {lengkap ? (
                  <Badge variant="default">✓ Lengkap</Badge>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {k.terlambat > 0 ? <Badge variant="outline">▲ {k.terlambat} Terlambat</Badge> : null}
                    {k.belum_absen > 0 ? <Badge variant="destructive">● {k.belum_absen} Belum absen</Badge> : null}
                  </div>
                )}
                {/* BR-G17: metrik agenda memakai tanggal submit laporan. */}
                <div className="text-sm text-muted-foreground">
                  Agenda: {k.agenda.selesai} selesai · {k.agenda.ditolak} ditolak
                  {k.agenda.menunggu > 0 ? (
                    <Badge variant="outline" className="ml-1.5">{k.agenda.menunggu} menunggu</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
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
    </div>
  );
}

/**
 * Bilah kemajuan sudah/terjadwal. Lebar memakai `style width %` (disetujui
 * pemilik, B2f) — persen, bukan warna, jadi lolos sapuan hex/rgb. Pembagi nol
 * = 0%, bukan NaN.
 */
export function BilahPersen({ sudah, terjadwal }: { sudah: number; terjadwal: number }) {
  const persen = terjadwal > 0 ? Math.round((sudah / terjadwal) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label={`${persen} persen sudah absen`}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${persen}%` }} />
    </div>
  );
}
