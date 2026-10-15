/**
 * UI-8 B2f — dashboard redesain (disetujui pemilik 2026-10-15).
 *
 * Menggantikan tes B2a (strip non-Card): keputusan itu DIBALIK secara sadar —
 * ringkasan sekarang memang 4 kartu proper. Tes B2a yang bertentangan dihapus,
 * bukan dilonggarkan diam-diam; alasannya ada di komentar tes UI-2 dan AGENTS.md.
 *
 * Yang dikunci: 16 group/card · 4 total ringkasan = jumlah kolom · toko lengkap
 * · toko sempurna bertanda ✓ · tautan antrean berupa tombol (href utuh) ·
 * bilah persen (termasuk pembagi nol).
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { BilahPersen, PanelDashboard } from '../src/app/admin/komponen-dashboard';

function dataCampuran() {
  return {
    tanggalPanjang: 'Jumat, 3 Okt 2026',
    antrean: 12,
    antreanAgenda: 5,
    kartu: [
      { toko_id: 1, toko_nama: 'Toko 1', terjadwal: 2, sudah_absen: 1, terlambat: 1, belum_absen: 1, agenda: { menunggu: 2, selesai: 3, ditolak: 1 } },
      // Dua toko sempurna: semua sudah absen, nol terlambat, nol belum. Dua
      // (bukan satu) supaya mutasi "logika lengkap dibalik" mengubah angkanya
      // (2 lawan 1) dan pasti tertangkap — dengan satu toko, benar dan terbalik
      // sama-sama menghasilkan 1 dan tes lolos palsu.
      { toko_id: 2, toko_nama: 'Toko 2', terjadwal: 3, sudah_absen: 3, terlambat: 0, belum_absen: 0, agenda: { menunggu: 0, selesai: 1, ditolak: 0 } },
      { toko_id: 3, toko_nama: 'Toko 3', terjadwal: 4, sudah_absen: 4, terlambat: 0, belum_absen: 0, agenda: { menunggu: 1, selesai: 0, ditolak: 0 } },
    ],
  };
}
// Total: terjadwal 9, sudah 8, terlambat 1, belum 1, lengkap 2/3.

describe('UI-8 B2f · ringkasan 4 kartu', () => {
  it('16 group/card: 10 pola tetap — 4 ringkasan + 2 antrean + 10 toko', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    // 3 toko fixture ini → 4 + 2 + 3 = 9.
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(9);
    expect(html).toContain('aria-label="Ringkasan hari ini"');
  });

  it('total = jumlah kolom; toko lengkap 2/3', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    const strip = html.split('aria-label="Ringkasan hari ini"')[1]!.split('</section>')[0]!;
    expect(strip).toContain('dari 9 Terjadwal');
    expect(strip).toContain('>1</div>');
    expect(strip).toContain('Toko lengkap');
    expect(strip).toMatch(/>2<span[^>]*> \/ 3<\//);
  });

  it('toko sempurna bertanda ✓ Lengkap; toko bermasalah berbadge pengecualian', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).toContain('✓ Lengkap');
    expect(html).toContain('▲ 1 Terlambat');
    expect(html).toContain('● 1 Belum absen');
    expect(html).toContain('2 menunggu');
  });

  it('tautan antrean berupa tombol (data-slot button + href utuh)', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).toContain('Buka Verifikasi →');
    expect(html).toContain('Buka Verifikasi Agenda →');
    const tombol = [...html.matchAll(/<(?:a|button)[^>]*data-slot="button"[^>]*>/g)].map((m) => m[0]);
    const berhref = tombol.filter((t) => t.includes('href="/admin/verifikasi'));
    expect(berhref.length).toBe(2);
  });

  it('bilah persen: 89% untuk 8/9; pembagi nol = 0% bukan NaN', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).toContain('width:89%');
    expect(html).toContain('width:50%');
    expect(html).toContain('width:100%');
    const nol = renderToStaticMarkup(h(BilahPersen, { sudah: 0, terjadwal: 0 }));
    expect(nol).toContain('width:0%');
    expect(nol).not.toContain('NaN');
  });
});
