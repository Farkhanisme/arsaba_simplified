# 20 — Prompt Agent Milestone M9 (Audit Log UI + Hardening + Aksesibilitas + QA)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**

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
                   # 34 berkas hasil UI-2 belum di-commit dan itu disengaja.
  npm run build
  npm run typecheck
  npm run test:tz

Kalau build atau tes sudah GAGAL SEBELUM Anda berubah, JANGAN melanjutkan. Laporkan dan
BERHENTI.

################################################################
2. INI MILESTONE PERTAMA YANG BUKAN CUMA PRESENTASI
################################################################
Milestone M0-M8 dan UI-1/UI-2 tidak pernah menambah kode server. M9 berbeda:

  Tabel `audit_log` di migrasi          SUDAH ADA
  Izin `audit_log: ['SUPER_ADMIN']`     SUDAH ADA, di src/server/izin.ts
  `catatAudit()` untuk MENULIS          SUDAH ADA, di src/server/audit.ts
  Query BACA dari audit_log             BELUM ADA — nol query SELECT
  `GET /api/admin/audit-log`            BELUM ADA
  Halaman `/admin/audit-log`            BELUM ADA
  Menu Audit Log                        Placeholder `segera: true`
  Header keamanan admin + CSP           BELUM ADA (hanya `/a/:path*`)
  Aksesibilitas (M9-05)                 belum
  Empat celah tes (M9-01 s.d. M9-04)   belum

Jadi M9 menambah backend. Konsekuensinya:
  - Route handler wajib memakai `guard()` dan memvalidasi query dengan zod.
  - Wajib didaftarkan di `tests/guard-origin.test.ts`. Tes itu MEMBandingkan daftar
    route terdaftar dengan SELURUH `route.ts` di `src/app/api`, jadi route baru yang
    lupa didaftarkan akan membuat tes gagal dengan sendirinya. Kalau tes gagal
    menunjuk route Anda, itu tandanya Anda lupa mendaftarkannya.
  - TIDAK perlu migrasi baru. Tabel dan indeksnya sudah ada. Dilarang mengubah
    `migrations/0001_init.sql` (md5 tetap 466a7b1a5aa5b1ab0a88e0a5f63a8a98).

Struktur `audit_log`, sudah final dan tidak boleh diubah:
    id, waktu, pengguna_id, aksi, entitas, entitas_id, sebelum, sesudah, catatan
    sebelum dan sesudah berisi JSON. Indeks: (waktu) dan (entitas, entitas_id).

`entitas` yang sudah dipakai: absensi, jadwal, karyawan, karyawan_link,
karyawan_penempatan, ketidakhadiran, log_ekspor, pengaturan, pengguna_admin,
shift_template, toko.

`aksi` memakai huruf besar-kecil campuran, contoh: LOGIN_BERHASIL, LOGIN_GAGAL,
GANTI_PASSWORD, VERIFIKASI, JADWAL_OVERRIDE, KOREKSI_UBAH_WAKTU, EKSPOR,
KARYAWAN_TAMBAH, PENGATURAN_UBAH, TIDAK_BERANGKAT_TAMBAH. JANGAN mengarang daftar
aksi di sisi klien. Ambil dari isi tabel, atau sediakan filter teks bebas.

################################################################
3. TUGAS 1 — QUERY BACA AUDIT LOG (BARU)
################################################################
Buat `src/server/repo/audit-log.ts`.

WAJIB:
  - Query berparameter saja. Dilarang menyambung string SQL dengan input pengguna.
    Membangun WHERE secara dinamis itu sah selama nilainya tetap lewat placeholder `?`.
  - Hanya SELECT. `audit_log` tidak boleh pernah di-UPDATE atau di-DELETE — itu
    larangan keras di AGENTS.md, bukan sekadar preferensi.
  - Pagination. Jangan mengambil seluruh tabel. Bawa `limit` dan `offset`, default 50
    baris, dan hitung juga totalnya supaya UI bisa menulis "Menampilkan X dari Y".
  - Filter sesuai `rules/05` §5.10: rentang waktu (dari dan sampai), pelaku
    (pengguna_id), aksi, entitas.
  - Ambil juga nama pelaku dari `pengguna_admin`. Jangan kirim `pengguna_id` telanjang
    ke klien kalau nama sudah tersedia. Cek nama kolomnya di `migrations/0001_init.sql`.
  - Urutkan `waktu DESC, id DESC` supaya yang terbaru di atas dan urutannya stabil
    antar halaman.

