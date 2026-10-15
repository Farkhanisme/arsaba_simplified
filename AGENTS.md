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
- **UI-5 Batch A selesai (2026-10-12): menutup 4 celah `rules/05` yang belum
  dikerjakan.** Batch ini tidak menambah fitur di luar `rules/05`.
  1. **`a/[token]/not-found.tsx`** — 4 inline style → `Card` + token shadcn.
     Penyebabnya bug yang sama seperti BUG-UI-07: panel tetap terang saat mode
     gelap aktif. Teksnya dikunci tes lain, tidak boleh diubah.
  2. **`src/app/not-found.tsx`** (baru) — sebelumnya Next.js memakai 404 bawaannya
     yang **berbahasa Inggris**, melanggar K-24. Sengaja netral: `/admin/apa-saja`
     dan `/apa-saja` memberi pesan yang sama supaya struktur admin tidak bisa dipetakan.
  3. **`src/app/admin/error.tsx` + `src/app/global-error.tsx`** (baru) — sebelumnya
     nol boundary error; satu error saja membuat Super Admin melihat halaman error
     Next.js tanpa jalan keluar. Isi error **tidak pernah** ditampilkan ke layar
     (bisa memuat nama kolom/SQL); hanya `digest` yang ditampilkan.
     `global-error` wajib merender `<html>`-nya sendiri **dan meng-import
     `globals.css` sendiri** — layout root yang biasanya mengimpornya ikut sudah gagal.
  4. **Font halaman karyawan** — `text-xs` (12px) dihapus seluruhnya dari `/a/[token]/`,
     termasuk di alasan penolakan, keterangan agenda, dan syarat foto. Teks isi → 16px.
     Keputusan cakupannya dicatat di `rules/OPEN_QUESTIONS.md` **B-22** (metadata 14px
     masih menunggu pemilik).
  Bonus: `style={{ background: '#000' }}` di `<video>` pratinjau kamera → `bg-black`.
  Inline style di `src/app/` kini **1**, dan itu hanya `page.tsx:5` (BUG-UI-01,
  di luar cakupan Batch A).
- **Dua jebakan tes baru dari UI-5, keduanya hampir lolos ke saya:**
  **(a)** `text-xs` muncul di HTML hasil render karena **komponen `Badge` shadcn
  sendiri** memuatnya di kelas dasar — assertion `not.toMatch(/text-xs/)` terhadap
  seluruh HTML akan selalu gagal dan itu BUKAN bug aplikasi. Persis jebakan
  `disabled:` yang sudah tercatat di AGENTS.md. Yang benar: periksa elemen yang
  teksnya dibaca. **(b)** Sapuan sumber membaca **komentarnya sendiri** —
  docblock `page.tsx` menjelaskan "text-xs dilarang", jadi dokumentasi yang jujur
  menggagalkan tesnya sendiri. Komentar harus dibuang sebelum menyapu.
  Pelajaran lebih dalam: **kelas dasar `Card` shadcn memuat `text-sm`**, jadi teks
  di dalam `Card` tanpa ukuran eksplisit turun ke 14px diam-diam.
- **Kesalahan mutasi yang saya buat sendiri (dicatat karena bisa terulang):** mutasi
  pertama untuk `global-error` menghasilkan **syntax error**, bukan kegagalan tes —
  dan saya hampir menghitungnya sebagai "tes tidak menangkap". Mutasi yang rusak
  bukan bukti. Mutasi harus valid, dan hasilnya harus dibaca per-ekspektasi.
- **Yang TIDAK bisa dibuktikan tes, dan dinyatakan terbuka:** `globals.css` benar-benar
  termuat di `global-error`. Vitest men-stub CSS, jadi `renderToStaticMarkup` tidak
  pernah bisa memastikannya. Pagar yang dipasang hanya memeriksa **keberadaan
  import**, bukan hasil render — dan itu dinyatakan terbuka di berkasnya sendiri.
- **Tiga mutasi pertama saya semuanya LALU dan itu informasi berguna, bukan
  kegagalan yang bisa disembunyikan.** Melihat `text-xs` di HTML membuat saya
  tambah assertion yang terlalu ketat; menghapus 404 membuat tes gagal **saat import**
  (bukan saat assertion), jadi filter `grep -E "×"` saya menutupinya dan hampir
  saya laporkan sebagai "tidak tertangkap"; menghapus `<html>` menghasilkan
  **syntax error**, bukan kegagalan tes. Pelajaran: mutasi harus **valid** dan
  hasilnya harus dibaca **per-ekspektasi** — "file gagal import" ≠ "assertion gagal".
