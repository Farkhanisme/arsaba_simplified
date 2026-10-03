'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast, pesanGalat, AksesDitolak, adalahAksesDitolak, type Pesan } from '../komponen';
import { CatatanTelegram, PanelPengaturan } from './komponen';

export default function HalamanPengaturan() {
  const [ambang, setAmbang] = useState('5');
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/pengaturan');
    if (!res.ok) {
      if (await adalahAksesDitolak(res)) {
        setAksesDitolak(true);
        return;
      }
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal memuat pengaturan.') });
      return;
    }
    const data = await res.json();
    setAmbang(String(data.data.ambang_terlambat_menit as number));
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const nilai = Number(ambang);
    const res = await fetch('/api/admin/pengaturan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambang_terlambat_menit: nilai }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal menyimpan pengaturan.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: 'Pengaturan berhasil disimpan.' });
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Pengaturan</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />
      {aksesDitolak ? <AksesDitolak /> : null}

      <PanelPengaturan ambang={ambang} onUbahAmbang={setAmbang} onSimpan={simpan} />

      <CatatanTelegram />
    </div>
  );
}
