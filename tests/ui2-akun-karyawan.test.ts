/**
 * UI-2 Akun Admin (§5.8) + Karyawan (§5.7).
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FormulirResetPassword,
  FormulirTambahAkun,
  LabelPeran,
  PanelPasswordSekali,
  TabelAkun,
} from '../src/app/admin/akun/komponen';
import {
  FilterCariKaryawan,
  FormulirPindah,
  FormulirTambahKaryawan,
  KOSONG,
  TabelKaryawan,
} from '../src/app/admin/master/karyawan/komponen';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

/**
 * Elemen polos = tag table/select/input/textarea/button TANPA data-slot.
 * Komponen shadcn me-render tag asli DENGAN data-slot — itu yang benar dan
 * harus lolos. Pola lama `not.toMatch(/<(table|...)`) salah menolak shadcn.
 */
function tagTanpaSlot(html: string): string[] {
  const semua = [...html.matchAll(/<(table|select|input|textarea|button)[^>]*>/g)].map((m) => m[0]);
  return semua.filter((t) => !t.includes('data-slot'));
}

describe('Akun (§5.8: tambah + password min 8 + sekali tampil)', () => {
  const daftar = [
    { id: 1, username: 'superadmin', nama: 'Super', peran: 'SUPER_ADMIN' as const, aktif: 1 },
    { id: 2, username: 'admin', nama: 'Admin', peran: 'ADMIN' as const, aktif: 0 },
  ];

  it('peran berlabel Indonesia lewat Badge, bukan kode enum', () => {
    const superHtml = render(h(LabelPeran, { peran: 'SUPER_ADMIN' }));
    expect(superHtml).toContain('Super Admin');
    expect(superHtml).toContain('data-slot="badge"');
    const adminHtml = render(h(LabelPeran, { peran: 'ADMIN' }));
    expect(adminHtml).toContain('>Admin<');
    const teks = (superHtml + adminHtml).replace(/value="[^"]*"/g, '').replace(/<[^>]*>/g, '');
    expect(teks).not.toMatch(/SUPER_ADMIN/);
  });

  it('password sekali tampil: nama akun + peringatan salin + Sembunyikan', () => {
    const html = render(
      h(PanelPasswordSekali, { info: { username: 'admin', password: 'rahasia123' }, onSembunyikan: tidakAda }),
    );
    expect(html).toContain('Password akun admin (ditampilkan sekali)');
    expect(html).toContain('rahasia123');
    expect(html).toContain('Salin sekarang');
    expect(html).toContain('>Sembunyikan<');
    expect(html).toContain('data-slot="alert"');
  });

  it('formulir tambah: Username/Password/Nama/Peran + minLength 8', () => {
    const html = render(
      h(FormulirTambahAkun, {
        form: { username: '', password: '', nama: '', peran: 'ADMIN' },
        onUbah: tidakAda,
        onTambah: tidakAda,
      }),
    );
    for (const id of ['akun-username', 'akun-password', 'akun-nama', 'akun-peran']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('type="password"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain('>Admin<');
    expect(html).toContain('>Super Admin<');
    expect(html).toContain('data-slot="native-select"');
  });

  it('tabel akun: Username/Nama/Peran/Status/Aksi + tiga tombol', () => {
    const html = render(h(TabelAkun, { daftar, onAlihAktif: tidakAda, onMintaReset: tidakAda, onBukaKunci: tidakAda }));
    for (const kolom of ['Username', 'Nama', 'Peran', 'Status', 'Aksi']) expect(html).toContain(kolom);
    expect(html).toContain('superadmin');
    for (const aksi of ['Nonaktifkan', 'Aktifkan', 'Reset Password', 'Buka Kunci']) expect(html).toContain(aksi);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('data-slot="badge"');
  });

  it('formulir reset: menyebut username + minLength 8 + Reset/Batal', () => {
    const html = render(
      h(FormulirResetPassword, {
        reset: { id: 2, username: 'admin', password: '' },
        onUbahPassword: tidakAda,
        onBatal: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(html).toContain('Reset password untuk admin');
    expect(html).toContain('minLength="8"');
    expect(html).toContain('>Reset<');
    expect(html).toContain('>Batal<');
  });

  it('tidak ada elemen polos', () => {
    const html =
      render(
        h(FormulirTambahAkun, {
          form: { username: 'a', password: 'b', nama: 'c', peran: 'ADMIN' },
          onUbah: tidakAda,
          onTambah: tidakAda,
        }),
      ) + render(h(TabelAkun, { daftar, onAlihAktif: tidakAda, onMintaReset: tidakAda, onBukaKunci: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});

describe('Karyawan (§5.7: enam field + pindah + link)', () => {
  const karyawan = [
    { id: 1, nama: 'Siti', nik: '123', jabatan: 'Kasir', alamat: null, nomor_hp: '081', kontak_darurat: null, aktif: 1 },
  ];

  it('formulir tambah memuat enam field berlabel', () => {
    const html = render(h(FormulirTambahKaryawan, { form: KOSONG, onUbah: tidakAda, onTambah: tidakAda }));
    for (const id of ['kry-nama', 'kry-nik', 'kry-jabatan', 'kry-alamat', 'kry-hp', 'kry-darurat']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('>Tambah<');
    expect((html.match(/data-slot="input"/g) ?? []).length).toBe(6);
  });

  it('filter cari + kosong persis "Belum ada karyawan."', () => {
    expect(render(h(FilterCariKaryawan, { cari: '', onUbahCari: tidakAda }))).toContain('Filter nama/NIK');
    const kosong = render(
      h(TabelKaryawan, {
        daftar: [],
        tokoKaryawan: {},
        linkKaryawan: {},
        suntingId: null,
        sunting: KOSONG,
        onUbahSunting: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
        onMintaPindah: tidakAda,
        onBuatLink: tidakAda,
        onSalin: tidakAda,
        onBuatUlangLink: tidakAda,
        onCabutLink: tidakAda,
      }),
    );
    expect(kosong).toContain('Belum ada karyawan.');
  });

  it('tabel: tujuh kolom + link + enam tombol link/pindah', () => {
    const html = render(
      h(TabelKaryawan, {
        daftar: karyawan,
        tokoKaryawan: { 1: 'Toko Melati' },
        linkKaryawan: { 1: { dibuat_at: 'x', url: 'https://arsaba.vercel.app/a/token123' } },
        suntingId: null,
        sunting: KOSONG,
        onUbahSunting: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
        onMintaPindah: tidakAda,
        onBuatLink: tidakAda,
        onSalin: tidakAda,
        onBuatUlangLink: tidakAda,
        onCabutLink: tidakAda,
      }),
    );
    for (const kolom of ['Nama', 'NIK', 'Jabatan', 'No. HP', 'Toko saat ini', 'Link', 'Aksi']) {
      expect(html, kolom).toContain(kolom);
    }
    expect(html).toContain('https://arsaba.vercel.app/a/token123');
    for (const aksi of ['Ubah', 'Nonaktifkan', 'Pindahkan', 'Salin', 'Buat Ulang', 'Cabut']) {
      expect(html, aksi).toContain(aksi);
    }
    expect(html).toContain('data-slot="table"');
  });

  it('tanpa link: "Belum ada link" + tombol Buat Link', () => {
    const html = render(
      h(TabelKaryawan, {
        daftar: karyawan,
        tokoKaryawan: {},
        linkKaryawan: {},
        suntingId: null,
        sunting: KOSONG,
        onUbahSunting: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
        onMintaPindah: tidakAda,
        onBuatLink: tidakAda,
        onSalin: tidakAda,
        onBuatUlangLink: tidakAda,
        onCabutLink: tidakAda,
      }),
    );
    expect(html).toContain('Belum ada link');
    expect(html).toContain('Buat Link');
  });

  it('formulir pindah: toko tujuan + tanggal efektif + Pindah/Batal', () => {
    const html = render(
      h(FormulirPindah, {
        daftarToko: [{ id: 2, nama: 'Toko Anggrek', aktif: 1 }],
        pindah: { id: 1, toko: '', tanggal: '' },
        onUbah: tidakAda,
        onBatal: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(html).toContain('Pindahkan karyawan');
    expect(html).toContain('Toko tujuan');
    expect(html).toContain('Tanggal efektif');
    expect(html).toContain('type="date"');
    expect(html).toContain('>Pindah<');
    expect(html).toContain('>Batal<');
  });

  it('tidak ada elemen polos', () => {
    const html = render(h(FormulirTambahKaryawan, { form: KOSONG, onUbah: tidakAda, onTambah: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});