################################################################
4. TUGAS 2 — ROUTE + TES ORIGIN
################################################################
Buat `src/app/api/admin/audit-log/route.ts` dengan `GET`.

  - `guard('audit_log', handler)`. Nama fitur HARUS persis `audit_log` — itu yang ada
    di matriks `src/server/izin.ts`. Salah nama berarti endpoint menolak semua orang.
    Ini sudah pernah menjadi bug nyata di M1.
  - Query divalidasi zod. Nilai di luar rentang ditolak dengan status 400 dan bentuk
    `{ kode, pesan }` berbahasa Indonesia.
  - Tambahkan ke `tests/guard-origin.test.ts` mengikuti pola entri yang sudah ada di
    sana (entri punya field `nama`, `metode`, `panggil`). Jangan mengarang cara baru.

  TES WAJIB untuk route ini:
      [ ] ADMIN mendapat 403 AKSES_DITOLAK
      [ ] SUPER_ADMIN mendapat 200
      [ ] Tanpa sesi mendapat 401, bukan 500
      [ ] GET tanpa Origin DITERIMA lalu lanjut ke cek sesi, karena browser
          same-origin tidak mengirim Origin (BUG-UI-05, rules/NOTES.md §13)
      [ ] POST, PUT, dan DELETE ke path ini TIDAK ADA. Buktikan dengan memanggilnya
          dan mengharapkan 405, bukan sekadar "tidak dipakai".
      [ ] limit atau tanggal di luar rentang memberi 400 dengan pesan Indonesia

  PENTING — jangan pernah memperbaiki BUG-UI-05. `wajibOrigin()` hanya mewajibkan
  Origin pada POST/PUT/PATCH/DELETE. Kalau diubah menjadi mewajibkan Origin di semua
  request, SELURUH UI admin mati di browser. Aturan aslinya sudah benar di
  `rules/03` §9.4. Jangan sentuh `src/server/guard.ts`.

################################################################
5. TUGAS 3 — HALAMAN /admin/audit-log
################################################################
`rules/05` §5.10, persis: "Tabel hanya-baca: waktu · pelaku · aksi · entitas ·
ringkasan; baris dapat dibuka untuk melihat nilai sebelum/sesudah. Filter waktu,
pelaku, aksi, entitas. Tidak ada tombol ubah/hapus."

Pola wajib — sama seperti UI-2:
  `src/app/admin/audit-log/page.tsx`      hanya jaringan dan state, nol inline style
  `src/app/admin/audit-log/komponen.tsx`  presentasional murni, DIEKSPOR, tanpa
                                          jaringan dan tanpa next/navigation, supaya
                                          bisa diuji dengan renderToStaticMarkup

Komponen yang dipakai: Card, Table, Badge, Button, Input, NativeSelect, Dialog atau
Accordion untuk sebelum/sesudah, Skeleton, Alert.

  - Gunakan `NativeSelect`, bukan `Select` base-ui. `Select` menampilkan kode mentah
    saat popup tertutup (BUG-UI-06, rules/NOTES.md §14). Untuk dropdown yang bisa
    tertutup, Select selalu salah.
  - `sebelum` dan `sesudah` berisi JSON. Tampilkan rapi dan TAHAN terhadap JSON rusak
    atau null. Jangan sampai JSON.parse melempar dan mengosongkan halaman.
  - Tidak boleh ada satu pun tombol Ubah, Hapus, atau Simpan di halaman ini.
  - Menu: di `src/app/admin/menu.ts` ubah
        { label: 'Audit Log', segera: true }
    menjadi
        { label: 'Audit Log', href: '/admin/audit-log' }
    lalu HAPUS penanda `(Segera)` di `src/app/admin/layout.tsx` yang dipasang pada
    item yang punya flag `segera`.
  - `tests/m2-izin-layout.test.ts` punya TIGA assertion yang menyentuh `segera`.
    Perlakukan masing-masing secara berbeda, jangan_changed semuanya tanpa berpikir:

      baris 197  ADMIN  `segera:true` berjumlah 0  -> TIDAK BERUBAH. Admin memang
                tidak punya item segera, dan tetap begitu.
      baris 210  SUPER_ADMIN `segera:true` berjumlah 1 -> jadi 0. Audit Log tidak
                lagi placeholder.
      baris 223  SUPER_ADMIN HTML memuat `Segera` -> jadi tidak boleh memuatnya.

    Yang berubah adalah fitur, jadi perubahan ini sah. Tapi lakukan dengan jujur:
    tambahkan juga assertion bahwa `/admin/audit-log` muncul untuk SUPER_ADMIN dan
    TIDAK muncul untuk ADMIN. Jangan melemahkan assertion yang tidak perlu diubah.

