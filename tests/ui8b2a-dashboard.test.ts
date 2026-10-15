/**
 * UI-8 B2a — dashboard: strip ringkasan + fraksi per toko + tautan aksi.
 *
 * Batas yang dijaga: strip ringkasan BUKAN Card (jumlah `group/card` tetap 12
 * seperti kunci tes UI-2), total = jumlah kolom kartu toko (bukan angka baru),
 * dan tidak ada fetch/prop/endpoint baru — PanelDashboard tetap menerima
 * `DataDashboard` yang sama dari `page.tsx`.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { PanelDashboard } from '../src/app/admin/komponen-dashboard';

function dataSepuluhToko() {
  return {
    tanggalPanjang: 'Jumat, 3 Okt 2026',
    antrean: 12,
    antreanAgenda: 5,
    kartu: Array.from({ length: 10 }, (_, i) => ({
      toko_id: i + 1,
      toko_nama: `Toko ${i + 1}`,
      terjadwal: 2,
      sudah_absen: 1,
      terlambat: i === 0 ? 1 : 0,
      belum_absen: 1,
      agenda: { menunggu: 2, selesai: 3, ditolak: 1 },
    })),
  };
}

describe('UI-8 B2a · strip ringkasan', () => {
  it('ada, berlabel, dan totalnya = jumlah kolom kartu toko', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html).toContain('aria-label="Ringkasan hari ini"');
    for (const label of ['Terjadwal', 'Sudah absen', 'Terlambat', 'Belum absen']) {
      expect(html, `strip memuat ${label}`).toContain(label);
    }
    // 10 toko × terjadwal 2 = 20; sudah 10; terlambat 1 (hanya Toko 1); belum 10.
    const strip = html.split('aria-label="Ringkasan hari ini"')[1]!.split('</section>')[0]!;
    expect(strip).toContain('>20</div>');
    expect(strip).toContain('>1</div>');
    expect(strip).toContain('>10</div>');
  });

  it('strip BUKAN Card — jumlah group/card tetap 12', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(12);
  });

  it('kartu toko tetap 10 dengan fraksi sudah/terjadwal', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html.match(/aria-label="Toko /g) ?? []).toHaveLength(10);
    expect(html).toContain('/ 2</span>');
  });

  it('tautan antrean tetap href-nya, berpanah sebagai aksi', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataSepuluhToko() }));
    expect(html).toContain('href="/admin/verifikasi"');
    expect(html).toContain('href="/admin/verifikasi-agenda"');
    expect(html).toContain('Buka Verifikasi →');
    expect(html).toContain('Buka Verifikasi Agenda →');
  });
});
