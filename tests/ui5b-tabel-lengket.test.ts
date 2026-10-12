/**
 * UI-5B — header lengket pada tabel yang benar-benar panjang (rules/05 §2: "Tabel
 * besar: header lengket, dapat digulir horizontal pada layar sempit").
 *
 * BAGIAN YANG SULIT DI SINI BUKAN "tempelkan sticky", melainkan membuktikan
 * bahwa sticky itu benar-benar BERFUNGSI di tabel ini.
 *
 * Alasannya (sudah diverifikasi, bukan dugaan): `overflow-x: auto` dengan
 * `overflow-y: visible` membuat `overflow-y` DIHITUNG menjadi `auto` (CSS
 * Overflow 3). Jadi wrapper `Table` adalah scroll container di kedua sumbu.
 * Akibatnya `position: sticky; top: 0` pada `<th>` lengket ke WRAPPER — bukan ke
 * halaman — dan wrapper tanpa `max-h` tidak pernah scroll vertikal. Hasilnya
 * `sticky top-0` yang terlihat benar di diff dan diam-diam TIDAK APA-APA.
 *
 * Karena itu halaman yang memakai header lengket WAJIB punya `maxH` di `Table`.
 * Dan halaman yang daftarnya pendek justru HARUS TIDAK punya `maxH`: 10 toko
 * atau 26 karyawan muat tanpa terpotong, menambah scrollbar kedua hanya
 * memperkecil isi tanpa manfaat.
 *
 * Yang diperiksa di sini adalah PASANGAN yang benar (`maxH` + sel sticky), bukan
 * keberadaan string "sticky" — karena keberadaan string itu persis yang terbaru
 * dan tidak menghasilkan apa pun.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Table, TableHead, TableHeadSticky, TableHeaderSticky } from '../src/components/ui/table';

function sumber(relatif: string): string {
  return readFileSync(join(process.cwd(), relatif), 'utf8');
}

function kodeTanpaKomentar(teks: string): string {
  return teks.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const HALAMAN_PANJANG = [
  'src/app/admin/audit-log/komponen.tsx',
  'src/app/admin/agenda/komponen.tsx',
  'src/app/admin/verifikasi-agenda/komponen.tsx',
];

/** Halaman yang daftar master-nya kecil — TIDAK boleh dapat scroll container. */
const HALAMAN_PENDEK = [
  'src/app/admin/master/toko/komponen.tsx',
  'src/app/admin/master/shift/komponen.tsx',
  'src/app/admin/master/karyawan/komponen.tsx',
  'src/app/admin/akun/komponen.tsx',
];

describe('Table: maxH mengubah wrapper jadi kotak scroll yang bisa di-sticky', () => {
  it('tanpa maxH, wrapper TIDAK boleh jadi scroll container vertikal', () => {
    // BUKTI: hapus maxH -> tes ini gagal.
    const html = renderToStaticMarkup(
      createElement(
        Table,
        null,
        createElement(TableHeaderSticky, null, createElement(TableHeadSticky, null, 'Waktu')),
      ),
    );
    expect(html).toContain('data-slot="table-container"');
    expect(html).not.toContain('overflow-y-auto');
    expect(html).not.toContain('role="region"');
  });

  it('dengan maxH, wrapper jadi kotak scroll yang bisa di-sticky', () => {
    // BUKTI: hapus maxH dari salah satu halaman -> tes halaman gagal.
    const html = renderToStaticMarkup(
      createElement(
        Table,
        { maxH: '70vh', scrollLabel: 'Tabel uji' },
        createElement(TableHeaderSticky, null, createElement(TableHeadSticky, null, 'Waktu')),
      ),
    );
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('max-height:70vh');
    // Tanpa ini area scroll tidak bisa difokus dari keyboard.
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Tabel uji"');
    expect(html).toContain('tabindex="0"');
  });

  it('TableHeadSticky punya sticky + latar, TableHead TIDAK', () => {
    // Perbedaan inilah yang menentukan header benar-benar lengket atau tidak.
    const lengket = renderToStaticMarkup(createElement(TableHeadSticky, null, 'Aksi'));
    const biasa = renderToStaticMarkup(createElement(TableHead, null, 'Aksi'));

    expect(lengket).toContain('sticky');
    expect(lengket).toContain('top-0');
    // Tanpa latar opaque, sel di bawahnya terlihat menembus header.
    expect(lengket).toContain('bg-card');
    expect(lengket).toContain('z-10');

    // Dan yang biasa TIDAK boleh punya sticky — kalau boleh, orang akan
    // menempelkannya ke tabel yang wrapper-nya tanpa maxH, dan hasilnya nol.
    expect(basicTanpaSticky(biasa)).toBe(true);
  });
});

function basicTanpaSticky(html: string): boolean {
  const kelas = (html.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
  return !kelas.includes('sticky') && !kelas.includes('top-0');
}

describe('halaman panjang: maxH dan sel sticky HARUS berpasangan', () => {
  for (const berkas of HALAMAN_PANJANG) {
    it(`${berkas} punya maxH + TableHeadSticky`, () => {
      const kode = kodeTanpaKomentar(sumber(berkas));
      expect(kode, `${berkas} tidak punya maxH`).toMatch(/<Table\b[^>]*\bmaxH=/);
      expect(kode, `${berkas} tidak punya scrollLabel`).toMatch(/\bscrollLabel=/);
      expect(kode, `${berkas} tidak memakai TableHeadSticky`).toContain('TableHeadSticky');

      // Pasangan yang salah: ada TableHeadSticky tapi TIDAK ada maxH. Ini
      // persis regresi yang paling mungkin terjadi dan paling tidak terlihat.
      const adaStickySel = kode.includes('<TableHeadSticky');
      const adaMaxH = /<Table\b[^>]*\bmaxH=/.test(kode);
      expect(adaStickySel && adaMaxH, `${berkas}: sticky tanpa maxH = tidak berfungsi`).toBe(true);
    });
  }
});

describe('halaman pendek: TIDAK boleh dapat scroll container sendiri', () => {
  for (const berkas of HALAMAN_PENDEK) {
    it(`${berkas} tidak memakai maxH`, () => {
      // BUKTI: tambah maxH ke salah satu halaman ini -> tes ini gagal.
      const kode = kodeTanpaKomentar(sumber(berkas));
      expect(
        kode,
        `${berkas} dapat maxH; daftarnya kecil sehingga scrollbar kedua hanya `
          + `memperkecil isi tanpa manfaat`,
      ).not.toMatch(/<Table\b[^>]*\bmaxH=/);
    });
  }

  it('daftar berkasnya benar-benar terpetakan', () => {
    // Tanpa ini, loop di atas bisa lulus hampa kalau ada berkas yang hilang.
    for (const b of [...HALAMAN_PANJANG, ...HALAMAN_PENDEK]) {
      expect(readdirSync(join(process.cwd(), 'src/app/admin')).length).toBeGreaterThan(0);
      expect(() => sumber(b)).not.toThrow();
    }
  });
});