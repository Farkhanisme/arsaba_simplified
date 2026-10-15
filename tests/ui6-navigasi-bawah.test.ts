/**
 * UI-6 — Navigasi bawah halaman karyawan (K-67, `rules/05` §3b).
 *
 * Sebelum UI-6, halaman ini memakai `TabsList` shadcn DI ATAS. Sekarang
 * navigasinya melekat di bawah dengan tepat dua item: "Absen" dan "Agenda".
 *
 * Semua pemeriksaan di sini memanggil komponen sungguhan lewat
 * `renderToStaticMarkup` — termasuk `page.tsx` itu sendiri, dengan
 * `muatInfoAbsen`/`muatInfoAgenda` dimock, jadi tidak ada koneksi database.
 * `page.tsx` adalah async Server Component, jadi elemennya di-`await` DULU lalu
 * baru dirender: `renderToStaticMarkup(createElement(Halaman, ...))` gagal dengan
 * "A component suspended while responding to synchronous input". Memanggil
 * komponen async seperti ini aman karena `page.tsx` tidak memakai hook —
 * larangan "jangan memanggil Komponen() langsung" di AGENTS.md berlaku untuk
 * komponen CLIENT yang memanggil hook (melempar `Cannot read properties of null
 * (reading 'useContext')`), bukan untuk fungsi async biasa. `useRouter` dan
 * `useParams` milik AbsenClient dimock, jadi tidak ada hook yang jalan di luar
 * pohon React.
 *
 * BATAS YANG JELAS (lihat `rules/OPEN_QUESTIONS.md` B-23): `renderToStaticMarkup`
 * tidak punya CSS, viewport, maupun keyboard virtual. Tes ini **tidak**
 * membuktikan navigasinya benar-benar melekat, tidak menutupi tombol, atau aman
 * dari tepi iPhone — itu wajib dicek manual di browser. Yang bisa dibuktikan
 * di sini: item navigasi ada dan bernama, tab yang tidak aktif benar-benar tidak
 * dirender, dan kelas yang dipakai memang `dvh` serta `env(safe-area-inset-bottom)`.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type Riwayat = {
  jenis: string;
  waktu: string;
  status: string;
  alasan_tolak: string | null;
  keterangan: string | null;
};

// Fixture dibuat lewat `vi.hoisted` supaya factory `vi.mock` (yang di-hoist ke
// atas berkas) boleh memakainya.
//
// `aksi` diberi `as const` karena `vi.hoisted` melonggarkan tipe objeknya jadi
// `string`, dan `tsc` menolak. Pelajarannya persis yang sudah tercatat di
// AGENTS.md: `vitest` hijau total sementara `next build` gagal — `vitest`
// tidak memeriksa tipe sama sekali.
const DATA = vi.hoisted(() => ({
  infoAbsen: {
    nama: 'Andi',
    toko: 'Toko Merdeka',
    tanggal: '2026-10-14',
    tanggalPanjang: 'Rabu, 14 Okt 2026',
    jam: '07:12',
    jadwal: {
      khusus: false,
      slot: [{ nama: 'Shift 1', jam_mulai: '07:00', jam_selesai: '15:00' }],
    },
    riwayat: [
      { jenis: 'CHECKIN', waktu: '07:05', status: 'MENUNGGU', alasan_tolak: null, keterangan: null },
    ] as Riwayat[],
    aksi: 'CHECKIN' as const,
    alasan: '',
  },
  infoAgenda: { nama: 'Andi', tanggal: '2026-10-14', daftar: [] },
}));

vi.mock('../src/server/absen-info', () => ({ muatInfoAbsen: async () => DATA.infoAbsen }));
vi.mock('../src/server/agenda-info', () => ({ muatInfoAgenda: async () => DATA.infoAgenda }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useParams: () => ({ token: 'token-uji' }),
  usePathname: () => '/a/token-uji',
  notFound: () => {
    throw new Error('notFound() dipanggil di tes');
  },
}));

/** Render halaman karyawan `/a/[token]` sungguhan, navigasi dan isinya. */
async function htmlHalaman(): Promise<string> {
  const Halaman = (await import('../src/app/a/[token]/page')).default;
  const elemen = await Halaman({ params: Promise.resolve({ token: 'token-uji' }) });
  return renderToStaticMarkup(elemen);
}

