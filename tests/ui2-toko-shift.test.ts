/**
 * UI-2 Data Master Toko + Shift (§5.7).
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FilterCariToko,
  FormulirTambahToko,
  TabelToko,
} from '../src/app/admin/master/toko/komponen';
import {
  BantuanShift,
  FilterTokoShift,
  FormulirSuntingShift,
  FormulirTambahShift,
  LABEL_TIPE,
  TabelShift,
} from '../src/app/admin/master/shift/komponen';

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

describe('Toko (§5.7: tambah/ubah nama, nonaktifkan, tanpa field lain)', () => {
  const daftar = [
    { id: 1, nama: 'Toko Melati', aktif: 1, dibuat_at: 'x' },
    { id: 2, nama: 'Toko Anggrek', aktif: 0, dibuat_at: 'x' },
  ];

  it('formulir tambah: placeholder + tombol dari shadcn', () => {
    const html = render(h(FormulirTambahToko, { namaBaru: '', onUbahNama: tidakAda, onTambah: tidakAda }));
    expect(html).toContain('placeholder="Nama toko baru"');
    expect(html).toContain('>Tambah<');
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-slot="card"');
  });

  it('filter cari memakai Input berlabel', () => {
    const html = render(h(FilterCariToko, { cari: '', onUbahCari: tidakAda }));
    expect(html).toContain('for="cari"');
    expect(html).toContain('placeholder="Filter nama toko"');
    expect(html).toContain('data-slot="input"');
  });

  it('tabel: kolom Nama/Status/Aksi + Badge status + aksi lengkap', () => {
    const html = render(
      h(TabelToko, {
        daftar,
        suntingId: null,
        suntingNama: '',
        onUbahSuntingNama: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
      }),
    );
    for (const kolom of ['Nama', 'Status', 'Aksi']) expect(html).toContain(kolom);
    expect(html).toContain('Toko Melati');
    expect(html).toContain('>Aktif<');
    expect(html).toContain('>Nonaktif<');
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('data-slot="table-head"');
    expect(html).toContain('data-slot="badge"');
    for (const aksi of ['Ubah', 'Nonaktifkan', 'Aktifkan']) expect(html).toContain(aksi);
  });

  it('kosong persis "Belum ada toko."', () => {
    const html = render(
      h(TabelToko, {
        daftar: [],
        suntingId: null,
        suntingNama: '',
        onUbahSuntingNama: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
      }),
    );
    expect(html).toContain('Belum ada toko.');
  });

  it('mode sunting menampilkan Input bernama + Simpan/Batal', () => {
    const html = render(
      h(TabelToko, {
        daftar,
        suntingId: 1,
        suntingNama: 'Toko Melati Baru',
        onUbahSuntingNama: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
      }),
    );
    expect(html).toContain('aria-label="Nama toko"');
    expect(html).toContain('value="Toko Melati Baru"');
    expect(html).toContain('>Simpan<');
    expect(html).toContain('>Batal<');
  });

  it('tidak ada elemen polos pada formulir + tabel', () => {
    const html =
      render(h(FormulirTambahToko, { namaBaru: 'x', onUbahNama: tidakAda, onTambah: tidakAda })) +
      render(
        h(TabelToko, {
          daftar,
          suntingId: null,
          suntingNama: '',
          onUbahSuntingNama: tidakAda,
          onMulaiSunting: tidakAda,
          onBatalSunting: tidakAda,
          onSimpanSunting: tidakAda,
          onAlihAktif: tidakAda,
        }),
      );
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});

describe('Shift (§5.7: per toko, bantuan Semua hari, tabel template)', () => {
  const toko = [{ id: 1, nama: 'Toko Melati', aktif: 1 }];
  const daftar = [
    { id: 1, toko_id: 1, nama: 'Pagi', tipe_hari: 'SEMUA' as const, jam_mulai: '07:00', jam_selesai: '15:00', aktif: 1 },
  ];

  it('label tipe mencakup tiga varian Indonesia', () => {
    expect(LABEL_TIPE.SEMUA).toContain('Semua hari');
    expect(LABEL_TIPE.WEEKDAY).toContain('Weekday');
    expect(LABEL_TIPE.WEEKEND).toContain('Weekend');
  });

  it('filter toko memakai NativeSelect dengan opsi pilih', () => {
    const html = render(h(FilterTokoShift, { tokoId: '', daftarToko: toko, onUbah: tidakAda }));
    expect(html).toContain('for="filter-toko"');
    expect(html).toContain('data-slot="native-select"');
    expect(html).toContain('— Pilih toko —');
    expect(html).toContain('>Toko Melati<');
  });

  it('bantuan Semua hari tampil persis', () => {
    const html = render(h(BantuanShift));
    expect(html).toContain('Pilih “Semua hari” bila jam sama setiap hari');
  });

  it('formulir tambah: Nama/Tipe/Jam + Tambah, NativeSelect berlabel', () => {
    const html = render(
      h(FormulirTambahShift, {
        form: { nama: '', tipe_hari: 'SEMUA', jam_mulai: '', jam_selesai: '' },
        onUbah: tidakAda,
        onTambah: tidakAda,
      }),
    );
    expect(html).toContain('for="nama"');
    expect(html).toContain('for="tipe"');
    expect(html).toContain('type="time"');
    expect(html).toContain('>Semua hari<');
    expect(html).toContain('>Weekday<');
    expect(html).toContain('>Weekend<');
    expect(html).toContain('>Tambah<');
    // Kode enum hanya sebagai value, teks terlihat berbahasa Indonesia.
    const teks = html.replace(/value="[^"]*"/g, '').replace(/<[^>]*>/g, '');
    expect(teks).not.toMatch(/SEMUA|WEEKDAY|WEEKEND/);
  });

  it('tabel shift: Nama/Tipe/Jam + WIB + Ubah; kosong dua kalimat', () => {
    const html = render(h(TabelShift, { daftar, adaTokoDipilih: true, onMintaSunting: tidakAda }));
    for (const kolom of ['Nama', 'Tipe hari', 'Jam', 'Aksi']) expect(html).toContain(kolom);
    expect(html).toContain('07:00–15:00 WIB');
    expect(html).toContain('>Ubah<');
    expect(render(h(TabelShift, { daftar: [], adaTokoDipilih: true, onMintaSunting: tidakAda }))).toContain(
      'Belum ada shift di toko ini.',
    );
    expect(render(h(TabelShift, { daftar: [], adaTokoDipilih: false, onMintaSunting: tidakAda }))).toContain(
      'Pilih toko untuk melihat shift.',
    );
  });

  it('formulir sunting: Simpan + Batal dengan Input waktu', () => {
    const html = render(
      h(FormulirSuntingShift, { sunting: daftar[0]!, onUbah: tidakAda, onBatal: tidakAda, onSimpan: tidakAda }),
    );
    expect(html).toContain('Ubah shift');
    expect(html).toContain('>Simpan<');
    expect(html).toContain('>Batal<');
    expect((html.match(/type="time"/g) ?? []).length).toBe(2);
  });

  it('tidak ada elemen polos', () => {
    const html =
      render(h(FilterTokoShift, { tokoId: '1', daftarToko: toko, onUbah: tidakAda })) +
      render(h(TabelShift, { daftar, adaTokoDipilih: true, onMintaSunting: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});
