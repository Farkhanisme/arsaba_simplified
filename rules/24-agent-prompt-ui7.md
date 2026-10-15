# 24 — Prompt Agent Milestone UI-7 (Jadwal Bulanan Bergeser ke Samping + Toast di Admin)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> Konteks: M15 selesai 2026-10-14 dengan 1032 tes hijau di tiga timezone. Keluhan pemilik
> dipilah menjadi beberapa milestone; UI-6 (navigasi bawah karyawan) ada di `rules/23`.

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau ada yang tidak tertulis, BERHENTI dan tulis pertanyaannya.

Milestone ini KECIL: dua tugas, keduanya presentation layer. Jangan menambah fitur, jangan
memasang dependensi, jangan menambah halaman, dan JANGAN memuat skill desain apa pun.
Komponen yang dibutuhkan sudah ada di repo.

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

Baseline yang diharapkan: 71 berkas tes, 1032 tes hijau.
md5 migrations/0001_init.sql = 466a7b1a5aa5b1ab0a88e0a5f63a8a98

Kalau build atau tes sudah GAGAL SEBELUM Anda berubah, JANGAN melanjutkan. Laporkan dan BERHENTI.

################################################################
2. TUGAS 1 — HALAMAN JADWAL BULANAN BERGESER KE SAMPING
################################################################
KELUHAN PEMILIK: saat memilih tampilan bulanan di /admin/jadwal, SELURUH HALAMAN bisa
digeser ke samping. Yang seharusnya: hanya tabel jadwal yang bergeser, sehingga menu,
judul halaman, dan baris filter tetap diam di tempatnya.

REPRODUKSI — buktikan sendiri lebih dulu, jangan langsung memperbaiki:
  APP_ORIGIN='http://localhost:3100' TURSO_DATABASE_URL='file:./data/demo.db' npm run dev
  Buka /admin/jadwal, pilih tampilan bulanan, perkecil jendela.
  UJI DI MODE LEBAR (desktop), bukan hanya device mode — gejala ini mungkin tidak muncul
  di layar sempit.

DUGAAN YANG SUDAH DIJELASKAN TAPI BELUM TERBUKTI. JANGAN DIPERCAYA, HARUS DIUKUR:
  Dugaan awal: SidebarInset (src/components/ui/sidebar.tsx, sekitar baris 310) memakai
  "flex w-full flex-1 flex-col", dan <main> di src/app/admin/layout.tsx:95 tidak punya
  min-w-0. Flex item dengan lebar minimum otomatis menolak menyusut di bawah lebar
  konten, sehingga overflow-x-auto di dalam tabel tidak pernah aktif dan halaman ikut
  melebar. Tabel bulanan punya sekitar 30 kolom dengan min-w-28 (112px), jadi lebarnya
  sekitar 3.400px.

  Anda WAJIB mengukur dan membuktikan di browser. Kalau penyebab sebenarnya berbeda, laporkan
  penyebab yang sebenarnya, bukan versi yang tertulis di atas.

  Tambah min-w-0 tanpa bukti bahwa itu penyebabnya persis kesalahan yang sudah pernah
  terjadi di proyek ini: ada agent yang menyimpulkan "tidak ada overflow-x" setelah menyapu
  hanya src/app/, padahal kelasnya ada di komponen bersama src/components/.

PERBAIKAN — hanya setelah penyebabnya terbukti:
  Perbaiki rantai flex yang jadi penyebab. Kemungkinan besar di SidebarInset, <main> di
  layout, atau keduanya. Kalau ternyata perlu menyentuh src/components/ui/table.tsx,
  boleh — tapi hanya kalau diagnosis membuktikan itu, dan catat alasannya di laporan.

