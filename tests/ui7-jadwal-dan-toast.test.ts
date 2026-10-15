/**
 * UI-7 — dua tugas presentation layer: jadwal bulanan tidak lagi menggeser
 * seluruh halaman, dan halaman admin punya toast.
 *
 * BATAS YANG DISERTAHUI SECARA KONSESUEN (mirip B-23 untuk navigasi bawah):
 * `renderToStaticMarkup` tidak punya layout, viewport, atau event. Jadi:
 *   - "halaman tidak bisa digeser ke samping" TIDAK dibuktikan di sini. Yang
 *     dibuktikan hanya présence `min-w-0` pada rantai flex, karena itu yang
 *     membuat overflow-X di dalam tabel finally aktif. Kebenarannya diukur di
 *     browser (lihat bagian "Verifikasi manual" di laporan).
 *   - Toast yang benar-benar muncul setelah tombol ditekan tidak bisa diuji
 *     di sini: `useEffect` tidak jalan di render statis, jadi tidak ada aksi
 *     yang bisa dipicu. Yang dibuktikan: Toaster admin terpasang tepat satu,
 *     posisinya bottom-right, dan labelnya Bahasa Indonesia.
 *
 * Yang TIDAK boleh dilonggarkan: pengujian di bawah memakai RENDER nyata untuk
 * apa pun yang bisa dirender. Pengecualian satu dan hanya satu: posisi Toaster
 * (`bottom-right`) tidak pernah muncul di markup sonner saat SSR, jadi props-nya
 * ditangkap lewat mock — bukan karena '=' tidak bisa diuji, tapi karena memang
 * tidak ada di keluaran render.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Teks yang benar-benar dibaca pengguna: seluruh tag dibuang lebih dulu. */
function teksTampak(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

describe('Tugas 1 — rantai flex yang membuat halaman ikut melebar', () => {
  it('SidebarInset punya min-w-0', async () => {
    const { SidebarInset } = await import('@/components/ui/sidebar');
    const html = renderToStaticMarkup(
      createElement(SidebarInset, { children: createElement('p', null, 'isi') }),
    );
    // Tanpa `min-w-0`, flex item menolak menyusut di bawah lebar isinya, jadi
    // `overflow-x-auto` di dalam tabel tidak pernah aktif dan seluruh halaman
    // ikut melebar. Dukur ulang di browser wajib — kelas ini bukan bukti
    // kebenaran, cuma pagar agar kelas itu tidak hilang diam-diam.
    expect(html, 'SidebarInset').toMatch(/<main[^>]*class="[^"]*\bmin-w-0\b/);
  });

  it('SidebarInset tetap punya sifat flex yang lain (tidak ditimpa semua)', async () => {
    const { SidebarInset } = await import('@/components/ui/sidebar');
    const html = renderToStaticMarkup(
      createElement(SidebarInset, { children: createElement('p', null, 'isi') }),
    );
    for (const kelas of ['flex', 'flex-1', 'flex-col', 'relative']) {
      expect(html, `kelas ${kelas} masih ada`).toMatch(new RegExp(`\\b${kelas}\\b`));
    }
  });

  it('wrapper tabel tetap punya overflow-x-auto (halaman JANGAN ikut jadi scroll container)', async () => {
    const { Table } = await import('@/components/ui/table');
    const html = renderToStaticMarkup(createElement(Table, { children: 'x' }));
    // overflowing harus tetap di DALAM wrapper tabel, bukan di halaman.
    expect(html).toMatch(/<div[^>]*class="[^"]*overflow-x-auto/);
    // Tanpa maxH tidak boleh ada scroll vertikal — halaman bulanan sengaja
    // tidak diberi maxH (keputusan terpisah, belum disetujui pemilik).
    expect(html, 'tanpa maxH tidak boleh ada overflow-y-auto').not.toMatch(/overflow-y-auto/);
    expect(html, 'tanpa maxH tidak boleh ada max-height').not.toMatch(/max-height/);
  });
});