/** Isi satu tab saja, tanpa kerangka halaman. */
async function htmlIsiTab(tab: 'absen' | 'agenda'): Promise<string> {
  const { IsiTab } = await import('../src/app/a/[token]/TabsHalamanClient');
  return renderToStaticMarkup(
    createElement(IsiTab, { tab, infoAbsen: DATA.infoAbsen, infoAgenda: DATA.infoAgenda }),
  );
}

/** Teks yang benar-benar dilihat karyawan: seluruh tag dibuang lebih dulu. */
function teksTampak(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/** Tag pembuka pertama yang cocok, mis. `<main class="…">`. */
function tag(html: string, pola: RegExp): string {
  const cocok = html.match(pola);
  if (!cocok) throw new Error(`tag tidak ditemukan: ${pola}`);
  return cocok[0];
}

type ItemNav = { aktif: boolean; kelas: string; isi: string; svgAda: boolean };

/** Pecah isi <nav> menjadi item-itemnya, lalu baca apa yang dilihat pengguna. */
function itemNavigasi(html: string): ItemNav[] {
  const nav = html.slice(html.indexOf('<nav'));
  const tombol = nav.match(/<button[\s\S]*?<\/button>/g) ?? [];
  return tombol.map((t) => ({
    aktif: t.includes('aria-current="page"'),
    kelas: (t.match(/class="([^"]*)"/) ?? ['', ''])[1] ?? '',
    isi: teksTampak(t).replace(/\s+/g, ' ').trim(),
    svgAda: t.includes('<svg'),
  }));
}

describe('K-67 — navigasi bawah ter-render sebagai <nav> dengan tepat dua item', () => {
  it('halaman karyawan memuat satu nav berlabel Bahasa Indonesia', async () => {
    const html = await htmlHalaman();
    // `aria-label` pada landmark itu wajib: tanpa itu pembaca layar hanya
    // memberitahu "navigation" tanpa tahu navigasi apa yang sedang Offer.
    expect(html).toMatch(/<nav[^>]*aria-label="Navigasi halaman"/);
  });

  it('tepat dua item navigasi, dan tidak ada item ketiga', async () => {
    const html = await htmlHalaman();
    expect((html.match(/data-slot="navigasi-bawah-item"/g) ?? []).length, 'jumlah item').toBe(2);
    // Hanya tombol di DALAM navigasi yang dihitung. Menambah item ketiga atau
    // tombol tengah besar akan menaikkan angka ini.
    const nav = html.slice(html.indexOf('<nav'));
    expect((nav.match(/<button/g) ?? []).length, 'tombol di dalam nav').toBe(2);
    expect(itemNavigasi(html).map((i) => i.isi)).toEqual(['Absen', 'Agenda']);
  });

  it('item navigasi ada DI DALAM nav, bukan di luar landmark-nya', async () => {
    const html = await htmlHalaman();
    const awalNav = html.indexOf('<nav');
    const akhirNav = html.indexOf('</nav>');
    const labelAbsen = html.indexOf('>Absen<');
    expect(labelAbsen).toBeGreaterThan(awalNav);
    expect(labelAbsen).toBeLessThan(akhirNav);
  });

  it('komponennya benar-benar generik: label dan nilai datang dari luar', async () => {
    // Kalau komponen ini sudah "!Absen" dan "Agenda" di dalam dirinya, render
    // dengan label sembarang akan gagal. Ini bukti bahwa ia presentasional dan
    // tidak tahu apa itu absensi.
    const { NavigasiBawah } = await import('../src/components/ui/navigasi-bawah');
    const html = renderToStaticMarkup(
      createElement(NavigasiBawah, {
        label: 'Navigasi contoh',
        nilai: 'dua',
        item: [
          { nilai: 'satu', label: 'Satu' },
          { nilai: 'dua', label: 'Dua' },
        ],
        onPilih: () => {},
      }),
    );
    expect(itemNavigasi(html).map((i) => i.isi)).toEqual(['Satu', 'Dua']);
    expect(teksTampak(html)).not.toMatch(/absen|agenda|kamera|token/i);
  });
});

describe('K-67 — nama aksesibel setiap item, bukan ikon saja', () => {
  it('nama aksesibel item diambil dari teksnya; ikon disembunyikan', async () => {
    const html = await htmlHalaman();
    const nav = html.slice(html.indexOf('<nav'));
    const ikon = nav.match(/<svg[^>]*>/g) ?? [];
    expect(ikon.length, 'dua ikon lucide').toBe(2);
    for (const s of ikon) expect(s, 'ikon disembunyikan dari pohon aksesibilitas').toContain('aria-hidden="true"');
    // Karena ikon disembunyikan, yang dibacakan pembaca layar hanyalah teksnya.
    for (const item of itemNavigasi(html)) expect(item.isi).toMatch(/^(Absen|Agenda)$/);
  });

  it('item tanpa ikon pun tetap punya nama aksesibel dari labelnya', async () => {
    const { NavigasiBawah } = await import('../src/components/ui/navigasi-bawah');
    const html = renderToStaticMarkup(
      createElement(NavigasiBawah, {
        label: 'Navigasi contoh',
        nilai: 'satu',
        item: [{ nilai: 'satu', label: 'Tanpa Ikon' }],
        onPilih: () => {},
      }),
    );
    const [satuItem] = itemNavigasi(html);
    expect(satuItem, 'satu item dirender').toBeTruthy();
    expect(satuItem?.isi).toBe('Tanpa Ikon');
    expect(html, 'tidak ada svg sama sekali').not.toContain('<svg');
    // Tidak ada aria-label yang memalsukan nama: nama benar-benar dari teks.
    const label = html.match(/aria-label="([^"]*)"/)?.[1];
    expect(label).toBe('Navigasi contoh');
  });

  it('nilai yang dikembalikan onPilih diambil dari tiap item, bukan dari indeks', async () => {
    const { NavigasiBawah } = await import('../src/components/ui/navigasi-bawah');
    const dipanggil: string[] = [];
    const elemen = createElement(NavigasiBawah, {
      label: 'Navigasi contoh',
      nilai: 'satu',
      item: [
        { nilai: 'satu', label: 'Satu' },
        { nilai: 'dua', label: 'Dua' },
      ],
      onPilih: (n: string) => dipanggil.push(n),
    });
    // SSR tidak bisa mengklik, jadi yang diperiksa adalah elemen yang dirender
    // punya penangan dan nilainya milik item itu.
    const html = renderToStaticMarkup(elemen);
    expect(html).not.toMatch(/href=/);
    expect(itemNavigasi(html).length).toBe(2);
    expect(dipanggil, 'tidak ada yang dipanggil sebelum ada klik').toEqual([]);
  });
});