BATAS YANG TIDAK BOLEH DILALUI:
  - Kolom pertama "Karyawan" memakai sticky left-0 (src/app/admin/jadwal/komponen.tsx:172
    dan 184). Itu sumbu HORIZONTAL, berbeda dari TableHeadSticky yang memakai sticky top-0
    (sumbu vertikal). Jangan tertukar, jangan menggabungkan keduanya tanpa sengaja.
    Setelah perbaikan, kolom itu harus tetap menempel di kiri saat tabel digeser.
  - Jadwal BULANAN tidak diberi maxH. Jangan menambahkannya. Prop maxH pada Table membuat
    wrapper menjadi kotak scroll vertikal — itu keputusan terpisah yang belum disetujui
    pemilik untuk halaman ini.
  - Tampilan hari dan minggu di halaman yang sama tidak boleh ikut berubah.
  - src/components/ui/table.tsx dipakai bersama oleh tiga halaman lain (audit-log, agenda,
    verifikasi-agenda). Perubahan di sana memengaruhi mereka juga — buktikan ketiga halaman itu
    masih benar.

################################################################
3. TUGAS 2 — TOAST DI HALAMAN ADMIN
################################################################
KELUHAN PEMILIK: hasil tindakan di halaman admin sulit terlihat karena muncul sebagai teks
atau panel sebaris yang ikut ter-scroll keluar layar.

KONDISI SAAT INI (sudah diverifikasi, jangan diulang):
  <Toaster /> HANYA dipasang di src/app/a/[token]/AbsenClient.tsx dan AgendaClient.tsx.
  Di seluruh /admin tidak ada satu pun Toaster. Admin belum punya toast sama sekali.
  src/components/ui/sonner.tsx sudah ada di repo dan sudah dipakai halaman karyawan.

PERBAIKAN:
  1. Pasang satu Toaster di layout admin, posisi bottom-right. Admin desktop-first;
     top-center dipakai halaman karyawan dan tidak boleh dipakai ulang di sini karena akan
     menutupi tabel.
  2. src/app/admin/layout.tsx adalah SERVER component — ia memanggil cookies(). Jadi ia TIDAK
     BOLEH diberi 'use client'. Letakkan Toaster di komponen client terpisah yang kecil,
     lalu impor dari layout. Ini jebakan yang HANYA ketahuan oleh next build, bukan oleh tsc
     dan bukan oleh vitest.
  3. Ubah pesan hasil tindakan yang paling sering luput menjadi toast.

ATURAN PEMISAH YANG WAJIB DIPATUHI — jangan jadi konversi massal:
  Toast HANYA untuk: berhasil, dan gagal yang terjadi SETELAH pengguna menekan tombol.
  TIDAK boleh jadi toast untuk:
    - pesan yang menempel pada field tertentu (galat validasi harus muncul dekat fieldnya)
    - pesan yang menjadi satu-satunya tanda bahwa ada yang gagal dan harus diperbaiki
    - apa pun di halaman karyawan — berkas itu sudah punya sistemnya sendiri
  Jangan menghapus pesan sebaris yang sekarang ada kalau pesannya masih dibutuhkan.
  Menampilkan pesan sebaris DAN toast sekaligus menghasilkan pesan dua kali. Pilih satu.

SELURUH teks Bahasa Indonesia. Tidak ada kata Inggris yang terlihat pengguna.

################################################################
4. TES
################################################################
TES YANG DILARANG (menguji teks, bukan perilaku):
  toContain pada isi file · expect(true).toBe(true) · existsSync(...) ·
  membaca berkas lalu mencari string · menghitung berkas lalu membandingkan angka tetap

TES YANG WAJIB ADA untuk milestone ini:
  [ ] Layout admin memuat tepat satu Toaster, posisinya bottom-right
  [ ] Pesan hasil tindakan yang dipilih muncul sebagai toast, bukan hanya sebaris
  [ ] Galat validasi yang menempel pada field TIDAK berubah menjadi toast
  [ ] Tidak ada teks Inggris di Toaster maupun di pesan
  [ ] src/app/a/[token]/ tidak berubah sama sekali
  [ ] src/components/ui/sonner.tsx tidak berubah (dipakai halaman karyawan)

