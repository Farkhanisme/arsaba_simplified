# AGENTS.md — Arsaba Management Center

Repositori ini berisi **spesifikasi**, bukan aplikasi. Pemiliknya adalah pemilik produk yang
menyatakan: *"Pemilik produk tidak ingin ada asumsi atau halusinasi."* Semua keputusan ada di
dokumen; tugas agen adalah **menerjemahkan dokumen menjadi kode tanpa mengarang apa pun**.

## Status repo saat ini

- Hanya ada `rules/*.md`. **Belum ada** `package.json`, `src/`, `migrations/`, `tests/`, atau git repo.
- Jadi **belum ada perintah build/test/lint yang bisa dijalankan**. Jangan mengarang perintah
  npm yang tidak ada; devs harus tersedia setelah M0 (§ "Urutan kerja").
- Definisi aplikasi (dipilih pemilik, K-24): Next.js App Router di Vercel, Turso/libSQL,
  **tanpa ORM**, UI Bahasa Indonesia saja, 26 karyawan / 10 toko / 2 akun admin.
- **Versi dipatok (K-41): Next.js `^16.3.7`, Node.js `24.x`.** Node 26 **tidak boleh dipakai** —
  Vercel hanya menyediakan 24/22/20 untuk builds & functions, dan Node 20 dinonaktifkan
  2026-10-01. Sumber & alasannya di `rules/NOTES.md` §1–2.
- **Satu zona waktu saja: WIB (K-51).** Tidak ada konversi di seluruh aplikasi. `getUTC*()`
  yang dipakai di `server/waktu.ts` itu **wajib** — jangan "diperbaiki" jadi `getHours()`/
  `getDate()`, karena itu mengembalikan bug B-13: seluruh tanggal bergeser 7 jam di server yang
  berjalan `TZ=UTC`, tanpa error dan tanpa crash.
- **Node lokal WAJIB `24.x` (K-43), sama dengan produksi.** Ada `.nvmrc` berisi `24`; di shell
  interaktif `nvm use` sudah memakainya otomatis. Kalau `node -v` menunjukkan `v26`, berhenti.
  Jangan pakai API yang hanya ada di Node 26 (mis. **Temporal API**) — akan jalan di lokal lalu
  crash di produksi.
- **Seluruh keputusan sudah diambil pemilik.** B-01 s.d. B-12 terjawab (jadi K-27 s.d. K-38), seluruh
  `[USULAN]` disetujui (K-40), durasi sesi 12 jam (K-39), domain produksi `arsaba.vercel.app`.
  Baca bagian A `rules/00` sebelum mulai; jangan mengambil keputusan berdasarkan ingatan saja.
- **Status 2026-10-03: M0–M8 selesai.** C-1 (patch batas 20 jam) dan C-2 (batas atas menit
  terlambat) keduanya sudah tackled di M4. Warisan tes palsu M1 juga sudah dibersihkan.
  **489 tes hijau di tiga timezone** (termasuk offset negatif) · build hijau · typecheck hijau ·
  Sudah di-commit ke GitHub (`main`, commit `5ad4348`).
  `migrations/0001_init.sql` tidak berubah sejak M0 (md5 `466a7b1a…`).
- **M4 menambah** `server/aturan/keterlambatan.ts` (fungsi murni: `pilihSlot`, `hitungN`,
  `hitungSelisih`), `repo/verifikasi.ts`, 4 route verifikasi/koreksi, halaman `/admin/verifikasi`,
  dan `sudahDiekspor()` yang membaca `log_ekspor` lebih dulu walau ekspor baru M8.
  Batas keterlambatan terbukti ketat memakai `>` (07:05:59 belum terlambat, 07:06:00 terlambat) dan
  `DITOLAK` tidak dihitung dalam N (BR-L1) — keduanya dibuktikan dengan mematikan aturannya.
- **M5 menambah** `server/aturan/jadwal.ts`, `repo/jadwal.ts`, 5 route jadwal, halaman
  `/admin/jadwal`, dan `namaHariWIB()` di `waktu.ts` (pola `Date.UTC` + `getUTCDay`).
- **B-19 (isi massal gagal sepenuhnya) sudah ditutup.** Akarnya: pratinjau menghitung
  `ditolak` lalu penerapannya mengabaikannya. Perbaikannya `klasifikasiSel()` — satu fungsi
  non-melempar dipakai pratinjau **dan** apply, jadi keduanya tidak bisa lagi berbeda jalur.
  Keputusan batch untuk M6 juga mengikuti pola yang sama (lihat bagian 6).
- **M6 menambah** `server/aturan/ketidakhadiran.ts`, `repo/ketidakhadiran.ts`, 4 route,
  halaman `/admin/tidak-berangkat`, dan `klasifikasiPenandaan()` yang NON-melempar.
