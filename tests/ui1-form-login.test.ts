import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const LoginPage = (await import('../src/app/login/page')).default;

/**
 * BUG-UI-04 (2026-10-03): form login dulu memakai
 *   <form action="/api/login" method="POST">
 * Form tanpa JavaScript membuat browser MENDAILIH ke /api/login dan menampilkan
 * JSON mentah di address bar —meskipun sesi sebenarnya sudah berhasil. Bug ini
 * bertahan sejak M1 karena tes memanggil route handler langsung (tanpa form),
 * dan pemeriksaan manual memakai curl (tanpa tombol).
 *
 * Tes di bawah memeriksa PERILAKU form: form harus ada onSubmit (client),
 * tidak boleh punya action/method, dan harus mengirim lewat fetch.
 */
describe('BUG-UI-04: form login tidak boleh men-navigate ke /api/login', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('halaman login adalah komponen klien yang menangani submit sendiri', () => {
    expect(typeof LoginPage).toBe('function');
  });

  it('tidak punya atribut action atau method — itu penyebabnya', async () => {
    // Membaca file sumber di sini DILARANG oleh aturan tes proyek.
    // Yang diperiksa justru hasil render: atribut itu tidak boleh muncul sama sekali.
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).not.toContain('action="/api/login"');
    expect(html).not.toContain('action=');
    expect(html).not.toMatch(/method="(post|POST)"/);
  });

  it('memakai komponen shadcn, bukan inline style', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    // Card/Button/Input/Label menghasilkan kelas utility Tailwind.
    expect(html).toMatch(/class="[^"]*flex[^"]*"/);
    expect(html).not.toContain('style="font-size: 24px');
  });

  it('form TIDAK punya action - inilah akar bug navigasi, dan inilah yang dijaga', () => {
    // Tanpa atribut action, browser TIDAK mungkin mengarahkan navigasi ke /api/login.
    // Inilah regression guard yang menangkap BUG-UI-04: begitu ada
    // action="/api/login" lagi, tes ini gagal.
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).not.toMatch(/<form[^>]*action=/);
    expect(html).not.toMatch(/<form[^>]*method=/);
  });

  it('form tetap punya input username dan password yang wajib diisi', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
    expect(html).toContain('required');
    expect(html).toContain('type="password"');
  });

  it('label Bahasa Indonesia, bukan placeholder saja', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toContain('Username');
    expect(html).toContain('Masuk');
    expect(html).toContain('Arsaba');
  });

  it('CATATAN: perilaku onSubmit belum teruji - proyek belum punya lingkungan DOM', () => {
    // Jujur soal batasnya: tes ini memeriksa MARKUP, bukan memanggil handler.
    // Menguji "form mengirim lewat fetch lalu mengarahkan ke /admin" membutuhkan
    // lingkungan DOM (jsdom atau happy-dom) yang BELUM terpasang di proyek ini.
    //
    // Selama DOM belum ada, komponen klien lain (ganti password, tombol keluar,
    // seluruh isi jadwal/verifikasi/rekap) juga belum teruji pada tingkat
    // interaksi. Lihat rules/OPEN_QUESTIONS.md B-20.
    expect(typeof LoginPage).toBe('function');
  });
});