TES WAJIB untuk halaman:
  [ ] Kelima kolom rules/05 §5.10 ada: Waktu, Pelaku, Aksi, Entitas, Ringkasan
  [ ] Tidak ada teks "Ubah", "Hapus", atau "Simpan" di seluruh HTML
  [ ] Loading memakai Skeleton
  [ ] Empty state ada dan berbahasa Indonesia
  [ ] Error state menampilkan pesan dan tombol "Coba lagi"
  [ ] Tidak ada elemen polos: <table>, <select>, <input>, <button> tanpa data-slot
  [ ] Nol inline style di page.tsx dan komponen.tsx
  [ ] Tidak ada teks Bahasa Inggris yang terlihat pengguna

################################################################
6. TUGAS 4 — HARDENING HEADER DAN CSP (BAGIAN PALING BERBAHAYA)
################################################################
`rules/03` §9.7: "Header keamanan dasar (CSP yang mengizinkan kamera untuk origin
sendiri, X-Content-Type-Options, dll)."

`next.config.mjs` sekarang hanya punya header untuk `/a/:path*`. Admin tidak punya
apa pun.

WAJIB:
  - Tambahkan `X-Content-Type-Options: nosniff` untuk `/admin/:path*`.
  - Tambahkan CSP untuk `/admin/:path*`. Admin tidak memakai kamera, jadi CSP admin
    boleh lebih ketat.
  - Tambahkan `Referrer-Policy` dan `X-Frame-Options` untuk admin.
  - Untuk `/a/[token]`: JANGAN menambah CSP yang bisa memblokir kamera. Halaman ini
    memakai `getUserMedia`, dan `Permissions-Policy: camera=(self)` sudah ada.
    Kalau kamu menambah CSP ke `/a/:path*`, CSP itu HARUS mengizinkan kamera untuk
    origin sendiri. Kalau tidak, halaman karyawan mati total.

INI RISIKO TERBESAR MILESTONE INI. `src/app/a/` dipakai 26 orang di HP dengan
jaringan seluler. Buktikan dengan `git diff --stat src/app/a/` — harus KOSONG.

BUKTI WAJIB untuk setiap header yang kamu tambahkan:
  [ ] Tiap header benar-benar terkirim. Buktikan dengan `curl -I`, bukan dengan
      membaca `next.config.mjs`. Config yang salah ketik tidak akan ketahuan kalau
      hanya dibaca.
  [ ] Halaman /a/ tetap 200 dan kameranya masih bisa dibuka. Buka lewat browser,
      bukan lewat curl.
  [ ] Matikan CSP-nya, lalu lihat tesmu gagal. Kalau tidak ada tes yang gagal, tes
      itu tidak menguji apa pun.

################################################################
7. TUGAS 5 — AKSESIBILITAS (M9-05)
################################################################
  - `PanelSel` di `src/app/admin/jadwal/komponen.tsx` kehilangan `aria-label="Panel
    sel"` yang dulu ada. Beri `aria-label`, atau `aria-labelledby` yang menunjuk
    `CardTitle`.
  - Buka semua 11 halaman admin di browser dan periksa minimal: setiap form punya
    label yang terhubung, setiap tombol ikon punya `aria-label`, tidak ada informasi
    yang hanya mengandalkan warna, urutan fokus masuk akal, dan modal bisa ditutup
    dengan keyboard.
  - Perbaikan sekecil mungkin. Aksesibilitas bukan alasan menulis ulang halaman.

