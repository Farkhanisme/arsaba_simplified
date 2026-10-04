/**
 * Ikon Lucide di aplikasi.
 *
 * Aturannya (keputusan pemilik): ikon dari `lucide-react` — sudah terinstal dan
 * dipakai semua komponen shadcn. Yang dilarang: karakter emoji sebagai ikon
 * (tampil beda di tiap HP, tidak ikut mode gelap) dan SVG tulisan tangan.
 *
 * Semua tes di sini me-render komponen sungguhan lewat
 * `renderToStaticMarkup(createElement(...))` lalu memeriksa HTML hasilnya.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'token-uji' }),
  usePathname: () => '/admin',
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  notFound: (): never => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AbsenClient, { IsiModalFoto } from '../src/app/a/[token]/AbsenClient';
import { SidebarProvider } from '../src/components/ui/sidebar';
import TautanMenu from '../src/app/admin/tautan-menu';
import TombolKeluar from '../src/app/admin/tombol-keluar';
import LoginPage from '../src/app/login/page';
import PengalihTema from '../src/app/pengalih-tema';
import type { InfoAbsen } from '../src/server/absen-info';

const infoAwal: InfoAbsen = {
  nama: 'Kry Ikon',
  toko: 'Toko Ikon',
  tanggal: '2026-10-03',
  tanggalPanjang: 'Jumat, 3 Okt 2026',
  jam: '07:00',
  jadwal: null,
  riwayat: [],
  aksi: 'CHECKIN',
  alasan: '',
};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('tombol halaman absen punya ikon Lucide', () => {
  it('tombol utama Foto dan Ganti Kamera merender svg', () => {
    const html = render(h(AbsenClient, { infoAwal }));
    expect(html).toContain('Foto');
    expect(html).toContain('Ganti Kamera');
    // Lucide merender <svg>; tombol teks polos tidak punya svg sama sekali.
    expect((html.match(/<svg/g) ?? []).length, 'jumlah ikon svg').toBeGreaterThanOrEqual(2);
  });

  it('isi modal Foto Ulang dan Absen merender svg', () => {
    const html = render(
      h(IsiModalFoto, { src: 'blob:x', aksi: 'CHECKIN', mengirim: false, onFotoUlang: () => {}, onKirim: () => {} }),
    );
    expect(html).toContain('Foto Ulang');
    expect(html).toContain('>Absen<');
    expect((html.match(/<svg/g) ?? []).length, 'ikon di kedua tombol modal').toBeGreaterThanOrEqual(2);
  });
});

describe('menu sidebar punya ikon Lucide per label', () => {
  // SidebarMenuButton butuh konteks SidebarProvider — dibungkus seperti di layout.
  function htmlMenu(href: string, label: string): string {
    return render(h(SidebarProvider, null, h(TautanMenu, { href, label })));
  }

  it('label yang dikenal merender satu ikon svg', () => {
    const html = htmlMenu('/admin', 'Dashboard');
    expect(html).toContain('Dashboard');
    expect((html.match(/<svg/g) ?? []).length, 'ikon Dashboard').toBe(1);
    const jadwal = htmlMenu('/admin/jadwal', 'Jadwal');
    expect((jadwal.match(/<svg/g) ?? []).length, 'ikon Jadwal').toBe(1);
  });

  it('label tak dikenal tetap tampil tanpa ikon — menu tidak boleh hilang', () => {
    const html = htmlMenu('/admin/x', 'Menu Belum Ada');
    expect(html).toContain('Menu Belum Ada');
    expect(html, 'tidak ada svg untuk label tak dikenal').not.toContain('<svg');
  });

  it('tombol Keluar memakai ikon LogOut', () => {
    const html = render(h(TombolKeluar));
    expect(html).toContain('Keluar');
    expect((html.match(/<svg/g) ?? []).length, 'ikon Keluar').toBe(1);
  });
});

describe('tombol Masuk di halaman login memakai ikon', () => {
  it('merender svg di dalam tombol submit', () => {
    const html = render(h(LoginPage));
    expect(html).toContain('Masuk');
    expect(html, 'ikon LogIn').toContain('<svg');
  });
});

describe('tombol tema memakai ikon Lucide, bukan emoji', () => {
  it('labelTema teks polos Terang/Gelap tanpa emoji', async () => {
    const { labelTema } = await import('../src/app/pengalih-tema');
    expect(labelTema(false, false)).toBe('Tema');
    expect(labelTema(true, true)).toBe('Terang');
    expect(labelTema(true, false)).toBe('Gelap');
  });

  it('pengalih tema merender SunIcon/MoonIcon dari lucide-react', () => {
    const kode = readFileSync('src/app/pengalih-tema.tsx', 'utf-8');
    // Urutan nama di import tidak penting — yang penting keduanya dari lucide.
    expect(kode, 'SunIcon dari lucide').toMatch(/import \{[^}]*SunIcon[^}]*\} from 'lucide-react'/);
    expect(kode, 'MoonIcon dari lucide').toMatch(/import \{[^}]*MoonIcon[^}]*\} from 'lucide-react'/);
    expect(kode, 'ikon dirender sesuai mode').toMatch(/\{siap \? \(gelap \? <SunIcon \/> : <MoonIcon \/>\) : null\}/);
    expect(kode, 'tidak ada emoji matahari/bulan').not.toMatch(/[☀🌙]/);
  });

  it('render statis menampilkan teks Tema tanpa emoji', () => {
    const html = render(h(PengalihTema));
    expect(html).toContain('Tema');
    expect(html, 'tidak ada emoji di HTML').not.toMatch(/[☀🌙]/);
  });
});
