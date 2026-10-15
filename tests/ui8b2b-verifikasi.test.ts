/**
 * UI-8 B2b — verifikasi: bar aksi massal menempel + foto mini 56px.
 *
 * Dua-duanya murni presentasi di `komponen.tsx`: tidak ada prop, fetch, atau
 * endpoint yang berubah. Kontrak lama (2 tombol, destructive di Tolak, src foto
 * + aria-label) ditegaskan ulang di sini supaya perubahan visual tidak diam-diam
 * melonggarkan perilaku.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KartuVerifikasi,
  PanelAksiMassal,
  type Baris,
} from '../src/app/admin/verifikasi/komponen';

const tidakAda = () => {};

function baris(ubah: Partial<Baris> = {}): Baris {
  return {
    id: 101,
    karyawan_id: 7,
    karyawan_nama: 'Siti Rahma',
    toko_id: 3,
    toko_nama: 'toko melati',
    tanggal: '2026-10-03',
    jenis: 'CHECKIN',
    checkin_id: null,
    waktu: '2026-10-03T07:12:00+07:00',
    sumber: 'SISTEM',
    foto_file_id: 'abc',
    lat: -6.2,
    lng: 106.816666,
    lokasi_status: 'AKURAT',
    status: 'MENUNGGU',
    alasan_tolak: null,
    keterangan: null,
    keterlambatan_final_menit: null,
    alasan_koreksi: null,
    keterlambatan: { n: 1, slot: { nama: 'pagi', jam_mulai: '07:00', jam_selesai: '15:00' }, selisih: 12, terlambatSistem: true },
    ...ubah,
  };
}

const bersama = {
  terpilih: false,
  onPilih: tidakAda,
  onLihatFoto: tidakAda,
  nilaiFinal: '',
  onUbahFinal: tidakAda,
  onSetujui: tidakAda,
  onTolak: tidakAda,
  onKoreksi: tidakAda,
};

describe('UI-8 B2b · bar aksi massal menempel', () => {
  it('menempel di bawah (sticky bottom-3) TANPA mengubah isi: badge + 2 tombol', () => {
    const html = renderToStaticMarkup(h(PanelAksiMassal, { jumlah: 4, onSetujui: tidakAda, onTolak: tidakAda }));
    expect(html).toContain('4 dipilih');
    expect(html).toContain('Setujui terpilih');
    expect(html).toContain('Tolak terpilih');
    expect((html.match(/data-slot="button"/g) ?? []).length).toBe(2);
    expect(html).toMatch(/\bsticky\b/);
    expect(html).toMatch(/\bbottom-3\b/);
  });

  it('tetap di bawah dialog/lightbox (z-20), bukan menutupinya', () => {
    const html = renderToStaticMarkup(h(PanelAksiMassal, { jumlah: 1, onSetujui: tidakAda, onTolak: tidakAda }));
    expect(html).toMatch(/\bz-20\b/);
    expect(html).not.toMatch(/\bz-50\b/);
  });
});

describe('UI-8 B2b · foto mini 56px', () => {
  it('img 56×56 dengan src dan aria-label yang sama', () => {
    const html = renderToStaticMarkup(h(KartuVerifikasi, { ...bersama, b: baris({ id: 555 }) }));
    expect(html).toContain('src="/api/foto/555"');
    expect(html).toContain('aria-label="Lihat foto 555"');
    expect(html).toContain('width="56"');
    expect(html).toContain('height="56"');
    expect(html).toMatch(/\bsize-14\b/);
    expect(html).not.toMatch(/\bsize-10\b/);
  });
});