- **`tests/ui3` punya pengecualian yang harus DIHAPUS, bukan ditambahkan.**Tes lama
  justru **memindai** keberadaan `style={{ background: '#000' }}` di `<video>`
  (`toBe(1)`). Pengecualian itu tidak perlu: `bg-black` hasil visualnya sama persis
  dan lolos sapuan warna literal. Sekarang syaratnya `toEqual([])`.
  **Pola yang sama berulang di dua tes** — `ui3` dan `ui5-ukuran-font` sama-sama
  melonggarkan syarat sebelum memeriksa. Melonggarkan tes supaya lulus itu melonggarkan
  pelarasan, bukan hanya tesnya.
- **Temuan UI-5B yang membatalkan temuan saya sendiri (2026-10-12).** Saya
  melaporkan "0 `overflow-x` di admin, tabel dipampihkan di tablet". Itu **SALAH**:
  saya hanya menyapu `src/app/`, sedangkan kelasnya ada di komponen bersama
  `src/components/ui/table.tsx` yang membungkus setiap tabel dengan
  `relative w-full overflow-x-auto`. Jadi gulir horizontal **sudah ada** sejak awal.
  **Pelajaran: sapuan "cukupkan tidak ada" harus selalu menyapu komponen bersama
  `src/components/`, bukan hanya `src/app/`.** Kesimpulan ini sudah dikoreksi di
  baris UI-5B pada tabel milestone di bawah.
- **Masalah teknis sticky header yang ditemukan setelah itu (belum dikerjakan).**
  `overflow-x: auto` + `overflow-y: visible` membuat `overflow-y` **dihitung jadi
  `auto`** — jadi wrapper `Table` adalah scroll container di **kedua sumbu**.
  `position: sticky; top: 0` pada `<th>` akan lengket ke **wrapper itu**, bukan ke
  halaman; dan karena wrapper tidak punya `max-h`, ia tidak pernah scroll
  vertikal. Artinya **menempelkan `sticky top-0` pada `TableHead` saja tidak
  menghasilkan apa pun** — perubahan yang terlihat benar di diff dan diam-diam
  tidak berfungsi. Butuh `max-h` pada wrapper (mengubahnya jadi kotak scroll
  sendiri) ATAU melepas `overflow-x` dari wrapper (mengorbankan gulir horizontal).
  Keduanya punya konsekuensi berbeda dan **memerlukan keputusan pemilik**.
- **UI-5B selesai (2026-10-12):** pemilik memilih **sticky hanya di halaman yang
  benar-benar panjang**. `Table` sekarang menerima prop `maxH` + `scrollLabel`;
  tanpa `maxH` perilakunya persis seperti sebelumnya (tanpa scroll container
  vertikal). Dipakai di **audit-log, agenda, verifikasi-agenda** (70vh, dengan
  `role="region"` + `aria-label` + `tabIndex` supaya bisa difokus dari keyboard).
  `TableHead` biasa **sengaja tidak** bisa sticky; ada `TableHeadSticky` terpisah
  yang punya `sticky top-0 z-10 bg-card`. Halaman master (toko/shift/karyawan/akun)
  **tidak** diberi `maxH` — 10 toko dan 26 karyawan muat tanpa terpotong, jadi
  scrollbar kedua hanya memperkecil isi tanpa manfaat.
  `tests/ui5b-tabel-lengket.test.ts` (11 tes) mengunci **pasangan** `maxH` +
  sel sticky, bukan keberadaan string "sticky" — karena keberadaan string itu
  persis yang terbaru dan tidak menghasilkan apa pun.
  **BUG-UI-01 ditutup:** halaman akar bukan lagi inline style. Inline style di
  `src/app/` kini **0**.
- **Paginasi tidak dikerjakan di UI-5B/UI-5C, dan alasannya teknis — bukan sekadar
  malas.** Repo `master/karyawan.ts`, `toko.ts`, dan `akun` **tidak punya
  parameter `limit`/`offset` sama sekali**; hanya `repo/audit-log.ts` yang
  punya (BATAS_BAWAN 50, BATAS_MAKS 200). Jadi §6 "paginasi untuk daftar
  panjang" belum terpenuhi di sana, dan **menutupnya berarti mengubah query**,
  bukan UI. Ditandai UI-5D.
  Tapi: dengan 10 toko dan 26 karyawan, daftar itu muat tanpa paginasi. Yang
  benar-benar perlu paginasi adalah audit-log (sudah punya) dan verifikasi.
