/**
 * M9-01 s.d. M9-04 — celah tes yang ditemukan audit independen (rules/19).
 * Setiap butir dibuktikan dengan mutasi (lihat laporan).
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PesanButuhTemplate, PanelSel } from '../src/app/admin/jadwal/komponen';
import { DaftarKosong } from '../src/app/admin/verifikasi/komponen';
import { FormulirTambahAkun, FormulirResetPassword } from '../src/app/admin/akun/komponen';
import { FormulirTambahToko, TabelToko } from '../src/app/admin/master/toko/komponen';
import { FormulirTambahShift, FormulirSuntingShift } from '../src/app/admin/master/shift/komponen';
import { FormulirTambahKaryawan, KOSONG } from '../src/app/admin/master/karyawan/komponen';
import { FormulirTandai, IsiDialogUbah } from '../src/app/admin/tidak-berangkat/komponen';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('M9-01 — arahan template kosong jadwal (rules/05 §5.4)', () => {
  it('kalimat persis, bisa dirender dari komponen', () => {
    expect(render(h(PesanButuhTemplate))).toContain(
      'Minta Super Admin menambah template di Data Master › Shift.',
    );
  });
});

describe('M9-02 — kosong verifikasi (rules/05 §5.3, kata per kata)', () => {
  it('kalimat persis, bisa dirender dari komponen', () => {
    expect(render(h(DaftarKosong))).toContain('Tidak ada absensi yang menunggu verifikasi.');
  });
});

describe('M9-05 — Panel sel punya nama aksesibel', () => {
  it('PanelSel memakai aria-label="Panel sel"', () => {
    const html = render(
      h(PanelSel, {
        tanggal: '2026-10-13',
        jadwalSel: null,
        templateCocok: [],
        panelTemplate: '',
        panelMode: 'lewati',
        ovBaru: false,
        ovSlots: [{ nama: '', jam_mulai: '', jam_selesai: '' }],
        ovCatatan: '',
        ovPeringatan: [],
        onUbahTemplate: tidakAda,
        onUbahMode: tidakAda,
        onSimpan: tidakAda,
        onMintaUbahKhusus: tidakAda,
        onKembaliStandar: tidakAda,
        onTutup: tidakAda,
        onUbahOvSlots: tidakAda,
        onUbahOvCatatan: tidakAda,
        onTambahSlot: tidakAda,
        onHapusSlot: tidakAda,
        onSimpanOverride: tidakAda,
        onBatalOverride: tidakAda,
      }),
    );
    expect(html).toContain('aria-label="Panel sel"');
  });
});

describe('M9-03 — batas maxLength sisi klien (16 titik)', () => {
  it('toko: tambah dan sunting dibatasi 100', () => {
    expect(
      render(h(FormulirTambahToko, { namaBaru: '', onUbahNama: tidakAda, onTambah: tidakAda })),
    ).toContain('maxLength="100"');
    const html = render(
      h(TabelToko, {
        daftar: [{ id: 1, nama: 'T', aktif: 1, dibuat_at: 'x' }],
        suntingId: 1,
        suntingNama: 'T',
        onUbahSuntingNama: tidakAda,
        onMulaiSunting: tidakAda,
        onBatalSunting: tidakAda,
        onSimpanSunting: tidakAda,
        onAlihAktif: tidakAda,
      }),
    );
    expect(html).toContain('maxLength="100"');
  });

  it('shift: tambah dan sunting dibatasi 100', () => {
    const tambah = render(
      h(FormulirTambahShift, {
        form: { nama: '', tipe_hari: 'SEMUA', jam_mulai: '', jam_selesai: '' },
        onUbah: tidakAda,
        onTambah: tidakAda,
      }),
    );
    expect(tambah).toContain('maxLength="100"');
    const sunting = render(
      h(FormulirSuntingShift, {
        sunting: { id: 1, toko_id: 1, nama: 'P', tipe_hari: 'SEMUA', jam_mulai: '07:00', jam_selesai: '15:00', aktif: 1 },
        onUbah: tidakAda,
        onBatal: tidakAda,
        onSimpan: tidakAda,
      }),
    );
    expect(sunting).toContain('maxLength="100"');
  });

  it('karyawan: nama 200, NIK 50, empat field 500', () => {
    const html = render(h(FormulirTambahKaryawan, { form: KOSONG, onUbah: tidakAda, onTambah: tidakAda }));
    expect(html).toContain('maxLength="200"');
    expect(html).toContain('maxLength="50"');
    expect(html.match(/maxLength="500"/g) ?? []).toHaveLength(4);
  });

  it('akun: username 50, nama 200', () => {
    const html = render(
      h(FormulirTambahAkun, {
        form: { username: '', password: '', nama: '', peran: 'ADMIN' },
        onUbah: tidakAda,
        onTambah: tidakAda,
      }),
    );
    expect(html).toContain('maxLength="50"');
    expect(html).toContain('maxLength="200"');
  });

  it('tidak-berangkat: catatan formulir dan dialog dibatasi 500', () => {
    const form = render(
      h(FormulirTandai, {
        pilihanKaryawan: [],
        form: { karyawan: [], dari: '', sampai: '', jenis: 'IZIN', catatan: '' },
        onUbah: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(form).toContain('maxLength="500"');
    const dialog = render(
      h(IsiDialogUbah, {
        ubah: { id: 1, jenis: 'IZIN', catatan: '' },
        onUbah: tidakAda,
        onBatal: tidakAda,
        onSimpan: tidakAda,
      }),
    );
    expect(dialog).toContain('maxLength="500"');
  });

  it('jadwal khusus: nama slot 100 dan catatan 500', () => {
    const html = render(
      h(PanelSel, {
        tanggal: '2026-10-13',
        jadwalSel: null,
        templateCocok: [],
        panelTemplate: '',
        panelMode: 'lewati',
        ovBaru: true,
        ovSlots: [{ nama: '', jam_mulai: '', jam_selesai: '' }],
        ovCatatan: '',
        ovPeringatan: [],
        onUbahTemplate: tidakAda,
        onUbahMode: tidakAda,
        onSimpan: tidakAda,
        onMintaUbahKhusus: tidakAda,
        onKembaliStandar: tidakAda,
        onTutup: tidakAda,
        onUbahOvSlots: tidakAda,
        onUbahOvCatatan: tidakAda,
        onTambahSlot: tidakAda,
        onHapusSlot: tidakAda,
        onSimpanOverride: tidakAda,
        onBatalOverride: tidakAda,
      }),
    );
    expect(html).toContain('maxLength="100"');
    expect(html).toContain('maxLength="500"');
  });
});

describe('M9-04 — teks petunjuk (min 8), K-48', () => {
  it('formulir tambah dan reset menampilkan "(min 8)"', () => {
    const tambah = render(
      h(FormulirTambahAkun, {
        form: { username: '', password: '', nama: '', peran: 'ADMIN' },
        onUbah: tidakAda,
        onTambah: tidakAda,
      }),
    );
    expect(tambah).toContain('(min 8)');
    const reset = render(
      h(FormulirResetPassword, {
        reset: { id: 1, username: 'a', password: '' },
        onUbahPassword: tidakAda,
        onBatal: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(reset).toContain('(min 8)');
  });
});
