/**
 * BUG-UI-07 — halaman karyawan `/a/[token]` tetap punya komponen putih saat
 * mode gelap aktif.
 *
 * Akar masalahnya: halaman ini 100% inline style dengan warna LITERAL
 * (`background: '#fff'`, `border: '1px solid #ddd'`, `color: '#444'`) yang tidak
 * pernah berubah. `tests/m3-halaman.test.ts` hanya memeriksa teks, jadi bug
 * warna lolos dari sana.
 *
 * Tes di sini memanggil komponen sungguhan lewat renderToStaticMarkup lalu
 * memeriksa HTML-nya: tidak boleh ada warna literal, dan setiap warna harus
 * memakai token yang punya nilai berbeda di `:root` dan `.dark`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DaftarRiwayat } from '../src/app/a/[token]/page';

const riwayat = [
  { jenis: 'CHECKIN', waktu: '2026-10-03T07:05:00+07:00', status: 'DISETUJUI', alasan_tolak: null },
  { jenis: 'CHECKOUT', waktu: '2026-10-03T15:02:00+07:00', status: 'MENUNGGU', alasan_tolak: null },
  { jenis: 'CHECKIN', waktu: '2026-10-02T09:00:00+07:00', status: 'DITOLAK', alasan_tolak: 'Foto tidak terbaca.' },
];

function html(): string {
  return renderToStaticMarkup(createElement(DaftarRiwayat, { riwayat }));
}

describe('BUG-UI-07 — halaman absen tidak boleh memakai warna literal', () => {
  it('riwayat absen tidak memakai hex untuk latar, teks, atau border', () => {
    const h = html();
    // Setiap(style=...) dipecah, lalu diperiksa isinya.
    const gaya = h.match(/style="[^"]*"/g) ?? [];
    expect(gaya.length, 'ada gaya inline yang perlu diperiksa').toBeGreaterThan(0);
    for (const g of gaya) {
      expect(g, 'warna literal di gaya inline').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(g, 'warna rgb/hsl literal').not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
      expect(g, 'nama warna putih literal').not.toMatch(/:\s*(white|black)\b/);
    }
  });

  it('setiap warna memakai token CSS, bukan hex', () => {
    const h = html();
    const tokenDipakai = [...h.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]!);
    expect(tokenDipakai.length, 'minimal satu token dipakai').toBeGreaterThan(0);
    expect(new Set(tokenDipakai).size, 'token yang dipakai').toBeGreaterThan(1);
  });

  it('token yang dipakai HARUS punya nilai berbeda di terang dan gelap', () => {
    // Ini inti bugnya: token yang sama persis di dua mode berarti panel tetap
    // putih di mode gelap. Baca globals.css dan bandingkan blok :root vs .dark.
    const css = readFileSync('src/app/globals.css', 'utf-8');
    const rootBlok = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
    const darkBlok = css.match(/\.dark\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rootBlok, 'blok :root ada di globals.css').not.toBe('');
    expect(darkBlok, 'blok .dark ada di globals.css').not.toBe('');

    const nilai = (blok: string, token: string): string | null => {
      const m = blok.match(new RegExp(`${token}:\\s*([^;]+)`));
      return m?.[1]?.trim() ?? null;
    };

    const tokenDipakai = [...new Set([...html().matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]!))];
    for (const token of tokenDipakai) {
      const terang = nilai(rootBlok, token);
      const gelap = nilai(darkBlok, token);
      expect(terang, `${token} punya nilai di :root`).not.toBeNull();
      expect(gelap, `${token} punya nilai di .dark — tanpa ini token jadi kosong dan teks hilang`).not.toBeNull();
      expect(terang, `${token} BERBEDA antara terang dan gelap`).not.toBe(gelap);
    }
  });

  it('badge status memakai token terpisah per status', () => {
    const h = html();
    expect(h, 'badge Menunggu').toContain('var(--badge-menunggu)');
    expect(h, 'badge Disetujui').toContain('var(--badge-setuju)');
    expect(h, 'badge Ditolak').toContain('var(--badge-ditolak)');
    // Teks badge harus punya token sendiri supaya kontrasnya dijamin.
    for (const t of ['menunggu', 'setuju', 'ditolak']) {
      expect(h, `warna teks badge ${t}`).toContain(`var(--badge-${t}-teks)`);
    }
  });

  it('ketiga status menampilkan teksnya, bukan hanya warna (rules/05 §3)', () => {
    const h = html();
    expect(h).toContain('Check-in');
    expect(h).toContain('Check-out');
    expect(h).toContain('Disetujui');
    expect(h).toContain('Menunggu');
    expect(h).toContain('Ditolak');
    expect(h, 'alasan penolakan ditampilkan').toContain('Foto tidak terbaca.');
  });

  it('daftar kosong tetap berbahasa Indonesia', () => {
    const kosong = renderToStaticMarkup(createElement(DaftarRiwayat, { riwayat: [] }));
    expect(kosong).toContain('Belum ada absen hari ini.');
  });
});

describe('BUG-UI-07 — sumber halaman absen bebas warna literal', () => {
  const berkas = ['src/app/a/[token]/page.tsx', 'src/app/a/[token]/AbsenClient.tsx'];

  for (const f of berkas) {
    it(`${f} tidak punya warna literal di kode (komentar dikecualikan)`, () => {
      const isi = readFileSync(f, 'utf-8');
      const tanpaKomentar = isi
        .split('\n')
        .filter((baris) => !baris.trim().startsWith('*') && !baris.trim().startsWith('//') && !baris.trim().startsWith('/*'))
        .join('\n');
      // Pengecualian satu-satunya: <video> tetap hitam di kedua mode, karena
      // itu pratinjau kamera, bukan panel UI.
      const tanpaVideo = tanpaKomentar.replace(/background:\s*'#000'/g, '');
      expect(tanpaVideo, 'warna literal di halaman absen').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(tanpaVideo, 'rgba/hsl literal').not.toMatch(/\b(rgba|hsla)\(/);
    });
  }
});