BUKTI MUTASI — mutasi harus VALID, dan hasilnya dibaca PER-EKSPEKTASI:
  1. Hapus <Toaster /> dari layout admin -> tes harus gagal
  2. Ubah posisi Toaster ke top-center -> tes posisi harus gagal
  3. Ubah satu pesan validasi field menjadi toast -> tes aturan pemisah harus gagal
  Mutasi yang gagal karena syntax error atau karena berkas gagal import BUKAN bukti.

JEBAKAN TES YANG SUDAH TERJADI DI PROYEK INI:
  - Kelas dasar Button shadcn memuat literal "disabled:" — assertion tidak boleh memakai
    kata itu. Penanda benar: atribut disabled="".
  - Badge shadcn memuat "text-xs" di kelas dasarnya; assertion terhadap seluruh HTML akan
    selalu gagal dan itu BUKAN bug aplikasi.
  - Class CSS bukan penanda stabil. Pola /data-checked/ bisa salah cocok.
  - Komponen client harus dijalankan di dalam render (createElement), bukan dipanggil langsung.
  - File tes tidak boleh jalan paralel.
  - Mutasi yang merusak berkas bukan bukti.

JEBAKAN KHUSUS MILESTONE INI:
  renderToStaticMarkup TIDAK bisa membuktikan tabel jadwal benar-benar yang bergeser.
  Jangan menulis tes yang mengaku membuktikan itu. Yang bisa diuji hanya Presence wrapper
  dan kelas pembingkusnya — dan itu belum cukup. Inilah alasan kenapa langkah 5 wajib.

GERBANG:
  npm run test:tz   # hijau di TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
  npm run typecheck
  npm run build     # WAJIB. tsc hijau tidak berarti build hijau.

################################################################
5. VERIFIKASI MANUAL — WAJIB, DAN TIDAK BISA DIGANTIKAN TES
################################################################
Setelah tes hijau:
  npm run build && APP_ORIGIN='http://localhost:3100' npm run start

Buka di browser pada LEBAR DESKTOP, bukan device mode — gejala jadwal ada di mode lebar.

  [ ] /admin/jadwal tampilan bulanan: yang bergeser sideways HANYA tabel jadwal
  [ ] Sidebar, judul halaman, dan baris filter TIDAK bergeser saat tabel digeser
  [ ] Kolom "Karyawan" tetap menempel di kiri saat tabel digeser horizontal
  [ ] Tampilan hari dan minggu di halaman jadwal tidak ikut berubah
  [ ] Halaman audit-log, agenda, verifikasi-agenda masih benar setelah perubahan table.tsx
  [ ] Toast muncul di kanan bawah, tidak menutupi tabel di tengah layar
  [ ] Toast hilang sendiri dan tidak menumpuk tanpa batas saat beberapa aksi cepat
  [ ] Tidak ada satu pun kata Inggris di toast
  [ ] Galat validasi pada field tetap muncul dekat fieldnya, bukan jadi toast
  [ ] Halaman /a/[token] masih berfungsi: absen dan agenda tidak berubah

Kalau ada butir yang gagal, JANGAN menulis laporan. Perbaiki, lalu ulangi dari awal.