################################################################
8. TUGAS 6 — TUTUP EMPAT CELAH TES (M9-01 s.d. M9-04)
################################################################
Semuanya ada di `rules/19-catatan-m9.md` lengkap dengan perintah reproduksinya. Baca
file itu lebih dulu. Ringkasnya:

  M9-01  "Minta Super Admin menambah template di Data Master › Shift."
         aturan: rules/05 §5.4
  M9-02  "Tidak ada absensi yang menunggu verifikasi."
         aturan: rules/05 §5.3, kalimat ini tertulis per kata di spec
  M9-03  Batas `maxLength` pada 16 input. zod di server sudah menjaganya, jadi ini
         bukan lubang keamanan — hanya pagar sisi klien yang bisa regresi diam-diam.
  M9-04  Teks petunjuk "(min 8)". `minLength={8}` sudah dipagari, jadi K-48 secara
         fungsional sudah tertutup. Yang hilang hanya teks petunjuknya.

Akar masalah M9-01 dan M9-02: string itu masih hidup di `page.tsx`, yang tidak bisa
dirender di tes karena butuh `next/navigation`. Pindahkan stringnya ke `komponen.tsx`
supaya bisa diuji. Jangan hanya menambahkan assertion ke halaman yang tidak bisa
dirender — itu tidak akan menangkap apa pun.

SETIAP closure harus dibuktikan dengan mutasi: jalankan tes, hapus aturannya, lihat tes
gagal, lalu pulihkan. Catat hasil mutasinya di laporan.

################################################################
9. YANG TIDAK BOLEH DISENTUH
################################################################

