# 22 — Prompt Agent Milestone M10 (Header Keamanan Login + CSP Produksi + Kode Mati)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> Konteks: M9 selesai 2026-10-03 dengan 664 tes hijau di tiga timezone. Utang kerja
> lengkap ada di `rules/21-catatan-m10.md`.

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau ada yang tidak tertulis, BERHENTI dan tulis pertanyaannya.

################################################################
1. HALTE WAJIB
################################################################
Sebelum mulai:
  node -v          # harus v24.x.x (K-43). Kalau v26, BERHENTI.
  git status       # CATAT apa yang sudah berubah. JANGAN pernah menjalankan
                   # git checkout / git reset --hard / git stash / git clean.
  npm run build
  npm run typecheck
  npm run test:tz

Kalau build atau tes sudah GAGAL SEBELUM Anda berubah, JANGAN melanjutkan. Laporkan dan
BERHENTI.

Milestone ini KECIL. Tiga tugas, menyentuh tiga berkas. Jangan menulis ulang apa pun yang
tidak diminta.

################################################################
2. TUGAS 1 — HEADER KEAMANAN UNTUK / DAN /login
################################################################
MASALAH: `next.config.mjs` hanya punya dua blok header — `/a/:path*` dan `/admin/:path*`.
Halaman `/` dan `/login` TIDAK punya satu pun header. Padahal `/login` adalah
satu-satunya halaman tanpa autentikasi yang menerima password, jadi permukaannya paling
besar.

REPRODUKSI — jalankan lebih dulu dan buktikan sendiri:
  npm run build && npm run start
  curl -s -D - -o /dev/null http://localhost:PORT/login \
    | grep -iE 'x-content-type|x-frame|referrer|content-security'
  # harus kosong — tidak ada satu pun

PERBAIKAN: tambah dua blok lagi di `next.config.mjs`, untuk `/` dan untuk `/login`.
Keduanya mendapat:

    X-Content-Type-Options   nosniff
    Referrer-Policy          strict-origin-when-cross-origin
    X-Frame-Options          DENY
    Content-Security-Policy  default-src 'self'; object-src 'none'; base-uri 'self';
                            form-action 'self'; frame-ancestors 'none'

CSP di `/` dan `/login` boleh lebih ketat daripada di `/admin/:path*`, karena tidak ada
kamera dan tidak ada grafik di sana.

PERINGATAN KHUSUS — INI YANG BISA MEMATIKAN LOGIN:
  `/login` punya `<form>`. Kalau `form-action` atau `base-uri` salah, atau kalau
  `script-src` terlalu ketat sehingga skrip Next tidak berjalan, login berhenti bekerja
  tanpa pesan error yang jelas di server.

  Karena itu:
    - `X-Frame-Options: DENY` dan `frame-ancestors 'none'` konsisten, jadi aman dipakai
      bersama-sama.
    - JANGAN menambah `script-src` apa pun di blok ini. Kalau ternyata halaman login
      memakai inline script, tambahkan `script-src 'self' 'unsafe-inline'` dan
      JELASKAN alasannya di komentar. Jangan menebak.
    - BUKTI: setelah selesai, jalankan server produksi dengan APP_ORIGIN yang cocok,
      lalu LOGIN DENGAN CURL sampai cookie sesinya benar-benar didapat, lalu buka
      `/admin` dan pastikan 200. Kalau login gagal, CSP Anda salah.

################################################################
3. TUGAS 2 — HILANGKAN 'unsafe-eval' DARI CSP PRODUKSI  (paling berisiko)
################################################################
MASALAH: CSP admin memakai

  script-src 'self' 'unsafe-inline' 'unsafe-eval'

`unsafe-eval` dibutuhkan `next dev`, tapi tidak dibutuhkan produksi. Karena `headers()`
mengembalikan nilai yang sama untuk kedua mode, produksi sekarang membuka `eval()`
untuk sumber apa pun yang lolos `'self'`.

