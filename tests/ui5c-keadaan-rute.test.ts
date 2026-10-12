/**
 * UI-5C — keadaan "memuat" saat transisi rute + judul halaman di header
 * (rules/05 §1.4 "setiap layar punya keadaan: memuat, kosong, error, sukses").
 *
 * Dua hal yang diuji:
 *
 * 1. `loading.tsx` ada di /admin dan /a/[token], dan isinya punya skeletal
 *    yang bisa dilihat — bukan spinner yang berputar tanpa konteks. Skeleton
 *    halaman karyawan juga TIDAK boleh memuat kerangka kamera, karena
 *    `AbsenClient` meminta `getUserMedia` di useEffect mount: menahan render
 *    menunda permintaan izin browser juga.
 *
 * 2. `labelHalaman` memberi label yang BENAR. Ini lebih dari sekadar "ada
 *    output": tiga kasus di bawah semuanya salah pada implementasi_naif yang
 *    mencocokkan "entri menu pertama yang cocok", dan ketiganya menghasilkan
 *    label yang menyesatkan admin.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MemuatAdmin from '../src/app/admin/loading';
import MemuatAbsen from '../src/app/a/[token]/loading';
import { menuUntukPeran } from '../src/app/admin/menu';

function sumber(relatif: string): string {
  return readFileSync(join(process.cwd(), relatif), 'utf8');
}

describe('loading.tsx menutup celah transisi rute', () => {
  it('berkasnya benar-benar ada', () => {
    // BUKTI: hapus salah satu berkas -> tes ini gagal.
    // `existsSync` Sendiri bukan bukti apa pun (AGENTS.md: ia tetap lulus untuk
    // file yang isinya rusak). Yang diuji adalah isi file-nya lewat render
    // di bawah; yang di sini hanya memastikan file ada di lokasi yang benar.
    expect(existsSync(join(process.cwd(), 'src/app/admin/loading.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/app/a/[token]/loading.tsx'))).toBe(true);
  });

  it('skeleton admin terlihat dan terbaca sebagai "memuat"', () => {
    const html = renderToStaticMarkup(createElement(MemuatAdmin));
    // BUKTI: ganti Skeleton dengan teks "Memuat..." -> tes ini gagal.
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain('Memuat halaman');
    // Pembaca layar harus tahu ini keadaan sementara, bukan isi halaman.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Memuat halaman…');
  });

  it('skeleton karyawan TIDAK memuat kerangka kamera', () => {
    // BUKTI: tambah satu <Skeleton className="aspect-[3/4]" /> -> tes ini gagal.
    // Kerangka kamera menipu: kotak abu-abu di tempat kamera terlihat seperti
    // kamera rusak, bukan "sedang memuat".
    const html = renderToStaticMarkup(createElement(MemuatAbsen));
    expect(html).not.toContain('aspect-');
    expect(html).not.toContain('object-cover');
  });

  it('skeleton karyawan mengikuti lebar maksimum yang sama dengan halamannya', () => {
    // BUKTI: ubah max-w-[480px] di loading.tsx saja -> tes ini gagal.
    // Halaman dan loading harus selaras, kalau tidak layar melompat saat data
    // tiba — persis gejala yang loading.tsx diciptakan untuk dihilangkan.
    const html = renderToStaticMarkup(createElement(MemuatAbsen));
    expect(html).toContain('max-w-[480px]');
    const isi = sumber('src/app/a/[token]/page.tsx');
    expect(isi).toContain('max-w-[480px]');
  });
});

describe('labelHalaman: label header sama dengan label sidebar', () => {
  it('fungsi yang diuji adalah IMPORAN NYATA, bukan salinan', async () => {
    // Ini yang menutup celah UI-5C. Tes sebelumnya menyalin logika labelHalaman
    // ke dalam file tes; mutasi pada kode asli (selalu pakai SUPER_ADMIN)
    // LULUS karena yang diuji tetap salinan yang sehat.
    const modul = await import('../src/app/admin/label-halaman');
    expect(typeof modul.labelHalaman).toBe('function');
  });

  it('JudulHalaman adalah client component — tanpa ini build produksi gagal', () => {
    // BUKTI: hapus 'use client' -> tes ini gagal.
    // Directive ini HANYA ketahuan saat `next build`. `tsc` tidak menangkapnya
    // (usePathname bertipe netral di server component), dan vitest tidak
    // menjalankan build sama sekali. Tanpa tes ini, regresi ini baru terlihat
    // saat deploy.
    const isi = sumber('src/app/admin/judul-halaman.tsx');
    expect(isi.trimStart().startsWith("'use client'")).toBe(true);
    expect(isi).toContain('usePathname');
  });

  it('layout.tsx tetap server component (tidak boleh punya use client)', () => {
    // Sebaliknya: layout memanggil cookies(). Begitu layout jadi client, seluruh
    // subtree admin ikut jadi client — termasuk halaman yang butuh data server.
    const isi = sumber('src/app/admin/layout.tsx');
    expect(isi.trimStart().startsWith("'use client'")).toBe(false);
    expect(isi).toContain('cookies()');
  });

  it('JudulHalaman benar-benar dirender di header', () => {
    // BUKTI: hapus <JudulHalaman peran={sesi.peran} /> dari header -> tes gagal.
    // Tanpa ini, komponennya bisa ada di disk tapi tidak pernah muncul — dan
    // tidak ada tes lain yang akan memberitahu.
    const isi = sumber('src/app/admin/layout.tsx');
    expect(isi).toContain('<JudulHalaman peran={sesi.peran} />');
    // Dan harus DI DALAM <header>, bukan di main atau di sidebar.
    const header = isi.slice(isi.indexOf('<header'), isi.indexOf('</header>'));
    expect(header, 'JudulHalaman tidak ada di dalam <header>').toContain('JudulHalaman');
  });

  for (const [url, diharapkan] of [
    ['/admin', 'Dashboard'],
    ['/admin/verifikasi', 'Verifikasi Absensi'],
    ['/admin/jadwal', 'Jadwal'],
    ['/admin/agenda', 'Agenda'],
    ['/admin/audit-log', 'Audit Log'],
    ['/admin/master/karyawan', 'Karyawan'],
    ['/admin/master/shift', 'Shift'],
    ['/admin/master/toko', 'Toko'],
    ['/admin/ubah-password', 'Ubah Password'],
  ] as const) {
    it(`${url} -> "${diharapkan}"`, async () => {
      // BUKTI: ganti label di menu.ts -> tes ini gagal.
      const { labelHalaman } = await import('../src/app/admin/label-halaman');
      expect(labelHalaman(url, 'SUPER_ADMIN')).toBe(diharapkan);
    });
  }

  it('setiap halaman yang punya page.tsx dapat label', async () => {
    // BUKTI: tambah halaman tanpa menambah entri menu -> tes ini gagal.
    // Ini yang mencegah halaman baru muncul tanpa judul di header.
    const { labelHalaman } = await import('../src/app/admin/label-halaman');
    const halaman = [
      'agenda', 'akun', 'audit-log', 'jadwal', 'master/karyawan', 'master/shift',
      'master/toko', 'pengaturan', 'rekap', 'tidak-berangkat', 'ubah-password',
      'verifikasi', 'verifikasi-agenda',
    ];
    for (const h of halaman) {
      expect(labelHalaman(`/admin/${h}`, 'SUPER_ADMIN'), `/admin/${h} tidak dapat label`).not.toBeNull();
    }
  });

  it('sub-halaman TIDAK mewarisi label induk — memang tidak ada route turunan', async () => {
    // BUKTI: kembalikan fallback prefix -> tes ini gagal.
    // src/app/admin tidak punya satu pun subdirektori halaman: semua halaman
    // ada tepat satu level. Yang `[id]` itu milik src/app/api, bukan halaman.
    const { labelHalaman } = await import('../src/app/admin/label-halaman');
    expect(labelHalaman('/admin/verifikasi/123', 'SUPER_ADMIN')).toBeNull();
    expect(labelHalaman('/admin/jadwal/bulan', 'SUPER_ADMIN')).toBeNull();
  });

  it('Admin biasa TIDAK melihat label halaman Super Admin', async () => {
    // BUKTI: ubah labelHalaman agar selalu memakai SUPER_ADMIN -> tes gagal.
    // Mutasi INI LULUS ketika logikanya masih disalin; sekarang yang diuji
    // kode aslinya. Kalau bocor, admin biasa mengetik /admin/akun dan melihat
    // label di header meski halamannya ditolak server — membocorkan halaman
    // yang tidak boleh dia lihat (rules/05 §4).
    const { labelHalaman } = await import('../src/app/admin/label-halaman');
    expect(labelHalaman('/admin', 'ADMIN')).toBe('Dashboard');
    expect(labelHalaman('/admin/akun', 'ADMIN')).toBeNull();
    expect(labelHalaman('/admin/audit-log', 'ADMIN')).toBeNull();
    expect(labelHalaman('/admin/pengaturan', 'ADMIN')).toBeNull();
    expect(labelHalaman('/admin/master/karyawan', 'ADMIN')).toBeNull();
  });

  it('setiap label dari menu punya penanda yang konsisten', () => {
    // Semua label menu tidak boleh punya trailing space atau label kosong —
    // label itu langsung tampil sebagai <h1> di header.
    for (const peran of ['ADMIN', 'SUPER_ADMIN'] as const) {
      for (const k of menuUntukPeran(peran)) {
        for (const i of k.item) {
          expect(i.label.trim(), `label "${i.label}" di ${k.judul}`).toBe(i.label);
          expect(i.label.length, `label kosong di ${k.judul}`).toBeGreaterThan(0);
        }
      }
    }
  });
});