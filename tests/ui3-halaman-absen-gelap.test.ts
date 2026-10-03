/**
 * Halaman karyawan `/a/[token]` — gaya, komponen, dan jarak.
 *
 * Riwayatnya panjang, jadi untuk konteks:
 *   - Versi pertama: 100% inline style dengan warna literal (`#fff`, `#ddd`,
 *     `#444`). Panel tetap putih saat mode gelap aktif. (BUG-UI-07)
 *   - Versi kedua: inline style tapi warna diganti token `var(--card)` dsb.
 *     Mode gelap jadi benar — TETAPI jarak antar kartu hilang, karena
 *     `marginBottom: 12` ikut hilang saat gaya diekstrak jadi `gayaKartu`.
 *     (BUG-UI-08)
 *   - Versi sekarang: komponen shadcn (Card, Badge, Alert, Button, Separator).
 *     Warna dan jarak keduanya datang dari komponen, jadi tidak bisa hilang
 *     diam-diam seperti BUG-UI-08.
 *
 * Tes di sini memanggil komponen sungguhan lewat renderToStaticMarkup. Yang
 * diperiksa adalah MECHANISME warnanya — bukan hex tertentu — supaya tetap
 * berlaku saat tema shadcn diganti.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DaftarRiwayat } from '../src/app/a/[token]/page';

const CONTOH_RIWAYAT = [
  { jenis: 'CHECKIN', waktu: '2026-10-03T07:05:00+07:00', status: 'DISETUJUI', alasan_tolak: null },
  { jenis: 'CHECKOUT', waktu: '2026-10-03T15:02:00+07:00', status: 'MENUNGGU', alasan_tolak: null },
  { jenis: 'CHECKIN', waktu: '2026-10-02T09:00:00+07:00', status: 'DITOLAK', alasan_tolak: 'Foto tidak terbaca.' },
];

const RIWAYAT_KOSONG: { jenis: string; waktu: string; status: string; alasan_tolak: string | null }[] = [];

function htmlRiwayat(isi = CONTOH_RIWAYAT): string {
  return renderToStaticMarkup(createElement(DaftarRiwayat, { riwayat: isi }));
}

const BERKAS = ['src/app/a/[token]/page.tsx', 'src/app/a/[token]/AbsenClient.tsx'];

/** Baris kode saja — komentar dibuang, jadi penjelasan tidak ikut terperiksa. */
function kodeTanpaKomentar(f: string): string {
  return readFileSync(f, 'utf-8')
    .split('\n')
    .filter((b) => {
      const t = b.trim();
      return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
    })
    .join('\n');
}

