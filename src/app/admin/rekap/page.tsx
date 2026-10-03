'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
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
    <div>
      {pemeriksaan.boleh ? (
        <p role="status" style={{ background: '#dcfce7', padding: 8, borderRadius: 4 }}>
          Semua absensi pada periode ini sudah diverifikasi.
        </p>
      ) : (
        <div role="alert" style={{ background: '#fee2e2', padding: 8, borderRadius: 4 }}>
          <p style={{ margin: '0 0 4px' }}>
            Ekspor belum bisa dilakukan: masih ada {pemeriksaan.jumlahMenunggu} absensi menunggu verifikasi dan{' '}
            {pemeriksaan.jumlahCheckinTerbuka} check-in tanpa check-out.
          </p>
          <Link href={verifikasiHref}>Buka Verifikasi</Link>
        </div>
      )}
      {pemeriksaan.peringatan > 0 ? (
        <p role="status" style={{ background: '#fef9c3', padding: 8, borderRadius: 4 }}>
          Peringatan: {pemeriksaan.peringatan} karyawan terjadwal tanpa absen dan tanpa penandaan.
        </p>
      ) : null}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: 8 }}>
        <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Nama</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Toko</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Hari Hadir</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Izin</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Tanpa Keterangan</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Total Menit Terlambat Final</th>
          </tr>
        </thead>
        <tbody>
          {ringkasan.map((r) => (
            <tr key={`${r.karyawan_id}-${r.toko_id}`}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.karyawan_nama}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.toko_nama}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.hari_hadir}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.hari_izin}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.hari_tanpa_keterangan}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.total_terlambat_final}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onUnduh} disabled={!bisaEkspor || mengunduh} style={{ padding: '8px 16px', marginTop: 8 }}>
        {mengunduh ? 'Mengunduh…' : 'Unduh Excel (.xlsx)'}
      </button>
    </div>
  );
}

function HalamanRekap() {
  const router = useRouter();
  const params = useSearchParams();
  const [tokoList, setTokoList] = useState<{ id: number; nama: string }[]>([]);
  const [data, setData] = useState<DataRekap | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [mengunduh, setMengunduh] = useState(false);

  useEffect(() => {
    fetch('/api/admin/verifikasi/pilihan')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b) setTokoList(b.data.toko);
      })
      .catch(() => undefined);
  }, []);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/rekap?${p.toString()}`);
  }

  const periksa = useCallback(async () => {
    const dari = params.get('dari') ?? '';
    const sampai = params.get('sampai') ?? '';
    const tokoId = params.get('toko_id') ?? '';
    if (!dari || !sampai) {
      setGalat('Isi rentang tanggal dulu.');
      return;
    }
    setMemuat(true);
    setGalat(null);
    setPesan(null);
    setAksesDitolak(false);
    try {
      const res = await fetch(`/api/admin/rekap?dari=${dari}&sampai=${sampai}${tokoId ? `&toko_id=${tokoId}` : ''}`);
      if (!res.ok) {
        if (await adalahAksesDitolak(res)) {
          setAksesDitolak(true);
          return;
        }
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal membuat rekap.');
      }
      setData(((await res.json()).data as DataRekap));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat rekap.');
    } finally {
      setMemuat(false);
    }
  }, [params]);

  async function unduh() {
    const dari = params.get('dari') ?? '';
    const sampai = params.get('sampai') ?? '';
    const tokoId = params.get('toko_id') ?? '';
    setMengunduh(true);
    try {
      const res = await fetch('/api/admin/rekap/ekspor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dari, sampai, toko_id: tokoId ? Number(tokoId) : null }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Ekspor gagal.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-${dari}-${sampai}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setPesan('File Excel berhasil diunduh.');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Ekspor gagal.');
    } finally {
      setMengunduh(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Rekap &amp; Ekspor</h1>
      {pesan ? <p role="status" style={{ background: '#dcfce7', padding: 8, borderRadius: 4 }}>{pesan}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <div>
          <label htmlFor="r-dari">Dari<br /><input id="r-dari" type="date" value={params.get('dari') ?? ''} onChange={(e) => aturParam('dari', e.target.value)} style={{ padding: 8 }} /></label>
        </div>
        <div>
          <label htmlFor="r-sampai">Sampai<br /><input id="r-sampai" type="date" value={params.get('sampai') ?? ''} onChange={(e) => aturParam('sampai', e.target.value)} style={{ padding: 8 }} /></label>
        </div>
        <div>
          <label htmlFor="r-toko">Toko<br />
            <select id="r-toko" value={params.get('toko_id') ?? ''} onChange={(e) => aturParam('toko_id', e.target.value)} style={{ padding: 8 }}>
              <option value="">Semua toko</option>
              {tokoList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={periksa} disabled={memuat} style={{ padding: '8px 16px' }}>
          {memuat ? 'Memeriksa…' : 'Periksa & Buat Rekap'}
        </button>
      </div>

      {memuat ? (
        <p>Memuat…</p>
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <div><p role="alert">{galat}</p><button type="button" onClick={periksa}>Coba lagi</button></div>
      ) : data ? (
        <PanelRekap data={data} mengunduh={mengunduh} onUnduh={unduh} />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanRekap />
    </Suspense>
  );
}