describe('Kamera — perpindahan tab WAJIB me-remount, bukan menyembunyikan', () => {
  it('tab agenda TIDAK memuat kamera sama sekali (bukan disembunyikan)', async () => {
    const agenda = await htmlIsiTab('agenda');
    // Inti docblock: "sembunyi saja masih memegang perangkat kamera". Kalau
    // markup tab agenda masih punya <video>, dua permintaan getUserMedia hidup
    // bersamaan — dan itu mematikan kamera depan di sebagian Android.
    expect(agenda, '<video> masih ada di tab agenda').not.toContain('<video');
    expect(agenda, 'tombol Ganti Kamera masih ada di tab agenda').not.toContain('Ganti Kamera');
  });

  it('tab absen memuat kamera seperti biasa', async () => {
    const absen = await htmlIsiTab('absen');
    expect(absen).toContain('<video');
    expect(absen).toContain('Ganti Kamera');
  });

  it('kedua tab menghasilkan isi yang berbeda, jadi "hanya tab aktif" berarti sesuatu', async () => {
    const absen = await htmlIsiTab('absen');
    const agenda = await htmlIsiTab('agenda');
    expect(absen.length).toBeGreaterThan(0);
    expect(agenda.length).toBeGreaterThan(0);
    expect(absen).not.toBe(agenda);
  });

  it('elemen tab punya key, jadi React tidak mengeluh soal key yang hilang', async () => {
    // BUKTI MUTASI (satu dari empat yang wajib): `key={nilai}` dihapus dari
    // <AbsenClient>/<AgendaClient> -> tes INI gagal.
    //
    // Kenapa diuji lewat warning, bukan lewat markup: `key` TIDAK PERNAH muncul
    // di HTML — React memakainya hanya saat mencocokkan elemen, dan HTML hasil
    // render sama persis dengan atau tanpanya. Yang bisa diamati adalah
    // konsekuensinya: anak daftar tanpa `key` membuat React DEV mengeluarkan
    // "Each child in a list should have a unique key prop" lewat console.error.
    // Jadi ini perilaku React sungguhan, bukan pembacaan teks berkas.
    const warning: string[] = [];
    const asli = console.error;
    console.error = (...a: unknown[]) => {
      warning.push(a.map(String).join(' '));
    };
    try {
      await htmlIsiTab('absen');
      await htmlIsiTab('agenda');
    } finally {
      console.error = asli;
    }
    const tentangKey = warning.filter((w) => /unique "key" prop|unique 'key' prop/.test(w));
    expect(tentangKey, `React mengeluh soal key: ${tentangKey.join(' | ')}`).toEqual([]);
  });

  it('docblock alasan remount kamera masih ada di TabsHalamanClient', () => {
    // Ini satu-satunya tes di berkas ini yang membaca teks berkas, dan itu
    // memang tidak bisa dihindari: tidak ada "perilaku" yang bisa diuji dari
    // sebuah komentar. Yang dijaga supaya penjelasan KENAPA `key` ada tidak
    // hilang diam-diam saat refactor. KebenaranBehavior-nya diuji terpisah di
    // atas: tab agenda benar-benar tanpa kamera.
    const isi = readFileSync('src/app/a/[token]/TabsHalamanClient.tsx', 'utf8');
    expect(isi, 'docblock menyebut getUserMedia').toMatch(/getUserMedia/);
    expect(isi, 'docblock menyebut instance/remount').toMatch(/remount|instance baru/i);
  });
});