describe('BUG-UI-07 — halaman absen memakai komponen shadcn', () => {
  for (const f of BERKAS) {
    it(`${f} mengimpor komponen dari @/components/ui`, () => {
      const isi = readFileSync(f, 'utf-8');
      const impor = isi.match(/from '@\/components\/ui\/[a-z-]+'/g) ?? [];
      expect(impor.length, `${f} mengimpor komponen shadcn`).toBeGreaterThan(0);
    });
  }

  it('riwayat dirender dengan Card dan Badge shadcn, bukan div polos', () => {
    const h = htmlRiwayat();
    expect(h, 'Card shadcn (data-slot)').toContain('data-slot="card"');
    expect(h, 'CardContent shadcn').toContain('data-slot="card-content"');
    expect(h, 'Badge shadcn').toContain('data-slot="badge"');
    expect(h, 'tidak ada <ul> dengan style inline untuk tiap baris').not.toMatch(/<li[^>]*style=/);
  });

  it('setiap status punya variant Badge yang berbeda', () => {
    const h = htmlRiwayat();
    // Tiga baris -> tiga Badge. Variant destructive harus muncul untuk Ditolak.
    expect((h.match(/data-slot="badge"/g) ?? []).length).toBe(3);
    expect(h, 'badge Ditolak memakai variant destructive').toMatch(/data-slot="badge"[^>]*destructive/);
    expect(h, 'badge Menunggu tidak destructive').toMatch(
      /data-slot="badge"[^>]*secondary[^>]*>Menunggu|secondary[^>]*data-slot="badge"[^>]*>Menugu/,
    );
  });

  it('TIDAK ada warna literal di halaman absen — warna datang dari komponen', () => {
    for (const f of BERKAS) {
      const kode = kodeTanpaKomentar(f);
      // Pengecualian satu-satunya: <video> tetap hitam di dua mode, karena itu
      // pratinjau kamera, bukan panel UI.
      const tanpaVideo = kode.replace(/style=\{\{ background: '#000' \}\}/g, '');
      expect(tanpaVideo, `warna literal di ${f}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(tanpaVideo, `rgba/hsl literal di ${f}`).not.toMatch(/\b(rgba|hsla)\(/);
    }
  });

  it('hanya <video> yang masih memakai inline style, dan itu disengaja', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    const gaya = kode.match(/style=\{\{[^}]*\}\}/g) ?? [];
    expect(gaya.length, 'jumlah inline style di AbsenClient').toBe(1);
    expect(gaya[0]).toContain('#000');
    // Dan harus menempel pada <video>, bukan pada panel mana pun.
    expect(kode).toMatch(/<video[\s\S]{0,200}style=\{\{ background: '#000' \}\}/);
  });

  it('judul "Jadwal hari ini" memakai CardTitle shadcn, bukan <h2> polos', () => {
    // Mutasi yang replaces CardTitle dengan <h2> sempat LOLOS: tes sebelumnya
    // hanya-strengthink <h2> sebagai teks, dan <h2> polos juga punya <h2>.
    const isi = readFileSync('src/app/a/[token]/page.tsx', 'utf-8');
    expect(isi, 'memakai CardTitle shadcn').toMatch(/<CardTitle[^>]*>\s*Jadwal hari ini/);
    // <h2> polos untuk judul jadwal tidak boleh ada.
    expect(isi, 'tidak ada <h2> polos di halaman').not.toMatch(/<h2[^>]*>\s*Jadwal hari ini/);
  });

  it('header memakai <h1>, dan tidak ada heading level yang dilompati', () => {
    const isi = readFileSync('src/app/a/[token]/page.tsx', 'utf-8');
    expect(isi, 'ada satu <h1>').toMatch(/<h1[^>]*>\{info\.nama\}/);
    // "Absen hari ini" adalah bagian setingkat CardTitle, jadi <h2> diizinkan —
    // tapi harus ada class font, bukan <h2> telanjang.
    const polos = isi.match(/<h2(?![^>]*className)[^>]*>/g) ?? [];
    expect(polos, '<h2> tanpa className').toEqual([]);
  });

  it('page.tsx tidak punya inline style sama sekali', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/page.tsx');
    expect(kode, 'page.tsx bebas inline style').not.toMatch(/style=\{\{/);
  });
});

describe('BUG-UI-08 — jarak antar bagian tidak boleh hilang diam-diam', () => {
  it('jarak antar kartu datang dari gap pada <main>', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/page.tsx');
    // Kalau gap ini dihapus, kartu akan menempel — persis bug yang terjadi
    // ketika marginBottom ikut hilang bersama gayaKartu.
    expect(kode, '<main> memakai gap untuk memisahkan kartu').toMatch(/<main[^>]*className="[^"]*\bgap-/);
  });

  it('jarak di dalam tiap kartu datang dari gap pada CardContent', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'CardContent memakai gap untuk jarak internal').toMatch(/<CardContent[^>]*className="[^"]*\bgap-/);
  });

  it('tidak ada marginBottom/y yang disetel manual per panel', () => {
    // Gaya per-panel adalah penyebab BUG-UI-08: begitu diekstrak jadi objek,
    // ada yang lupa terbawa. Sekarang tidak ada objek gaya sama sekali.
    for (const f of BERKAS) {
      const kode = kodeTanpaKomentar(f);
      expect(kode, `tidak ada CSSProperties di ${f}`).not.toMatch(/CSSProperties/);
      expect(kode, `tidak ada objek gaya manual di ${f}`).not.toMatch(/const gaya\w+\s*[:=]/);
    }
  });

  it('terpisah oleh Separator agar batas bagian jelas', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/page.tsx');
    expect(kode, 'memakai Separator').toMatch(/<Separator/);
    expect(kode, 'Separator diimpor dari shadcn').toMatch(/from '@\/components\/ui\/separator'/);
  });
});

describe('rules/05 §3 — isi halaman absen tidak boleh hilang', () => {
  it('ketiga status menampilkan teksnya, bukan hanya warna', () => {
    const h = htmlRiwayat();
    expect(h).toContain('Check-in');
    expect(h).toContain('Check-out');
    expect(h).toContain('Disetujui');
    expect(h).toContain('Menunggu');
    expect(h).toContain('Ditolak');
    expect(h, 'alasan penolakan ditampilkan').toContain('Foto tidak terbaca.');
  });

  it('daftar kosong berbahasa Indonesia', () => {
    expect(htmlRiwayat(RIWAYAT_KOSONG)).toContain('Belum ada absen hari ini.');
  });

  it('urutan bagian sesuai rules/05 §3', () => {
    // Memakai nomor BARIS, bukan posisi substring: nama AbsenClient muncul
    // duluan di baris import, bukan di tempat pemakaiannya.
    const isi = readFileSync('src/app/a/[token]/page.tsx', 'utf-8');
    const baris = isi.split('\n');
    const cari = (pola: RegExp) => baris.findIndex((b) => pola.test(b));
    const nama = cari(/\{info\.nama\}/);
    const jadwal = cari(/Jadwal hari ini/);
    const kamera = cari(/<AbsenClient/);
    const riwayat = cari(/<DaftarRiwayat/);
    expect(nama, 'header memakai info.nama').toBeGreaterThan(-1);
    expect(jadwal, 'jadwal setelah header').toBeGreaterThan(nama);
    expect(kamera, 'kamera setelah jadwal').toBeGreaterThan(jadwal);
    expect(riwayat, 'riwayat setelah kamera').toBeGreaterThan(kamera);
  });

  it('kalimat "Tidak ada jadwal" persis seperti rules/05 §3', () => {
    const isi = readFileSync('src/app/a/[token]/page.tsx', 'utf-8');
    expect(isi).toContain('Tidak ada jadwal (absen tetap bisa dilakukan)');
  });
});

describe('rules/05 baris 23 — target sentuh minimum 44x44 px', () => {
  it('tombol absen punya tinggi >= 44px lewat class, bukan size bawaan', () => {
    const isi = readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8');
    // KELAS_SENTUH h-12 = 48px. Button shadcn hanya sampai lg = h-9 = 36px,
    // jadi tanpa class ini target sentuh di bawah aturan.
    expect(isi, 'KELAS_SENTUH memakai h-12 (48px)').toMatch(/KELAS_SENTUH\s*=\s*'h-12/);
    expect(isi, 'KELAS_SENTUH dipakai di tombol').toMatch(/className=\{`flex-1 \$\{KELAS_SENTUH\}`\}/);
    // Tidak boleh menggantungkan pada size="lg" saja.
    expect(isi, 'tidak mengandalkan size lg').not.toMatch(/size="lg"/);
  });
});

describe('BUG-UI-07 — pesan di AbsenClient memakai Alert shadcn', () => {
  it('pesan galat memakai Alert variant destructive, bukan <p> polos', () => {
    // Mutasi yang replaces <Alert> dengan <p> sempat LOLOS karena pesan dirender
    // dari state React yang tidak aktif saat render statis — jadi yang diperiksa
    // adalah KODE komponennya, bukan HTML hasil render.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'Alert diimpor').toMatch(/import \{[^}]*Alert[^}]*\} from '@\/components\/ui\/alert'/);
    expect(kode, 'memakai Alert variant destructive untuk galat').toMatch(/<Alert variant="destructive"/);
    expect(kode, 'memakai Alert untuk peringatan lokasi').toMatch(/<Alert>\s*<AlertDescription>Lokasi tidak aktif/);
  });

  it('pesan sukses memakai role="status" dan galat role="alert"', () => {
    // rules/03: role status/alert wajib supaya pembaca layarlirih.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'pesan sukses role=status').toMatch(/<Alert role="status">/);
    expect(kode, 'pesan galat role=alert').toMatch(/role="alert"/);
  });

  it('AlertDescription dipakai, bukan teks mentah di dalam Alert', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    const alerts = kode.match(/<Alert[\s>][\s\S]*?<\/Alert>/g) ?? [];
    expect(alerts.length, 'jumlah blok Alert').toBeGreaterThanOrEqual(3);
    for (const a of alerts) {
      expect(a, 'isi Alert memakai AlertDescription').toContain('AlertDescription');
    }
  });

  it('tombol "Mengirim…" dan status lain memakai Button shadcn', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    // Tidak boleh ada <button> polos.
    expect(kode, 'tidak ada <button> polos').not.toMatch(/<button/);
    expect((kode.match(/<Button/g) ?? []).length, 'jumlah Button shadcn').toBeGreaterThanOrEqual(6);
  });
});

describe('Kamera — alur wajib tidak boleh berubah', () => {
  it('pratinjau kamera langsung dibuka tanpa tombol (rules/05 §3 langkah 1)', () => {
    const isi = readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8');
    expect(isi, 'useEffect memanggil mulaiKamera').toMatch(/void mulaiKamera\('user'\)/);
    expect(isi, 'ada elemen video').toContain('<video');
    expect(isi, 'video autoPlay').toContain('autoPlay');
    expect(isi, 'video playsInline (Wajib di iOS)').toContain('playsInline');
  });

  it('tidak ada input file dari galeri (K-02)', () => {
    const isi = readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8');
    // Periksa KODE, bukan komentar — komentar sengaja menyebut "<input
    // type=\"file\">" untuk menyatakan hal yang tidak dilakukan, jadi kalau
    // examiningnya mentah-inclusive, akan salah positives.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'tidak ada <input type=file>').not.toMatch(/<input[^>]*type=["']file["']/);
    expect(kode, 'tidak ada accept=image untuk pilih dari galeri').not.toMatch(/accept=["']image/);
    expect(kode, 'tidak ada label untuk input file').not.toMatch(/htmlFor=["'][^"']*foto/i);
  });

  it('nama field yang dikirim ke server tidak berubah', () => {
    const isi = readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8');
    for (const f of ['token', 'jenis', 'foto', 'lat', 'lng', 'lokasi_status', 'request_id']) {
      expect(isi, `fd.set('${f}')`).toContain(`fd.set('${f}'`);
    }
  });
});