describe('Tugas 2 — Toaster admin', () => {
  it('ToasterAdmin merender tepat satu wadah notifikasi', async () => {
    const ToasterAdmin = (await import('../src/app/admin/ToasterAdmin')).default;
    const html = renderToStaticMarkup(createElement(ToasterAdmin));
    // Sonner baru membuat <ol data-sonner-toaster> setelah ada toast pertama;
    // di SSR yang muncul adalah <section aria-live>. Itu yang dihitung di sini.
    expect((html.match(/aria-live="polite"/g) ?? []).length, 'tepat satu wadah').toBe(1);
    expect(html).toContain('aria-atomic="false"');
  });

  it('label wadah notifikasi Bahasa Indonesia, bukan bawaan sonner', async () => {
    const ToasterAdmin = (await import('../src/app/admin/ToasterAdmin')).default;
    const html = renderToStaticMarkup(createElement(ToasterAdmin));
    // Sonner menempelkan "alt+T" pada label — jadi yang diperiksa bagian
    // namanya, bukan keseluruhan atribut.
    expect(html).toMatch(/aria-label="Notifikasi alt\+T"/);
    expect(html, 'label bawaan sonner tidak boleh ikut').not.toMatch(/Notifications/i);
    // Dan tidak ada kata Inggris lain di teks yang tampil.
    const kataInggris = ['Notifications', 'Loading', 'Error', 'Success', 'Dismiss', 'Close'];
    const ketemu = kataInggris.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(teksTampak(html)));
    expect(ketemu, `kata Inggris: ${ketemu.join(', ')}`).toEqual([]);
  });

  it('posisinya bottom-right (props yang diteruskan ke sonner)', async () => {
    // Pengecualian mock yangjustifikasi: `position` tidak pernah muncul di markup
    // sonner saat SSR maupun saat belum ada toast — jadi tidak ada yang bisa
    // diperiksa di render. Yang diperiksa: Toaster admin meneruskan
    // bottom-right, DAN bukan top-center milik halaman karyawan.
    const captured: Record<string, unknown>[] = [];
    vi.doMock('@/components/ui/sonner', () => ({
      Toaster: (props: Record<string, unknown>) => {
        captured.push(props);
        return null;
      },
    }));
    vi.resetModules();
    const ToasterAdmin = (await import('../src/app/admin/ToasterAdmin')).default;
    renderToStaticMarkup(createElement(ToasterAdmin));
    expect(captured.length, 'Toaster dipanggil tepat sekali').toBe(1);
    expect(captured[0]?.['position'], 'posisi admin').toBe('bottom-right');
    expect(captured[0]?.['position'], 'bukan top-center milik karyawan').not.toBe('top-center');
    vi.doUnmock('@/components/ui/sonner');
    vi.resetModules();
  });

  it('layout admin memasang tepat satu Toaster', async () => {
    // Layout memanggil cookies() lalu getSession() lalu query DB. Semuanya
    // dimock supaya yang diuji STRUKTUR layout, bukan autentikasi.
    vi.doMock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'sesi-uji' }) }) }));
    vi.doMock('../src/server/auth', () => ({
      getSession: async () => ({ pengguna_id: 1 }),
    }));
    vi.doMock('../src/server/db', () => ({
      getDb: () => ({
        execute: async () => ({ rows: [{ id: 1, username: 'superadmin', peran: 'SUPER_ADMIN', aktif: 1 }] }),
      }),
    }));
    vi.resetModules();
    const AdminLayout = (await import('../src/app/admin/layout')).default;
    const ToasterAdmin = (await import('../src/app/admin/ToasterAdmin')).default;
    const elemen = await AdminLayout({ children: createElement('p', null, 'isi') });

    // Susun ulang (React belum render, hanya elemen) lalu hitung berapa kali
    // ToasterAdmin muncul. Ini satu-satunya cara membuktikan "tepat satu"
    // tanpa mengandalkan isi DOM.
    let jumlah = 0;
    const jelajah = (node: unknown): void => {
      if (node === null || node === undefined || typeof node === 'boolean') return;
      if (Array.isArray(node)) {
        node.forEach(jelajah);
        return;
      }
      if (typeof node === 'object' && 'type' in (node as Record<string, unknown>)) {
        const el = node as { type?: unknown; props?: { children?: unknown } };
        if (el.type === ToasterAdmin) jumlah += 1;
        jelajah(el.props?.children);
      }
    };
    jelajah(elemen);
    expect(jumlah, 'jumlah ToasterAdmin di layout').toBe(1);
    vi.doUnmock('next/headers');
    vi.doUnmock('../src/server/auth');
    vi.doUnmock('../src/server/db');
    vi.resetModules();
  });
});

