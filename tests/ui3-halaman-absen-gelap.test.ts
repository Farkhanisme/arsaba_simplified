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
 *   - Versi modal: hasil foto tampil di Dialog yang mengunci latar, pesan
 *     sukses/galat lewat toast sonner. Foto yang gagal ikut dibuang bersama
 *     modalnya (keputusan pemilik, opsi b) — tidak ada kirim ulang.
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
import { IsiModalFoto } from '../src/app/a/[token]/AbsenClient';

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

  it('hasil kirim memakai toast sonner, bukan state pesan + tombol', () => {
    // Keputusan pemilik: sukses/gagal kirim ditutup dengan toast. Tombol
    // "Selesai" dan "Coba Lagi" dihapus — muatUlang otomatis setelah sukses,
    // foto yang gagal dibuang dan karyawan foto ulang.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'toast diimpor dari sonner').toMatch(/import \{[^}]*toast[^}]*\} from 'sonner'/);
    expect(kode, 'Toaster dipasang di halaman absen').toMatch(/<Toaster position="top-center"/);
    // Dua cabang render (TIDAK_TERSEDIA dan utama) masing-masing butuh Toaster
    // sendiri. Menghapus satu saja berarti separuh alur tanpa toast.
    expect((kode.match(/<Toaster position="top-center"/g) ?? []).length, 'Toaster di kedua cabang').toBe(2);
    expect(kode, 'sukses memakai toast.success').toMatch(/toast\.success\(/);
    expect(kode, 'galat memakai toast.error').toMatch(/toast\.error\(/);
    expect(kode, 'tidak ada state pesan lagi').not.toMatch(/setPesan|useState<\{ jenis/);
    expect(kode, 'tidak ada tombol Selesai').not.toMatch(/>\s*Selesai\s*</);
    expect(kode, 'tidak ada tombol Coba Lagi').not.toMatch(/>\s*Coba Lagi\s*</);
  });

  it('AlertDescription dipakai, bukan teks mentah di dalam Alert', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    const alerts = kode.match(/<Alert[\s>][\s\S]*?<\/Alert>/g) ?? [];
    expect(alerts.length, 'jumlah blok Alert').toBeGreaterThanOrEqual(2);
    for (const a of alerts) {
      expect(a, 'isi Alert memakai AlertDescription').toContain('AlertDescription');
    }
  });

  it('tombol memakai Button shadcn, bukan <button> polos', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    // Tidak boleh ada <button> polos.
    expect(kode, 'tidak ada <button> polos').not.toMatch(/<button/);
    // Foto, Ganti Kamera, Periksa lagi di halaman utama + Foto Ulang, Absen di modal.
    expect((kode.match(/<Button/g) ?? []).length, 'jumlah Button shadcn').toBeGreaterThanOrEqual(5);
    for (const label of ['Foto', 'Ganti Kamera', 'Foto Ulang', 'Periksa lagi']) {
      expect(kode, `tombol ${label} ada`).toContain(label);
    }
  });
});

