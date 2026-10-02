'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { KartuToko } from '../../server/aturan/dashboard';

export interface DataDashboard {
  tanggalPanjang: string;
  kartu: KartuToko[];
  antrean: number;
}

/** Panel presentasional: 10 kartu + antrean dengan tautan, tanpa pemilih tanggal. */
export function PanelDashboard({ data }: { data: DataDashboard }) {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard — {data.tanggalPanjang}</h1>
      <section aria-label="Antrean verifikasi" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12, maxWidth: 480 }}>
        <div style={{ fontSize: 14, color: '#555' }}>Antrean verifikasi</div>
        <div style={{ fontSize: 28, fontWeight: 'bold' }}>{data.antrean}</div>
        <Link href="/admin/verifikasi">Buka Verifikasi</Link>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {data.kartu.map((k) => (
          <section key={k.toko_id} aria-label={`Toko ${k.toko_nama}`} style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{k.toko_nama}</h2>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 14 }}>
              <dt>Terjadwal</dt>
              <dd style={{ margin: 0, fontWeight: 'bold' }}>{k.terjadwal}</dd>
              <dt>Sudah absen</dt>
              <dd style={{ margin: 0, fontWeight: 'bold' }}>{k.sudah_absen}</dd>
              <dt>Terlambat</dt>
              <dd style={{ margin: 0, fontWeight: 'bold', color: '#c2410c' }}>{k.terlambat}</dd>
              <dt>Belum absen</dt>
              <dd style={{ margin: 0, fontWeight: 'bold', color: '#b91c1c' }}>{k.belum_absen}</dd>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function HalamanDashboard() {
  const [data, setData] = useState<DataDashboard | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) {
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
