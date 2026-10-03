/**
 * UI-2 Dashboard (/admin, rules/05 §5.2).
 *
 * Memeriksa PanelDashboard dari komponen-dashboard.tsx lewat render statis.
 * PanelDashboard juga di-re-export dari page.tsx untuk kompatibilitas tes lama.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('PanelDashboard isi wajib §5.2', () => {
  it('10 kartu + antrean + tautan verifikasi + 4 angka', () => {
    const html = render(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html.match(/aria-label="Toko /g) ?? []).toHaveLength(10);
    expect(html).toContain('Antrean verifikasi');
    expect(html).toContain('href="/admin/verifikasi"');
    expect(html).toContain('Buka Verifikasi');
    for (const label of ['Terjadwal', 'Sudah absen', 'Terlambat', 'Belum absen']) {
      expect(html, `label ${label}`).toContain(label);
    }
    expect(html).toContain('Jumat, 3 Okt 2026');
    expect(html).not.toContain('type="date"');
  });

  it('dua grafik dengan judul dan tinggi eksplisit', () => {
    const html = render(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html).toContain('Terjadwal vs Sudah absen per toko');
    expect(html).toContain('Keterlambatan per toko');
    expect(html).toContain('h-[260px]');
    expect(html).toContain('h-[220px]');
  });

  it('angka Terlambat + Belum absen memakai Badge (bukan teks polos berwarna)', () => {
    const html = render(h(PanelDashboard, { data: dataSepuluhToko() }));
    // Badge dibuktikan lewat data-slot="badge" — span polos tidak punya itu.
    expect((html.match(/data-slot="badge"/g) ?? []).length).toBeGreaterThanOrEqual(20);
    expect(html).toContain('▲ 1');
    expect(html).toContain('● 1');
  });

  it('kartu memakai Card shadcn: group/card + header + content', () => {
    const html = render(h(PanelDashboard, { data: dataSepuluhToko() }));
    // 10 kartu toko + 1 kartu antrean = 11.
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(11);
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-content"');
  });

  it('tanpa inline style ber-hex di markup kita (token variant dipakai)', () => {
    const html = render(h(PanelDashboard, { data: dataSepuluhToko() }));
    // Kelas bawaan ChartContainer memuat "#ccc"/"#fff" di dalam selektornya —
    // itu milik pustaka, bukan literal yang kita tulis. Yang dilarang adalah
    // atribut style="...#..." (hex inline di halaman).
    expect(html).not.toMatch(/style="[^"]*#[0-9a-fA-F]/);
    expect(html).not.toMatch(/style="[^"]*rgb\(/);
  });
});

describe('HalamanDashboard keadaan memuat', () => {
  it('memuat memakai Skeleton bersama, bukan teks Memuat…', async () => {
    const html = render(h(HalamanDashboard));
    expect(html).toContain('aria-label="Memuat"');
    expect((html.match(/data-slot="skeleton"/g) ?? []).length).toBeGreaterThan(0);
    expect(html).not.toContain('Memuat…');
  });
});