- **UI-5C selesai (2026-10-12): `loading.tsx` + judul halaman di header.**
  1004 tes. Celah §1.4 "keadaan memuat" menutup transisi rute (sebelumnya nol
  `loading.tsx` di seluruh aplikasi — layar hampa selama beberapa detik saat
  pindah menu). `loading.tsx` karyawan **sengaja tidak** memuat kerangka kamera:
  `AbsenClient` meminta `getUserMedia` di `useEffect` mount
  (`AbsenClient.tsx:219`), jadi menahan render menunda permintaan izin browser
  juga — karyawan menunggu lebih lama justru di langkah yang paling sering gagal.
- **Trade-off yang pemilik ketahui dan setujui: `loading.tsx` di `/a/[token]`
  mengubah status "link tidak berlaku" dari 404 jadi 200.** Shell terkirim lebih
  dulu supaya skeleton bisa tampil; `notFound()` baru dipanggil setelahnya, dan
  response code sudah terkunci. Diverifikasi: `/halaman-ngawur` (tanpa
  `loading.tsx`) tetap 404, `/a/token-palsu` (dengan `loading.tsx`) 200.
  Dipilih pemilik 2026-10-12: pertahankan skeleton. Kalau nanti link status
  HTTP dibutuhkan (mis. untuk<link> di WhatsApp), ini yang harus diubah.
- **M15 selesai (2026-10-14): keterangan absensi.** `K-66` + `BR-A13`. Kolom baru
  `absensi.keterangan` lewat `migrations/0003_keterangan_absensi.sql` — `0001_init.sql`
  **tidak** disentuh (md5 `466a7b1a…` tetap). Tanpa CHECK panjang, mengikuti preseden
  `agenda.keterangan`/`alasan_koreksi`; batas 500 ditegakkan zod di route, **sebelum**
  foto masuk Telegram (jadi keterangan kepanjangan tidak meninggalkan foto yatim).
  Sifat yang dijaga tes: keterangan **tidak pernah** memengaruhi apa pun — kuota, status,
  `keterlambatan_final_menit`, blokir BR-A9, dan idempotensi BR-A11 semuanya diuji dengan
  keterangan terisi. Sheet "Detail Harian" jadi **13 kolom** (BR-R5 direvisi).
  1032 tes; 10 mutasi semuanya tertangkap.
- **M16 selesai (2026-10-15): sheet kalender per karyawan di ekspor Excel.** `K-68` +
  `BR-R9`. Berkas baru `server/aturan/kalender.ts` (fungsi murni: `klasifikasiSel()`,
  `susunKalenderKaryawan()`), `kalenderPeriode()` + `susunKalender()` di `repo/rekap.ts`,
  penulis sheet + `namaSheetKalender()` + `WARNA_SEL` di `server/ekspor.ts`, dan
  `tests/m16-kalender-ekspor.test.ts` (19 tes). Aritmetika tanggal **tidak ditulis ulang** —
  memakai `awalMinggu()`/`rentangTanggal()` dari `aturan/jadwal.ts` (pola `Date.UTC`+`getUTC*`).
  Data demo: 26 karyawan → workbook berisi **29 sheet** (3 tetap + 26 kalender).
  Sifat yang dijaga tes: `DITOLAK` tidak pernah sampai ke kalender (disaring di SQL) ·
  **terlambat ditentukan angka FINAL `keterlambatan_final_menit > 0`, bukan selisih sistem**
  (diuji dua arah: terlambat sistem tapi final NULL → hijau; tak terlambat sistem tapi final
  25 → oranye) · jumlah hari `HADIR`+`TERLAMBAT` di kalender **sama persis** dengan kolom
  `Hari Hadir` di Ringkasan.
- **Dua jebakan M16 yang harus diingat.** (a) **`skipped` bukan `passed`.** Tes M16 versi
  pertama gagal di `beforeAll` (penempatan ganda melanggar `uq_penempatan_terbuka`) dan 11 tes
  dilaporkan **skipped** sementara 8 tes lain hijau — kalau hanya membaca baris ringkasan, itu
  terlihat "tes sebagian lulus". Sama seperti jebakan `vitest -t` di §M15(a): **periksa
  jumlah `skipped`** setiap kali menjalankan satu berkas tes. (b) **Ekspektasi tes bisa salah
  dan tes tetap hijau.** Dua tes M16 gagal bukan karena bug: (1) jumlah sheet dihitung dari
  *nama unik*, padahal dua karyawan bernama sama memang mendapat **dua** sheet (yang dibedakan
  akhiran) — sheet per **karyawan_id**, bukan per nama; (2) koordinat sel hard-code menebak
  pekan yang salah, dan teks yang dibandingkan adalah hasil **sanitasi** nama, bukan awalan
  nama mentah. Perbaikannya adalah mengoreksi ekspektasi, **bukan** melonggarkan assertion.