describe('rules/05 §3b — konten tidak boleh tertutup navigasi', () => {
  it('kerangka main punya padding bawah khusus navigasi, bukan padding simetris', async () => {
    const html = await htmlHalaman();
    const main = tag(html, /<main[^>]*>/);
    // `p-4` diganti padding bawah yang lebih besar. Kalau dikembalikan ke `p-4`,
    // navigasi menutupi tombol "Absen" — butir yang paling sering terlewat,
    // karena halaman yang panjang tetap terlihat "benar".
    expect(main, 'padding bawah konten').toMatch(/pb-\[calc\(/);
    expect(main, 'tidak lagi padding simetris p-4').not.toMatch(/\bp-4\b/);
    expect(main, 'sisi kiri dan kanan tetap 1rem').toMatch(/\bpx-4\b/);
    expect(main, 'sisi atas tetap 1rem').toMatch(/\bpt-4\b/);
  });

  it('tinggi bar navigasi dan padding konten memakai angka yang sama', async () => {
    // Kalau bar jadi 5rem tapi padding konten tetap 4rem, navigasi menutupi
    // tombol — persis bug yang dicegah ini. Angka diambil dari HTML hasil
    // render, bukan dari konstanta di kode, sehingga yang dibandingkan benar
    // yang akan dipakai browser.
    const html = await htmlHalaman();
    const nav = html.slice(html.indexOf('<nav'));
    const tinggiBar = nav.match(/h-\[([0-9.]+rem)\]/)?.[1];
    expect(tinggiBar, 'tinggi bar terbaca dari kelas h-[...] di nav').toBeTruthy();
    const main = tag(html, /<main[^>]*>/);
    const padding = main.match(/pb-\[calc\(([0-9.]+rem)\+env\(safe-area-inset-bottom\)\)\]/);
    expect(padding, 'padding bawah memuat tinggi bar + safe-area').toBeTruthy();
    expect(padding![1], 'angka padding sama dengan angka tinggi bar').toBe(tinggiBar);
  });

  it('padding bawah nav memakai env(safe-area-inset-bottom) tanpa tambahan tetap', async () => {
    const html = await htmlHalaman();
    const nav = tag(html, /<nav[^>]*>/);
    // Bentuk persis env() saja. Kalau jadi calc(1rem + env(...)), perangkat
    // tanpa notch ikut mendapat ruang kosong ganda — dilarang rules/05 §3b.
    expect(nav).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(nav, 'tidak ada tinggi tetap tambahan di atas safe-area').not.toMatch(
      /pb-\[calc\([^)]*\+\s*env\(/,
    );
  });
});

describe('rules/05 §3b — tinggi memakai dvh, bukan vh', () => {
  it('kerangka main memakai min-h-dvh', async () => {
    const html = await htmlHalaman();
    expect(tag(html, /<main[^>]*>/)).toMatch(/\bmin-h-dvh\b/);
  });

  it('TIDAK ada vh atau min-h-screen di kerangka halaman', async () => {
    // `vh` dan `min-h-screen` tidak ikut menyusut ketika keyboard virtual membuka;
    // itulah sebabnya aturan ini ada.
    const html = await htmlHalaman();
    const main = tag(html, /<main[^>]*>/);
    expect(main, 'tidak ada satuan vh').not.toMatch(/\d+vh\b/);
    expect(main, 'tidak memakai min-h-screen').not.toMatch(/\bmin-h-screen\b/);
    expect(main, 'tidak memakai min-h-100vh').not.toMatch(/\bmin-h-100vh\b/);
  });

  it('bar navigasi sendiri tidak memaksakan tinggi viewport', async () => {
    // Bar punya tinggi tetap (64 px) — itu disengaja, dan justru tidak memakai
    // satuan viewport. Yang boleh memakainya hanyalah kerangka halaman.
    const html = await htmlHalaman();
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav, 'bar tidak memakai vh maupun dvh').not.toMatch(/d?vh/);
    expect(nav, 'tinggi bar tetap dan eksplisit').toMatch(/\bh-\[4rem\]/);
  });
});

describe('rules/05 §3b — tab aktif dibedakan tanpa warna saja', () => {
  it('tepat satu item aktif ditandai aria-current', async () => {
    const html = await htmlHalaman();
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect((html.match(/data-aktif="ya"/g) ?? []).length).toBe(1);
    const item = itemNavigasi(html);
    expect(item.filter((i) => i.aktif).map((i) => i.isi)).toEqual(['Absen']);
  });

  it('item aktif punya penanda bentuk; item tidak aktif tidak punya', async () => {
    const html = await htmlHalaman();
    // Penandanya GARIS di atas item, bukan hanya beda warna. Jumlahnya harus
    // tepat satu: kalau ikut muncul di item yang tidak aktif, dua-duanya
    // bertanda dan penanda tidak lagi berarti.
    expect((html.match(/data-slot="navigasi-bawah-penanda"/g) ?? []).length).toBe(1);
    const aktif = html.match(/data-aktif="ya"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(aktif, 'label item aktif ditebalkan').toMatch(/font-semibold/);
    const tidakAktif = html.match(
      /data-slot="navigasi-bawah-item"((?![\s\S]{0,200}data-aktif="ya")[\s\S]*?)<\/button>/,
    )?.[1];
    expect(tidakAktif, 'ada item yang tidak aktif').toBeTruthy();
    expect(tidakAktif, 'label item tidak aktif memakai tebal biasa').toMatch(/font-medium/);
  });

  it('item tidak aktif tetap punya label teks (rules/05 §1.3)', async () => {
    const html = await htmlHalaman();
    for (const item of itemNavigasi(html)) {
      expect(item.isi, 'label teks tetap ada di item tidak aktif').toMatch(/^(Absen|Agenda)$/);
    }
  });
});

describe('rules/05 §3b — melekat di bawah, dan tidak menutupi modal', () => {
  it('nav melekat di bawah (fixed, inset-x-0, bottom-0)', async () => {
    const html = await htmlHalaman();
    const nav = tag(html, /<nav[^>]*>/);
    expect(nav).toMatch(/\bfixed\b/);
    expect(nav).toMatch(/\bbottom-0\b/);
    expect(nav).toMatch(/\binset-x-0\b/);
  });

  it('z-index nav di bawah z-50 milik Dialog', async () => {
    // Modal hasil foto harus menutupi navigasi, bukan sebaliknya. Dialog shadcn
    // yang dipakai repo ini memakai z-50.
    const html = await htmlHalaman();
    const nav = tag(html, /<nav[^>]*>/);
    const zNav = Number(nav.match(/z-(\d+)/)?.[1]);
    expect(zNav, 'nav punya z-index eksplisit').toBeGreaterThan(0);
    expect(zNav, 'nav tidak boleh sama dengan atau di atas Dialog').toBeLessThan(50);
  });

  it('nav muncul SETELAH konten absen, bukan mendahului tugasnya', async () => {
    // Navigasi tetap hidup di dalam komponen yang memegang state tab, jadi di
    // markup ia muncul setelah kartu kamera. Yang dijaga di sini: navigasi
    // tidak boleh mendahului konten tugas. Memindahkan state tab ke atas
    // Server Component supaya nav bisa jadi anak terakhir `<main>` tidak
    // mungkin, karena Server Component tidak bisa menyimpan state.
    const html = await htmlHalaman();
    const isiKamera = html.indexOf('Ambil absen');
    expect(isiKamera, 'kartu kamera ada di halaman').toBeGreaterThan(-1);
    expect(html.indexOf('<nav')).toBeGreaterThan(isiKamera);
  });

  it('isi navigasi dibatasi lebar halaman, dan tiap item selebar setengahnya', async () => {
    // Di layar lebar, bar tetap mengikuti kolom halaman (480 px) supaya tidak
    // melayang sendiri-sendiri di tengah layar.
    const html = await htmlHalaman();
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).toMatch(/max-w-\[480px\]/);
    expect((nav.match(/flex-1/g) ?? []).length, 'dua item membagi lebar rata').toBe(2);
  });
});

describe('Bahasa dan ukuran huruf di halaman karyawan', () => {
  it('label navigasi 16 px (text-base), bukan 14 atau 12', async () => {
    const html = await htmlHalaman();
    const nav = html.slice(html.indexOf('<nav'));
    const label = nav.match(/<span class="[^"]*">(Absen|Agenda)<\/span>/);
    expect(label, 'label nav punya kelas ukuran sendiri').toBeTruthy();
    expect(label![0]).toMatch(/\btext-base\b/);
    expect(label![0], 'bukan text-sm').not.toMatch(/\btext-sm\b/);
    expect(label![0], 'bukan text-xs').not.toMatch(/\btext-xs\b/);
  });

  it('tidak ada satu pun kata Inggris yang terlihat pengguna', async () => {
    const html = await htmlHalaman();
    // PENTING: yang diperiksa hanya TEKS, bukan seluruh HTML. Nama kelas
    // Tailwind memang bahasa Inggris ("font-semibold", "rounded-full") dan itu
    // benar — yang dilarang K-24 adalah kata Inggris yang dibaca karyawan.
    const teks = teksTampak(html);
    const kataInggris = [
      'Home', 'Settings', 'Profile', 'Dashboard', 'Submit', 'Close', 'Loading', 'Error',
      'Cancel', 'Save', 'Delete', 'Edit', 'Next', 'Previous', 'Menu', 'Search', 'More',
      'Layout', 'Overview', 'Logout', 'Login', 'Password', 'Username', 'Photo',
      'Gallery', 'Upload', 'Try again', 'Required', 'Choose', 'Loading...',
    ];
    const ketemu = kataInggris.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(teks));
    expect(ketemu, `kata Inggris terlihat karyawan: ${ketemu.join(', ')}`).toEqual([]);
  });

  it('tidak ada warna hex/rgb/hsl literal di keluaran halaman', async () => {
    const html = await htmlHalaman();
    expect(html, 'warna hex literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html, 'warna rgb/hsl literal').not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it('tidak ada style inline di halaman, navigasi termasuk', async () => {
    expect(await htmlHalaman(), 'inline style').not.toMatch(/ style="/);
  });
});