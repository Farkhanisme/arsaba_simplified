'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast, pesanGalat, type Pesan } from '../komponen';

export default function HalamanPengaturan() {
  const [ambang, setAmbang] = useState('5');
  const [pesan, setPesan] = useState<Pesan | null>(null);

  const muat = useCallback(async () => {
    const res = await fetch('/api/admin/pengaturan');
    if (!res.ok) {
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
    <div>
      <h1 style={{ marginTop: 0 }}>Pengaturan</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />

      <form onSubmit={simpan} style={{ background: '#fff', padding: 16, border: '1px solid #ddd', maxWidth: 480 }}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="ambang">Ambang terlambat (menit)<br />
            <input id="ambang" type="number" min={0} step={1} value={ambang} onChange={(e) => setAmbang(e.target.value)} required style={{ padding: 8, width: 120 }} />
          </label>
          <p style={{ fontSize: 13, color: '#555' }}>
            Check-in terlambat bila selisih menit melebihi ambang ini. Nilai bawaan: 5.
          </p>
        </div>
        <button type="submit" style={{ padding: '8px 16px' }}>Simpan</button>
      </form>

      <p style={{ fontSize: 13, color: '#555', marginTop: 16 }}>
        Konfigurasi bot Telegram diatur lewat variabel lingkungan server dan tidak ditampilkan di halaman ini.
      </p>
    </div>
  );
}
