# 17 — Prompt Agent Milestone UI-1 (Pondasi Desain + Dashboard)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan.

MILESTONE INI BERBEDA DARI SEMUA MILESTONE SEBELUMNYA: ini milestone PRESENTASI.
Tidak ada aturan bisnis baru, tidak ada route baru, tidak ada perubahan database.
Yang berubah adalah BAGAIMANA aplikasi itu terlihat dan Likenya.

################################################################
1. HALTE WAJIB
################################################################
Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  git status      # harus bersih
  npm run build   # harus hijau

Kalau build tidak hijau SEBELUM Anda berubah, JANGAN melanjutkan. Laporkan dan BERHENTI.

################################################################
2. TIGA BUG YANG HARUS DIPERBAIKI DULU
################################################################
Temuannya berasal dari menjalankan aplikasi sungguhan di browser, bukan dari membaca kode.
Tiga hal ini tidak pernah terlihat selama sembilan milestone.

--- BUG-UI-01: halaman akar masih "versi M0" ---
src/app/page.tsx berbunyi "Aplikasi internal absensi — versi M0."
Ganti dengan penjelasan yang benar dan menautkan ke /login. JANGAN sebut nomor milestone
atau "versi" apa pun — nomor milestone itu urusan pengembangan, bukan pengguna.
Halaman ini boleh sesederhana apa pun; yang penting tidak berbohong.