- **Aturan M16 yang tidak bisa dibuktikan dari file jadi.** Sel `PARSIAL` (check-in
  `DISETUJUI` tanpa check-out) **tidak pernah muncul di file .xlsx yang diunduh**, karena itu
  check-in terbuka dan BR-R2 memblokir ekspor. Aturannya tetap ditulis dan diuji lewat
  fungsi murni + `susunRekap()` (jalur yang tetap jalan saat ekspor diblokir). Detailnya
  `rules/OPEN_QUESTIONS.md` **B-24**.
- **Tiga jebakan M15 yang akan applicable lagi (semuanya sudah tercatat di `NOTES.md` §15c):**
  (a) **`vitest -t` dengan pola yang tidak cocok nama tes mana pun tetap terlihat "lalus"**
  — tesnya tidak pernah jalan. Mutasi "hapus kolom Excel" sempat dilaporkan LALUS karena
  itu. Setiap skrip mutasi sekarang **wajib** memastikan ada tes yang benar-benar dieksekusi.
  (b) **React 19 menulis `maxLength="500"` dengan huruf besar-kecil aslinya**, bukan
  `maxlength` — pola harus `/i`. (c) **Menambah atribut JSX memecah satu baris jadi
  beberapa**, jadi tes yang menyapu sumber dengan `X="..." Y="..."` ikut gagal; perbaiki
  dengan `\s+`/`[\s\S]{0,200}?`, **jangan** melonggarkan assertion-nya.
- **Tiga celah yang HANYA ketahuan `next build`, bukan `tsc` atau vitest:**
  (1) `usePathname` di server component, (2) `'use client'` yang wajib ada,
  (3) import tak terpakai. Semuanya build hijau di `tsc` dan 1004 tes.
  **Pelajaran: `tsc` hijau BUKAN berarti build hijau.** Jalankan `npm run build`
  setiap kali menyentuh `'use client'`/`usePathname`/layout.
  `JudulHalaman` dipisah ke `judul-halaman.tsx` (+ `'use client'`), dan
  `labelHalaman` ke `label-halaman.ts` — dua tes menjaga pemisahan itu.
- **Kesalahan terbesar UI-5C: menguji SALINAN, bukan kode aslinya.** Tes
  pertama menyalin logika `labelHalaman` ke file tes. Mutasi "pakai
  `SUPER_ADMIN` selalu" (membocorkan label halaman Super Admin ke Admin biasa)
  **LULUS** — karena yang diuji tetap salinan yang sehat. Setelah `labelHalaman`
  diekspor ke berkas sendiri dan tes mengimpornya, mutasi yang SAMA langsung
  tertangkap. Salinan logika di dalam tes hampir tidak pernah menguji apa pun
  yang sedang berjalan.
- **Memasang `tests/ui5c` sempat membuat satu mutasi LALUS lagi**: menghapus
  `<JudulHalaman>` dari `<header>` tidak menggagalkan apa pun, karena tidak ada
  tes yang melihat header itu sendiri. Ditambahkan tes yang memotong substring
  antara `<header>` dan `</header>` — sekarang mutasi "hapus dari header" DAN
  "pindahkan ke luar header" sama-sama tertangkap.