- **M7 menambah** `server/aturan/dashboard.ts` (fungsi murni: `terlambatSistem`, `hitungBelumAbsen`,
  `kartuToko`), `repo/dashboard.ts`, route `GET /api/admin/dashboard`, halaman `/admin`.
  Fungsi `terlambatSistem()` **sengaja tidak menerima** `keterlambatan_final_menit` — secara
  struktural mustahil memakai angka yang salah. `repo/dashboard.ts` juga punya `angkaBanding()`:
  implementasi naif yang SENGAJA terpisah dari jalur produksi, dipakai sebagai pembanding tes.
- **M8 adalah milestone yang akhirnya menulis `log_ekspor`.** Sampai M7 tidak ada satu pun
  `INSERT INTO log_ekspor` di `src/` — K-32 sudah dibaca di 11 tempat tapi belum pernah terjadi
  dalam alur nyata. **Perhatikan kebalikannya:** M7 dashboard memakai `terlambat_sistem` (dihitung
  ulang), M8 rekap memakai `keterlambatan_final_menit` (kolom, BR-L3). Jangan saling menyalin.
- **Data demo siap** (`scripts/isi-data-demo.ts`, terpisah dari `seed.ts`): 10 toko,
  26 karyawan, penempatan sejak 2026-01-01, 981 baris absensi, 6 penandaan. Dipakai untuk
  pembanding manual M7. **Tidak** dipakai sebagai fixture tes.
- **M8 menambah** `server/aturan/rekap.ts`, `repo/rekap.ts`, `server/ekspor.ts` (exceljs),
  3 route rekap, halaman `/admin/rekap`. M8 adalah milestone yang **pertama kali menulis
  `log_ekspor`** — kunci periode K-32 kini hidup di alur nyata, bukan hanya di fixture.
- **UI-1/Data demo untuk memeriksa halaman (2026-10-03).** Menjalankan dev server dengan
  `APP_ORIGIN='http://localhost:3000'` dan `TURSO_DATABASE_URL='file:./data/demo.db'`
  menemukan 3 bug yang tak terlihat dari membaca kode:
  **BUG-UI-01** halaman akar masih "versi M0" · **BUG-UI-02** aplikasi tidak bisa dipakai
  di localhost tanpa menimpa `APP_ORIGIN`, dan pesan login yang muncul menyesatkan ·
  **BUG-UI-03** halaman terlarang tampil kosong, bukan pesan akses ditolak.
  Yang justru terbukti benar: 13 halaman admin 200 tanpa error, dan izin Admin/Super Admin
  sinkron di menu **dan** di server.
- **BUG-UI-05 (2026-10-03) ditutup: seluruh UI admin tidak pernah bisa dipakai di browser.**
  Browser **tidak mengirim header `Origin` pada request same-origin GET/HEAD** (MDN).
  Semua halaman admin ambil data dengan `fetch()` GET, jadi `wajibOrigin` selalu melihat
  Origin kosong dan membalas 403. Padahal `rules/03` §9.4 sudah benar sejak awal:
  *"cek `Origin` **pada mutasi**"* — kode lah yang menyimpang, bukan spec-nya.
  Perbaikan: mutasi (POST/PUT/PATCH/DELETE) tetap mewajibkan Origin cocok persis;
  GET/HEAD tanpa Origin diterima lalu lanjut ke cek sesi. Kalau Origin **dikirim**,
  harus cocok persis untuk semua metode.
  **Pelajaran:** tes memanggil route dengan `NextRequest` yang menyertakan Origin secara
  eksplisit, dan pemeriksaan manual memakai `curl -H 'Origin: ...'`. Keduanya tidak pernah
  meniru browser. **Tes harus meniru apa yang dilakukan browser, bukan apa yang dikerjakan
  penguji** — aturan yang secara fisik tidak dikirim browser akan mengunci pintu yang
  memang harus terbuka. Detail + bukti mutasi di `rules/NOTES.md` §13.
- **UI-2 dimulai: halaman Verifikasi Absensi memakai komponen shadcn (2026-10-03).**
  `admin/verifikasi/page.tsx` sebelumnya 435 baris, **0 import shadcn, 65 inline style**.
  Markup-nya dipisah ke `admin/verifikasi/komponen.tsx` (presentasional murni) memakai
  `Card` `Table` `Badge` `Button` `Input` `Textarea` `Checkbox` `NativeSelect` `Skeleton`
  `Alert` `Dialog`. 37 tes baru (`tests/ui2-verifikasi-komponen.test.ts`) semuanya
  memanggil `renderToStaticMarkup`, dan **9 mutasi** semuanya tertangkap.
- **BUG-UI-06 (2026-10-03): `Select` base-ui menampilkan KODE MENTAH, bukan label.**
  `SelectItem` ada di dalam `Portal` yang **tidak ter-mount saat popup tertutup**
  (`SelectPortal`: `mounted || forceMount`). Item tidak pernah terdaftar, jadi
  `SelectValue` jatuh ke `serializeValue(value)` dan trigger menampilkan
  `<span data-slot="select-value">DISETUJUI</span>`, bukan "Disetujui" — juga di
  browser, sampai dropdown dibuka sekali. Filter harus pakai **`NativeSelect`**
  (`<select>` asli): label + penanda `selected` ikut ter-render di server, jadi tampil
  benar sejak byte pertama **dan bisa diuji**. Konsekuensi lain: opsi `SelectContent`
  tidak pernah masuk render statis karena portal, jadi mustahil diuji.
  Detail + sumber di `rules/NOTES.md` §14.
