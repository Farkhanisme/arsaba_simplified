'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, type Pesan } from '../../komponen';

interface Karyawan {
  id: number;
  nama: string;
  nik: string | null;
  jabatan: string | null;
  alamat: string | null;
  nomor_hp: string | null;
  kontak_darurat: string | null;
  aktif: number;
}

interface Toko {
  id: number;
  nama: string;
  aktif: number;
}

interface Penempatan {
  toko_id: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
}

interface InfoLink {
  dibuat_at: string;
  url: string;
}

const KOSONG = { nama: '', nik: '', jabatan: '', alamat: '', nomor_hp: '', kontak_darurat: '' };

function HalamanKaryawan() {
  const router = useRouter();
  const params = useSearchParams();
  const cari = params.get('cari') ?? '';
  const [daftar, setDaftar] = useState<Karyawan[]>([]);
  const [daftarToko, setDaftarToko] = useState<Toko[]>([]);
  const [tokoKaryawan, setTokoKaryawan] = useState<Record<number, string>>({});
  const [linkKaryawan, setLinkKaryawan] = useState<Record<number, InfoLink | null>>({});
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [form, setForm] = useState(KOSONG);
  const [suntingId, setSuntingId] = useState<number | null>(null);
  const [sunting, setSunting] = useState(KOSONG);
  const [pindah, setPindah] = useState<{ id: number; toko: string; tanggal: string } | null>(null);

  const muat = useCallback(async () => {
    const [rk, rt] = await Promise.all([fetch('/api/admin/master/karyawan'), fetch('/api/admin/master/toko')]);
    if (!rk.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(rk, 'Gagal memuat karyawan.') });
      return;
    }
    const kry = ((await rk.json()).data as Karyawan[]);
    setDaftar(kry);
    const toko = rt.ok ? ((await rt.json()).data as Toko[]) : [];
    setDaftarToko(toko);
    const namaToko = new Map(toko.map((t) => [t.id, t.nama]));
    // Toko saat ini + link per karyawan.
    const petaToko: Record<number, string> = {};
    const petaLink: Record<number, InfoLink | null> = {};
    await Promise.all(
      kry.map(async (k) => {
        const rp = await fetch(`/api/admin/master/penempatan?karyawan_id=${k.id}`);
        if (rp.ok) {
          const riwayat = ((await rp.json()).data as Penempatan[]);
          const terbuka = riwayat.find((p) => p.berlaku_sampai === null);
          petaToko[k.id] = terbuka ? (namaToko.get(terbuka.toko_id) ?? `Toko ${terbuka.toko_id}`) : '—';
        }
        const rl = await fetch(`/api/admin/master/link?karyawan_id=${k.id}`);
        petaLink[k.id] = rl.ok ? ((await rl.json()).data as InfoLink | null) : null;
      }),
    );
    setTokoKaryawan(petaToko);
    setLinkKaryawan(petaLink);
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const tampil = daftar.filter((k) => `${k.nama} ${k.nik ?? ''}`.toLowerCase().includes(cari.toLowerCase()));

  function nilaiAtauNull(v: string): string | null {
    return v === '' ? null : v;
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/master/karyawan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: form.nama,
        nik: nilaiAtauNull(form.nik),
        jabatan: nilaiAtauNull(form.jabatan),
        alamat: nilaiAtauNull(form.alamat),
        nomor_hp: nilaiAtauNull(form.nomor_hp),
        kontak_darurat: nilaiAtauNull(form.kontak_darurat),
      }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal menambah karyawan.') });
      return;
    }
    setForm(KOSONG);
    setPesan({ jenis: 'sukses', teks: 'Karyawan berhasil ditambah.' });
    muat();
  }

  async function simpanSunting(id: number) {
    const res = await fetch(`/api/admin/master/karyawan/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: sunting.nama,
        nik: nilaiAtauNull(sunting.nik),
        jabatan: nilaiAtauNull(sunting.jabatan),
        alamat: nilaiAtauNull(sunting.alamat),
        nomor_hp: nilaiAtauNull(sunting.nomor_hp),
        kontak_darurat: nilaiAtauNull(sunting.kontak_darurat),
      }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah karyawan.') });
      return;
    }
    setSuntingId(null);
    setPesan({ jenis: 'sukses', teks: 'Karyawan berhasil diubah.' });
    muat();
  }

  async function alihAktif(k: Karyawan) {
    const res = await fetch(`/api/admin/master/karyawan/${k.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: k.aktif === 1 ? 0 : 1 }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mengubah status karyawan.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: k.aktif === 1 ? 'Karyawan dinonaktifkan.' : 'Karyawan diaktifkan kembali.' });
    muat();
  }

  async function buatLink(id: number) {
    const res = await fetch('/api/admin/master/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: id }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal membuat link.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: 'Link berhasil dibuat.' });
    muat();
  }

  async function buatUlangLink(id: number) {
    if (!window.confirm('Buat ulang link? Link lama langsung tidak berlaku.')) return;
    const res = await fetch('/api/admin/master/link/buat-ulang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: id }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal membuat ulang link.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: 'Link lama dicabut, link baru berlaku.' });
    muat();
  }

  async function cabutLink(id: number) {
    if (!window.confirm('Cabut link? Karyawan tidak bisa absen sampai link baru dibuat.')) return;
    const res = await fetch('/api/admin/master/link/cabut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: id }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal mencabut link.') });
      return;
    }
    setPesan({ jenis: 'sukses', teks: 'Link berhasil dicabut.' });
    muat();
  }

  async function kirimPindah(e: React.FormEvent) {
    e.preventDefault();
    if (!pindah) return;
    const res = await fetch('/api/admin/master/penempatan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: pindah.id, toko_tujuan_id: Number(pindah.toko), tanggal_efektif: pindah.tanggal }),
    });
    if (!res.ok) {
      setPesan({ jenis: 'galat', teks: await pesanGalat(res, 'Gagal memindah karyawan.') });
      return;
    }
    setPindah(null);
    setPesan({ jenis: 'sukses', teks: 'Karyawan berhasil dipindah.' });
    muat();
  }

  async function salin(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setPesan({ jenis: 'sukses', teks: 'Link disalin.' });
    } catch {
      setPesan({ jenis: 'galat', teks: 'Gagal menyalin. Salin manual dari kolom link.' });
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Data Master — Karyawan</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />

      <form onSubmit={tambah} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16, background: '#fff', padding: 12, border: '1px solid #ddd' }}>
        <label>Nama*<br /><input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required maxLength={200} style={{ padding: 8, width: '90%' }} /></label>
        <label>NIK<br /><input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} maxLength={50} style={{ padding: 8, width: '90%' }} /></label>
        <label>Jabatan<br /><input value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} maxLength={500} style={{ padding: 8, width: '90%' }} /></label>
        <label>Alamat<br /><input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} maxLength={500} style={{ padding: 8, width: '90%' }} /></label>
        <label>Nomor HP<br /><input value={form.nomor_hp} onChange={(e) => setForm({ ...form, nomor_hp: e.target.value })} maxLength={500} style={{ padding: 8, width: '90%' }} /></label>
        <label>Kontak darurat<br /><input value={form.kontak_darurat} onChange={(e) => setForm({ ...form, kontak_darurat: e.target.value })} maxLength={500} style={{ padding: 8, width: '90%' }} /></label>
        <div><br /><button type="submit" style={{ padding: '8px 16px' }}>Tambah</button></div>
      </form>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cari">Cari: </label>
        <input id="cari" defaultValue={cari} onChange={(e) => router.replace(`/admin/master/karyawan?cari=${encodeURIComponent(e.target.value)}`)} placeholder="Filter nama/NIK" style={{ padding: 8 }} />
      </div>

      {tampil.length === 0 ? (
        <p>Belum ada karyawan.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Nama</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>NIK</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Jabatan</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>No. HP</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Toko saat ini</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Link</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((k) => {
                const link = linkKaryawan[k.id];
                return (
                  <tr key={k.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      {suntingId === k.id ? (
                        <input value={sunting.nama} onChange={(e) => setSunting({ ...sunting, nama: e.target.value })} aria-label="Nama karyawan" style={{ padding: 6 }} />
                      ) : (
                        <>{k.nama} {k.aktif === 1 ? null : <em>(Nonaktif)</em>}</>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{k.nik ?? '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{k.jabatan ?? '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{k.nomor_hp ?? '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{tokoKaryawan[k.id] ?? '…'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {link ? (
                        <span title={link.url} style={{ fontSize: 12 }}>{link.url}</span>
                      ) : (
                        <span style={{ color: '#888' }}>Belum ada link</span>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {suntingId === k.id ? (
                          <>
                            <button type="button" onClick={() => simpanSunting(k.id)}>Simpan</button>
                            <button type="button" onClick={() => setSuntingId(null)}>Batal</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => { setSuntingId(k.id); setSunting({ nama: k.nama, nik: k.nik ?? '', jabatan: k.jabatan ?? '', alamat: k.alamat ?? '', nomor_hp: k.nomor_hp ?? '', kontak_darurat: k.kontak_darurat ?? '' }); }}>Ubah</button>
                        )}
                        <button type="button" onClick={() => alihAktif(k)}>{k.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button type="button" onClick={() => setPindah({ id: k.id, toko: '', tanggal: '' })}>Pindahkan</button>
                        {link ? (
                          <>
                            <button type="button" onClick={() => salin(link.url)}>Salin</button>
                            <button type="button" onClick={() => buatUlangLink(k.id)}>Buat Ulang</button>
                            <button type="button" onClick={() => cabutLink(k.id)}>Cabut</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => buatLink(k.id)}>Buat Link</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pindah ? (
        <form onSubmit={kirimPindah} style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid #ddd', display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label>Toko tujuan<br />
              <select value={pindah.toko} onChange={(e) => setPindah({ ...pindah, toko: e.target.value })} required style={{ padding: 8 }}>
                <option value="">— Pilih —</option>
                {daftarToko.filter((t) => t.aktif === 1).map((t) => (
                  <option key={t.id} value={t.id}>{t.nama}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>Tanggal efektif<br /><input type="date" value={pindah.tanggal} onChange={(e) => setPindah({ ...pindah, tanggal: e.target.value })} required style={{ padding: 8 }} /></label>
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Pindah</button>
          <button type="button" onClick={() => setPindah(null)}>Batal</button>
        </form>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanKaryawan />
    </Suspense>
  );
}