- **Urutan diagnosis waktu `test:tz` gagal.** Kalau tes gagal di ketiga timezone
  sekaligus (`UTC`/`Asia/Jakarta`/`America/New_York`), itu hampir selalu **bukan**
  bug timezone — itu regresi biasa yang muncul di mana-mana. Jalankan satu timezone
  saja dulu, baca assertion yang gagal, baru putuskan.
  (Bug asli timezone — seperti B-13 — gagal di **sebagian** timezone, bukan semua.)
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
- **M12–M14 selesai (2026-10-08): fitur Agenda lengkap, 942 tes hijau di tiga timezone.**
  `rules/00` K-57..K-65, `rules/02` §18 (BR-G1..BR-G20). Berkas baru:
  `server/aturan/laporan.ts` (fungsi murni alur draft/submit/verifikasi),
  `server/repo/agenda-laporan.ts`, `server/repo/agenda-pribadi.ts`,
  `server/agenda-info.ts`, tab `src/app/a/[token]/TabsHalamanClient.tsx` +
  `AgendaClient.tsx`, `/admin/verifikasi-agenda`, dan 6 route baru
  (`/api/agenda/{info,laporan,buat}`, `/api/admin/verifikasi-agenda{,/[id]}`,
  `/api/foto/agenda/[id]`).
  **Empat bug nyata yang ketahuan saat M12–M14** — semua karena tes, tidak karena
  berjalan dan terlihat rusak:
  1. **`await` hilang pada `periksaDraft()`** → route tetap mengunggah foto ke
     Telegram padahal aturannya sudah menolak, jadi setiap penolakan meninggalkan
     foto yatim di grup. Tanpa `await`, check-nya jadi promise yang tidak pernah ditunggu.
     Ditemukan karena tes menghitung jumlah panggilan stub fetch, bukan karena error.
  2. **`agenda_laporan.tanggal` semula `NOT NULL`** → draft tidak bisa tersimpan
     sama sekali. Kolomnya harus NULL-able; aturan "non-draft wajib punya tanggal"
     pindah ke `CHECK`. Pelajaran: **kolom yang nilainya baru diketahui saat submit
     tidak boleh NOT NULL sejak awal.**
  3. **`CHECK status='DRAFT' OR sesudah_file_id IS NOT NULL`** → agenda `wajib_foto=0`
     (BR-G8) tidak punya foto sama sekali, jadi tidak bisa pernah MENUNGGU.
     Aturan itu lintas-tabel ⇒ **harus trigger**, bukan CHECK (sudah ditulis begitu
     di `rules/04` §6a, tapi belum ada yang mengaitkannya dengan kasus tanpa-foto).
  4. **`karyawanDalamCakupan()` tidak meng-UNION `agenda_laporan`** → karyawan yang
     hanya mengerjakan agenda tidak pernah muncul di sheet `Ringkasan`, jadi kolom
     Agenda Selesai/Ditolak selalu 0 untuk dia dan tidak ketahuan karena tabel tetap
     "terisi" karyawan lain.
  **Dua jebakan tes yang terperangkap:**
  **(a)** Stub `fetch` Telegram yang mengecek `String(init.body).includes('sendPhoto')`
     — `String(FormData)` = `"[object FormData]"`, jadi **tidak pernah** kena dan
     semua tes gagal 502. URL harus yang dicek.
  **(b)** Ekspor memakai `toko_id: null` = semua toko, dan `sudahDiekspor()` membaca
     itu sebagai "semua toko terkunci" (K-32). Maka tes verifikasi yang memakai
     **tanggal yang sama** dengan tes ekspor gagal 403 karena urutan, bukan karena
     bug. Perbaikan: **satu toko per skenario + tanggal lampau untuk tes K-32.**
- **Celah tes ikon sidebar ketahuan 2026-10-09 (menu Agenda & Verifikasi Agenda tanpa ikon).**
  `tautan-menu.tsx` merender ikon HANYA kalau label ada di `IKON_MENU`, jadi menu baru
  yang labelnya lupa didaftarkan tampil polos — bukan error, bukan komponen rusak.
  Tes lama (`ui4-ikon.test.ts`) hanya menguji `Dashboard` + `Jadwal`, dan ada tes yang
  justru menyatakan "label tak dikenal → tampil tanpa ikon" itu benar. Pola yang sama
  seperti temuan audit M9: **tes menguji yang sudah ada, bukan yang baru ditambah.**
  Pagar sekarang: `IKON_MENU` diekspor, dan ada tes yang menarik daftar label dari
  `menuUntukPeran()` sendiri — jadi menu berikutnya yang lupa ikon akan gagal sendiri,
  tanpa perlu tes baru tiap kali. Ikon berdekatan **wajib berbeda bentuk**
  (Jadwal `CalendarIcon` vs Agenda `CalendarCheckIcon`; Verifikasi Absensi
  `ClipboardCheckIcon` vs Verifikasi Agenda `ListChecksIcon`) — ada tesnya.
- **Keputusan yang paling mudah dilanggar di Agenda: penerima TIDAK dibekukan**
  (K-58, BR-G2). Memindahkan karyawan diam-diam mengubah siapa yang punya agenda,
  dan ini pilihan pemilik — jangan "diperbaiki" jadi snapshot tanpa keputusan baru.
  **Mulai M14, K-13 berubah makna** (syarat ekspor jadi tiga) — lihat catatan K-63.
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
- **UI-6 selesai (2026-10-15): navigasi bawah halaman karyawan.** `K-67`. Tepat dua item
  ("Absen" dan "Agenda") di `src/components/ui/navigasi-bawah.tsx`; tab di atas
  (`TabsList` + `TabsTrigger`) **diganti** komponen itu, sementara status tab tetap
  `useState` lokal di `TabsHalamanClient.tsx` — **tanpa URL** (deep linking tidak
  diputuskan). `page.tsx` memakai `min-h-dvh` (bukan `vh`, supaya keyboard virtual tidak
  merusak kerangka) dan padding bawah `calc(4rem + env(safe-area-inset-bottom))` supaya
  navigasi tidak menutupi tombol. 29 tes di `tests/ui6-navigasi-bawah.test.ts`.
  **Yang tidak bisa dibuktikan tes:** posisi melekat, perilaku keyboard, dan
  `env(safe-area-inset-bottom)` — `renderToStaticMarkup` tidak punya
  CSS maupun viewport, jadi verifikasi manual di browser adalah **syarat selesai**, bukan
  pelengkap (**B-23**).
