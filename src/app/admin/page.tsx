'use client';

import { useCallback, useEffect, useState } from 'react';
import { AksesDitolak, adalahAksesDitolak, PanelGalat, PanelMemuat } from './komponen';
import { PanelDashboard, type DataDashboard } from './komponen-dashboard';

export { PanelDashboard };
export type { DataDashboard };

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

  if (memuat) return <PanelMemuat jumlahBaris={6} />;
  if (aksesDitolak) return <AksesDitolak />;
  if (galat || !data) {
    return <PanelGalat pesan={galat ?? 'Gagal memuat dashboard.'} onCobaLagi={muat} />;
  }
  return <PanelDashboard data={data} />;
}