- **Dua jebakan `npx shadcn add` pada style `base-nova`** (lihat `NOTES.md` §14):
  registry menulis `import { cn } from "cn"` — bukan `@/lib/utils`, jadi tidak bisa
  di-typecheck; dan menyisipkan teks English (`Close`, `Sidebar`) yang melanggar aturan
  UI Bahasa Indonesia. Keduanya harus diperbaiki manual tiap kali komponen baru dipasang.
- **Pelajaran tes baru dari UI-2.** Ekspektasi tes bisa salah dan tes tetap hijau:
  `not.toMatch(/<button[^>]*disabled/)` selalu gagal karena kelas dasar shadcn Button
  memuat literal `disabled:` (penanda yang benar: atribut `disabled=""`). Class CSS juga
  bukan penanda stabil — `has-data-checked:` di dalam class chip membuat pola
  `/data-checked/` salah cocok. Dan `/<th[^>]*>/` ikut cocok dengan `<thead>`.
  Nilai `<textarea>` adalah isi elemen, bukan atribut `value`.
- **UI-2 prompt siap (`rules/18-agent-prompt-ui2.md`), 2026-10-03.** Verified page
  tidak boleh disentuh — pemilik sendiri yang mengubah tabel jadi bentuk **KARTU**
  (`KartuVerifikasi` + `DaftarKartuVerifikasi`), dan itu jadi teladan UI-2.
  Sisa pekerjaan: **248 inline style** dan **117 elemen polos** di 14 berkas
  `src/app/admin/`. Prompt memuat keempat jebakan yang sudah ketahuan (BUG-UI-05 Origin,
  BUG-UI-06 Select base-ui, import `from "cn"`, `data-slot` tertimpa) plus pemetaan
  halaman → rules/05 §5.x → komponen. Inventaris dan angka di prompt sudah diverifikasi
  dengan penghitungan, bukan diketik manual.
- **UI-2 selesai dan diaudit independen (2026-10-03).** 248 inline style dan 117
  elemen polos di `src/app/admin/` menjadi **0**; 212 string user-visible pindah ke
  `komponen.tsx` yang bisa diuji. 622 tes hijau di tiga timezone. Yang diklaim agent
  **semua terbukti benar** — tidak ada tes yang dilemahkan, tidak ada aturan bisnis
  yang berubah, tidak ada endpoint yang berubah.
- **Audit menemukan 4 celah tes yang tidak diketahui agent** — dipindah ke M9 dengan
  cara reproduksinya di **`rules/19-catatan-m9.md`** (M9-01 s.d. M9-05 + B-20).
  Pelajarannya: 10 mutasi pilihan agent semuanya lulus, tapi 4 mutasi **yang dipilih
  dari `rules/05` dan dari yang tidak ada di tes** tidak. Audit yang hanya mengulang
  mutasi yang sudah ada tidak menambah nilai.
- **B-20 (jsdom) ditunda pemilik** dengan alasan "nanti saja". Belum ada persetujuan
  memasang. Cakupan yang disarankan ada di `rules/19` §B-20: empat alur saja, bukan
  12 halaman.
- **Prompt M9 siap (`rules/20-agent-prompt-m9.md`), 2026-10-03.** M9 adalah milestone
  pertama yang **menambah kode server**, bukan cuma presentasi. Yang sudah ada: tabel
  `audit_log`, izin `audit_log: ['SUPER_ADMIN']`, `catatAudit()`. Yang **nol**: query
  `SELECT` dari audit_log, route `GET /api/admin/audit-log`, halaman `/admin/audit-log`.
  Menu sudah punya placeholder `{ label: 'Audit Log', segera: true }`.
  `next.config.mjs` hanya punya header untuk `/a/:path*`; admin nol — padahal
  `rules/03` §9.7 minta CSP + header dasar.
  **Risiko terbesar M9 adalah CSP:** `/a/[token]` memakai `getUserMedia`, jadi CSP yang
  salah akan mematikan halaman karyawan untuk 26 orang. Syarat mutlak:
  `git diff --stat src/app/a/` kosong, dan kamera dibuktikan **di browser**, bukan curl.
- **M9 selesai dan diaudit independen (2026-10-03).** 664 tes hijau di tiga timezone.
  Yang diklaim agent **semua terbukti benar** — termasuk pengakuan sendiri soal kode mati
  dan penyimpangan. Terverifikasi: `src/app/a/` `guard.ts` `waktu.ts` `migrations/` kosong ·
  md5 `466a7b1a…` · SQL audit log aman (`klausa` cuma literal, nilai lewat `args`) ·
  `guard('audit_log')` persis · `formatWaktuAudit` pakai `slice()` sehingga aman timezone ·
  `password_hash` tidak pernah masuk audit · 405 tanpa DB. Kelima closure M9-01..M9-05
  terbukti dengan mutasi audit sendiri; mutasi bonus (hapus `X-Frame-Options`, longgarkan
  CSP, ubah nama sumber, tambah CSP ke `/a/`, salah nama guard) semuanya tertangkap.