- **UI-7 selesai (2026-10-15): jadwal bulanan tidak lagi menggeser halaman + toast.**
  Akar "halaman bergeser" ternyata **bukan** di grid bulanan, melainkan di pembungkus konten
  `src/components/ui/sidebar.tsx`: anak flex tanpa `min-w-0` ikut melebar mengikuti grid
  yang lebar, lalu halaman ikut bergeser. `min-w-0` membuat pengguliran terjadi di dalam
  pembungkus itu, bukan di halaman. Toast: `Alert` di `src/app/admin/jadwal/page.tsx` diganti
  `sonner` (sukses/gagal), dipasang lewat `src/app/admin/ToasterAdmin.tsx` di
  `src/app/admin/layout.tsx`. 10 tes di `tests/ui7-jadwal-dan-toast.test.ts`.
  **Tidak ada keputusan pemilik baru** — commit ini tidak menyentuh `rules/00`, jadi kolom
  Keputusan di tabel sengaja tetap `—`.
- **Prompt UI-8 siap (`rules/25-agent-prompt-ui8.md`), 2026-10-15.** Pemicunya: pemilik
  menyatakan tampilan "kurang menarik" (2026-10-14), dan `rules/00` memang **tidak memuat
  satu pun** keputusan soal warna, tipografi, atau tema — jadi ini penambahan keputusan,
  bukan pelanggaran keputusan lama. **Fase A sepenuhnya READ-ONLY:** tidak boleh menulis satu
  file pun, keluarannya dokumen keputusan di chat. Syarat mutlak di akhir: `git status
  --short` dan `git diff --stat` harus sama dengan yang tercatat di awal — kalau berubah,
  milestone **gagal**, bukan "sedikit di luar cakupan". Kontras **dihitung**, bukan dikira:
  ambang 4.5:1 teks biasa, 3:1 non-teks, dan **7:1 untuk halaman karyawan** (dipakai di
  bawah matahari — lebih ketat dari WCAG dan itu disengaja). Setelah Anda memilih opsi,
  implementasinya jadi milestone baru (Fase B).
- **UI-8 B1 selesai (2026-10-15): fondasi palet B + tipografi 1 (K-69).** Cakupan
  sengaja sempit: `globals.css` (primer biru hue 255; secondary/muted/accent dipecah
  jadi tiga lightness; card dipisah dari background; `--destructive` dan `--badge-*`
  tidak berubah) + hierarki judul dua tingkat di 4 komponen bersama (`CardTitle` dan
  `JudulHalaman` text-lg semibold; judul Dialog/Sheet text-base semibold) + stack font
  eksplisit (alias `--font-heading: var(--font-sans)` yang sirkular dibuang).
  Bukti kontrak FE-BE utuh: `git diff --stat src/app/api/` = 0 dan `src/server/` +
  `migrations/` = 0 — hanya presentasi yang berubah. 10 tes baru
  (`tests/ui8b1-fondasi.test.ts`); 4 mutasi semuanya tertangkap. Tata letak halaman
  (Fase B2) sengaja belum — fondasi dulu supaya sumber masalah visual selalu jelas.
- **UI-8 B2a selesai (2026-10-15): dashboard.** Strip "Ringkasan hari ini" (4 total =
  jumlah kolom kartu toko, dihitung di render — tanpa fetch/prop/endpoint baru),
  fraksi `sudah/terjadwal` per kartu toko, dan panah → pada tautan antrean.
  Strip sengaja BUKAN Card supaya `group/card` tetap 12 sesuai kunci tes UI-2 —
  dan mutasi "bungkus strip jadi Card" terbukti ditangkap **kedua** tes (baru +
  lama). 4 tes baru; 3 mutasi tertangkap. Kolom Keputusan `—`: tidak ada keputusan
  pemilik baru, hanya reorganisasi presentasi angka §5.2 yang sudah wajib ada.
- **UI-8 B2b selesai (2026-10-15): verifikasi.** Bar aksi massal menempel
  (`sticky bottom-3 z-20` + `shadow-lg` pada Card pembungkus; isi badge + 2 tombol
  tidak berubah) dan foto mini 40px → 56px (src + aria-label tidak berubah).
  3 tes baru; 2 mutasi tertangkap. **Kesalahan sendiri yang diperbaiki:** komentar
  JSX `{/* */}` yang saya taruh di dalam ternary berdampingan dengan `<Button>`
  tanpa pembungkus = syntax error (bukan kegagalan tes). Komentar dipindah ke
  luar ternary. Pelajaran: komentar JSX adalah expression — dua expression
  berdampingan tetap butuh pembungkus.
