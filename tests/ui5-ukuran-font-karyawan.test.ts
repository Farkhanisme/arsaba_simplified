/**
 * UI-5 Batch A — ukuran font halaman karyawan (rules/05 §2: "ukuran dasar ≥ 16 px
 * di halaman karyawan").
 *
 * Halaman ini dipakai 26 orang, sebagian besar dari HP kelas bawah, sering
 * sambil berdiri dan dengan satu tangan. Sebelum 2026-10-12 di dalamnya ada
 * 7 `text-xs` (12px) dan 11 `text-sm` (14px) — dan yang 12px justru dipakai
 * untuk hal yang paling penting dibaca: alasan penolakan, keterangan agenda,
 * dan syarat foto.
 *
 * Ada dua jenis pemeriksaan di sini, dan keduanya memang dibutuhkan:
 *
 *   1. SAPUAN SUMBER — jaminan invarian untuk SELURUH berkas. Ini memang
 *      membaca teks berkas, dan itu disengaja: persis yang dilakukan ESLint
 *      untuk aturan "kelas ini tidak boleh muncul". Untuk memverifikasi
 *      "tidak ada di mana pun", renderToStaticMarkup tidak bisa dipakai karena
 *      beberapa komponennya butuh kamera, mediaDevices, dan konteks browser.
 *   2. RENDER — verifikasi bahwa kelas yang benar-benar muncul di HTML punya
 *      ukuran yang cukup, pada komponen yang bisa dirender tanpa browser.
 *
 * Yang diperiksa adalah NAMA KELAS, bukan piksel absolut, karena mengikuti
 * skala Tailwind.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DaftarRiwayat } from '../src/app/a/[token]/page';

const BERKAS_KARYAWAN = readdirSync(join(process.cwd(), 'src/app/a/[token]')).filter((f) =>
  f.endsWith('.tsx'),
);

function sumber(nama: string): string {
  const teks = readFileSync(join(process.cwd(), 'src/app/a/[token]', nama), 'utf8');
  // Komentar dibuang dulu. Docblock page.tsx menjelaskan aturan "text-xs tidak
  // boleh dipakai" — jadi kalau tidak dibuang, dokumentasi yang jujur justru
  // menggagalkan tesnya sendiri. Ini jebakan tes-source yang nyata, bukan
  // hypothetis: tes ini sempat gagal persis karena itu.
  return teks.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const RIWAYAT = [
  { jenis: 'CHECKIN', waktu: '07:05', status: 'DISETUJUI', alasan_tolak: null, keterangan: null },
  { jenis: 'CHECKOUT', waktu: '15:02', status: 'DITOLAK', alasan_tolak: 'Foto tidak terbaca.', keterangan: null },
];

describe('sapuansumber: tidak ada font kecil di halaman karyawan', () => {
  it('daftar berkasnya benar-benar terpetakan', () => {
    // Tanpa ini, sapuansumber di bawah bisa lulus hampa kalau folder berubah nama.
    expect(BERKAS_KARYAWAN.length).toBeGreaterThanOrEqual(4);
    expect(BERKAS_KARYAWAN).toContain('page.tsx');
    expect(BERKAS_KARYAWAN).toContain('AbsenClient.tsx');
  });

  it('TIDAK ada text-xs (12px) di satu pun berkas karyawan', () => {
    // BUKTI: kembalikan satu `text-base` menjadi `text-xs` -> tes ini gagal.
    const pedals = BERKAS_KARYAWAN.filter((f) => /\btext-xs\b/.test(sumber(f)));
    expect(pedals, `text-xs masih dipakai di: ${pedals.join(', ')}`).toEqual([]);
  });

  it('TIDAK ada ukuran font bebas di bawah 16px', () => {
    // Menutup jalur lain untuk teks kecil: text-[13px], text-[0.8rem], dll.
    const kecil = BERKAS_KARYAWAN.filter((f) => {
      const semua = [...sumber(f).matchAll(/text-\[([0-9.]+)(px|rem)\]/g)];
      return semua.some(
        ([, angka, satuan]) => (satuan === 'px' ? Number(angka) < 16 : Number(angka) < 1),
      );
    });
    expect(kecil, `ukuran bebas < 16px di: ${kecil.join(', ')}`).toEqual([]);
  });
});

describe('render: isi halaman yang wajib dibaca benar-benar 16px', () => {
  const html = renderToStaticMarkup(createElement(DaftarRiwayat, { riwayat: RIWAYAT }));

  /**
   * JEBAKAN. Assertion `not.toMatch(/text-xs/)` terhadap SELURUH html akan
   * selalu gagal — bukan karena halaman ini salah, tapi karena komponen shadcn
   * membawa `text-xs` di kelas dasarnya sendiri:
   *   - Badge: "inline-flex h-5 ... text-xs font-medium"
   *   - Card:  "group/card flex flex-col ... text-sm text-card-foreground"
   * Badge memang SEHARUSNYA kecil, itu disengaja. Yang boleh diperiksa hanya
   * elemen yang teksnya dibaca karyawan. Persis jebakan yang sama seperti
   * literal `disabled:` di kelas dasar Button.
   */

  it('baris absen memakai text-base', () => {
    // BUKTI: ubah className ini -> text-xs -> tes ini gagal.
    expect(html).toMatch(/<span class="text-base">Check-in · 07:05 WIB<\/span>/);
    expect(html).toMatch(/<span class="text-base">Check-out · 15:02 WIB<\/span>/);
  });

  it('alasan penolakan 16px — itu yang paling sering dibaca', () => {
    expect(html).toMatch(
      /<p class="[^"]*\btext-base\b[^"]*">Ditolak: Foto tidak terbaca\.<\/p>/,
    );
  });

  it('keadaan kosong juga 16px', () => {
    // BUKTI: kembalikan ke text-sm -> tes ini gagal.
    const kosong = renderToStaticMarkup(createElement(DaftarRiwayat, { riwayat: [] }));
    expect(kosong).toMatch(/<p class="[^"]*\btext-base\b[^"]*">Belum ada absen hari ini\.<\/p>/);
  });

  it('kelas dasar Card memang text-sm, jadi teks WAJIB punya ukuran sendiri', () => {
    // Penjelas kenapa catatan di atas tidak boleh dilonggarkan: melepas
    // `text-base` dari elemen di atas berarti teks turun ke 14px secara diam-diam.
    // `[^>]*` (bukan `[^"]*`) karena text-sm ada di atribut class, bukan di data-slot.
    expect(html).toMatch(/data-slot="card"[^>]*\bclass="[^"]*\btext-sm\b/);
  });
});