'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { AksesDitolak, adalahAksesDitolak } from './komponen';
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
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard — {data.tanggalPanjang}</h1>
      <Card style={{ maxWidth: 480, marginBottom: 12 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 14, fontWeight: 'normal' }}>Antrean verifikasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{data.antrean}</div>
          <Link href="/admin/verifikasi">Buka Verifikasi</Link>
        </CardContent>
      </Card>

      <section aria-label="Grafik kehadiran per toko" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16 }}>Terjadwal vs Sudah absen per toko</h2>
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

      <section aria-label="Grafik keterlambatan per toko" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16 }}>Keterlambatan per toko</h2>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {data.kartu.map((k) => (
          <Card key={k.toko_id} aria-label={`Toko ${k.toko_nama}`}>
            <CardHeader>
              <CardTitle style={{ fontSize: 16 }}>{k.toko_nama}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 14 }}>
                <dt>Terjadwal</dt>
                <dd style={{ margin: 0, fontWeight: 'bold' }}>{k.terjadwal}</dd>
                <dt>Sudah absen</dt>
                <dd style={{ margin: 0, fontWeight: 'bold' }}>{k.sudah_absen}</dd>
                <dt>Terlambat</dt>
                <dd style={{ margin: 0, fontWeight: 'bold', color: '#c2410c' }}>▲ {k.terlambat}</dd>
                <dt>Belum absen</dt>
                <dd style={{ margin: 0, fontWeight: 'bold', color: '#b91c1c' }}>● {k.belum_absen}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function HalamanDashboard() {
  const [data, setData] = useState<DataDashboard | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) {
        if (await adalahAksesDitolak(res)) {
          setAksesDitolak(true);
          return;
        }
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat dashboard.');
      }
      setData(((await res.json()).data as DataDashboard));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat dashboard.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  if (memuat) return <p>Memuat…</p>;
  if (aksesDitolak) return <AksesDitolak />;
  if (galat || !data) {
    return (
      <div>
        <p role="alert">{galat ?? 'Gagal memuat dashboard.'}</p>
        <button type="button" onClick={muat}>
          Coba lagi
        </button>
      </div>
    );
  }
  return <PanelDashboard data={data} />;
}
