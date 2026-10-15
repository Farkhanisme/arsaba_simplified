/**
 * UI-8 B2h — dashboard triase + de-card (K-71, disetujui pemilik 2026-10-15).
 *
 * Menggantikan tes B2g (3 kartu): pita + triase bukan kartu, tinggal 1 kartu
 * tabel. Keputusan wadah dibalik sadar; isi §5.2 tetap sama persis.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { BilahPersen, PanelDashboard, PanelTindakan } from '../src/app/admin/komponen-dashboard';

function dataCampuran() {
  return {
    tanggalPanjang: 'Jumat, 3 Okt 2026',
    antrean: 12,
    antreanAgenda: 5,
    kartu: [
      // Toko sempurna DULU supaya mutasi "tanpa sort" mengubah urutan dan
      // tertangkap — bila yang bermasalah sudah di depan, sort tidak mengubah
      // apa-apa dan tes lolos palsu (pelajaran yang sama dengan fixture 2v1).
      { toko_id: 2, toko_nama: 'Toko 2', terjadwal: 3, sudah_absen: 3, terlambat: 0, belum_absen: 0, agenda: { menunggu: 0, selesai: 1, ditolak: 0 } },
      { toko_id: 1, toko_nama: 'Toko 1', terjadwal: 2, sudah_absen: 1, terlambat: 1, belum_absen: 1, agenda: { menunggu: 2, selesai: 3, ditolak: 1 } },
      // Dua toko sempurna supaya mutasi "logika lengkap dibalik" mengubah
      // angka (2 lawan 1) — pelajaran dari B2f, jangan diulangi.
      { toko_id: 3, toko_nama: 'Toko 3', terjadwal: 4, sudah_absen: 4, terlambat: 0, belum_absen: 0, agenda: { menunggu: 1, selesai: 0, ditolak: 0 } },
    ],
  };
}
// Total: terjadwal 9, sudah 8, terlambat 1, belum 1, lengkap 2/3.

describe('UI-8 B2h · satu kartu tabel + triase', () => {
  it('tepat 1 group/card: hanya tabel toko', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(1);
    expect(html).toContain('aria-label="Ringkasan hari ini"');
    expect(html).toContain('aria-label="Perlu tindakan"');
  });

  it('tanpa pola template: tanpa kartu identik ganda, tanpa ·, tanpa →', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).not.toContain('→');
    expect(html).not.toContain('·');
  });

  it('triase: hanya toko bermasalah + antrean, tiap baris deep link terfilter', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    const triase = html.split('aria-label="Perlu tindakan"')[1]!.split('</section>')[0]!;
    // Toko 1 bermasalah ikut; Toko 2/3 (sempurna) tidak disebut di triase.
    expect(triase).toContain('Toko 1');
    expect(triase).not.toContain('Toko 2');
    expect(triase).not.toContain('Toko 3');
    expect(triase).toContain('1 belum absen, 1 terlambat');
    // Deep link terfilter per toko + antrean; teks = label menu, tanpa panah.
    expect(triase).toContain('href="/admin/verifikasi?status=MENUNGGU&amp;toko_id=1"');
    expect(triase).toContain('Buka Verifikasi Absensi');
    expect(triase).toContain('Buka Verifikasi Agenda');
  });

  it('semua beres → "Semua toko beres ✓", bukan panel kosong', () => {
    const html = renderToStaticMarkup(
      h(PanelTindakan, {
        kartu: [{ toko_id: 9, toko_nama: 'Toko 9', terjadwal: 2, sudah_absen: 2, terlambat: 0, belum_absen: 0, agenda: { menunggu: 0, selesai: 1, ditolak: 0 } }],
        antrean: 0,
        antreanAgenda: 0,
      }),
    );
    expect(html).toContain('Semua toko beres ✓');
    expect(html).not.toContain('href=');
  });

  it('tabel: baris bermasalah dulu; sempurna ✓; total dan bar tetap benar', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html.match(/<th[^>]*scope="row"/g) ?? []).toHaveLength(3);
    // Urutan diperiksa DI DALAM tabel (setelah judul "Kehadiran per toko") —
    // triase di atas juga menyebut Toko 1 duluan dan akan menutupi urutan
    // tabel bila diperiksa dari seluruh HTML.
    const tabel = html.split('Kehadiran per toko')[1]!;
    const i1 = tabel.indexOf('Toko 1');
    const i2 = tabel.indexOf('Toko 2');
    expect(i1, 'bermasalah sebelum sempurna').toBeGreaterThanOrEqual(0);
    expect(i2, 'toko kedua ada di tabel').toBeGreaterThanOrEqual(0);
    expect(i1, 'bermasalah sebelum sempurna').toBeLessThan(i2);
    expect(html).toContain('✓ Lengkap');
    expect(html).toContain('▲ 1 Terlambat');
    expect(html).toContain('● 1 Belum absen');
    expect(html).toContain('dari 9 Terjadwal');
    expect(html).toContain('Toko lengkap');
    expect(html).toMatch(/>2 \/ 3</);
    expect(html).toContain('width:89%');
  });

  it('BilahPersen: pembagi nol = 0% bukan NaN', () => {
    const nol = renderToStaticMarkup(h(BilahPersen, { sudah: 0, terjadwal: 0 }));
    expect(nol).toContain('width:0%');
    expect(nol).not.toContain('NaN');
    expect(nol).toContain('role="progressbar"');
  });
});