PERBAIKAN: jadikan nilai itu tergantung pada mode, dengan membaca `process.env.NODE_ENV`
di dalam `headers()`. Bentuknya kira-kira begini:

  const modeProduksi = process.env['NODE_ENV'] === 'production';
  // produksi: TANPA 'unsafe-eval'
  // development: tetap memakainya karena Next.js dev membutuhkannya untuk HMR

BACAKAN DOKUMENTASI RESMI Next.js untuk memastikan dua hal ini, dan jangan menebak dari
ingatan:
  1. Apakah `headers()` boleh mengembalikan nilai yang berbeda tergantung mode?
  2. `NODE_ENV` kapan dibaca — saat build atau saat request?
Catat URL yang Anda pakai di rules/NOTES.md.

ATURAN MUTLAK:
  - Build produksi WAJIB berisi CSP tanpa `unsafe-eval`.
  - `next dev` WAJIB tetap memakai `unsafe-eval`, kalau tidak HMR rusak dan Anda sendiri
    tidak bisa bekerja.
  - `/a/:path*` TETAP TIDAK diberi CSP. Kamera 26 karyawan bergantung pada itu.

JIKA ANDA TIDAK BISA MEMBUKTIKAN KEDUA KONDISI DI ATAS, BERHENTI DAN LAPORKAN. Jangan
menebak lalu mengirimnya. Ini satu-satunya tugas di milestone ini yang bisa merusak
halaman tanpa memunculkan error sama sekali di server — tidak ada yang terlihat
  sampai klien yang sedang memakainya.

################################################################
4. TUGAS 3 — KODE MATI ItemMenu.segera
################################################################
MASALAH: `src/app/admin/menu.ts` masih mendeklarasikan `segera?: boolean;` tapi tidak ada
lagi yang membacanya. Cabang yang memakainya, yaitu label "Segera", dihapus saat M9.

KEPUTUSAN PEMILIK: field ini DISENGAJA DIJAGA, bukan dihapus. Proyek ini memakai pola
"Segera" untuk menu yang belum ada, jadi menghapusnya akan merusak pola itu.

PERBAIKAN: tambahkan satu blok komentar singkat di deklarasinya yang menjelaskan bahwa
field itu dipakai lagi begitu ada menu berlabel "Segera". Jangan menambah kode, jangan
menambah tes, jangan mengubah perilaku apa pun.

################################################################
5. TES
################################################################

TES YANG DILARANG:
  expect(kodeFile).toContain('...')        menguji teks, bukan perilaku
  expect(true).toBe(true)
  expect(existsSync('page.tsx')).toBe(true)
  Membaca berkas lalu mencari string
  Menghitung jumlah berkas lalu membandingkannya dengan angka tetap

TES YANG WAJIB: panggil kode sungguhan.
  - `next.config.mjs`: panggil `headers()` lalu periksa hasilnya, seperti yang sudah
    dilakukan di `tests/m9-header.test.ts`. Baca berkas itu lebih dulu dan ikuti
    polanya.
  - Bukti headers() WAJIB lewat `curl -D -` ke server produksi yang benar-benar
    berjalan. Config yang salah ketik tidak akan ketahuan kalau hanya dibaca.
    Dan 307 redirect ke /login BUKAN bukti — itu artinya halaman tidak pernah dirender.

TES WAJIB untuk milestone ini:
  [ ] `/` punya keempat header
  [ ] `/login` punya keempat header
  [ ] `/admin/:path*` masih punya keempat header
  [ ] `/a/:path*` MASIH TIDAK punya CSP, dan `Permissions-Policy: camera=(self)` utuh
  [ ] Build produksi: CSP admin tidak memuat 'unsafe-eval'
  [ ] Build produksi: /admin/audit-log tetap 200 dan semua sumber dayanya berasal dari origin sendiri
  [ ] Login lewat curl ke server produksi berhasil mendapat cookie sesi
  [ ] `ItemMenu.segera` punya komentar yang menjelaskan tuannya