- **UI-8 B2c selesai (2026-10-15): jadwal.** Kolom weekend (header + sel isi)
  berpita `bg-muted/50`; teks "(Weekend)" tetap sehingga warna bukan satu-satunya
  pembeda (§1.3). Cakupan dikoreksi jujur di tengah jalan: kolom lengket, label
  Weekend, dan badge Khusus **sudah ada** — bukan saya yang membuatnya. 2 tes baru;
  2 mutasi tertangkap (pita hilang; pita bocor ke weekday). **Jebakan tes:** assertion
  `not.toMatch(/bg-muted\/50/)` terhadap SELURUH isi sel selalu gagal karena kelas
  `dark:hover:bg-muted/50` milik Button ikut kecocokkan — yang diperiksa harus TAG
  PEMBUKANYA saja. Persis keluarga jebakan `disabled:`/`text-xs` yang sudah tercatat.
- **UI-8 B2d selesai (2026-10-15): rekap.** Tiga heading penanda urutan ("1. Filter"
  sebagai judul kartu — override kecilnya dibuang sehingga memakai basis text-lg;
  "2. Pemeriksaan" + "3. Pratinjau & unduh" sebagai h2). Isi, href terfilter, dan
  status disabled tombol tidak berubah — dibuktikan tes lama UI-2/M8 yang tetap
  hijau tanpa diubah. 3 tes baru (termasuk urutan lewat posisi indeks, bukan
  sekadar keberadaan teks); 2 mutasi tertangkap (heading hilang; nomor tertukar).
- **UI-8 B2e selesai (2026-10-15): halaman karyawan.** Tombol "Foto" dan "Absen"
  pakai `KELAS_UTAMA` (h-14/56px, text-lg/18px, semibold); "Ganti Kamera",
  "Foto Ulang", "Muat Ulang" tetap `KELAS_SENTUH` — kontras ukuran = hierarki
  (§3.1 satu tugas satu tombol utama). Cakupan dikoreksi jujur: timeline riwayat
  dan tombol lebih besar "untuk semua" BATAL — `DaftarRiwayat` terkunci sebagai
  Card oleh tes UI-3 (keputusan BUG-UI-07) dan KELAS_SENTUH terkunci persis oleh
  tes 44px. 3 tes baru mengikuti preseden UI-3 (AbsenClient tak bisa di-render
  SSR); 2 mutasi tertangkap, salah satunya menjatuhkan 2 tes sekaligus.
