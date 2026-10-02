import { describe, it, expect, vi } from 'vitest';

// Runtime Next di-mock (bukan kode kita), sama seperti halaman jadwal.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

import HalamanTidakBerangkat, { PanelHasilTandai } from '../src/app/admin/tidak-berangkat/page';

describe('halaman /admin/tidak-berangkat benar-benar bisa dirender', () => {
  it('menampilkan formulir, daftar kosong, dan struktur filter', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(HalamanTidakBerangkat));

    expect(html).toContain('Tandai Tidak Berangkat');
    expect(html).toContain('Tanpa Keterangan');
    expect(html).toContain('Simpan');
  });

  it('panel hasil menampilkan pesan blokir BR-X3 persis + tautan Verifikasi', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(
      createElement(PanelHasilTandai, {
        hasil: {
          dibuat: [{ karyawan_id: 2, tanggal: '2026-10-10' }],
          ditolak: [
            { karyawan_id: 1, tanggal: '2026-10-10', alasan: 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.' },
          ],
        },
      }),
    );
    expect(html).toContain('1 tersimpan, 1 ditolak.');
    expect(html).toContain('Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.');
    expect(html).toContain('href="/admin/verifikasi"');
  });
});