BUKTI WAJIB: matikan aturannya, lihat tes gagal.
  - Cabut blok header `/login` -> tes harus gagal
  - Kembalikan 'unsafe-eval' ke build produksi -> tes harus gagal
  - Tambahkan CSP ke `/a/:path*` -> tes harus gagal (ini yang mematikan kamera)
  - Hapus komentar `ItemMenu.segera` -> tes harus gagal

Kalau ada tes yang tetap hijau setelah aturannya dimatikan, tes itu tidak menguji apa
pun. Perbaiki atau hapus. Catat hasil tiap mutasi di laporan.

Yang tidak boleh terputus:
  [ ] npm run test:tz hijau di TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
  [ ] 664 tes yang ada sekarang tetap lulus
  [ ] git diff --stat src/app/a/ kosong
  [ ] migrations/0001_init.sql tidak berubah (md5 466a7b1a5aa5b1ab0a88e0a5f63a8a98)
  [ ] src/server/guard.ts dan src/server/waktu.ts tidak berubah

################################################################
6. YANG TIDAK BOLEH DISENTUH
################################################################

DILARANG:
  src/app/a/[token]/**       Halaman karyawan, 26 orang di HP. Butuh getUserMedia.
  src/server/guard.ts        Pemeriksaan Origin. BUG-UI-05.
  src/server/waktu.ts        BUG-01: jangan pernah mengumpankan `sekarangWIB()` ke
                             fungsi waktu lain.
  src/app/admin/verifikasi/** Sudah disetujui pemilik pada UI-2.
  src/app/api/**             Tidak ada route baru dan tidak ada perubahan logika.
  migrations/0001_init.sql   Tidak boleh berubah sama sekali.
  package.json dan package-lock.json  Tidak memasang paket apa pun. jsdom (B-20) sudah
                             ditunda pemilik dan TIDAK termasuk milestone ini.
  rules/00 s.d. rules/06     Kalau memang ada yang salah, tulis di
                             rules/OPEN_QUESTIONS.md — jangan mengubah sendiri.
  git checkout, git reset --hard, git stash, git clean, dan git commit

WAJIB:
  - Tidak ada teks Bahasa Inggris yang terlihat pengguna
  - Tidak ada warna hex atau rgb literal
  - Tidak menambah fitur, halaman, atau aturan baru

################################################################
7. KRITERIA SELESAI
################################################################
  [ ] npm run build 0 error
  [ ] npm run typecheck 0 error
  [ ] npm run test:tz hijau di TIGA timezone
  [ ] `/` dan `/login` punya keempat header, dibuktikan dengan curl ke server produksi
  [ ] Build produksi: CSP admin tanpa 'unsafe-eval'; `next dev` tetap memakainya
  [ ] Login berhasil lewat curl ke server produksi, lalu `/admin` balas 200
  [ ] `/a/:path*` tetap tanpa CSP
  [ ] src/app/a/, src/server/guard.ts, src/server/waktu.ts, src/app/api/, dan migrations/
        tidak berubah

################################################################
8. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M10 (header keamanan login + CSP produksi + kode mati)
Selesai: <berkas yang diubah>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus atau gagal, jumlah, di masing-masing timezone>
Header / dan /login: <empat header yang ditambahkan, dan hasil curl-nya>
Bukti login masih bisa: <perintah curl login, hasilnya, lalu status /admin>
CSP produksi: <bagaimana condition dibuat; bukti build produksi tanpa unsafe-eval>
CSP dev: <bukti next dev masih memakai unsafe-eval>
Kamera: <bukti /a/:path* tetap tanpa CSP>
ItemMenu.segera: <komentar yang ditambahkan>
Bukti mutasi: <empat mutasi di bagian 5 dan hasilnya>
Halaman karyawan: <bukti git diff kosong untuk src/app/a/>
Tidak boleh disentuh: <bukti git diff kosong untuk guard.ts, waktu.ts, src/app/api, migrations>
Migrasi: <md5 migrations/0001_init.sql>
Verifikasi dokumentasi eksternal: <URL yang dipakai, dicatat di rules/NOTES.md>
Yang tidak dikerjakan: <B-20 jsdom, dan alasannya>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
9. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| M9 selesai | 664 tes hijau di tiga timezone |
| Server produksi bisa dijalankan lokal | `APP_ORIGIN` harus disesuaikan — `APP_ORIGIN_DEV` diabaikan di produksi (BUG-UI-02) |
| Baseline commit | belum ada — 52 berkas hasil UI-2 dan M9 masih di working tree |
| jsdom (B-20) | ditunda pemilik — **tidak termasuk M10** |

## C. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber |
|---|---|
| `/` dan `/login` nol header | `curl` ke server produksi, 2026-10-03 |
| `/admin/:path*` keempat header ada | `curl` ke server produksi |
| `/a/:path*` punya `Permissions-Policy: camera=(self)`, tanpa CSP | `next.config.mjs` |
| CSP admin tidak memblokir apa pun | inventarisasi sumber daya 12 halaman: 13 `script src`, **0 non-self**, 5 inline, 2 link, 1 atribut style |
| `ItemMenu.segera` tidak dipakai siapa pun | `grep -rn 'segera' src/app/` → satu baris |
| jsdom tidak diperlukan untuk tiga tugas ini | ketiga tugas hanya menyentuh konfigurasi dan komentar |

## D. Peta M10 → spec → berkas

| Tugas | Spec | Berkas | Status |
|---|---|---|---|
| Header `/` dan `/login` | `rules/03` §9.7 | `next.config.mjs` | tambah 2 blok |
| `unsafe-eval` di produksi | `rules/03` §9.7 | `next.config.mjs` | kondisi |
| Komentar `ItemMenu.segera` | — | `src/app/admin/menu.ts` | 1 komentar |
| Tes | — | `tests/m9-header.test.ts` atau berkas baru | tambah |

**Pemeriksaan silang wajib sebelum mengirim prompt ini** — pelajaran dari kontradiksi
prompt M9, di mana `src/app/admin/verifikasi/**` ada di daftar "dilarang" sekaligus
meminta M9-02 di berkas itu. Sudah diperiksa untuk file ini:

| Path | hanya di "wajib" | hanya di "dilarang" |
|---|---|---|
| `next.config.mjs` | ya | — |
| `src/app/admin/menu.ts` | ya | — |
| `tests/m9-header.test.ts` | ya | — |
| `src/app/a/[token]/**` | — | ya |
| `src/server/guard.ts`, `src/server/waktu.ts` | — | ya |
| `src/app/admin/verifikasi/**` | — | ya |
| `src/app/api/**` | — | ya |
| `migrations/0001_init.sql` | — | ya |
| `package.json`, `package-lock.json` | — | ya |

Tidak ada tumpang tindih.

## E. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Tidak ada lingkungan DOM** (B-20 ditunda) | Ketiga tugas tidak butuh DOM, jadi tidak menghalangi. Yang tetap mustahil: membuktikan CSP tidak merusak halaman di browser sungguhan. |
| **Browser tidak terhubung ke sesi agent** | Pelanggaran CSP hanya muncul di konsol browser, bukan di respons HTTP. Agent bisa membuktikan semua sumber daya diizinkan secara mekanis, tetapi tidak bisa melihat halaman benar-benar berfungsi. Untuk tugas 1 dan 2, bukti mekanis adalah bukti terbaik yang ada. |
| `headers()` bisa dievaluasi saat build | `NODE_ENV` yang dibaca harus yang saat build, bukan saat request. Agent wajib memverifikasi ke dokumentasi, bukan menebak. |
| `/login` punya `<form>` | `form-action` atau `base-uri` yang salah mematikan login tanpa error server yang jelas. Wajib dibuktikan dengan login lewat curl. |

## F. Yang TIDAK termasuk M10

- **jsdom / B-20** — ditunda pemilik
- **Penghapusan `ItemMenu.segera`** — pemilik memutuskan **dipertahankan** dengan komentar
- **Optimasi indeks database** — `audit_log` tidak punya indeks `pengguna_id`/`aksi`; diterima karena datanya masih kecil. Menambah indeks perlu keputusan tersendiri
- **Fitur baru apa pun**