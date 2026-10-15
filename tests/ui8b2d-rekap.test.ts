/**
 * UI-8 B2d — rekap: alur 3 langkah eksplisit (1. Filter → 2. Pemeriksaan →
 * 3. Pratinjau & unduh).
 *
 * Hanya heading penanda urutan; isi, href terfilter, dan status disabled
 * tombol tidak berubah (dikunci tes lama UI-2/M8). Urutan dibuktikan lewat
 * posisi indeks di HTML, bukan sekadar keberadaan teks.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterRekap, PanelRekap } from '../src/app/admin/rekap/komponen';

const tidakAda = () => {};

const dataLolos = {
  filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: null as number | null },
  pemeriksaan: { boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, jumlahAgendaMenunggu: 0, peringatan: 0 },
  ringkasan: [],
};

describe('UI-8 B2d · tiga langkah berurutan', () => {
  it('filter berlabel langkah 1', () => {
    const html = renderToStaticMarkup(
      h(FilterRekap, { dari: '', sampai: '', tokoId: '', tokoList: [], memuat: false, onUbah: tidakAda, onPeriksa: tidakAda }),
    );
    expect(html).toContain('1. Filter');
    expect(html).toContain('Periksa &amp; Buat Rekap');
  });

  it('pemeriksaan (2) tampil SEBELUM pratinjau & unduh (3)', () => {
    const html = renderToStaticMarkup(h(PanelRekap, { data: dataLolos, mengunduh: false, onUnduh: tidakAda }));
    const i2 = html.indexOf('2. Pemeriksaan');
    const i3 = html.indexOf('3. Pratinjau');
    expect(i2, 'ada heading langkah 2').toBeGreaterThanOrEqual(0);
    expect(i3, 'ada heading langkah 3').toBeGreaterThanOrEqual(0);
    expect(i2, 'pemeriksaan sebelum pratinjau').toBeLessThan(i3);
    // Isi lama utuh: status lolos + tombol unduh aktif.
    expect(html).toContain('Semua absensi dan agenda pada periode ini sudah diverifikasi.');
    expect(html).toContain('Unduh Excel (.xlsx)');
  });

  it('langkah 3 tampil juga saat ekspor diblokir (tombol mati, bukan hilang)', () => {
    const html = renderToStaticMarkup(
      h(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: null },
          pemeriksaan: { boleh: false, jumlahMenunggu: 2, jumlahCheckinTerbuka: 0, jumlahAgendaMenunggu: 0, peringatan: 0 },
          ringkasan: [],
        },
        mengunduh: false,
        onUnduh: tidakAda,
      }),
    );
    expect(html).toContain('2. Pemeriksaan');
    expect(html).toContain('3. Pratinjau');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });
});
