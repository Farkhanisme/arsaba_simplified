import { describe, it, expect, vi } from 'vitest';

// Runtime Next di-mock (bukan kode kita): useSearchParams/useRouter melempar
// di luar pohon Next. Yang diuji adalah halaman yang benar-benar dirender.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import HalamanJadwal, { PanelHasilMassal } from '../src/app/admin/jadwal/page';

describe('halaman /admin/jadwal benar-benar bisa dirender', () => {
  it('menampilkan mode Hari/Minggu/Bulan, filter toko, dan isi massal', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(HalamanJadwal));

    expect(html).toContain('Jadwal');
    // Mode tampil tiga pilihan (05 §5.4).
    for (const mode of ['Hari', 'Minggu', 'Bulan']) {
      expect(html, `mode ${mode} harus ada`).toContain(mode);
    }
    expect(html).toContain('Tanggal acuan');
    expect(html).toContain('Pilih toko');
    // Isi massal: pratinjau -> terapkan, mode lewati/timpa eksplisit (BR-J5).
    expect(html).toContain('Isi massal');
    expect(html).toContain('Pratinjau');
    expect(html).toContain('Lewati');
    expect(html).toContain('Timpa');
    // Keadaan kosong tanpa toko terpilih.
    expect(html).toContain('Pilih toko untuk melihat jadwal.');
  });

  it('panel hasil massal merender ditimpa beserta daftarnya (B-19)', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(
      createElement(PanelHasilMassal, {
        hasil: {
          baru: [{ karyawan_id: 1, tanggal: '2026-10-13' }],
          dilewati: [{ karyawan_id: 2, tanggal: '2026-10-13' }],
          ditimpa: [{ karyawan_id: 3, tanggal: '2026-10-14' }],
          ditolak: [{ karyawan_id: 4, tanggal: '2026-10-15', alasan: 'Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.' }],
        },
      }),
    );
    expect(html).toContain('1 dibuat, 1 ditimpa, 1 dilewati, 1 ditolak.');
    expect(html).toContain('(ditimpa)');
    expect(html).toContain('Karyawan #3');
    expect(html).toContain('Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.');
  });
});