- **Empat temuan audit M9 dipindah ke M10 (`rules/21-catatan-m10.md`).**
  **M10-01 (tinggi): `/login` dan `/` tidak punya satu pun header keamanan** — satu-satunya
  halaman tanpa autentikasi yang menerima password justru tanpa proteksi, padahal
  `rules/03` §9.7 minta header dasar. M10-02 `unsafe-eval` aktif di produksi · M10-03
  `ItemMenu.segera` kode mati · M10-04 jsdom (B-20) menunggu keputusan pemilik.
  **Keempatnya bukan salah agent** — M10-01 dan M10-02 adalah batas cakupan yang saya tulis
  sendiri di prompt M9.
- **Pelajaran: prompt M9 punya kontradiksi internal yang saya buat sendiri.**
  `src/app/admin/verifikasi/**` ada di daftar DILARANG (baris 244) sementara §8 dan
  tabel D memerintahkan M9-02 dikerjakan di berkas itu. Agent menanganinya benar.
  **Aturan ke depan:** sebelum mengirim prompt, grep setiap path yang muncul di bagian
  "dilarang" dan bagian "wajib", pastikan tidak bentrok. Lihat `rules/21` §E.
- **Prompt M10 siap (`rules/22-agent-prompt-m10.md`), 2026-10-03.** Cakupannya owner yang
  menetapkan: **tiga** dari empat utang kerja — M10-01 header `/` dan `/login`, M10-02
  `unsafe-eval` di produksi, M10-03 komentar untuk `ItemMenu.segera`. **jsdom (M10-04)
  dikeluarkan** sesuai keputusan owner. M10-03 owner memutuskan **dipertahankan** dengan
  komentar, bukan dihapus — proyek ini memakai pola "Segera" untuk menu yang belum ada.
  Prompt M10 sengaja kecil: tiga tugas, tiga berkas.
- **M10-02 adalah satu-satunya tugas yang bisa merusak tanpa error server.** Melepas
  `unsafe-eval` dari CSP produksi tidak akan memunculkan apa pun di respons HTTP kalau
  ternyata ada skrip yang memakainya — baru terlihat saat klien membuka halaman. Karena
  browser tidak terhubung ke sesi agent, bukti terbaik yang ada adalah inventarisasi
  sumber daya (13 `script src`, 0 non-self) plus login lewat curl. Kalau agent tidak bisa
  membuktikan kedua mode (produksi tanpa, dev dengan), ia **berhenti dan melapor** —
  prompt itu memerintahkan hal itu secara eksplisit.
- **Pemeriksaan silang path dijalankan sebelum mengirim prompt M10.** Pelajaran dari
  kontradiksi prompt M9 dicatat sebagai langkah wajib: tidak ada path yang boleh muncul
  di bagian "dilarang" sekaligus bagian "wajib". Tabel silangnya ada di
  `rules/22` §D.
- **Pelajaran: aplikasi ini belum pernah dibuka di browser selama 8 milestone.** Membaca kode
  dan menjalankan tes TIDAK sama dengan melihat hasilnya. Milestone presentasi wajib
  diverifikasi dengan membuka aplikasi.
- **BUG-01 (2026-10-03) sudah ditutup: `serialisasiWIB(sekarangWIB())` menulis 7 jam ke depan.**
  `sekarangWIB()` sudah mengembalikan Date yang digeser +07:00, jadi mengumpannya lagi ke
  fungsi waktu lain menggeser dua kali. 88 call site (41 `src/`, 43 `tests/`, 4 `scripts/`).
  Terangkap hanya karena **saya sendiri** jatuh ke jebakan itu saat menulis skrip data demo —
  dan hanya karena saya membandingkan hasilnya dengan tanggal nyata, bukan antar-tes.
  Tes yang menangkap bug call-site: `tests/waktu-tulis.test.ts` (membandingkan nilai yang
  ditulis route dengan `serialisasiWIB()`). Tes antar-fungsi saja TIDAK cukup — semuanya
  bisa salah bersama. Detail di `rules/NOTES.md` §12.
- **Setiap aturan punya tes yang membuktikan akibatnya, bukan hanya membaca teks.** Pola audit
  yang dipakai sejak M2: matikan aturannya sementara, lihat tesnya langsung gagal. Inilah
  dasar bahwa tes itu benar-benar menangkap bug.
- **Tiga blocker M1 yang dulu tersembunyi**, semuanya tertangkap setelah `tests/route.e2e.test.ts`
  memanggil Route Handler sungguhan: route login menaruh **hash** (bukan id mentah) ke cookie
  sehingga setiap login ditolak · endpoint izin memakai nama fitur yang tidak ada di matriks
  sehingga menolak semua peran · `trim()` masih ada di route ganti-password. Plus satu bug lagi:
  **logout tidak pernah menghapus sesi** karena mengirim nilai cookie mentah ke `destroySession()`
  yang mencari `sha256(id_sesi)`.
