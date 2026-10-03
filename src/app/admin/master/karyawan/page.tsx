'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toast, pesanGalat, AksesDitolak, adalahAksesDitolak, type Pesan } from '../../komponen';
import {
  FilterCariKaryawan,
  FormulirPindah,
  FormulirTambahKaryawan,
  KOSONG,
  TabelKaryawan,
  type FormulirKaryawan,
  type InfoLink,
  type Karyawan,
  type Toko,
} from './komponen';

interface Penempatan {
  toko_id: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
}

function HalamanKaryawan() {
  const router = useRouter();
  const params = useSearchParams();
  const cari = params.get('cari') ?? '';
  const [daftar, setDaftar] = useState<Karyawan[]>([]);
  const [daftarToko, setDaftarToko] = useState<Toko[]>([]);
  const [tokoKaryawan, setTokoKaryawan] = useState<Record<number, string>>({});
  const [linkKaryawan, setLinkKaryawan] = useState<Record<number, InfoLink | null>>({});
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [form, setForm] = useState<FormulirKaryawan>(KOSONG);
  const [suntingId, setSuntingId] = useState<number | null>(null);
  const [sunting, setSunting] = useState<FormulirKaryawan>(KOSONG);
  const [pindah, setPindah] = useState<{ id: number; toko: string; tanggal: string } | null>(null);

  const muat = useCallback(async () => {
    const [rk, rt] = await Promise.all([fetch('/api/admin/master/karyawan'), fetch('/api/admin/master/toko')]);
    if (!rk.ok) {
      if (await adalahAksesDitolak(rk)) {
        setAksesDitolak(true);
        return;
      }
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
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Data Master — Karyawan</h1>
      <Toast pesan={pesan} onTutup={() => setPesan(null)} />
      {aksesDitolak ? <AksesDitolak /> : null}

      <FormulirTambahKaryawan
        form={form}
        onUbah={(sebagian) => setForm({ ...form, ...sebagian })}
        onTambah={tambah}
      />

      <FilterCariKaryawan
        cari={cari}
        onUbahCari={(nilai) => router.replace(`/admin/master/karyawan?cari=${encodeURIComponent(nilai)}`)}
      />

      <TabelKaryawan
        daftar={tampil}
        tokoKaryawan={tokoKaryawan}
        linkKaryawan={linkKaryawan}
        suntingId={suntingId}
        sunting={sunting}
        onUbahSunting={setSunting}
        onMulaiSunting={(k) => {
          setSuntingId(k.id);
          setSunting({
            nama: k.nama,
            nik: k.nik ?? '',
            jabatan: k.jabatan ?? '',
            alamat: k.alamat ?? '',
            nomor_hp: k.nomor_hp ?? '',
            kontak_darurat: k.kontak_darurat ?? '',
          });
        }}
        onBatalSunting={() => setSuntingId(null)}
        onSimpanSunting={simpanSunting}
        onAlihAktif={alihAktif}
        onMintaPindah={(k) => setPindah({ id: k.id, toko: '', tanggal: '' })}
        onBuatLink={buatLink}
        onSalin={salin}
        onBuatUlangLink={buatUlangLink}
        onCabutLink={cabutLink}
      />

      {pindah ? (
        <FormulirPindah
          daftarToko={daftarToko}
          pindah={pindah}
          onUbah={setPindah}
          onBatal={() => setPindah(null)}
          onKirim={kirimPindah}
        />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
      <HalamanKaryawan />
    </Suspense>
  );
}
