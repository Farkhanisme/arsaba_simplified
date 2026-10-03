/**
 * M9 Audit Log — halaman /admin/audit-log (rules/05 §5.10).
 *
 * Semua tes me-render komponen sungguhan lewat renderToStaticMarkup.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FilterAudit,
  IsiDialogDetail,
  NavigasiHalaman,
  TabelAudit,
  formatWaktuAudit,
  ringkasanAudit,
  uraikanJson,
  type BarisAudit,
} from '../src/app/admin/audit-log/komponen';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

function tagTanpaSlot(html: string): string[] {
  const semua = [...html.matchAll(/<(table|select|input|textarea|button)[^>]*>/g)].map((m) => m[0]);
  return semua.filter((t) => !t.includes('data-slot'));
}

function baris(ubah: Partial<BarisAudit> = {}): BarisAudit {
  return {
    id: 7,
    waktu: '2026-09-02T09:05:00+07:00',
    pengguna_id: 1,
    pengguna_nama: 'Super Admin Awal',
    aksi: 'TOKO_TAMBAH',
    entitas: 'toko',
    entitas_id: 3,
    sebelum: null,
    sesudah: '{"nama":"Toko Melati"}',
    catatan: 'Toko Melati dibuka.',
    ...ubah,
  };
}

describe('fungsi murni audit-log', () => {
  it('formatWaktuAudit memakai dd/MM/yyyy HH:mm WIB', () => {
    expect(formatWaktuAudit('2026-09-02T09:05:00+07:00')).toBe('02/09/2026 09:05 WIB');
  });

  it('ringkasan memakai catatan bila ada, kalau tidak aksi + entitas', () => {
    expect(ringkasanAudit(baris())).toBe('Toko Melati dibuka.');
    expect(ringkasanAudit(baris({ catatan: null }))).toBe('TOKO_TAMBAH · toko #3');
    expect(ringkasanAudit(baris({ catatan: '  ', entitas_id: null }))).toBe('TOKO_TAMBAH · toko');
  });

  it('uraikanJson tidak pernah melempar (null, kosong, rusak)', () => {
    expect(uraikanJson(null)).toEqual({ ada: false, cantik: '—' });
    expect(uraikanJson('  ')).toEqual({ ada: false, cantik: '—' });
    expect(uraikanJson('{"a":1}').cantik).toContain('"a": 1');
    expect(uraikanJson('{rusak').cantik).toBe('{rusak');
  });
});

describe('TabelAudit (§5.10: waktu · pelaku · aksi · entitas · ringkasan)', () => {
  it('kelima kolom ada dengan isi yang benar', () => {
    const html = render(h(TabelAudit, { baris: [baris()], onBuka: tidakAda }));
    for (const kolom of ['Waktu', 'Pelaku', 'Aksi', 'Entitas', 'Ringkasan']) {
      expect(html, kolom).toContain(kolom);
    }
    expect(html).toContain('02/09/2026 09:05 WIB');
    expect(html).toContain('Super Admin Awal');
    expect(html).toContain('TOKO_TAMBAH');
    expect(html).toContain('toko');
    expect(html).toContain('Toko Melati dibuka.');
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('aria-label="Lihat detail audit 7"');
  });

  it('pelaku null tampil sebagai em-dash', () => {
    const html = render(h(TabelAudit, { baris: [baris({ pengguna_nama: null })], onBuka: tidakAda }));
    expect(html).toContain('—');
  });

  it('empty state berbahasa Indonesia', () => {
    expect(render(h(TabelAudit, { baris: [], onBuka: tidakAda }))).toContain(
      'Belum ada catatan audit pada filter ini.',
    );
  });

  it('TIDAK ADA tombol Ubah, Hapus, atau Simpan di seluruh HTML', () => {
    const html = render(h(TabelAudit, { baris: [baris()], onBuka: tidakAda }));
    const teks = html.replace(/<[^>]*>/g, ' ');
    expect(teks).not.toMatch(/Ubah|Hapus|Simpan/);
  });

  it('tidak ada elemen polos', () => {
    expect(tagTanpaSlot(render(h(TabelAudit, { baris: [baris()], onBuka: tidakAda })))).toEqual([]);
  });
});

describe('FilterAudit (waktu, pelaku, aksi, entitas)', () => {
  const opsi = { aksi: ['LOGIN_GAGAL', 'TOKO_TAMBAH'], entitas: ['toko'], pelaku: [{ id: 1, nama: 'Super Admin Awal' }] };
  const nilai = { dari: '', sampai: '', pengguna_id: '', aksi: '', entitas: '' };

  it('lima field berlabel dengan NativeSelect beropsi Semua', () => {
    const html = render(h(FilterAudit, { nilai, opsi, onUbah: tidakAda }));
    for (const id of ['audit-dari', 'audit-sampai', 'audit-pelaku', 'audit-aksi', 'audit-entitas']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html.match(/>Semua</g) ?? []).toHaveLength(3);
    expect(html).toContain('>LOGIN_GAGAL<');
    expect(html).toContain('>Super Admin Awal<');
    expect(html.match(/data-slot="native-select"/g) ?? []).toHaveLength(3);
    expect(html.match(/type="date"/g) ?? []).toHaveLength(2);
  });

  it('tidak ada elemen polos', () => {
    expect(tagTanpaSlot(render(h(FilterAudit, { nilai, opsi, onUbah: tidakAda })))).toEqual([]);
  });
});

describe('NavigasiHalaman (Menampilkan X–Y dari Z)', () => {
  it('teks jumlah + tombol Sebelumnya/Berikutnya', () => {
    const html = render(h(NavigasiHalaman, { offset: 0, limit: 50, total: 120, onUbah: tidakAda }));
    expect(html).toContain('Menampilkan 1–50 dari 120');
    expect(html).toContain('Sebelumnya');
    expect(html).toContain('Berikutnya');
  });

  it('halaman pertama mengunci Sebelumnya, halaman terakhir mengunci Berikutnya', () => {
    const awal = render(h(NavigasiHalaman, { offset: 0, limit: 50, total: 120, onUbah: tidakAda }));
    const tombolAwal = [...awal.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(tombolAwal[0]).toContain('disabled=""');
    expect(tombolAwal[1]).not.toContain('disabled=""');
    const akhir = render(h(NavigasiHalaman, { offset: 100, limit: 50, total: 120, onUbah: tidakAda }));
    expect(akhir).toContain('Menampilkan 101–120 dari 120');
    const tombolAkhir = [...akhir.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(tombolAkhir[1]).toContain('disabled=""');
  });
});

describe('IsiDialogDetail (sebelum/sesudah tahan JSON rusak)', () => {
  it('menampilkan pelaku, entitas, catatan, dan JSON rapi', () => {
    const html = render(h(IsiDialogDetail, { baris: baris() }));
    expect(html).toContain('Audit #7');
    expect(html).toContain('Super Admin Awal');
    expect(html).toContain('toko #3');
    expect(html).toContain('Toko Melati dibuka.');
    expect(html).toContain('Sebelum');
    expect(html).toContain('Sesudah');
    expect(html).toContain('&quot;nama&quot;');
  });

  it('null dan JSON rusak tidak mengosongkan dialog', () => {
    const html = render(h(IsiDialogDetail, { baris: baris({ sebelum: null, sesudah: '{rusak', catatan: null }) }));
    expect(html).toContain('—');
    expect(html).toContain('{rusak');
    expect(html).not.toContain('Toko Melati dibuka.');
  });
});