- **Pelajaran yang harus diingat:** tes yang membaca teks source (`toContain`) atau
  `expect(true).toBe(true)` **bukan tes** — selalu lulus tanpa memeriksa perilaku apa pun.
  `existsSync('page.tsx')` juga bukan tes: tetap lulus untuk file yang isinya rusak.
  **Bukti wajib untuk setiap tes baru: matikan aturannya, lalu lihat tes itu gagal.** Itu satu-satunya
  cara membuktikan tes benar-benar menguji sesuatu. Contoh nyata di `rules/NOTES.md` §10 —
  `existsSync` lulus pada dua mutasi halaman yang dirender, `renderToStaticMarkup` gagal pada
  keduanya.
  > **Dua jebakan saat menguji halaman (React 19).** (a) Komponen client harus dijalankan di dalam
  > render — teruskan `createElement(Komponen)`; jangan memanggil `Komponen()` langsung atau
  > meng-await hasilnya, karena itu melempar `Cannot read properties of null (reading 'useContext')`.
  > (b) `useRouter()` dari `next/navigation` melempar `expected app router to be mounted` di luar
  > pohon Next — pakai `vi.mock('next/navigation', ...)`. Yang di-mock adalah runtime Next,
  > bukan kode kita.
  Selain itu, file tes TIDAK boleh jalan paralel: semuanya memakai `data/uji_*.db` dan saling
  menghapus file itu. Gejalanya bukan error yang jelas, melainkan kegagalan yang berubah-ubah
  tiap kali. `vitest.config.mts` sudah mengaturnya lewat `fileParallelism: false`.
- **Keputusan baru 2026-10-01:** K-46 batas percobaan login (5/24 jam, per username **dan** IP,
  buka kunci manual Super Admin) · K-47 halaman `/admin/ubah-password`, ganti password membatalkan
  seluruh sesi lain · K-48 password minimal 8 karakter · K-49 seed dua akun, password dari env.

## Aturan emas

1. **Baca `rules/00`–`rules/06` sebelum menulis kode.** Urutan presisi saat dokumen konflik:
   `00 > 01 > 02 > 03 > 04 > 05 > 06`. `00-decision-log.md` menang atas semuanya.
   Prompt siap pakai untuk agen ada di `rules/07-agent-prompt-m0.md` (M0) dan
   `rules/08-agent-prompt-m1.md` (M1), `rules/09-agent-prompt-perbaikan-m1.md`, dan
   `rules/10-agent-prompt-m2.md` (M2), `rules/11-agent-prompt-m3.md` (M3),
   `rules/12-agent-prompt-m4.md` (M4), `rules/13-agent-prompt-m5.md` (M5),
   `rules/14-agent-prompt-m6.md` (M6), `rules/15-agent-prompt-m7.md` (M7),
   `rules/16-agent-prompt-m8.md` (M8), `rules/17-agent-prompt-ui1.md` (UI-1),
   `rules/18-agent-prompt-ui2.md` (UI-2), `rules/20-agent-prompt-m9.md` (M9),
   `rules/22-agent-prompt-m10.md` (M10).
   Catatan utang kerja: `rules/19-catatan-m9.md` (M9), `rules/21-catatan-m10.md` (M10).
2. Mekanisme tag (legenda di `00`) tetap berlaku untuk pertanyaan **baru**: `[KEPUTUSAN]` boleh,
   `[USULAN]` boleh tapi tandai untuk ditinjau, `[BELUM DIPUTUSKAN]` berarti **berhenti** — jangan
   implementasi, jangan nebak. B-01 s.d. B-17 sudah tertutup, jadi pertanyaan baru
   mulai dari **`B-18`**.
3. Ambigu / kontradiksi / kekosongan: berhenti pada bagian itu, tulis di `rules/OPEN_QUESTIONS.md`
   (ID, konteks, opsi, rekomendasi), lalu lanjutkan pekerjaan lain yang tidak terblokir.
4. Jangan menambah fitur, kolom, halaman, atau aturan yang tidak tertulis.
5. Jangan mengubah keputusan pemilik walau ada cara "lebih baik" — ajukan sebagai usulan.
6. Detail API eksternal (Telegram, Vercel, libSQL) **wajib diverifikasi ke dokumentasi resmi**,
   sumbernya dicatat di `rules/NOTES.md`. Jangan menulis dari ingatan.
7. Kerjakan SATU milestone per giliran. Setelah selesai, tulis laporan (format di bawah)
   lalu BERHENTI dan tunggu pemilik menjawab "lanjut". Jangan memulai milestone berikutnya.
8. Jika isi file ini berbeda dengan rules/, rules/ yang berlaku.

## Artefak wajib