DILARANG SAMA SEKALI:
  src/app/a/[token]/**      Halaman karyawan, 26 orang di HP. Buktikan dengan
                            `git diff --stat src/app/a/` — harus kosong.
  src/server/guard.ts       Pemeriksaan Origin. Lihat BUG-UI-05.
  src/server/waktu.ts       BUG-01: jangan pernah mengumpankan `sekarangWIB()` ke
                            fungsi waktu lain.
  src/app/admin/verifikasi/**  Sudah disetujui pemilik pada UI-2.
  migrations/0001_init.sql  md5 tetap 466a7b1a5aa5b1ab0a88e0a5f63a8a98
  rules/00 s.d. rules/06    Kalau memang ada yang salah, tulis di
                            rules/OPEN_QUESTIONS.md — jangan mengubah sendiri.

DILARANG:
  - UPDATE atau DELETE pada audit_log, dalam bentuk apa pun
  - Menambah halaman, filter, atau fitur yang tidak diminta di sini
  - Menulis sebelum/sesudah dari sisi klien
  - Memasang paket baru. jsdom (B-20) sudah ditunda pemilik dengan alasan "nanti
    saja" dan TIDAK termasuk milestone ini. Kalau kamu merasa membutuhkannya,
    tanyakan di laporan — jangan memasang sendiri.
  - git checkout, git reset --hard, git stash, git clean, dan git commit

WAJIB:
  - Tidak ada teks Bahasa Inggris yang terlihat pengguna, termasuk sr-only
  - Tidak ada warna hex atau rgb literal — pakai variant komponen atau token CSS
  - Semua pesan error berbahasa Indonesia dengan bentuk { kode, pesan }

################################################################
10. TES — CARA YANG WAJIB
################################################################

TES YANG DILARANG:
  expect(kodeFile).toContain('...')        menguji teks, bukan perilaku
  expect(true).toBe(true)
  expect(existsSync('page.tsx')).toBe(true)
  Membaca berkas .tsx lalu mencari string di dalamnya
  Menghitung jumlah berkas dengan find atau execSync lalu membandingkannya dengan
    angka tetap

TES YANG WAJIB: panggil kode sungguhan.
  - Route: panggil handler-nya dengan NextRequest, lalu periksa status dan JSON.
  - Komponen: renderToStaticMarkup(createElement(Komponen, props)). Dua jebakan
    React 19: teruskan createElement(Komponen), jangan memanggil Komponen() langsung;
    dan kalau memakai useRouter, mock modul 'next/navigation'.
  - Header dan CSP: `curl -I` ke route-nya, lalu periksa headernya benar-benar ada.

PENGECATATAN PENTANG — sudah terbukti menipu berkali-kali:
  - `disabled:` di dalam kelas Button BUKAN penanda disabled. Gunakan atribut
    `disabled=""`.
  - `data-slot` milik komponen bisa terhapus kalau kamu mengirim `data-slot` sendiri.
    Untuk membuktikan sebuah komponen dipakai, pakai kelas khasnya (misalnya
    `group/card`) atau atribut lain yang tidak tertimpa.
  - `has-data-checked:` di dalam class membuat pola `/data-checked/` salah cocok.
    Gunakan `data-checked=""`.
  - `/<th[^>]*>/` juga cocok dengan `<thead>`.

BUKTI WAJIB: matikan aturannya, lihat tes gagal. Kalau tetap hijau, tes itu tidak
menguji apa pun. Catat setiap mutasi di laporan.

Yang tidak boleh terputus:
  [ ] npm run test:tz hijau di TZ=UTC, TZ=Asia/Jakarta, dan TZ=America/New_York
  [ ] 622 tes yang ada sekarang tetap lulus, kecuali yang memang berubah karena
      fitur ini memang harus berubah
  [ ] git diff --stat src/app/a/ kosong
  [ ] migrations/0001_init.sql tidak berubah
  [ ] src/server/guard.ts tidak berubah

################################################################
11. KRITERIA SELESAI
################################################################
  [ ] npm run build 0 error
  [ ] npm run typecheck 0 error
  [ ] npm run test:tz hijau di TIGA timezone
  [ ] Audit Log: repo baca, route, dan halaman. Hanya Super Admin. Hanya-baca.
  [ ] Menu "Audit Log" aktif dan tidak lagi menampilkan "(Segera)"
  [ ] ADMIN tidak melihat menu itu DAN endpoint menolaknya di server
  [ ] Nol inline style dan nol elemen polos di halaman baru
  [ ] Header keamanan terkirim di /admin/:path*, dibuktikan dengan curl -I
  [ ] /a/[token] tetap 200 dan kamera masih bisa dibuka, dibuktikan di browser
  [ ] M9-01 s.d. M9-05 tertutup, masing-masing dengan bukti mutasi
  [ ] src/app/a/, src/server/guard.ts, src/server/waktu.ts tidak berubah
  [ ] migrations/0001_init.sql tidak berubah

################################################################
12. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M9 (audit log UI + hardening + aksesibilitas + QA)
Selesai: <berkas yang dibuat dan diubah>
Versi: Node <node -v> / Next.js <versi> / Tailwind <versi>
Tes: <lulus atau gagal, jumlah, di masing-masing timezone>
Audit Log — repo: <query, filter, pagination, urutan; bukti total baris dihitung>
Audit Log — route: <fitur izin yang dipakai; bukti ADMIN 403 dan SUPER_ADMIN 200>
Audit Log — hanya-baca: <bukti tidak ada route mutasi, bukan sekadar tidak dipakai>
Audit Log — halaman: <kelima kolom rules/05 §5.10 ada; bukti tidak ada tombol ubah
  atau hapus>
Menu: <perubahan di menu.ts dan dua tes yang berubah di m2-izin-layout.test.ts>
Hardening: <header apa yang ditambahkan ke path mana, dan hasil curl -I-nya>
Kamera: <bukti /a/[token] masih bisa membuka kamera setelah CSP ditambahkan>
Aksesibilitas: <M9-05 plus temuan lain per halaman>
Celah tes ditutup: <M9-01 sampai M9-05, masing-masing dengan hasil mutasi>
Yang tidak dikerjakan: <B-20 jsdom dan alasannya>
Halaman karyawan: <bukti git diff kosong untuk src/app/a/>
Tidak boleh disentuh: <bukti git diff kosong untuk guard.ts dan waktu.ts>
Migrasi: <md5 migrations/0001_init.sql>
Verifikasi dokumentasi eksternal: <URL yang dipakai, dicatat di rules/NOTES.md>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
13. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan membuat milestone baru.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Tabel `audit_log` + indeks | sudah ada di `0001_init.sql` |
| Izin `audit_log: ['SUPER_ADMIN']` | sudah ada di `src/server/izin.ts` |
| `catatAudit()` | sudah ada di `src/server/audit.ts` |
| Menu Audit Log | sudah ada sebagai placeholder `segera: true` |
| Tes baseline | 622 hijau di tiga timezone |
| jsdom (B-20) | **ditunda pemilik — tidak termasuk M9** |

## C. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber |
|---|---|
| `wajibOrigin()` hanya mewajibkan Origin pada mutasi — jangan diubah | `rules/NOTES.md` §13, `rules/03` §9.4 |
| `Select` base-ui menampilkan kode mentah saat popup tertutup | `rules/NOTES.md` §14 |
| `data-slot` milik komponen tertimpa kalau kita kirim `data-slot` sendiri | `rules/NOTES.md` §15 |
| `guard-origin.test.ts` memaksa route baru didaftarkan | `tests/guard-origin.test.ts` |
| `Permissions-Policy: camera=(self)` sudah ada untuk `/a/:path*` | `next.config.mjs` |
| Hanya `/a/:path*` yang punya header; admin nol | `next.config.mjs` |
| Nama kolom `pengguna_admin` untuk nama pelaku | `migrations/0001_init.sql` |

## D. Peta M9 → spec → berkas

| Tugas | Spec | Berkas | Status |
|---|---|---|---|
| Repo baca audit log | `rules/05` §5.10 | `src/server/repo/audit-log.ts` | baru |
| Route audit log | `rules/03` §7 | `src/app/api/admin/audit-log/route.ts` | baru |
| Halaman audit log | `rules/05` §5.10 | `src/app/admin/audit-log/{page,komponen}.tsx` | baru |
| Menu aktif | `rules/05` §4 | `src/app/admin/menu.ts` | ubah 1 baris |
| Hapus "(Segera)" | — | `src/app/admin/layout.tsx` | ubah |
| CSP + header admin | `rules/03` §9.7 | `next.config.mjs` | tambah |
| Aksesibilitas M9-05 | — | `src/app/admin/jadwal/komponen.tsx` | tambah 1 atribut |
| Celah tes M9-01..04 | `rules/05` §5.3, §5.4, K-48 | `admin/jadwal/page.tsx`, `admin/verifikasi/page.tsx`, `admin/jadwal/komponen.tsx`, `admin/akun/komponen.tsx`, `admin/master/karyawan/komponen.tsx` | pindahkan string + tes |
| Tes menu | — | `tests/m2-izin-layout.test.ts` baris 210 dan 223 (baris 197 tidak berubah) | ubah |
| Tes Origin route | — | `tests/guard-origin.test.ts` | tambah 1 entri |

## E. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Tidak ada lingkungan DOM** (B-20 ditunda) | 622 tes tidak satu pun memanggil handler klien. Yang bisa diuji: route, repo, markup presentasional, header. Yang **tidak** bisa: klik, disable setelah fetch gagal, submit form. |
| `Dialog`/`Sheet`/`Select` berbasis portal | Isi popup tidak masuk render statis. Ekstrak isinya ke komponen sendiri lalu render langsung — seperti `IsiDialogTolak` di halaman verifikasi. |
| `audit_log` tidak punya indeks untuk `pengguna_id` atau `aksi` | Filter pelaku dan aksi akan pemindaian penuh. Datanya masih kecil, jadi diterima. **Jangan menambah indeks tanpa diminta** — itu perubahan skema. |
| Kelas CSS bukan penanda stabil | `disabled:`, `has-data-checked:`, `group/card-header` versus `group/card`. Gunakan atribut dan teks. |

## F. Yang TIDAK termasuk M9

- **jsdom / B-20** — ditunda pemilik. Kalau M9 selesai dan Anda mau, itu milestone tersendiri.
- **Halaman karyawan** `/a/[token]` — di luar cakupan sejak awal
- **Optimasi indeks database** — perlu keputusan tersendiri
- **Fitur baru apa pun** — pemilik tidak meminta