describe('Modal hasil foto — mengunci latar sampai ada keputusan', () => {
  const props = {
    src: 'blob:hasil-foto',
    aksi: 'CHECKIN',
    mengirim: false,
    onFotoUlang: () => {},
    onKirim: () => {},
  };

  function htmlModal(ubah: Partial<typeof props> = {}): string {
    return renderToStaticMarkup(createElement(IsiModalFoto, { ...props, ...ubah }));
  }

  it('menampilkan foto besar, tombol Foto Ulang, dan tombol Absen', () => {
    const h = htmlModal();
    expect(h, 'foto hasil').toMatch(/<img[^>]*src="blob:hasil-foto"[^>]*alt="Hasil foto absen"/);
    expect(h).toContain('Foto Ulang');
    expect(h).toContain('>Absen<');
    expect((h.match(/data-slot="button"/g) ?? []).length, 'dua tombol shadcn').toBe(2);
  });

  it('aksi CHECKOUT mengubah label tombol menjadi Absen Check-out', () => {
    expect(htmlModal({ aksi: 'CHECKOUT' })).toContain('Absen Check-out');
  });

  it('saat mengirim, tombol nonaktif dan teks menjadi Mengirim…', () => {
    const h = htmlModal({ mengirim: true });
    expect(h).toContain('Mengirim…');
    expect(h, 'kedua tombol disabled').toMatch(/<button[^>]*disabled=""/);
    expect(h, 'tidak ada Absen yang bisa diklik').not.toMatch(/>Absen</);
  });

  it('modal dikunci: tanpa tombol tutup, abaikan klik-luar/Escape', () => {
    // Kalau modal bisa ditutup sembarangan, foto hilang tanpa jejak dan
    // karyawan bingung — hanya Foto Ulang atau hasil kirim yang menutupnya.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'DialogContent tanpa tombol tutup').toMatch(/<DialogContent showCloseButton=\{false\}/);
    expect(kode, 'permintaan tutup dari klik-luar/Escape diabaikan').toMatch(/<Dialog open=\{modalTerbuka\} onOpenChange=\{\(\) => \{\}\}>/);
  });

  it('modal terbuka tepat saat ada foto yang menunggu keputusan', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'modalTerbuka dari foto + pratinjau').toMatch(/const modalTerbuka = foto !== null && pratinjau !== null;/);
  });

  it('tombol utama tidak lagi berubah menjadi Foto Ulang/Absen', () => {
    // Sebelum modal, tombol utama berganti setelah foto diambil. Sekarang tombol
    // utama selalu Foto + Ganti Kamera; Foto Ulang/Absen hanya ada di modal.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'tidak ada cabang {!foto} di tombol utama').not.toMatch(/\{\!foto \?/);
  });

  it('foto yang gagal ikut dibuang bersama modalnya (opsi b)', () => {
    // Keputusan pemilik: tidak ada kirim ulang. Setiap cabang kirim — sukses,
    // gagal, maupun offline — memanggil buangFoto() sebelum toast.
    // Diperiksa PER CABANG, bukan dihitung total: menghapus satu saja (mis.
    // cabang kompresi gagal) harus gagal, karena foto basi akan nyangkut.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'offline: buang dulu baru toast').toMatch(/if \(!navigator\.onLine\) \{\s+buangFoto\(\);/);
    expect(kode, 'kompresi gagal: buang dulu baru toast').toMatch(/if \(!hasil\) \{\s+buangFoto\(\);/);
    expect(kode, 'respons gagal: buang dulu baru toast').toMatch(/if \(!res\.ok\) \{\s+buangFoto\(\);/);
    expect(kode, 'sukses: buang dulu baru toast').toMatch(/buangFoto\(\);\s+toast\.success\(/);
    expect(kode, 'galat jaringan: buang dulu baru toast').toMatch(/\} catch \{\s+buangFoto\(\);/);
    expect(kode, 'buangFoto mengosongkan foto, pratinjau, dan requestId').toMatch(/setRequestId\(null\)/);
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
describe('BUG-UI-09 — "Absen hari ini" langsung muncul tanpa reload manual', () => {
  it('muatUlang menyegarkan Server Component lewat router.refresh', () => {
    // Akar bugnya: DaftarRiwayat ("Absen hari ini") dirender Server Component
    // page.tsx dari data saat halaman dibuka, sedangkan muatUlang() hanya
    // mengupdate state lokal AbsenClient. Tanpa router.refresh(), daftar di
    // bawah tidak pernah berubah sampai reload manual.
    // useEffect/useState tidak jalan di render statis, jadi yang diperiksa
    // adalah KODE muatUlang — sama seperti tes handler lain di berkas ini.
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'useRouter diimpor dari next/navigation').toMatch(
      /import \{[^}]*useRouter[^}]*\} from 'next\/navigation'/,
    );
    expect(kode, 'router dibuat di komponen').toMatch(/const router = useRouter\(\);/);
    expect(kode, 'muatUlang memanggil router.refresh setelah setInfo').toMatch(
      /setInfo\(badan\.data as InfoAbsen\);\s+buangFoto\(\);\s+router\.refresh\(\);/,
    );
  });

  it('kirim sukses memicu muatUlang sehingga daftar ikut segar', () => {
    // kirim() yang berhasil harus mengakhiri dengan await muatUlang() — itu
    // satu-satunya jalur yang menyegarkan daftar "Absen hari ini".
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'kirim sukses memanggil muatUlang').toMatch(/toast\.success\(badan\.pesan as string\);\s+await muatUlang\(\);/);
  });
});

describe('Animasi halus halaman absen — hormati motion-reduce', () => {
  it('bagian utama memakai animate-in + fade-in + motion-reduce', () => {
    // Kelas animasi yang dipakai HARUS terbukti ada di tw-animate-css
    // (slide-in-from-bottom-2 misalnya TIDAK ada — hanya slide-in-from-bottom).
    const kode = kodeTanpaKomentar('src/app/a/[token]/page.tsx');
    expect(kode, '<main> punya animasi masuk').toMatch(/<main[^>]*className="[^"]*animate-in fade-in duration-300 motion-reduce:animate-none"/);
    expect(kode, 'kartu riwayat punya animasi masuk').toMatch(/<Card key=\{i\} className="animate-in fade-in slide-in-from-bottom duration-300 motion-reduce:animate-none"/);
  });

  it('kartu kamera dan foto hasil punya animasi masuk', () => {
    const kode = kodeTanpaKomentar('src/app/a/[token]/AbsenClient.tsx');
    expect(kode, 'kartu ambil absen beranimasi').toMatch(/<Card aria-label="Ambil absen" className="[^"]*animate-in/);
    expect(kode, 'foto hasil beranimasi').toMatch(/alt="Hasil foto absen" className="[^"]*animate-in fade-in/);
  });

  it('setiap animate-in dipasangkan motion-reduce:animate-none', () => {
    // Tanpa pasangan ini, pengguna "kurangi gerakan" tetap kena animasi.
    for (const f of BERKAS) {
      const kode = kodeTanpaKomentar(f);
      const denganAnimasi = (kode.match(/className="[^"]*animate-in[^"]*"/g) ?? []).length;
      const denganReduce = (kode.match(/className="[^"]*motion-reduce:animate-none[^"]*"/g) ?? []).length;
      expect(denganReduce, `motion-reduce di ${f}`).toBe(denganAnimasi);
      expect(denganAnimasi, `ada animasi di ${f}`).toBeGreaterThan(0);
    }
  });

  it('render nyata memuat kelas animasi', () => {
    expect(htmlRiwayat(), 'kartu riwayat beranimasi di HTML').toContain('animate-in');
  });
});
