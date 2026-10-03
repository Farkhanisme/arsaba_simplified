import { describe, it, expect, vi } from 'vitest';

// Runtime Next di-mock (bukan kode kita), pola yang sama dengan halaman lain.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import HalamanRekap, { PanelRekap } from '../src/app/admin/rekap/page';

describe('halaman /admin/rekap benar-benar bisa dirender', () => {
  it('menampilkan filter, tombol Periksa, dan tombol Unduh setelah data ada', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(HalamanRekap));

    expect(html).toContain('Rekap');
    expect(html).toContain('Periksa &amp; Buat Rekap');
    expect(html).toContain('Semua toko');
  });

  it('gagal: tombol ekspor nonaktif + jumlah + tautan Verifikasi terfilter', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(
      createElement(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: 2 },
          pemeriksaan: { boleh: false, jumlahMenunggu: 3, jumlahCheckinTerbuka: 2, peringatan: 0 },
          ringkasan: [],
        },
        mengunduh: false,
        onUnduh: () => undefined,
      }),
    );
    expect(html).toContain('masih ada 3 absensi menunggu verifikasi');
    expect(html).toContain('2 check-in tanpa check-out');
    expect(html).toContain('href="/admin/verifikasi?status=MENUNGGU&amp;dari=2026-10-01&amp;sampai=2026-10-03&amp;toko_id=2"');
    // Gagal -> tombol ekspor nonaktif. Penanda: atribut disabled="" — bukan
    // substring "disabled", karena kelas dasar Button shadcn memuat literal
    // "disabled:" (jebakan UI-2 yang sudah pernah menipu).
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('peringatan saja: tombol ekspor TETAP aktif', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    // PanelRekap tidak memuat tombol (tombol di induk, aktif bila boleh=true).
    // Di sini buktikan panel peringatan tampil TANPA pesan gagal.
    const html = renderToStaticMarkup(
      createElement(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: null },
          pemeriksaan: { boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 1 },
          ringkasan: [
            { karyawan_id: 1, karyawan_nama: 'A', toko_id: 1, toko_nama: 'T', hari_hadir: 0, hari_izin: 0, hari_tanpa_keterangan: 0, total_terlambat_final: 0 },
          ],
        },
        mengunduh: false,
        onUnduh: () => undefined,
      }),
    );
    expect(html).toContain('Semua absensi pada periode ini sudah diverifikasi.');
    expect(html).toContain('1 karyawan terjadwal tanpa absen dan tanpa penandaan');
    expect(html).not.toContain('Ekspor belum bisa dilakukan');
    // Peringatan saja -> tombol ekspor TETAP aktif (tanpa atribut disabled).
    // Lihat catatan di atas: kelas Button memuat "disabled:", jadi yang
    // diperiksa adalah atribut disabled="", bukan substring.
    expect(html).toContain('Unduh Excel (.xlsx)');
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('nama sheet sesuai: tabel pratinjau kolom BR-R4', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(
      createElement(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-01', tokoId: null },
          pemeriksaan: { boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 0 },
          ringkasan: [],
        },
        mengunduh: false,
        onUnduh: () => undefined,
      }),
    );
    for (const kolom of ['Hari Hadir', 'Izin', 'Tanpa Keterangan', 'Total Menit Terlambat Final']) {
      expect(html, `kolom ${kolom} harus ada`).toContain(kolom);
    }
  });
});
