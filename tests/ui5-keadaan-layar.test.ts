/**
 * UI-5 Batch A — "setiap layar punya keadaan" (rules/05 §1.4).
 *
 * Tiga berkas yang dulu tidak ada sama sekali, atau ada tapi rusak:
 *   1. src/app/a/[token]/not-found.tsx  — 100% inline style (BUG-UI-07 yang sama)
 *   2. src/app/not-found.tsx            — tidak ada; Next.js pakai 404-nya sendiri
 *                                         yang berbahasa Inggris (melanggar K-24)
 *   3. src/app/admin/error.tsx + src/app/global-error.tsx — tidak ada; satu error
 *                                         saja membuat admin melihat halaman error
 *                                         Next.js tanpa tombol keluar
 *
 * Yang diperiksa adalah MEKANISME warnanya — bukan hex tertentu — supaya tetap
 * berlaku saat tema shadcn diganti. Setiap klaim punya mutasi yang harus
 * menggagalkannya; lihat catatan "BUKTI" di tiap blok.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LinkTidakBerlaku from '../src/app/a/[token]/not-found';
import HalamanTidakDitemukan from '../src/app/not-found';
import KesalahanAdmin from '../src/app/admin/error';
import KesalahanFatal from '../src/app/global-error';

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('halaman link karyawan tidak berlaku', () => {
  const html = render(createElement(LinkTidakBerlaku));

  it('memakai token CSS, bukan inline style', () => {
    // BUKTI: kembalikan inline style -> tes ini gagal.
    expect(html).not.toMatch(/ style="/);
  });

  it('teks Indonesianya persis seperti yang dikunci tes lain', () => {
    // Dikunci tests/m3-absen.test.ts dan tests/m12-agenda-karyawan.test.ts.
    expect(html).toContain('Link tidak berlaku. Hubungi admin.');
  });

  it('memakai komponen Card sehingga ikut mode gelap', () => {
    // BUKTI: ganti bg-muted/40 dengan hex literal -> tes ini gagal.
    // Yang diperiksa TOKEN, bukan warnanya: tema bisa diganti kapan saja.
    expect(html).toMatch(/bg-muted\//);
    expect(html).toContain('max-w-sm');
  });
});

describe('404 seluruh aplikasi', () => {
  const html = render(createElement(HalamanTidakDitemukan));

  it('Bahasa Indonesia, bukan 404 bawaan Next.js', () => {
    // BUKTI: hapus berkas ini -> Next.js memakai 404 bawaannya dan tes gagal.
    expect(html).toContain('Halaman tidak ditemukan.');
    expect(html).not.toMatch(/could not be found/i);
    expect(html).not.toMatch(/404 page/i);
  });

  it('memakai token CSS, bukan inline style', () => {
    expect(html).not.toMatch(/ style="/);
  });

  it('tidak membocorkan struktur admin', () => {
    // 404 ini melayani /admin/apa-saja DAN /apa-saja. Kalau pesannya
    // berbeda antara keduanya, penyerang bisa memetakan bagian mana yang ada.
    expect(html).not.toMatch(/admin|super admin|dashboard|jadwal|verifikasi/i);
  });

  it('memberi jalan keluar yang benar-benar ada', () => {
    expect(html).toContain('href="/"');
  });
});

describe('boundary error admin', () => {
  const pesanRahasia = 'SQLITE_ERROR: tidak ada kolom "password_hash" di tabel pengguna_admin';
  const html = render(
    createElement(KesalahanAdmin, {
      error: Object.assign(new Error(pesanRahasia), { digest: 'abc123' }),
      reset: () => {},
    }),
  );

  it('memberi tombol keluar, bukan jalan buntu', () => {
    // BUKTI: ganti <button onClick={reset}> dengan teks biasa -> tes gagal.
    expect(html).toContain('Coba lagi');
  });

  it('TIDAK menampilkan isi error ke layar', () => {
    // Ini halaman yang terbuka di laptop bersama. Detail error bisa memuat
    // nama kolom atau potongan SQL.
    expect(html).not.toContain('password_hash');
    expect(html).not.toContain('SQLITE_ERROR');
    expect(html).not.toContain(pesanRahasia);
  });

  it('menampilkan digest karena itu satu-satunya yang berguna untuk melapor', () => {
    expect(html).toContain('abc123');
  });

  it('memberi tahu bahwa data tidak berubah', () => {
    // Setelah gagal memuat, admin tidak boleh mengira perlu mengulang aksi
    // yang sebenarnya sudah berhasil.
    expect(html).toContain('Data Anda tidak berubah.');
  });
});

describe('boundary error terakhir (global)', () => {
  const html = render(
    createElement(KesalahanFatal, {
      error: Object.assign(new Error('boom'), { digest: 'zzz' }),
      reset: () => {},
    }),
  );

  it('merender <html> sendiri karena layout root ikut gagal', () => {
    // Next.js mewajibkan ini. Tanpa <html>, browser membuat dokumen sendiri
    // tanpa <head>, dan stylesheet tidak pernah termuat.
    expect(html).toContain('<html lang="id">');
  });

  it('memberi jalan keluar berupa muat ulang', () => {
    expect(html).toContain('Muat ulang');
  });

  it('Bahasa Indonesia', () => {
    expect(html).toContain('Aplikasi gagal berjalan.');
  });

  it('meng-import globals.css, karena layout root yang mengimpornya ikut gagal', () => {
    // BUKTI: hapus import itu -> tes ini gagal.
    //
    // Yang diuji di sini ADALAH keberadaan import, bukan hasil render. Vitest
    // men-stub berkas CSS, jadi renderToStaticMarkdown tidak pernah bisa
    // membuktikan gaya sudah termuat — dan tidak boleh diklaim begitu.
    // Yang bisa dijaga hanya: berkas ini masih meminta CSS-nya sendiri.
    const isi = readFileSync(join(process.cwd(), 'src/app/global-error.tsx'), 'utf8');
    expect(isi).toMatch(/import\s+['"]\.\/globals\.css['"]/);
  });
});