| File | Isi |
|---|---|
| `rules/OPEN_QUESTIONS.md` | Pertanyaan yang memblokir (ID `B-13` seterusnya), plus temuan baru dari agen |
| `rules/NOTES.md` | Hasil verifikasi dokumentasi eksternal + sumber URL |

Keduanya belum ada; buat saat pertama kali dibutuhkan.

## Larangan keras

Tidak boleh: ORM (Prisma/Drizzle) — SQL mentah berparameter saja · concat string SQL dengan input
pengguna · jam perangkat klien untuk waktu absen · login karyawan · upload foto dari galeri/file ·
hapus permanen `absensi` · `UPDATE`/`DELETE` pada `audit_log` · menyimpan lokasi selain lat/lng ·
geofence, perhitungan gaji, notifikasi, hari libur · menampilkan token bot atau URL unduhan
Telegram ke klien · mencatat token link/password/secret ke log · hanya menyembunyikan menu di UI
(tidak boleh — peran wajib dicek di server).

## Urutan kerja (milestone)

Kerjakan berurutan; sebuah milestone selesai bila kriteria terpenuhi **dan** tes lulus.
Tidak ada yang terblokir — kolom keputusan menunjukkan keputusan yang dipakai.

| M | Isi | Keputusan | Status |
|---|---|---|---|
| M0 | Next.js + TS, koneksi Turso, runner migrasi, `0001_init.sql`, modul `waktu.ts` + tesnya | K-38 | **SELESAI** 2026-10-01 |
| M1 | Login admin, sesi DB **12 jam**, peran, pembatasan login, util audit log | K-39 | **SELESAI** 2026-10-02 |
| M2 | Data master: toko, shift template, karyawan (NIK/jabatan/alamat/HP/kontak darurat), penempatan/pemindahan, link, akun admin, pengaturan | K-34, K-35, K-50 | **SELESAI** 2026-10-03 |
| M3 | Halaman `/a/[token]`, `POST /api/absen`, kamera, lokasi, Telegram, kuota, pasangan, idempotensi | K-28, K-29, K-31, K-52, K-53 | **SELESAI** 2026-10-03 |
| M4 | Verifikasi (satuan/massal), foto proxy, keterlambatan sistem + final, koreksi manual | K-28, K-30, K-32, K-36, K-54 | **SELESAI** 2026-10-03 |
| M5 | Jadwal grid hari/minggu/bulan, isi massal, perubahan khusus satu hari (maks **2 slot**) | K-14, K-17, K-22, K-27, K-37, K-55 | **SELESAI** 2026-10-03 |
| M6 | Tandai tidak berangkat | K-19, K-22, K-31, K-32, K-56 | **SELESAI** 2026-10-03 |
| M7 | Dashboard | K-22, K-28, K-30, K-36 | **SELESAI** 2026-10-03 |
| M8 | Rekap, pra-syarat ekspor, Excel, `log_ekspor`, penguncian periode | K-13, K-32, K-33 | **SELESAI** 2026-10-03 |
| UI-1 | Pondasi desain (Tailwind v4 + shadcn), mode gelap, layout, dashboard + grafik | — | prompt siap |
| UI-2 | Redesign 12 halaman admin sisanya | — | **prompt siap** (`rules/18`) |
| M9 | Audit log UI, hardening, aksesibilitas, QA menyeluruh | — | **SELESAI** 2026-10-03 · 664 tes |
| M10 | Header keamanan `/` dan `/login`, `unsafe-eval` di produksi, kode mati | `rules/03` §9.7 | **prompt siap** (`rules/22`) · 3 dari 4 utang kerja |

## Yang paling mudah salah

**Waktu** — satu-satunya tempat memanipulasi waktu adalah `server/waktu.ts` (`sekarangWIB()`,
`tanggalWIB()`, `menitDalamHari()`, `jenisHari()`, serialisasi `+07:00`). Dilarang `new Date()` di
luar modul itu. Semua waktu dari server, WIB (UTC+7, tanpa DST).

