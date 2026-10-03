import { describe, it, expect, vi } from 'vitest';

// Halaman dashboard tidak memakai hook navigasi (tanpa pemilih tanggal),
// tapi mock tetap dipasang agar aman bila dependensi berubah.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import HalamanDashboard, { PanelDashboard } from '../src/app/admin/page';

function dataSepuluhToko() {
  return {
    tanggalPanjang: 'Jumat, 3 Okt 2026',
    antrean: 12,
    kartu: Array.from({ length: 10 }, (_, i) => ({
      toko_id: i + 1,
      toko_nama: `Toko ${i + 1}`,
      terjadwal: 2,
      sudah_absen: 1,
      terlambat: i === 0 ? 1 : 0,
      belum_absen: 1,
    })),
  };
}

describe('halaman /admin benar-benar bisa dirender', () => {
  it('menampilkan 10 kartu + antrean dengan tautan, tanpa pemilih tanggal', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(PanelDashboard, { data: dataSepuluhToko() }));

    // Tepat 10 kartu toko.
    expect(html.match(/aria-label="Toko /g) ?? []).toHaveLength(10);
    expect(html).toContain('Toko 10');
    // Kartu antrean dengan tautan ke Verifikasi (rules/05 §5.2).
    expect(html).toContain('Antrean verifikasi');
    expect(html).toContain('href="/admin/verifikasi"');
    // Empat angka per kartu.
    for (const label of ['Terjadwal', 'Sudah absen', 'Terlambat', 'Belum absen']) {
      expect(html, `label ${label} harus ada`).toContain(label);
    }
    // Larangan versi 1: tidak ada pemilih tanggal.
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('type="month"');
    // Judul mencantumkan tanggal hari ini dari server.
    expect(html).toContain('Jumat, 3 Okt 2026');
    // Dua grafik dengan judul teks, tinggi eksplisit, dan angka/label selain warna.
    expect(html).toContain('Terjadwal vs Sudah absen per toko');
    expect(html).toContain('Keterlambatan per toko');
    expect(html).toContain('h-[260px]');
    expect(html).toContain('h-[220px]');
  });

  it('halaman memuat dengan keadaan skeleton', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    // useEffect tidak jalan di render statis -> keadaan memuat.
    const html = renderToStaticMarkup(createElement(HalamanDashboard));
    expect(html).toContain('Memuat…');
  });
});
