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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
 * Panel presentasional — TABEL TOKO, amandemen K-70 (disetujui pemilik
 * 2026-10-15). 16 kartu B2f terasa seperti "papan catur"; penggantinya
 * 3 kartu: 1 ringkasan (4 stat) + 1 antrean (2 baris aksi) + 1 tabel 10 baris.
 *
 * Yang TIDAK berubah: `DataDashboard` (semua angka dihitung di render),
 * fetch, href, teks tautan, badge angka + semantiknya, judul + tinggi grafik,
 * dan tidak ada input tanggal. Header tabel STATIS (10 baris muat tanpa
 * scroll — konsisten dengan keputusan UI-5B).
 */
/**
 * Urutan toko: bermasalah dulu (belum desc, lalu terlambat desc), lengkap di
 * bawah. `sort` stabil, jadi seri = urutan semula. Murni presentasi di render —
 * data, fetch, dan endpoint tidak berubah.
 */
function urutToko<T extends { belum_absen: number; terlambat: number }>(kartu: T[]): T[] {
  return [...kartu].sort((a, b) => b.belum_absen - a.belum_absen || b.terlambat - a.terlambat);
}

/**
 * Panel "Perlu tindakan" (K-71): HANYA yang bermasalah — toko dengan belum>0
 * atau terlambat>0 (terurut, tiap baris deep link terfilter ke verifikasi)
 * plus antrean yang >0. Kosong → "Semua toko beres ✓", bukan panel kosong.
 * Teks tombol tanpa panah, sama persis dengan label menu.
 */
export function PanelTindakan({
  kartu,
  antrean,
  antreanAgenda,
}: {
  kartu: DataDashboard['kartu'];
  antrean: number;
  antreanAgenda: number;
}) {
  const bermasalah = urutToko(kartu.filter((k) => k.belum_absen > 0 || k.terlambat > 0));
  if (bermasalah.length === 0 && antrean === 0 && antreanAgenda === 0) {
    return (
      <section aria-label="Perlu tindakan">
        <p className="text-base">Semua toko beres ✓</p>
      </section>
    );
  }
  return (
    <section aria-label="Perlu tindakan" className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">Perlu tindakan</h2>
      {bermasalah.map((k) => (
        <div key={k.toko_id} className="flex flex-wrap items-center gap-3 border-b pb-2">
          <div className="min-w-40 flex-1 text-base">
            <strong>{k.toko_nama}</strong>
            <span className="text-muted-foreground">
              {' — '}
              {[k.belum_absen > 0 ? `${k.belum_absen} belum absen` : null, k.terlambat > 0 ? `${k.terlambat} terlambat` : null]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
          <Button size="sm" render={<Link href={`/admin/verifikasi?status=MENUNGGU&toko_id=${k.toko_id}`}>Buka Verifikasi</Link>} />
        </div>
      ))}
      {antrean > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b pb-2">
          <div className="min-w-40 flex-1 text-base">
            <strong>{antrean}</strong> <span className="text-muted-foreground">menunggu verifikasi absensi</span>
          </div>
          <Button size="sm" render={<Link href="/admin/verifikasi">Buka Verifikasi Absensi</Link>} />
        </div>
      ) : null}
      {antreanAgenda > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b pb-2">
          <div className="min-w-40 flex-1 text-base">
            <strong>{antreanAgenda}</strong> <span className="text-muted-foreground">menunggu verifikasi agenda</span>
          </div>
          <Button size="sm" render={<Link href="/admin/verifikasi-agenda">Buka Verifikasi Agenda</Link>} />
        </div>
      ) : null}
    </section>
  );
}

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

      {/* Pita ringkasan BUKAN kartu (K-71): satu momen berani halaman ini =
          fraksi tabular oversize; sisanya disiplin. Koma sebagai pemisah,
          bukan `·`. */}
      <section aria-label="Ringkasan hari ini" className="flex flex-col gap-3 border-b pb-4">
        <div>
          <div className="text-sm text-muted-foreground">Sudah absen hari ini</div>
          <div className="text-5xl font-bold tabular-nums tracking-tight">
            {total.sudahAbsen}
            <span className="text-2xl font-medium text-muted-foreground"> / {total.terjadwal}</span>
          </div>
          <BilahPersen sudah={total.sudahAbsen} terjadwal={total.terjadwal} />
          <div className="text-sm text-muted-foreground">dari {total.terjadwal} Terjadwal</div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span><strong className="text-base">{total.terlambat}</strong> <span className="text-muted-foreground">Terlambat</span></span>
          <span><strong className="text-base">{total.belumAbsen}</strong> <span className="text-muted-foreground">Belum absen</span></span>
          <span><strong className="text-base">{tokoLengkap} / {data.kartu.length}</strong> <span className="text-muted-foreground">Toko lengkap</span></span>
        </div>
      </section>

      <PanelTindakan
        kartu={data.kartu}
        antrean={data.antrean}
        antreanAgenda={data.antreanAgenda}
      />

      <Card>
        <CardHeader>
          <CardTitle>Kehadiran per toko</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Toko</TableHead>
                <TableHead>Sudah absen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agenda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {urutToko(data.kartu).map((k) => {
                const lengkap = k.belum_absen === 0 && k.terlambat === 0 && k.sudah_absen === k.terjadwal;
                return (
                  <TableRow key={k.toko_id}>
                    <TableHead scope="row" className="font-bold">{k.toko_nama}</TableHead>
                    <TableCell>
                      <span className="font-bold">
                        {k.sudah_absen}
                        <span className="font-medium text-muted-foreground"> / {k.terjadwal}</span>
                      </span>
                      <BilahPersen sudah={k.sudah_absen} terjadwal={k.terjadwal} />
                    </TableCell>
                    <TableCell>
                      {lengkap ? (
                        <Badge variant="default">✓ Lengkap</Badge>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {k.terlambat > 0 ? <Badge variant="outline">▲ {k.terlambat} Terlambat</Badge> : null}
                          {k.belum_absen > 0 ? <Badge variant="destructive">● {k.belum_absen} Belum absen</Badge> : null}
                        </span>
                      )}
                    </TableCell>
                    {/* BR-G17: metrik agenda memakai tanggal submit laporan.
                        Koma sebagai pemisah (K-71), bukan `·` pola template. */}
                    <TableCell className="text-sm text-muted-foreground">
                      {k.agenda.selesai} selesai, {k.agenda.ditolak} ditolak
                      {k.agenda.menunggu > 0 ? (
                        <Badge variant="outline" className="ml-1.5">{k.agenda.menunggu} menunggu</Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