- **Tabel milestone pernah basi (2026-10-15) — sudah disinkronkan.** Baris UI-1, UI-2, dan
  M10 masih tertulis "prompt siap" padahal ketiganya sudah selesai dan ter-commit
  (`9abe8d1`, `adbb000`), dan UI-6/UI-7 **tidak punya baris sama sekali**. `rules/21` §A
  juga masih menandai M10-01/02/03 "belum" padahal ketiganya ada di `next.config.mjs` dan
  `src/app/admin/menu.ts` (dibuktikan dengan `git log -S`, bukan dari pengingat).
  Penyebabnya mudah: commit UI-2 + M9 + M10 dipaket jadi satu, lalu tabel tidak pernah
  dikembalikan ke sinkron. **Pelajaran:** status di dokumen harus dicek **setelah commit**,
  bukan hanya setelah milestone — kalau tidak, tabel ikut berbohong dan menyisakan pekerjaan
  yang sebenarnya sudah selesai.
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
   `rules/22-agent-prompt-m10.md` (M10), `rules/23-agent-prompt-ui6.md` (UI-6),
   `rules/24-agent-prompt-ui7.md` (UI-7), `rules/25-agent-prompt-ui8.md` (UI-8).
   **Agenda tidak memakai file prompt** — M11–M14 dikerjakan langsung dari K-57 s.d.
   K-65 di `rules/00` dan BR-G1..BR-G20 di `rules/02` §18.
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
| UI-1 | Pondasi desain (Tailwind v4 + shadcn), mode gelap, layout, dashboard + grafik | — | **SELESAI** 2026-10-03 (`rules/17`) |
| UI-2 | Redesign 12 halaman admin sisanya | — | **SELESAI** 2026-10-03 · 622 tes (`rules/18`) |
| M9 | Audit log UI, hardening, aksesibilitas, QA menyeluruh | — | **SELESAI** 2026-10-03 · 664 tes |
| M10 | Header keamanan `/` dan `/login`, `unsafe-eval` di produksi, kode mati | `rules/03` §9.7 | **SELESAI** 2026-10-03 · 3 dari 4 utang kerja (`rules/22`); M10-04 jsdom → **B-20** |
| M11 | **Agenda — sisi admin**: K-57, K-58, K-62 | K-57, K-58, K-62 | **SELESAI** 2026-10-08 |
| M12 | Agenda — sisi karyawan (tab `/a/[token]`, kamera before/after, draft) | K-59, K-60 | **SELESAI** 2026-10-08 |
| M13 | Agenda — verifikasi admin + penguncian periode terekspor | K-61, K-65 | **SELESAI** 2026-10-08 |
| M14 | Agenda — rekap Excel (sheet `Detail Agenda`), blokir ekspor, dashboard | K-63, K-64 | **SELESAI** 2026-10-08 · 942 tes |
| M15 | **Keterangan absensi** — teks bebas opsional di modal hasil foto (maks 500), tampil di kartu Verifikasi + kolom Excel ke-13 | K-66, BR-A13 | **SELESAI** 2026-10-14 · 1032 tes |
| M16 | **Sheet kalender per karyawan di ekspor Excel** — grid mingguan Sen–Min, jam check-in/check-out di setiap sel, warna hadir/terlambat/izin/tanpa keterangan | K-68, BR-R9 | **SELESAI** 2026-10-15 · 1090 tes |
| UI-5A | **Batch A — 4 celah `rules/05`**: not-found karyawan, 404 root, `error.tsx` + `global-error.tsx`, font ≥16px karyawan | `rules/05` §1.4, §2, K-24 | **SELESAI** 2026-10-12 · 972 tes |
| UI-5B | Header lengket di 3 tabel panjang + halaman akar (BUG-UI-01) | `rules/05` §2 | **SELESAI** 2026-10-12 · 983 tes |
| UI-5C | `loading.tsx` (transisi rute) + judul halaman di header | `rules/05` §1.4 | **SELESAI** 2026-10-12 · 1004 tes |
| UI-5D | Paginasi di `master/*` dan `akun` (repo belum punya `LIMIT`) | `rules/05` §6 | belum — butuh perubahan query |
| UI-6 | **Navigasi bawah halaman karyawan `/a/[token]`** — tepat 2 item (Absen, Agenda), menggantikan tab atas; status tab tetap state lokal, tanpa URL | K-67, `rules/05` §3b | **SELESAI** 2026-10-15 · 29 tes (`rules/23`) |
| UI-7 | **Jadwal bulanan tidak lagi menggeser halaman** (`min-w-0` pada pembungkus konten sidebar) + toast `sonner` menggantikan `Alert` di halaman jadwal | — | **SELESAI** 2026-10-15 · 10 tes (`rules/24`) |
| UI-8 | **Audit tampilan Fase A — READ-ONLY**: opsi palet + tipografi + peta token. Keluarannya **dokumen keputusan untuk pemilik**, bukan diff | — | **SELESAI** 2026-10-15 · pemilik pilih B + tipografi 1 (`rules/25`) |
| UI-8 B1 | **Fondasi: palet B + tipografi 1.** Token `globals.css` + hierarki judul di 4 komponen bersama. Tanpa ubah tata letak halaman, endpoint, atau server | K-69 | **SELESAI** 2026-10-15 · 10 tes baru |
| UI-8 B2a | **Dashboard: strip ringkasan + fraksi per toko + tautan aksi.** Total dihitung di render dari data yang sama; strip bukan Card (12 group/card utuh); tanpa fetch/prop/endpoint baru | — | **SELESAI** 2026-10-15 · 4 tes baru |
| UI-8 B2b | **Verifikasi: bar aksi massal menempel + foto mini 56px.** Sticky bottom-3 z-20 (di bawah dialog); isi bar (badge + 2 tombol) utuh; src/aria-label foto utuh | — | **SELESAI** 2026-10-15 · 3 tes baru |
| UI-8 B2c | **Jadwal: pita latar kolom weekend.** Header + sel isi weekend `bg-muted/50`; teks "(Weekend)" tetap (warna bukan satu-satunya pembeda, §1.3) | — | **SELESAI** 2026-10-15 · 2 tes baru |
| UI-8 B2d | **Rekap: alur 3 langkah eksplisit.** "1. Filter" (judul kartu), "2. Pemeriksaan" + "3. Pratinjau & unduh" (h2 berurutan); isi/href/disabled utuh | — | **SELESAI** 2026-10-15 · 3 tes baru |
| UI-8 B2e | **Karyawan: aksi utama naik satu tingkat.** Foto + Absen pakai KELAS_UTAMA (h-14/56px, text-lg, semibold); sekunder tetap KELAS_SENTUH; alur K-52 + kunci font/target utuh | — | **SELESAI** 2026-10-15 · 3 tes baru |

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