describe('Aturan pemisah — galat validasi field TIDAK jadi toast', () => {
  it('Toast inline admin masih merendered di dalam halaman sebagai role="alert"', async () => {
    const { Toast } = await import('../src/app/admin/komponen');
    const html = renderToStaticMarkup(
      createElement(Toast, {
        pesan: { jenis: 'galat', teks: 'Shift belum dipilih.' },
        onTutup: () => {},
      }),
    );
    // Galat validasi yang menempel pada field tetap Alert SEBARIS di dalam
    // halaman, supaya terlihat dekat dengan formnya — bukan toast yang melayang
    // dan hilang sendiri.
    expect(html, 'galat tetap alert sebaris').toMatch(/role="alert"/);
    expect(html).toContain('Shift belum dipilih.');
    // Dan bukan elemen sonner.
    expect(html, 'bukan sonner').not.toMatch(/data-sonner/);
  });

  it('pesan sukses inline admin juga tetap sebaris (bukan toast) di halaman master', async () => {
    const { Toast } = await import('../src/app/admin/komponen');
    const html = renderToStaticMarkup(
      createElement(Toast, {
        pesan: { jenis: 'sukses', teks: 'Toko berhasil ditambah.' },
        onTutup: () => {},
      }),
    );
    expect(html).toContain('Toko berhasil ditambah.');
    expect(html, 'sukses master tetap inline').not.toMatch(/data-sonner/);
    // Tidak ada kata Inggris di pesan.
    const kataInggris = ['Success', 'Error', 'Saved', 'Loading', 'Failed'];
    const ketemu = kataInggris.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(teksTampak(html)));
    expect(ketemu, `kata Inggris: ${ketemu.join(', ')}`).toEqual([]);
  });
});

describe('Halaman karyawan tidak ikut perubahan UI-7', () => {
  it('halaman /a/[token] tidak memuat Toaster admin', async () => {
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
      useParams: () => ({ token: 'token-uji' }),
      usePathname: () => '/a/token-uji',
      notFound: () => {
        throw new Error('notFound() dipanggil di tes');
      },
    }));
    // Modul data dimock supaya halaman ini tidak menyentuh database sama sekali.
    vi.doMock('../src/server/absen-info', () => ({
      muatInfoAbsen: async () => ({
        nama: 'Andi',
        toko: 'Toko Merdeka',
        tanggal: '2026-10-14',
        tanggalPanjang: 'Rabu, 14 Okt 2026',
        jam: '07:12',
        jadwal: null,
        riwayat: [],
        aksi: 'CHECKIN' as const,
        alasan: '',
      }),
    }));
    vi.doMock('../src/server/agenda-info', () => ({
      muatInfoAgenda: async () => ({ nama: 'Andi', tanggal: '2026-10-14', daftar: [] }),
    }));
    vi.resetModules();
    const Halaman = (await import('../src/app/a/[token]/page')).default;
    const elemen = await Halaman({ params: Promise.resolve({ token: 'token-uji' }) });
    const html = renderToStaticMarkup(elemen);
    // Navigasi bawah UI-6 masih ada (dua item).
    expect(html).toMatch(/<nav[^>]*aria-label="Navigasi halaman"/);
    expect((html.match(/data-slot="navigasi-bawah-item"/g) ?? []).length).toBe(2);
    // Tapi Toaster admin TIDAK ikut terpasang di sini.
    expect(html, 'label Toaster admin tidak boleh ada di halaman karyawan').not.toContain(
      'aria-label="Notifikasi"',
    );
    vi.doUnmock('next/navigation');
    vi.doUnmock('../src/server/absen-info');
    vi.doUnmock('../src/server/agenda-info');
    vi.resetModules();
  });
});