import { describe, it, expect } from 'vitest';

import { AksesDitolak, adalahAksesDitolak } from '../src/app/admin/komponen';

function respons(kode: string | null, status: number): Response {
  const body = kode === null ? 'bukan-json' : JSON.stringify({ kode, pesan: 'x' });
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

describe('BUG-UI-03 keadaan akses ditolak', () => {
  it('403 AKSES_DITOLAK terdeteksi walau body masih dibutuhkan pemanggil', async () => {
    const res = respons('AKSES_DITOLAK', 403);
    expect(await adalahAksesDitolak(res)).toBe(true);
    // Body asli tetap bisa dibaca sesudahnya (clone, bukan consume).
    expect(await res.json()).toEqual({ kode: 'AKSES_DITOLAK', pesan: 'x' });
  });

  it('bukan 403 / bukan AKSES_DITOLAK / bukan JSON -> false', async () => {
    expect(await adalahAksesDitolak(respons('AKSES_DITOLAK', 200))).toBe(false);
    expect(await adalahAksesDitolak(respons('TIDAK_DITEMUKAN', 404))).toBe(false);
    expect(await adalahAksesDitolak(respons('ERROR', 403))).toBe(false);
    expect(await adalahAksesDitolak(respons(null, 403))).toBe(false);
  });

  it('komponen menampilkan pesan yang jelas, bukan layar kosong', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(AksesDitolak));
    expect(html).toContain('Akses ditolak');
    expect(html).toContain('Anda tidak punya akses ke halaman ini.');
    expect(html.trim().length).toBeGreaterThan(0);
  });
});
