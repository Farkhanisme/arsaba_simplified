/**
 * UI-8 B2g — dashboard tabel (K-70, amandemen §5.2 disetujui pemilik
 * 2026-10-15). 16 kartu B2f → 3 kartu: 1 ringkasan + 1 antrean + 1 tabel.
 *
 * Menggantikan tes B2f (kartu per toko): keputusan wadah dibalik secara sadar,
 * isi yang wajib §5.2 tetap sama persis. Baris memakai `th scope="row"`.
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
      // Dua toko sempurna supaya mutasi "logika lengkap dibalik" mengubah
      // angka (2 lawan 1) — pelajaran dari B2f, jangan diulangi.
      { toko_id: 2, toko_nama: 'Toko 2', terjadwal: 3, sudah_absen: 3, terlambat: 0, belum_absen: 0, agenda: { menunggu: 0, selesai: 1, ditolak: 0 } },
      { toko_id: 3, toko_nama: 'Toko 3', terjadwal: 4, sudah_absen: 4, terlambat: 0, belum_absen: 0, agenda: { menunggu: 1, selesai: 0, ditolak: 0 } },
    ],
  };
}
// Total: terjadwal 9, sudah 8, terlambat 1, belum 1, lengkap 2/3.

describe('UI-8 B2g · tiga kartu + tabel toko', () => {
  it('tepat 3 group/card: ringkasan + antrean + tabel', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(3);
    expect(html).toContain('aria-label="Ringkasan hari ini"');
    expect(html).toContain('aria-label="Antrean verifikasi"');
  });

  it('10 pola tetap: satu baris per toko (th scope=row), kolom sesuai K-70', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html.match(/<th[^>]*scope="row"/g) ?? []).toHaveLength(3);
    for (const kolom of ['>Toko<', '>Sudah absen<', '>Status<', '>Agenda<']) {
      expect(html, `kolom ${kolom}`).toContain(kolom);
    }
    expect(html).not.toContain('aria-label="Toko ');
  });

  it('total = jumlah kolom; toko lengkap 2/3; bar 89%', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    const ringkas = html.split('aria-label="Ringkasan hari ini"')[1]!.split('aria-label="Antrean verifikasi"')[0]!;
    expect(ringkas).toContain('dari 9 Terjadwal');
    expect(ringkas).toMatch(/>2<span[^>]*> \/ 3<\//);
    expect(ringkas).toContain('width:89%');
  });

  it('sempurna ✓; bermasalah berbadge; menunggu ikut', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).toContain('✓ Lengkap');
    expect(html).toContain('▲ 1 Terlambat');
    expect(html).toContain('● 1 Belum absen');
    expect(html).toContain('2 menunggu');
    expect(html).toContain('width:50%');
    expect(html).toContain('width:100%');
  });

  it('tautan antrean berupa tombol (data-slot button + href utuh)', () => {
    const html = renderToStaticMarkup(h(PanelDashboard, { data: dataCampuran() }));
    expect(html).toContain('Buka Verifikasi →');
    expect(html).toContain('Buka Verifikasi Agenda →');
    const tombol = [...html.matchAll(/<(?:a|button)[^>]*data-slot="button"[^>]*>/g)].map((m) => m[0]);
    expect(tombol.filter((t) => t.includes('href="/admin/verifikasi')).length).toBe(2);
  });

  it('BilahPersen: pembagi nol = 0% bukan NaN', () => {
    const nol = renderToStaticMarkup(h(BilahPersen, { sudah: 0, terjadwal: 0 }));
    expect(nol).toContain('width:0%');
    expect(nol).not.toContain('NaN');
    expect(nol).toContain('role="progressbar"');
  });
});