> **Offset eksplisit, bukan andalkan timezone mesin (K-45).** Metode `getHours()`/`getDate()`/
> `getFullYear()`/`getDay()` **dilarang di seluruh kode** — semuanya mengikuti timezone mesin, bukan
> WIB. Ini bug nyata yang sudah terjadi (B-13): di `TZ=UTC` semua tanggal salah 7 jam dan
> `serialisasiWIB()` menempelkan jam UTC ke label `+07:00`. Pola benar: geser instant ke
> `+07:00` eksplisit, lalu baca dengan `getUTC*()`. Dan `sekarangWIB()` meski namanya begitu
> mengembalikan `Date` absolut UTC — pemanggil tidak boleh memakai `get*` lokal padanya.
>
> **Jangan pernah mengumpankan `sekarangWIB()` ke fungsi waktu lain (BUG-01).** `sekarangWIB()`
> sudah mengembalikan Date yang digeser +07:00. Memakainya sebagai argumen `serialisasiWIB()`
> atau `tanggalWIB()` menggeser **dua kali** — hasilnya 7 jam, bahkan satu HARI, di masa depan.
> Bentuk yang benar: `serialisasiWIB()` tanpa argumen. Lihat `rules/NOTES.md` §12.
>
> **Tes wajib tiga timezone (K-44).** Jalankan `TZ=UTC npx vitest run`,
> `TZ=Asia/Jakarta npx vitest run` dan **`TZ=America/New_York npx vitest run`**, atau cukup
> `npm run test:tz`. Ketiganya harus lulus. `npm test` polos di satu timezone saja **tidak
> memenuhi** kriteria — itulah cara B-13 lolos.
>
> **Offset negatif itu wajib (B-18), bukan tambahan biasa.** UTC dan Jakarta sama-sama offset
> non-negatif, jadi keduanya memberi jawaban **identik** untuk kelas bug "tanggal ikut timezone
> mesin" — bug yang lolos ke dua-duanya lalu hanya salah saat dipakai. Diperuktikan: pola salah
> `new Date(tanggal).getDay()` meleset **6 dari 6 tanggal** di New York, tapi **0 dari 6** di
> UTC, Jakarta, maupun Kiritimati (UTC+14). Menambah timezone offset positif lain tidak
> membantu apa pun.

**Tanggal absensi = tanggal check-in.** Check-out mewarisi `tanggal` dan `toko_id` check-in-nya,
termasuk setelah tengah malam.

**Urutan submit absen (BR-A4)**: validasi aturan → unggah foto ke Telegram → simpan DB. Kalau
unggah Telegram gagal, **tidak ada record sama sekali**. Tidak boleh menulis DB dulu lalu unggah.

**Keterlambatan dihitung saat ditampilkan, tidak disimpan.** Detik diabaikan; terlambat bila
selisih **> 5 menit** (07:05 toleransi, 07:06 terlambat). Tanpa jadwal → selisih kosong. Yang
dipakai rekap hanyalah `keterlambatan_final_menit` isi manual admin (`NULL` = 0).

**Penomoran slot bergerak (K-28).** Check-in ke-N dibandingkan dengan slot ke-N; jika N melebihi
jumlah slot, dipakai **slot terakhir**. Event `DITOLAK` tidak dihitung dalam N, jadi penomoran
otomatis bergeser saat ada check-in yang ditolak.

**Batas check-out mandiri 20 jam (K-29).** Hitung dari `waktu` check-in, bukan dari tengah malam.
Selama ≤ 20 jam karyawan boleh check-out sendiri; setelah itu tombol kembali ke "Check-in" dan
hanya admin yang bisa menutup lewat koreksi. **Query admin (koreksi/rekap/ekspor) memakai varian
tanpa batas 20 jam** — check-in yang lewat batas tetap harus menggagalkan ekspor (BR-R2).

**Absen diblokir pada tanggal bertanda tidak berangkat (K-31).**

**Mensetujui check-in terlambat sistem wajib isi menit final (K-30)** — `0` harus diketik
eksplisit, tidak boleh default diam-diam.

**Periode terekspor hanya bisa diubah Super Admin (K-32)** — verifikasi, koreksi, penandaan, dan
jadwal. Admin biasa ditolak di server. Selama periode **belum** terekspor, keputusan verifikasi
boleh diubah `DISETUJUI` ↔ `DITOLAK` (K-36).

**Kuota**: maksimum 2 check-in **aktif** (`status <> 'DITOLAK'`) per karyawan per tanggal; aturan
yang sama tetap berlaku pada koreksi admin. `DITOLAK` tidak menghabiskan jatah dan tidak menjadi
pasangan. Batas ini tidak bisa dijamin constraint SQL — wajib dicek di dalam transaksi.

**Hadir** = ada ≥1 pasangan yang check-in **dan** check-out-nya `DISETUJUI`; dihitung per tanggal
unik (dua pasangan di tanggal sama tetap 1 hari). Verifikasi check-in dan check-out terpisah;
check-out dari check-in yang ditolak berdiri sendiri.

**Ekspor dikunci (K-13)**: dalam rentang+toko terpilih tidak boleh ada event `MENUNGGU` dan tidak
boleh ada check-in terbuka. Dicek di server sebelum file dibuat, bukan hanya di UI. Karyawan
terjadwal tanpa absen tanpa penandaan **hanya peringatan**, tidak memblokir (K-33).

**Penandaan tidak berangkat** diblokir bila pada tanggal itu masih ada event aktif.
**Pemindahan karyawan** diblokir selama masih ada jadwal di toko lama pada/setelah tanggal efektif (K-35).

**Sesi admin 12 jam (K-39)** sejak login berhasil, disimpan di `sesi_admin.kedaluwarsa_at`.

## Standar kode & struktur

- TypeScript strict, validasi `zod` di setiap batas server, route handler tipis.
- Logika bisnis = **fungsi murni** di `server/aturan/` (uji tanpa DB). Query di `server/repo/`.
- Operasi multi-langkah dalam transaksi; aturan penting dijaga ganda di aplikasi **dan** constraint.
- Setiap mutasi admin memanggil util audit **di dalam transaksi yang sama**.
- Respons error seragam `{ kode, pesan }`, pesan Bahasa Indonesia.
- Struktur `src/` sesuai `rules/03` §4 (`app/`, `server/{db,waktu,auth,izin,telegram,audit,aturan,repo}`, `lib/`).

