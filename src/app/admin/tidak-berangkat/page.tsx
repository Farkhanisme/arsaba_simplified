'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';

interface Penandaan {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggal: string;
  jenis: 'IZIN' | 'TANPA_KETERANGAN';
  catatan: string | null;
}

interface HasilTandai {
  dibuat: { karyawan_id: number; tanggal: string }[];
  ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
}

const PESAN_X3 = 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.';

function tanggalPendek(t: string): string {
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

export function PanelHasilTandai({ hasil }: { hasil: HasilTandai }) {
  return (
    <div style={{ marginTop: 8, fontSize: 14 }}>
      <p>
        {hasil.dibuat.length} tersimpan, {hasil.ditolak.length} ditolak.
      </p>
      {hasil.ditolak.length > 0 ? (
        <ul>
          {hasil.ditolak.map((d, i) => (
            <li key={i}>
              Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}: {d.alasan}{' '}
              {d.alasan === PESAN_X3 ? <a href="/admin/verifikasi">Buka Verifikasi</a> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function HalamanTidakBerangkat() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<Penandaan[]>([]);
  const [pilihan, setPilihan] = useState<{ toko: { id: number; nama: string }[]; karyawan: { id: number; nama: string }[] }>({ toko: [], karyawan: [] });
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [form, setForm] = useState({ karyawan: [] as number[], dari: '', sampai: '', jenis: 'IZIN', catatan: '' });
  const [hasil, setHasil] = useState<HasilTandai | null>(null);
  const [ubah, setUbah] = useState<{ id: number; jenis: 'IZIN' | 'TANPA_KETERANGAN'; catatan: string } | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const [rDaftar, rPilih] = await Promise.all([
        fetch(`/api/admin/tidak-berangkat?${query}`),
        fetch('/api/admin/verifikasi/pilihan'),
      ]);
      if (!rDaftar.ok) {
        if (await adalahAksesDitolak(rDaftar)) {
          setAksesDitolak(true);
          return;
        }
        const b = await rDaftar.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat data.');
      }
      setDaftar(((await rDaftar.json()).data as Penandaan[]));
      if (rPilih.ok) setPilihan((await rPilih.json()).data);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setMemuat(false);
    }
  }, [query]);

  useEffect(() => {
    muat();
  }, [muat]);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/tidak-berangkat?${p.toString()}`);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/tidak-berangkat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        karyawan_ids: form.karyawan,
        dari: form.dari,
        sampai: form.sampai || undefined,
        jenis: form.jenis,
        catatan: form.catatan || undefined,
      }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok && res.status !== 409) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    if (b?.data) setHasil(b.data as HasilTandai);
    setPesan((b?.pesan as string) ?? '');
    muat();
  }

  async function simpanUbah() {
    if (!ubah) return;
    const res = await fetch(`/api/admin/tidak-berangkat/${ubah.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jenis: ubah.jenis, catatan: ubah.catatan || null }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal mengubah.');
      return;
    }
    setUbah(null);
    setPesan('Penandaan berhasil diubah.');
    muat();
  }

  async function hapusBaris(id: number) {
    if (!window.confirm('Hapus penandaan ini? Karyawan bisa absen lagi pada tanggal itu.')) return;
    const res = await fetch(`/api/admin/tidak-berangkat/${id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menghapus.');
      return;
    }
    setPesan('Penandaan berhasil dihapus.');
    muat();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Tandai Tidak Berangkat</h1>
      {pesan ? <p role="status" style={{ background: '#dcfce7', padding: 8, borderRadius: 4 }}>{pesan}</p> : null}

      <form onSubmit={kirim} style={{ background: '#fff', border: '1px solid #ddd', padding: 12, maxWidth: 640, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
          {pilihan.karyawan.map((k) => (
            <label key={k.id}>
              <input type="checkbox" checked={form.karyawan.includes(k.id)} onChange={(e) => setForm({ ...form, karyawan: e.target.checked ? [...form.karyawan, k.id] : form.karyawan.filter((x) => x !== k.id) })} /> {k.nama}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>Tanggal<br /><input type="date" value={form.dari} onChange={(e) => setForm({ ...form, dari: e.target.value })} required style={{ padding: 8 }} /></label>
          <label>Sampai (opsional)<br /><input type="date" value={form.sampai} onChange={(e) => setForm({ ...form, sampai: e.target.value })} style={{ padding: 8 }} /></label>
          <label>Jenis<br />
            <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} style={{ padding: 8 }}>
              <option value="IZIN">Izin</option>
              <option value="TANPA_KETERANGAN">Tanpa Keterangan</option>
            </select>
          </label>
          <label>Catatan (opsional)<br /><input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} maxLength={500} style={{ padding: 8 }} /></label>
          <button type="submit" disabled={form.karyawan.length === 0 || !form.dari} style={{ padding: '8px 16px' }}>Simpan</button>
        </div>
      </form>

      {hasil ? <PanelHasilTandai hasil={hasil} /> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <label>Toko<br />
          <select value={params.get('toko_id') ?? ''} onChange={(e) => aturParam('toko_id', e.target.value)} style={{ padding: 8 }}>
            <option value="">Semua</option>
            {pilihan.toko.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
        </label>
        <label>Dari<br /><input type="date" value={params.get('dari') ?? ''} onChange={(e) => aturParam('dari', e.target.value)} style={{ padding: 8 }} /></label>
        <label>Sampai<br /><input type="date" value={params.get('sampai') ?? ''} onChange={(e) => aturParam('sampai', e.target.value)} style={{ padding: 8 }} /></label>
      </div>

      {memuat ? (
        <p>Memuat…</p>
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <div><p role="alert">{galat}</p><button type="button" onClick={muat}>Coba lagi</button></div>
      ) : daftar.length === 0 ? (
        <p>Belum ada penandaan ketidakhadiran.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Tanggal</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Karyawan</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Toko</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Jenis</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Catatan</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((d) => (
              <tr key={d.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{tanggalPendek(d.tanggal)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.karyawan_nama}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.toko_nama}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{ background: d.jenis === 'IZIN' ? '#dbeafe' : '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>
                    {d.jenis === 'IZIN' ? 'Izin' : 'Tanpa Keterangan'}
                  </span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{d.catatan ?? '—'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setUbah({ id: d.id, jenis: d.jenis, catatan: d.catatan ?? '' })}>Ubah</button>
                    <button type="button" onClick={() => hapusBaris(d.id)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ubah ? (
        <div role="dialog" aria-label="Ubah penandaan" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 440, width: '100%' }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Ubah penandaan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label>Jenis<br />
                <select value={ubah.jenis} onChange={(e) => setUbah({ ...ubah, jenis: e.target.value as 'IZIN' | 'TANPA_KETERANGAN' })} style={{ padding: 8 }}>
                  <option value="IZIN">Izin</option>
                  <option value="TANPA_KETERANGAN">Tanpa Keterangan</option>
                </select>
              </label>
              <label>Catatan<br />
                <textarea value={ubah.catatan} onChange={(e) => setUbah({ ...ubah, catatan: e.target.value })} rows={2} maxLength={500} style={{ width: '100%', padding: 8 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setUbah(null)}>Batal</button>
              <button type="button" onClick={simpanUbah}>Simpan</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanTidakBerangkat />
    </Suspense>
  );
}