--- BUG-UI-02: aplikasi tidak bisa dipakai di localhost ---
src/server/guard.ts membandingkan Origin dengan `origin !== appOrigin` secara EKSAK.
Dengan .env.local apa adanya (APP_ORIGIN=https://arsaba.vercel.app), setiap route di
localhost mendapat 403 — termasuk login. Yang lebih buruk, pesan login yang muncul adalah
"Username atau password salah." sehingga developer mengira password-nya salah, padahal
credential-nya benar.

Perbaikan yang diminta — JANGAN melemahkan wajibOrigin:
  - Kalau APP_ORIGIN tidak sama persis dengan origin request, TETAP 403.
  - Tambahkan jalur development yang EKSPLISIT dan terlihat jelas di kode: misalnya
    sebuah file konfigurasi atau variabel APP_ORIGIN_DEV yang HANYA dibaca saat NODE_ENV
    development. Dokumentasikan di komentar kenapa ini aman dan kenapa tidak berlaku di
    produksi.
  - Jangan pernah membuat production menerima Origin apa pun.
  - Pastikan halaman login tetap menampilkan "Username atau password salah." untuk
    kegagalan Origin (BR-AUTH tidak boleh bocor lewat pesan).

--- BUG-UI-03: tidak ada halaman "akses ditolak" ---
Super Admin saja yang boleh master data (K-22). Kalau Admin mengetik /admin/master/toko
langsung, halamannya sekarang tampil 200 dengan shell kosong lalu API-nya 403.
Akibatnya layar kosong, bukan pesan yang jelas.

Perbaikan: saat halaman admin memanggil API dan mendapat 403 AKSES_DITOLAK, tampilkan
keadaan "Anda tidak punya akses ke halaman ini" yang jelas, bukan layar kosong.
Terapkan juga di layout, sehingga direct URL ke halaman terlarang tidak pernah tampil kosong.
Tetap. Server tetap menolak — yang diperbaiki hanya tampilannya.

################################################################
3. VERIFIKASI YANG SUDAH SELESAI — JANGAN DIULANG
################################################################
Saya sudah memverifikasi ke dokumentasi resmi pada 2026-10-03. Tidak perlu mencari lagi:

  shadcn/ui Next.js    https://ui.shadcn.com/docs/installation/next
  Komponen Chart       https://ui.shadcn.com/docs/components/chart
  Tailwind v4 Next.js  https://tailwindcss.com/docs/installation/framework-guides/nextjs

Tiga poin yang WAJIB diperhatikan:
  1. Tailwind v4 itu CSS-FIRST. TIDAK ADA tailwind.config.js.
     Cukup: postcss.config.mjs + @import "tailwindcss"; di globals.css
  2. shadcn bukan pustaka — CLI-nya menyalin SOURCE komponen ke src/components/ui/.
     Itu bagus: kodenya bisa diaudit, tidak ada lock-in.
  3. Komponen chart membungkus RECHARTS v3, dan API-nya BERUBAH dari v2:
       - pakai var(--chart-1), BUKAN hsl(var(--chart-1))
       - HAPUS `layout` dari <Bar> kalau parent <BarChart> sudah mendefinisikannya
       - ChartContainer WAJIB punya tinggi (h-[200px] / min-h-*) agar ResponsiveContainer
         bisa mengukur saat render pertama
       - `accessibilityLayer` untuk aksesibilitas keyboard dan screen reader
     Tutorial lama akan membuat Anda gagal. Jangan ikut tutorial versi lama.

Alias `@/*` -> `./src/*` sudah ada di tsconfig.json. Jangan diubah.

################################################################
4. RISIKO UTAMA MILESTONE INI — BACA
################################################################
Tailwind v4 menyertakan PREFLIGHT yang me-reset gaya bawaan browser: margin, border,
box-sizing, dan seterusnya.

Proyek ini punya 353 inline style={{}} dan hanya 2 className=. Halaman lama banyak
bergantung pada perilaku bawaan browser. Setelah Tailwind dipasang, halaman-halaman itu
AKAN BERUBAH — dan kita tidak bisa mengetahuinya tanpa melihat.

Karena itu Anda WAJIB menjalankan build + typecheck setelah SETIAP langkah, dan membuka
aplikasi, bukan/pass melakukan semuanya sekaligus lalu melihat hasilnya di akhir.

################################################################
5. LANGKAH PEMASANGAN (berurutan, verifikasi tiap langkah)
################################################################

Langkah 1 — Tailwind
  npm install tailwindcss @tailwindcss/postcss postcss
  buat postcss.config.mjs:
      const config = { plugins: { "@tailwindcss/postcss": {} } };
      export default config;
  globals.css: tambahkan @import "tailwindcss";
  -> npm run build. JIKA GAGAL, STOP dan laporkan.

Langkah 2 — shadcn
  npx shadcn@latest init
  -> JIKA CLI meminta menimpa file yang sudah ada (globals.css, tsconfig.json, dll),
     JANGAN menimpa buta. Bandingkan isinya, gabungkan seperlunya, catat setiap
     perubahan di laporan. tsconfig.json pernah punya masalah jadi tercemar entry
     .next/dev/types (lihat AGENTS.md) — janganVilla biarkan itu kembali.
  npx shadcn@latest add card button badge table skeleton separator chart \
      dropdown-menu sheet tooltip input label select dialog alert tabs switch avatar sonner
  -> npm run build. JIKA GAGAL, STOP dan laporkan.

Langkah 3 — design token + mode gelap
  shadcn menulis token warna ke globals.css sebagai CSS variable (:root dan .dark).
  Periksa dan rapikan:
    - GANTI aturan body lama yang hardcoded (#f5f5f5 dan #111) dengan token variabel.
      Warna hardcoded bertentangan dengan mode gelap.
    - Pastikan kelas `dark` benar-benar bisa dipasang ke <html>.
    - src/app/layout.tsx perlu suppressHydrationWarning pada <html> supaya kelas tema
      tidak memicu peringatan hydration.
  Tambahkan pengalih tema (terang/gelap) yang:
    - MENYIMPAN pilihan di localStorage
    - MENERAPKAN kelas `dark` ke <html> SEBELUM hydrate, lewat skrip inline kecil di
      <head>, supaya tidak ada kedipan putih (flash) saat halaman dimuat
    - Menghormati prefers-color-scheme sebagai nilai awal kalau belum pernah dipilih
  Semua teks dan ikon harus terbaca di KEDUA mode. Cek kontrasnya, jangan diasumsikan.

Langkah 4 — layout admin
  Pakai komponen Sidebar shadcn. Persyaratan:
    - Sidebar tersembunyi di layar kecil, terbuka lewat tombol menu (komponen Sheet)
    - Menu tetap mengikuti peran seperti sekarang (Admin 6 link, Super Admin 11 link)
    - Tampilkan nama peran yang sedang aktif
    - Navigasi aktif diberi penanda visual yang jelas
  Layout saat ini memakai inline style. GANTI dengan utility class Tailwind.

Langkah 5 — dashboard + grafik
  rules/02 §12 dan rules/05 §5.2 TIDAK BERUBAH. Yang berubah hanya tampilannya:
    - Satu kartu per toko (10 kartu): Terjadwal · Sudah absen · Terlambat · Belum absen
    - Kartu "Terlambat" dan "Belum absen" diberi PENEKANAN visual (rules/05 §5.2)
    - Kartu Antrean verifikasi: jumlah MENUNGGU, tautan ke /admin/verifikasi
    - Tambahkan GRAFIK. Pilihan yang diminta pemilik: Recharts lewat komponen shadcn chart.
      Dua chart yang masuk akal dengan data yang SUDAH tersedia di /api/admin/dashboard:
        a) Diagram batang per toko: Terjadwal vs Sudah absen (membuat "belum absen" terlihat)
        b)Diagram batang "Terlambat" per toko (dengan penekanan)
      JANGAN mengarang metrik baru. JANGAN mengambil data yang tidak ada di endpoint itu.
      Kalau sebuah grafik butuh data yang tidak tersedia, JANGAN membuatnya — laporkan
      sebagai pertanyaan di laporan.
    - Grafik harus punya tinggi eksplisit (lihat bagian 3)
    - Warna grafik lewat CSS variable supaya ikut mode gelap
    - Grafik yang hanya mengandalkan warna harus punya label atau angka juga —
      jangan andalkan warna saja untuk pembaca yang buta warna
    - TETAP TANPA pemilih tanggal (rules/05 §5.2 melarangnya)

