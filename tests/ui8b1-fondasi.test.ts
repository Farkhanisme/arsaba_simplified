/**
 * UI-8 Fase B1 — fondasi: palet B + tipografi Opsi 1 (K-69).
 *
 * Yang dikunci di sini HANYA fondasi (token + komponen judul bersama), bukan
 * tata letak halaman. Dua lapis bukti yang berbeda:
 *   1. Nilai token di `globals.css` — dibaca dari berkas aslinya, bukan salinan.
 *      Selain mengunci nilai persis, ada assertion SEMANTIK (secondary/muted/
 *      accent harus tiga nilai berbeda; card harus beda dari background) supaya
 *      "datar lagi" tertangkap walau nilainya diganti dengan yang lain.
 *   2. Komponen judul bersama yang di-render sungguhan — hierarki dua tingkat
 *      (judul halaman/kartu text-lg, judul dialog/sheet text-base).
 *
 * Aturan repo: `createElement(Komponen)`, jangan panggil langsung (React 19
 * melempar tanpa context). `usePathname` di-mock karena itu runtime Next,
 * bukan kode kita.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/verifikasi',
}));

import { CardTitle } from '../src/components/ui/card';
import { Dialog, DialogTitle } from '../src/components/ui/dialog';
import { Sheet, SheetTitle } from '../src/components/ui/sheet';
import JudulHalaman from '../src/app/admin/judul-halaman';

const css = fs.readFileSync('src/app/globals.css', 'utf-8');

/** Ambil nilai satu variabel dari blok :root pertama (mode terang). */
function tokenTerang(nama: string): string {
  // '.dark' muncul juga di `@custom-variant` (baris 4), jadi potong pada blok
  // `.dark {` yang sebenarnya — bukan kemunculan string pertama.
  const blok = css.split('\n.dark {')[0]!;
  const ketemu = new RegExp(`--${nama}:([^;]+);`).exec(blok);
  expect(ketemu, `token --${nama} ada di :root`).not.toBeNull();
  return ketemu![1]!.trim();
}

describe('UI-8 B1 · token palet B terkunci', () => {
  it('primer biru Opsi B, bukan abu netral', () => {
    expect(tokenTerang('primary')).toBe('oklch(0.5 0.15 255)');
    expect(tokenTerang('primary-foreground')).toBe('oklch(0.985 0 0)');
  });

  it('secondary/muted/accent TIGA nilai berbeda (anti-datar)', () => {
    const s = tokenTerang('secondary');
    const m = tokenTerang('muted');
    const a = tokenTerang('accent');
    expect(new Set([s, m, a]).size).toBe(3);
    expect(s).toBe('oklch(0.93 0.02 255)');
    expect(m).toBe('oklch(0.95 0.015 255)');
    expect(a).toBe('oklch(0.88 0.05 255)');
  });

  it('card dipisah dari background (terang)', () => {
    expect(tokenTerang('card')).not.toBe(tokenTerang('background'));
    expect(tokenTerang('card')).toBe('oklch(1 0 0)');
    expect(tokenTerang('background')).toBe('oklch(0.99 0.005 255)');
  });

  it('sidebar terang punya hue biru dan aksen terbedakan', () => {
    expect(tokenTerang('sidebar')).toBe('oklch(0.98 0.01 255)');
    expect(tokenTerang('sidebar-accent')).toBe('oklch(0.9 0.04 255)');
    expect(tokenTerang('sidebar-accent-foreground')).toBe('oklch(0.3 0.09 255)');
    expect(tokenTerang('sidebar-primary')).toBe('oklch(0.5 0.15 255)');
  });

  it('mode gelap: primer diterangkan, bukan abu netral', () => {
    const gelap = css.split('\n.dark {')[1]!.split('/* Palet kategorik')[0]!;
    const nilai = (nama: string) => {
      const ketemu = new RegExp(`--${nama}:([^;]+);`).exec(gelap);
      expect(ketemu, `token --${nama} ada di .dark`).not.toBeNull();
      return ketemu![1]!.trim();
    };
    expect(nilai('background')).toBe('oklch(0.17 0.02 260)');
    expect(nilai('primary')).toBe('oklch(0.72 0.12 255)');
    expect(nilai('primary-foreground')).toBe('oklch(0.18 0.03 260)');
    expect(nilai('sidebar')).toBe('oklch(0.2 0.03 260)');
  });

  it('--destructive dan --badge-* TIDAK berubah (semantik status)', () => {
    expect(tokenTerang('destructive')).toBe('oklch(0.577 0.245 27.325)');
    expect(tokenTerang('badge-menunggu')).toBe('oklch(0.976 0.062 90)');
    expect(tokenTerang('badge-menunggu-teks')).toBe('oklch(0.42 0.09 70)');
    expect(tokenTerang('badge-setuju')).toBe('oklch(0.962 0.044 155)');
    expect(tokenTerang('badge-setuju-teks')).toBe('oklch(0.35 0.09 155)');
    expect(tokenTerang('badge-ditolak')).toBe('oklch(0.962 0.043 25)');
    expect(tokenTerang('badge-ditolak-teks')).toBe('oklch(0.42 0.14 25)');
  });

  it('--font-sans eksplisit; --font-heading bukan alias dirinya sendiri', () => {
    expect(css).toContain('--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;');
    expect(css).not.toContain('--font-heading: var(--font-sans);');
    expect(css).toContain('--font-heading: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;');
  });
});

describe('UI-8 B1 · hierarki judul dua tingkat', () => {
  it('CardTitle: text-lg semibold (tingkat atas)', () => {
    const html = renderToStaticMarkup(h(CardTitle, null, 'Judul Kartu'));
    expect(html).toContain('Judul Kartu');
    expect(html).toMatch(/\btext-lg\b/);
    expect(html).toMatch(/\bfont-semibold\b/);
    expect(html).toMatch(/\btracking-tight\b/);
  });

  it('JudulHalaman: h1 text-lg semibold dengan font-heading', () => {
    const html = renderToStaticMarkup(h(JudulHalaman, { peran: 'ADMIN' }));
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).toMatch(/\btext-lg\b/);
    expect(html).toMatch(/\bfont-semibold\b/);
    expect(html).toMatch(/\bfont-heading\b/);
  });

  it('judul dialog/sheet text-base semibold (tingkat bawah) — render sungguhan', () => {
    // Primitif base-ui butuh konteks Root; di-render di dalam Root-nya
    // masing-masing — tetap komponen asli, bukan salinan.
    const dialog = renderToStaticMarkup(h(Dialog, null, h(DialogTitle, null, 'Hapus?')));
    const sheet = renderToStaticMarkup(h(Sheet, null, h(SheetTitle, null, 'Panel')));
    for (const [nama, html] of [['dialog', dialog], ['sheet', sheet]] as const) {
      expect(html, `${nama}: judul semibold`).toMatch(/\bfont-semibold\b/);
      expect(html, `${nama}: judul tracking-tight`).toMatch(/\btracking-tight\b/);
      expect(html, `${nama}: judul BUKAN text-lg`).not.toMatch(/\btext-lg\b/);
      expect(html, `${nama}: judul text-base`).toMatch(/\btext-base\b/);
    }
  });
});