**Database** (`rules/04`): `INTEGER PRIMARY KEY AUTOINCREMENT` · nama tabel `snake_case` Bahasa
Indonesia · tanggal `TEXT YYYY-MM-DD` · jam shift `TEXT HH:MM` · waktu kejadian `TEXT` ISO 8601
dengan offset `+07:00` · boolean `INTEGER` 0/1 · `PRAGMA foreign_keys = ON` di tiap koneksi.
Migrasi: `migrations/NNNN_nama.sql` maju saja, dicatat di `schema_migrations`. DDL lengkap sudah
ditulis di `rules/04` §2 — gunakan itu, jangan mengarang ulang.

- **`postbuild` membersihkan `tsconfig.json`.** `next build` menyuntik `.next/dev/types` ke
  `include` setiap kali dijalankan; kalau dibiarkan, typecheck lokal memeriksa berkas yang tidak
  ada di Vercel. Sudah otomatis lewat `scripts/perbaiki-tsconfig.mjs` — jangan dibersihkan manual.

**Env (server only)**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `APP_ORIGIN` (`https://arsaba.vercel.app`). Token bot tidak boleh sampai ke klien.

## Wajib diverifikasi ke dokumentasi resmi

Daftar di `rules/03` §15: batas & metode Telegram Bot API (`sendPhoto`, `getFile`, ukuran file) ·
batas ukuran body request Vercel Functions · dukungan trigger, partial index, dan transaksi pada
libSQL/Turso · cara memakai klien libSQL di lingkungan serverless. Catat hasilnya di `NOTES.md`.

## Tes minimum

- **Setiap route WAJIB punya tes Origin.** `tests/guard-origin.test.ts` membandingkan daftar route
  terdaftar dengan seluruh `route.ts` di `src/app/api`; route baru yang lupa diuji membuat tes
  itu gagal. Pagar ini sudah menangkap kebocoran M1–M3 yang hanya memeriksa 4 dari 27 route.

- Fungsi murni di `server/aturan/` tanpa database; repo memakai database uji **SQLite lokal**
  `data/uji.db` (K-42). **Jangan pakai `:memory:`** — tiap koneksi dapat db kosong sendiri,
  sehingga constraint bisa lulus palsu. Bukti lokal bukan bukti Turso (lihat `NOTES.md` §3a).
- Batas keterlambatan (termasuk `07:05:59` vs `07:06:00`), tanpa jadwal, dua slot, satu slot dengan check-in kedua.
- Kuota check-in, pasangan, check-out lintas tengah malam, penolakan tidak menghabiskan jatah.
- Hari hadir (satu pasangan valid, pasangan setengah disetujui, dua pasangan satu tanggal).
- Pemilihan template `WEEKDAY`/`WEEKEND`/`SEMUA`.
- Blokir ekspor, blokir penandaan, izin per peran di setiap endpoint.
- `PRAGMA foreign_keys = ON` benar-benar aktif (harus diverifikasi oleh tes).

## Format laporan tiap milestone

Format ini harus sama persis dengan blok 9 `rules/07` (atau prompt milestone yang berlaku):

```
Milestone: M?
Selesai: <daftar>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus/gagal, jumlah>
Constraint terverifikasi: <hasil nyata, bukan asumsi>
Verifikasi dokumentasi eksternal: <apa, sumber> (di NOTES.md)
Keputusan teknis yang Anda ambil: <package manager, test runner, alasan>
Pertanyaan baru: <tidak ada, atau ID di OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>
```

## Cara memulai sesi agent

Prompt siap pakai: `rules/07` (M0), `rules/08` + `rules/09` (M1), `rules/10` (M2).
Dua cara:

- **Blok A** — salin utuh, paste sebagai pesan pertama. Paling deterministik.
- **Trigger pendek** (bagian C opsi 2) — hanya kalau agent pasti membuka file.

Sebelum mengirim, cek prasyarat di bagian B: `node -v` harus `v24.x.x` (K-41/K-43), dan
database uji lokal `data/uji.db` siap (K-42). Kalau Node bukan 24, jangan biarkan agent
memasang versi lain — Vercel tidak mendukungnya.

Catatan lingkungan devs: Node dikelola **nvm** (repo Arch tidak punya Node 24), dan
`~/.bashrc` memuat guard non-interaktif. Jadi `node` tidak terlihat di shell non-interaktif —
itu normal, bukan kerusakan. Detail di `rules/NOTES.md` §1a.

## Kalau tidak yakin

Bertanya lebih murah daripada membangun ulang. Untuk apa pun yang memengaruhi aturan bisnis,
struktur data, atau perilaku yang terlihat pengguna dan tidak tertulis di dokumen: **berhenti dan
tanyakan.**