################################################################
6. BATASAN KERAS
################################################################

DILARANG DISENTUH:
  src/app/a/[token]/**      Halaman karyawan. 26 orang memakainya di HP.
                            rules/05 §3 merancang alurnya sengaja sesederhana mungkin
                            (kamera -> Foto -> Absen). Komponen berat akan memperlambat
                            di jaringan seluler. JANGAN sentuh file ini sama sekali.
  src/app/login/page.tsx    Boleh dirapikan, tapi alurnya jangan diubah.
  src/app/api/**            Tidak ada route baru, tidak ada perubahan logika.
  src/server/**             Tidak ada perubahan aturan bisnis.
  migrations/0001_init.sql  md5 harus tetap 466a7b1a5aa5b1ab0a88e0a5f63a8a98
  src/server/waktu.ts, guard.ts, auth.ts, audit.ts, izin.ts, db.ts
  vitest.config.mts

Halaman admin lain (verifikasi, jadwal, tidak-berangkat, rekap, akun, pengaturan,
master/*) pada milestone ini JANGAN dirombak — itu UI-2. Anda boleh MENYENTUH layout-nya
supaya menu dan kerangka benar, tapi isi halamannya biarkan.

WAJIB:
  - Tidak boleh ada perubahan pada angka atau definisi metrik mana pun
  - Tidak boleh ada dependensi lain selain yang disebut di bagian 5
  - Tidak boleh ada teks Bahasa Inggris yang terlihat oleh pengguna
  - Jangan menambahkan fitur, halaman, atau komponen yang tidak diminta di sini

################################################################
7. TES
################################################################
DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)

WAJIB ada tes untuk:

  BUG-UI-01
  [ ] Halaman akar tidak lagi memuat kata "versi M0" ATAU kata "versi"

  BUG-UI-02 — ini yang paling penting, jangan sampai lemah
  [ ] APP_ORIGIN tidak persis -> tetap 403 (KEAMANAN TIDAK BOLEH LEMAH)
  [ ] Jalur development yang Anda tambahkan HANYA aktif saat NODE_ENV development
  [ ] Halaman login tetap "Username atau password salah." saat Origin ditolak
  [ ] Dengan APP_ORIGIN development yang benar, login BERHASIL

  BUG-UI-03
  [ ] Respons 403 AKSES_DITOLAK menghasilkan keadaan "akses ditolak" yang terlihat,
      bukan layar kosong

  Yang TIDAK boleh terputus
  [ ] Seluruh 489 tes lama tetap lulus (kecuali yang memang berubah karena UI)
  [ ] Menu Admin tetap 6 link, Super Admin 11 link
  [ ] Route yang tidak boleh diubah: jalankan test:tz dan pastikan tidak ada regresi

  Struktur UI
  [ ] Layout memakai komponen dari src/components/ui, bukan inline style
  [ ] src/components/ui/ berisi komponen hasil shadcn CLI (bisa diaudit)
  [ ] Halaman /a/[token] tidak berubah sama sekali — buktikan dengan git diff --stat
        pada folder itu HARUS kosong

################################################################
8. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone (K-44):
                            TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
  [ ] Tidak ada teks "versi M0" atau kata "versi" di halaman akar
  [ ] migrations/0001_init.sql tidak berubah (md5 466a7b1a5aa5b1ab0a88e0a5f63a8a98)
  [ ] git diff --stat src/app/a/  -> KOSONG (halaman karyawan tidak tersentuh)
  [ ] src/server/** tidak berubah
  [ ] src/app/api/** tidak berubah
  [ ] Tidak ada dependensi lain selain yang disebut di bagian 5
  [ ] Mode gelap: kelas dark bisa dipasang, pilihan tersimpan, tidak ada flash putih
  [ ] Grafik punya tinggi eksplisit dan label/angka, bukan hanya warna

WAJIB: catat setiap perubahan yang dilakukan shadcn init pada file yang sudah ada.
CLI itu suka menimpa tsconfig.json dan globals.css. Setiap overwrite harus
dipertimbangkan dan dicatat.

################################################################
9. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: UI-1 (pondasi desain + dashboard)
Selesai: <file yang dibuat / diubah>
Versi: Node <node -v> / Next.js <versi> / Tailwind <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
BUG-UI-01: <bukti teks "versi M0" hilang>
BUG-UI-02: <bukti 403 tetap berlaku di produksi + jalur dev hanya saat development>
BUG-UI-03: <bukti 403 menghasilkan tampilan akses ditolak>
File yang ditimpa shadcn init: <daftar, dan apa yang berubah di tiap file>
Komponen shadcn: <daftar yang di-add>
Design token: <warna utama terang dan gelap yang Anda pilih>
Mode gelap: <bukti kelas dark, localStorage, dan cara flash putih dihindari>
Layout: <bukti sidebar responsif + menu per peran masih benar>
Grafik: <jenis grafik, data dari mana, tinggi eksplisit, cara_NON-color>
Halaman karyawan: <bukti git diff kosong untuk src/app/a/>
Regresi: <489 tes lama: berapa yang lulus, ada yang berubah dan mengapa>
Verifikasi dokumentasi eksternal: <tiga URL yang sudah diverifikasi; plus URL lain
  bila Anda memakai dokumentasi tambahan>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
10. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai UI-2.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Alias `@/*` → `./src/*` | sudah ada di `tsconfig.json` |
| Komponen yang akan dipakai | semua baru — belum ada `src/components/ui/` |
| Database demo | `scripts/isi-data-demo.ts` sudah terisi |
| Teks M0 | ada, harus hilang |

## C. Yang sudah diverifikasi (jangan diulang)

- shadcn mendukung jalur "Existing Project"; alias `@/*` sudah cocok
- Komponen `chart` membungkus **Recharts v3** — tiga perubahan API dari v2 sudah dicatat
- Tailwind **v4.3** CSS-first: tidak ada `tailwind.config.js`
- 13 halaman admin sudah **200** tanpa error server
- Izin Admin/Super Admin sudah benar di menu **dan** di server
- Dashboard API sudah mengembalikan angka yang benar (terverifikasi silang)

## D. Perbedaan dari semua milestone sebelumnya

| Hal | M0–M8 | UI-1 |
|---|---|---|
| Yang berubah | logika bisnis | **tampilan saja** |
| Route/DB | berubah | **tidak boleh berubah** |
| Verifikasi | tes perilaku | tes + **periksa visual manual** |
| Risiko | bug logika | **Preflight merusak halaman lama** |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Gaya UI berubah | bagian 4, 5 |
| Halaman akar berubah | bagian 2 (BUG-UI-01) |
| `guard.ts` dapat jalur dev | bagian 2 (BUG-UI-02) — **dilarang melemahkan** |
| `globals.css` + `layout.tsx` | bagian 5 (token, mode gelap) |
| Dashboard | bagian 5 (grafik) |
| `rules/05` §5.2 | tidak berubah — hanya tampilannya |