################################################################
6. YANG TIDAK BOLEH DISENTUH
################################################################
DILARANG:
  src/app/api/**                   Tidak ada route baru, tidak ada perubahan logika.
  src/app/a/[token]/**             26 orang bergantung pada halaman ini. Butuh getUserMedia.
  src/server/guard.ts              Pemeriksaan Origin. BUG-UI-05.
  src/server/waktu.ts              BUG-01: jangan pernah mengumpankan sekarangWIB() ke
                                   fungsi waktu lain.
  src/app/admin/verifikasi/**      Sudah disetujui pemilik pada UI-2. Keluhan verifikasi
                                   ditangani sebagai milestone BERIKUTNYA, bukan di sini.
  src/app/admin/master/**          Keluhan modal tambah/edit juga milestone berikutnya.
  migrations/**                    Tidak boleh berubah sama sekali.
  package.json                     Tidak memasang paket apa pun.
  rules/01 s.d. rules/04 dan rules/06   Kalau ada yang salah, tulis di
                                   rules/OPEN_QUESTIONS.md — jangan diubah sendiri.
  git checkout, git reset --hard, git stash, git clean, git commit

WAJIB:
  - Tidak ada warna hex atau rgb literal
  - Tidak ada teks di bawah 16px di halaman karyawan
  - Tidak ada teks Bahasa Inggris yang terlihat pengguna

################################################################
7. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: UI-7 (jadwal bulanan bergeser ke samping + toast di admin)
Selesai: <berkas yang diubah>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus atau gagal, jumlah, di masing-masing timezone>
Diagnosis jadwal: <penyebab SEBENARNYA yang Anda buktikan di browser, bukan dugaan awal.
  Kalau dugaan awal salah, tulis itu terus terang>
Perbaikan jadwal: <apa yang Anda ubah dan mengapa itu memperbaiki>
Toast: <posisi, jumlah pesan yang jadi toast, dan mana yang sengaja TIDAK jadi toast>
Bukti mutasi: <tiga mutasi dan hasilnya per ekspektasi>
Halaman karyawan: <bukti git diff kosong untuk src/app/a/>
Tidak boleh disentuh: <bukti git diff kosong untuk src/app/api, master, verifikasi,
  guard.ts, waktu.ts, migrations>
Migrasi: <md5 migrations/0001_init.sql>
Verifikasi manual: <hasil sebelas butir di langkah 5>
Yang tidak dikerjakan: <checkout massal, modal tambah/edit, perbaikan verifikasi —
  dan alasannya>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
8. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Milestone sebelumnya | M15 selesai 2026-10-14, 1032 tes hijau di tiga timezone |
| Baseline tes | 71 berkas, 1032 tes |
| md5 `migrations/0001_init.sql` | `466a7b1a5aa5b1ab0a88e0a5f63a8a98` |
| Port dev | `3100` (`npm run dev`) |
| `APP_ORIGIN` | `http://localhost:3100` wajib disetel manual (BUG-UI-02) |

## C. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber |
|---|---|
| `Table` membungkus itself dengan `relative w-full overflow-x-auto` | `src/components/ui/table.tsx:40-45` |
| Wrapper `Table` sudah punya `overflow-x-auto` sejak awal | sama |
| `SidebarInset` memakai `flex w-full flex-1 flex-col`, tanpa `min-w-0` | `sidebar.tsx:310` |
| `<main>` di layout admin tidak punya `min-w-0` | `layout.tsx:95` |
| `min-w-0` ADA di komponen lain sidebar (`SidebarMenuButton` dkk) | `sidebar.tsx:387,460,644,682` |
| Kolom "Karyawan" di jadwal bulanan memakai `sticky left-0 bg-card` | `jadwal/komponen.tsx:172,184` |
| Tiap kolom tanggal memakai `min-w-28` | `jadwal/komponen.tsx:174` |
| `TableHeadSticky` (sumbu vertikal) dipakai audit-log, agenda, verifikasi-agenda dengan 70vh | UI-5B, `tests/ui5b-tabel-lengket.test.ts` |
| `<Toaster />` tidak ada di seluruh `/admin` | `grep -rn "<Toaster" src/` → 3 hasil, semuanya di `src/app/a/[token]/` |
| `src/components/ui/sonner.tsx` sudah ada | repo |
| Halaman master (toko, karyawan, akun) tidak mengimpor `Dialog` sama sekali | `grep -rln "Dialog" src/app/admin/` |
| Verifikasi sudah punya "Setujui terpilih" / "Tolak terpilih", TIDAK punya koreksi massal | `verifikasi/komponen.tsx:259-262`, `verifikasi/page.tsx:267` |
| `repo/verifikasi.ts` sudah punya batas bawah/atas | AGENTS.md, UI-5D |

## D. Peta UI-7 → spec → berkas

| Bagian | Spec | Berkas | Status |
|---|---|---|---|
| Jadwal bulanan bergeser | `rules/05` §2 | `src/components/ui/sidebar.tsx` atau `src/app/admin/layout.tsx` | setelah diagnosis |
| Toast admin | `rules/05` §1.4 | komponen client baru + `src/app/admin/layout.tsx` | pasang |
| Toast komponen | — | `src/components/ui/navigasi-toast.tsx` | baru |
| Pesan jadi toast | `rules/05` §7 | `src/app/admin/*/page.tsx` (dipilih) | sebagian |
| Tes | — | `tests/ui7-jadwal-geser.test.ts`, `tests/ui7-toast-admin.test.ts` | baru |

## E. Pemeriksaan silang

| Path | hanya di "wajib" | hanya di "dilarang" |
|---|---|---|
| `src/app/admin/layout.tsx` | ya | — |
| `src/components/ui/navigasi-toast.tsx` | ya | — |
| `src/components/ui/sidebar.tsx` | ya | — |
| `src/components/ui/table.tsx` | ya | — |
| `src/app/admin/jadwal/komponen.tsx` | ya | — |
| `src/app/admin/*/page.tsx` (kecuali master dan verifikasi) | ya | — |
| `tests/ui7-*.test.ts` | ya | — |
| `src/components/ui/sonner.tsx` | — | ya |
| `src/app/a/[token]/**` | — | ya |
| `src/app/admin/verifikasi/**`, `src/app/admin/master/**` | — | ya |
| `src/app/api/**`, `src/server/guard.ts`, `src/server/waktu.ts` | — | ya |
| `migrations/**`, `package.json` | — | ya |
| `rules/01`–`rules/04`, `rules/06` | — | ya |

Tidak ada tumpang tindih. `src/components/ui/table.tsx` sengaja tidak ada di daftar
dilarang karena perbaikan bisa saja ada di sana — tapi hanya setelah diagnosis.

## F. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Penyebab overflow belum terbukti** | Dugaan `min-w-0` masuk akal tapi belum diukur. Kalau salah, perbaikan bisa tidak memperbaiki apa pun. |
| **`renderToStaticMarkup` tidak memproses CSS** | Tidak ada tes yang bisa membuktikan tabel yang bergeser. Verifikasi manual adalah satu-satunya bukti. |
| **Gejala mungkin hanya di mode lebar** | Kalau hanya diuji di device mode, bisa salahsimpul "sudah beres". |
| **`overflow-y` dihitung jadi `auto`** | noted di AGENTS.md: `overflow-x: auto` membuat `overflow-y: visible` terhitung `auto`. Wrapper sudah jadi scroll container dua sumbu; karena tidak ada `max-h`, ia tidak pernah scroll vertikal. Jangan tambah `maxH` tanpa keputusan pemilik. |
| **`table.tsx` dipakai bersama** | Perubahan di sana mempengaruhi audit-log, agenda, dan verifikasi-agenda. Wajib dibuktikan ketiganya. |
| **`'use client'` hanya ketahuan build** | Layout admin adalah server component. Menempelkan Toaster langsung akan lolos di tsc dan vitest, lalu gagal di `next build`. |
| **Tidak ada browser terhubung ke sesi agent** | Posisi toast dan perilaku gutters harus dicek pemilik. |

## G. Yang TIDAK termasuk UI-7

- **Checkout massal** — pemilik memutuskan menunda. Ini fitur baru: route/transaksi baru, dan butuh keputusan aturan bisnis (boleh melewati batas 20 jam? satu karyawan bisa 2 checkout? hasil parsial?)
- **Modal untuk tambah/edit** di Toko, Karyawan, Akun — milestone terpisah
- **Paginasi halaman verifikasi** — UI-5D, sudah ada batas bawah/atas di repo
- **Pencarian karyawan di verifikasi** — mengubah query SQL, bukan UI
- **Tampilan foto absensi lebih besar** — perlu dibaca dulu route foto proxy-nya
- **Navigasi bawah di admin** — pemilik memutuskan admin tetap desktop-first
- **jsdom / B-20** — masih ditunda pemilik