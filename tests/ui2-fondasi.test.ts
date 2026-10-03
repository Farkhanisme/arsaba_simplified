/**
 * UI-2 fondasi: komponen bersama admin + tombol keluar + pengalih tema.
 *
 * Semua tes me-render komponen sungguhan lewat
 * `renderToStaticMarkup(createElement(...))` lalu memeriksa HTML hasilnya.
 * Tidak ada yang membaca teks berkas dan tidak ada `expect(true).toBe(true)`.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

import {
  AksesDitolak,
  PanelGalat,
  PanelMemuat,
  Toast,
} from '../src/app/admin/komponen';
import { labelKeluar } from '../src/app/admin/tombol-keluar';
import { labelTema } from '../src/app/pengalih-tema';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('AksesDitolak', () => {
  it('menampilkan pesan jelas dengan Card shadcn, bukan layar kosong', () => {
    const html = render(h(AksesDitolak));
    expect(html).toContain('Akses ditolak');
    expect(html).toContain('Anda tidak punya akses ke halaman ini.');
    // Card shadcn dibuktikan lewat kelas group/card (data-slot tertimpa, lihat NOTES §14).
    expect(html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).toHaveLength(1);
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-content"');
  });

  it('tidak memakai elemen polos button/input/select/table/textarea', () => {
    const html = render(h(AksesDitolak));
    expect(html).not.toMatch(/<(table|select|input|textarea|button)[\s>]/);
  });
});

describe('Toast', () => {
  it('sukses memakai Alert hijau dengan role status', () => {
    const html = render(h(Toast, { pesan: { jenis: 'sukses', teks: 'Karyawan berhasil ditambah.' }, onTutup: tidakAda }));
    expect(html).toContain('Karyawan berhasil ditambah.');
    expect(html).toContain('data-slot="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain('bg-green-50');
  });

  it('galat memakai Alert destructive dengan tombol Tutup shadcn', () => {
    const html = render(h(Toast, { pesan: { jenis: 'galat', teks: 'Gagal menyimpan.' }, onTutup: tidakAda }));
    expect(html).toContain('Gagal menyimpan.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('Tutup pesan');
  });

  it('tanpa pesan tidak merender apa pun', () => {
    expect(render(h(Toast, { pesan: null, onTutup: tidakAda }))).toBe('');
  });
});

describe('PanelGalat + PanelMemuat bersama', () => {
  it('galat menampilkan pesan + tombol Coba lagi dari Button shadcn', () => {
    const html = render(h(PanelGalat, { pesan: 'Gagal memuat dashboard.', onCobaLagi: tidakAda }));
    expect(html).toContain('Gagal memuat dashboard.');
    expect(html).toContain('Coba lagi');
    expect(html).toContain('data-slot="button"');
  });

  it('memuat memakai Skeleton, bukan teks Memuat…', () => {
    const html = render(h(PanelMemuat, { jumlahBaris: 3 }));
    expect(html.match(/data-slot="skeleton"/g) ?? []).toHaveLength(3);
    expect(html).toContain('aria-label="Memuat"');
    expect(html).not.toContain('Memuat…');
  });
});

describe('labelKeluar + labelTema (fungsi murni)', () => {
  it('label keluar berganti saat mengirim', () => {
    expect(labelKeluar(false)).toBe('Keluar');
    expect(labelKeluar(true)).toBe('Keluar…');
  });

  it('label tema Indonesia: Tema / Terang / Gelap', () => {
    expect(labelTema(false, false)).toBe('Tema');
    expect(labelTema(true, true)).toContain('Terang');
    expect(labelTema(true, false)).toContain('Gelap');
  });
});

describe('tidak ada teks Inggris terlihat di fondasi', () => {
  it('AksesDitolak + Toast + PanelGalat bebas kata Inggris shadcn', () => {
    const gabung =
      render(h(AksesDitolak)) +
      render(h(Toast, { pesan: { jenis: 'galat', teks: 'x.' }, onTutup: tidakAda })) +
      render(h(PanelGalat, { pesan: 'Gagal.', onCobaLagi: tidakAda }));
    const teks = gabung.replace(/<[^>]*>/g, ' ');
    expect(teks).not.toMatch(/Close|Sidebar|Toggle Sidebar|Submit|Cancel|Loading/);
  });
});
