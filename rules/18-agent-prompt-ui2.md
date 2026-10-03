# 18 — Prompt Agent Milestone UI-2 (Redesign 12 Halaman Admin)

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

MILESTONE INI SAMA SEPERTI UI-1: ini milestone PRESENTASI. Tidak ada aturan bisnis baru,
tidak ada route baru, tidak ada perubahan database. Yang berubah hanya BAGAIMANA aplikasi
itu terlihat dan terasa. rules/02 dan rules/05 §5 TIDAK BERUBAH — jika Anda merasa perlu
mengubahnya, BERHENTI dan tulis pertanyaannya, jangan mengubah.

################################################################
1. HALTE WAJIB
################################################################
Sebelum mulai:
  node -v         # harus v24.x.x (K-43). Kalau v26, BERHENTI.
  git status      # catat apa yang sudah berubah sebelumnya
  npm run build   # harus hijau
  npm run typecheck
  npm run test:tz # harus hijau di TIGA timezone

Kalau build atau tes sudah GAGAL SEBELUM Anda berubah, JANGAN melanjutkan. Laporkan dan
BERHENTI. Jangan memperbaiki milestone lain.

################################################################
2. YANG SUDAH SELESAI — JANGAN DIULANG
################################################################

--- 2.1 Halaman Verifikasi Absensi SUDAH redesigned (2026-10-03) ---
Pemilik sendiri yang mengubahnya dari tabel menjadi bentuk KARTU, dan itu disetujui.
JANGAN sentuh src/app/admin/verifikasi/** sama sekali. Ia juga jadi TELADAN untuk
seluruh pekerjaan Anda:

  src/app/admin/verifikasi/komponen.tsx   komponen presentasional murni, 0 inline style
  src/app/admin/verifikasi/page.tsx       hanya jaringan + state, 0 inline style
  tests/ui2-verifikasi-komponen.test.ts   38 tes yang memanggil renderToStaticMarkup

Bacalah berdua berkas itu SEBELUM mulai. Tiru polanya persis.

--- 2.2 Empat jebakan yang sudah ditemukan (lihat rules/NOTES.md §13–§14) ---

(a) BUG-UI-05: browser TIDAK mengirim header Origin pada request same-origin GET/HEAD.
    wajibOrigin() kini hanya mewajibkan Origin pada MUTASI. JANGAN "memperbaiki" ini
    kembali menjadi mewajibkan Origin pada semua request — itu akan mengunci seluruh UI
    admin di browser. Aturan aslinya rules/03 §9.4 sudah benar.

(b) BUG-UI-06: komponen Select (base-ui) menampilkan KODE MENTAH, bukan label.
    SelectItem berada di dalam Portal yang tidak ter-mount saat popup tertutup, jadi
    SelectValue jatuh ke serializeValue(value) dan trigger menampilkan
    <span data-slot="select-value">DISETUJUI</span>, bukan "Disetujui". Berlaku juga di
    browser, sampai dropdown dibuka sekali.
    -> Untuk filter dan dropdown yang TERTAUT, WAJIB memakai NativeSelect (select
       asli). Label dan penanda selected ikut ter-render di server.
    -> Select hanya boleh dipakai bila popup-nya benar-benar terbuka saat pertama
       dirender. Kalau ragu, pakai NativeSelect.

(c) npx shadcn@latest add menulis import yang RUSAK pada style base-nova:
        import { cn } from "cn"        <- HARUS "@/lib/utils"
    dan menyisipkan teks English ("Close", "Sidebar") yang melanggar aturan UI Bahasa
    Indonesia. Periksa lagi setelah setiap penambahan komponen.

(d) Shimpan data-slot menimpa milik komponen. Komponen shadcn menulis data-slot-nya
    SEBELUM {...props}, jadi <Card data-slot="kartu-saya"> MENGHAPUS data-slot="card".
    Untuk membuktikan sebuah komponen benar-benar dipakai, jangan andalkan data-slot-nya
    — pakai kelas khasnya (mis. group/card) atau atribut lain yang tidak ditimpa.

################################################################
3. INVENTARIS YANG HARUS DIKERJAKAN
################################################################
Semua angka di bawah sudah diverifikasi pada 2026-10-03. Kolom "inline" = jumlah
style={{...}};"polos" = jumlah elemen <table>/<select>/<input>/<textarea>/<button>
 polos yang harus hilang.

  BERKAS                                        BARIS INLINE POLOS  rules/05
  src/app/admin/jadwal/page.tsx                     438     42    28   §5.4
  src/app/admin/master/karyawan/page.tsx            346     35    23   §5.7
  src/app/admin/tidak-berangkat/page.tsx            271     38    17   §5.5
  src/app/admin/rekap/page.tsx                      210     26     7   §5.6
  src/app/admin/master/shift/page.tsx               206     25    14   §5.7
  src/app/admin/akun/page.tsx                       173     24    13   §5.8
  src/app/admin/master/toko/page.tsx                156     14     9   §5.7
  src/app/admin/page.tsx (dashboard)                147     15     1   §5.2
  src/app/admin/ubah-password/page.tsx              100     11     1   §5.11
  src/app/admin/pengaturan/page.tsx                  69      7     2   §5.9
  src/app/admin/layout.tsx                          105      5     0   §4
  src/app/admin/komponen.tsx                         87      5     1   -
  src/app/admin/tombol-keluar.tsx                    26      1     1   -
  src/app/admin/tautan-menu.tsx                      16      0     0   -
                                                          TOTAL 248

TOTAL 248 inline style dan 117 elemen polos. Kerjakan SATU halaman per langkah (lihat
bagian 6), jangan semuanya sekaligus.

Komponen shadcn yang sudah tersedia di src/components/ui/ (24 buah) — tidak perlu
mengunduh ulang:
  alert avatar badge button card chart checkbox dialog dropdown-menu field input
  label native-select select separator sheet sidebar skeleton sonner switch table
  tabs textarea tooltip

################################################################
4. POLA YANG WAJIB DITERAPKAN
################################################################
Untuk setiap halaman, pisahkan seperti yang sudah dilakukan di halaman verifikasi:

  <halaman>/page.tsx        komponen klien. Hanya: fetch, state, router, callback.
                            TIDAK BOLEH ada style={{}} di sini. Nol.
  <halaman>/komponen.tsx    komponen presentasional murni, DIEKSPOR, tanpa jaringan
                            dan tanpa next/navigation, supaya bisa diuji.

Prinsip pemisahan: sebuah komponen layak diuji kalau bisa dirender tanpa browser.
Kalau komponen butuh router atau fetch, itu berarti terlalu banyak logika di dalamnya —
pindahkan logikanya ke fungsi murni.

Gunakan komponen yang SUDAH ada. Contoh pemetaan yang sudah dipakai di halaman
verifikasi dan tidak boleh diulang:
  <table> polos         -> Table TableHeader TableBody TableRow TableHead TableCell
  <select> filter      -> NativeSelect + NativeSelectOption  (JANGAN Select, lihat 2.2b)
  kotak centang polos  -> Checkbox
  <textarea> polos     -> Textarea
  <input> polos        -> Input
  <label> polos        -> Label atau field berlabel
  tombol polos         -> Button (pilih variant: default / destructive / outline / ghost)
  span berwarna status -> Badge (pilih variant: default / secondary / outline / destructive)
  "loading: Memuat…"   -> Skeleton (rules/05 §5.3 mewajibkan skeleton baris)
  pesan galat polos    -> Alert variant="destructive" (rules/05 §5.x: pesan + tombol
                          "Coba lagi")
  daftar/kartu        -> Card + CardHeader + CardTitle + CardContent
  menu/tema/nav       -> Sidebar, Sheet, DropdownMenu, Separator, Tooltip, Sonner

Aturan warna: JANGAN menulis hex atau rgb literal di halaman. Pakai variant komponen,
atau token CSS var(--...). Mode gelap harus tetap terbaca di SEMUA halaman — setiap
warna latar/teks yang Anda pilih harus diuji di terang DAN gelap.

Aturan bahasa: tidak boleh ada teks Bahasa Inggris yang terlihat pengguna, termasuk
sr-only. Cek dialog, sheet, tooltip, dan placeholder.

################################################################
5. YANG TIDAK BOLEH DISENTUH
################################################################

DILARANG SAMA SEKALI:
  src/app/a/[token]/**        Halaman karyawan. 26 orang memakainya di HP dengan
                              jaringan seluler. rules/05 §3 merancang alurnya sesederhana
                              mungkin. Buktikan tidak tersentuh dengan:
                                  git diff --stat src/app/a/
                              Harus KOSONG.
  src/app/admin/verifikasi/**  Sudah disetujui pemilik (lihat 2.1)
  src/app/api/**              Tidak ada route baru, tidak ada perubahan logika
  src/server/**               Tidak ada perubahan aturan bisnis sama sekali
  migrations/0001_init.sql    md5 harus tetap 466a7b1a5aa5b1ab0a88e0a5f63a8a98
  src/server/{waktu,guard,auth,audit,izin,db}.ts
  vitest.config.mts
  rules/00 s.d. rules/06      Dokumen spesifikasi. Kalau salah, tulis di
                              rules/OPEN_QUESTIONS.md, jangan ubah sendiri.

TIDAK BOLEH berubah karena redesign:
  - Angka, definisi metrik, atau ambang apa pun
  - Endpoint yang dipanggil, parameter query, atau bentuk body POST
  - Nama field yang dikirim ke server
  - Perilaku validasi (mis. batas 0..1440 menit final, K-54)
  - Intensitas izin: peran tetap dicek di SERVER, bukan hanya disembunyikan di menu
  - rules/03 §9.4 dan src/server/guard.ts (lihat 2.2a)

WAJIB:
  - owner tidak meminta fitur baru. Kalau sebuah halaman terasa perlu fitur
    tambahan, JANGAN tambahkan. Catat di laporan sebagai pertanyaan.

################################################################
6. KERJAKAN SATU HALAMAN PER LANGKAH, DIVERIFIKASI
################################################################
Mengubah 12 halaman sekaligus lalu melihat hasilnya di akhir adalah cara pasti
menemukan bug yang tidak pernah ketahuan. Milestone ini sudah punya sejarah buruk:
aplikasi ini tidak pernah dibuka di browser selama 9 milestone, dan begitu dibuka,
tiga bug fundamental langsung terlihat.

Untuk SETIAP halaman, satu per satu:
  1. Baca rules/05 §5.x untuk halaman itu. TULIS DAFTAR ISI yang wajib ada —
     setiap label, kolom, empty state, loading state, dan error state.
  2. Pindahkan markup ke komponen.tsx yang bisa di-render tanpa browser.
  3. Tulis tes yang memanggil renderToStaticMarkup pada komponen itu.
  4. Jalankan: npm run typecheck && npm run build && npm run test:tz
  5. Buka halamannya di browser dan LIHAT hasilnya. Bukan hanya curl.
     Cek terang DAN gelap, layar lebar DAN sempit (sidebar harus tetap bisa dibuka).
  6. Bandingkan dengan daftar isi langkah 1. Tidak boleh ada yang hilang.
  7. Baru pindah ke halaman berikutnya.

Kalau temuannya butuh keputusan, catat di laporan dan BERHENTI. Jangan menebak.

################################################################
7. TES — CARA YANG WAJIB
################################################################

TES YANG DILARANG (sudah pernah menyesatkan selama 9 milestone):
  expect(kodeFile).toContain('...')          menguji teks, bukan perilaku
  expect(true).toBe(true)                    menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)  lulus untuk file yang isinya rusak
 menghitung jumlah berkas dari find                   menghitung berkas, bukan mengujinya
  Membaca .tsx laluTmencari string            sama seperti toContain

TES YANG WAJIB:
  Panggil komponen sungguhan dan periksa HTML hasilnya:
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { createElement } = await import('react');
      const html = renderToStaticMarkup(createElement(Komponen, props));
  Dua jebakan React 19 yang sudah terbukti:
    (a) Komponen klien harus dijalankan di dalam render — teruskan createElement(Komponen).
        Jangan memanggil Komponen() langsung, jangan meng-await hasilnya.
    (b) Kalau komponen memakai useRouter dari next/navigation, mock runtime Next-nya:
        vi.mock('next/navigation', ...)
        Yang di-mock adalah runtime Next, bukan kode kita.

  Pola yang sudah terbukti di tests/ui2-verifikasi-komponen.test.ts:
    - data-slot="table-head" membuktikan TableHead benar-benar dipakai
    - kelas group/card membuktikan Card dipakai (data-slot-nya bisa tertimpa, lihat 2.2d)
    - aria-label="Menit terlambat final 12" membuktikan input-nya bisa diuji
    - atribut disabled="" membuktikan tombol mati (KATA disabled: di dalam class
      Button BUKAN penanda yang valid — itu bug yang sudah pernah menipu)
    - kelas MEMANG tidak stabil. Preferensi atribut dan teks.

BUKTI WAJIB SETIAP TES BARU:
  Matikan aturannya, lalu lihat tes itu gagal. Kalau tes tetap hijau, tes itu tidak
  menguji apa pun dan harus diperbaiki. Catat hasil tiap mutasi di laporan.

Yang wajib ada tesnya per halaman:
  [ ] Semua isi wajib rules/05 §5.x halaman itu benar-benar muncul di HTML
  [ ] Loading memakai Skeleton, bukan teks "Memuat…" (kalau rules/05 mewajibkannya)
  [ ] Empty state memakai kalimat yang persis dari rules/05
  [ ] Error state menampilkan pesan + tombol "Coba lagi"
  [ ] Tidak ada elemen polos: <table>/<select>/<input>/<textarea>/<button> tanpa
      data-slot dari komponen
  [ ] Tidak ada style={{}} di page.tsx dan komponen.tsx halaman itu
  [ ] Tidak ada teks Bahasa Inggris yang terlihat pengguna

Yang tidak boleh terputus:
  [ ] npm run test:tz tetap hijau di TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
  [ ] tests/guard-origin.test.ts tetap hijau (38 route, mutasi WAJIB Origin)
  [ ] 544 tes yang ada sekarang tetap lulus, kecuali yang memang berubah karena UI —
      dan perubahannya harus dijelaskan di laporan
  [ ] src/app/a/ tidak berubah (git diff --stat kosong)
  [ ] migrations/0001_init.sql tidak berubah (md5 466a7b1a5aa5b1ab0a88e0a5f63a8a98)

################################################################
8. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone
  [ ] 248 inline style yang tersisa di src/app/admin/ menjadi 0
  [ ] 117 elemen polos yang tersisa menjadi 0
  [ ] Setiap halaman punya komponen.tsx yang presentasional dan bisa dirender
  [ ] Setiap halaman punya tes renderToStaticMarkup; tiap tes punya bukti mutasi
  [ ] Setiap halaman sudah dibuka di browser dan diperiksa, terang dan gelap
  [ ] src/server/** dan src/app/api/** tidak berubah sama sekali
  [ ] migrations/0001_init.sql tidak berubah
  [ ] git diff --stat src/app/a/ kosong
  [ ] Tidak ada teks Bahasa Inggris yang terlihat pengguna

################################################################
9. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: UI-2 (redesign 12 halaman admin)
Selesai: <daftar halaman yang selesai, dan berkas yang dibuat/diubah>
Versi: Node <node -v> / Next.js <versi> / Tailwind <versi> / shadcn base-nova
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Per halaman: <halaman — jumlah inline style sebelum->sesudah, jumlah tes, bukti mutasi>
Komponen shadcn yang dipakai: <daftar per halaman>
Komponen yang perlu ditambah: <daftar, dan perbaiki import "cn" serta teks English>
Bug yang ditemukan: <ID BUG-UI-xx, gejala, akar, bukti. Kosongkan kalau tidak ada>
Per halaman yang tidak selesai: dan alasannya
Halaman karyawan: <bukti git diff kosong untuk src/app/a/>
src/server/** dan src/app/api/** dan src/app/api/** tidak berubah — buktikan dengan git diff --stat
Migrasi: <md5 migrations/0001_init.sql>
Verifikasi dokumentasi eksternal: <URL yang Anda pakai; catat di rules/NOTES.md>
Keputusan teknis yang Anda ambil: <package/komponen/pendekatan yang perlu dikonfirmasi>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
10. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M9 (audit log UI, hardening,
aksesibilitas, QA menyeluruh). Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| `src/components/ui/` | 24 komponen, termasuk `native-select`, `checkbox`, `textarea`, `field` |
| Halaman verifikasi | **sudah selesai** — dipakai sebagai teladan |
| Tes baseline | 544 hijau di tiga timezone |
| Database demo | `scripts/isi-data-demo.ts` sudah terisi (10 toko, 26 karyawan, ~985 absensi) |
| Migrasi | md5 `466a7b1a5aa5b1ab0a88e0a5f63a8a98`, tidak boleh berubah |

## C. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber |
|---|---|
| Browser tidak mengirim `Origin` pada same-origin GET/HEAD | MDN HTTP `Origin` |
| `SelectPortal`: `mounted \|\| forceMount` | `node_modules/@base-ui/react@1.8` |
| `SelectValue` jatuh ke `serializeValue(value)` | `.../internals/resolveValueLabel.js` |
| shadcn `base-nova` menulis `import { cn } from "cn"` | `rules/NOTES.md` §14 |
| shadcn menyisipkan teks English `Close` / `Sidebar` | `rules/NOTES.md` §14 |

## D. Peta halaman → spec → komponen

rules/05 §5.x adalah acuan isi. Kolom kanan adalah pemetaan yang **sudah terbukti**
dipakai di halaman verifikasi, bukan usulan baru.

| Halaman | Spec | Failing utama | Komponen utama |
|---|---|---|---|
| `/admin` | §5.2 | 15 inline | Card, chart (Recharts v3), Badge, Button |
| `/admin/jadwal` | §5.4 | 42 inline, 28 polos | Card, Table, NativeSelect, Dialog, Tabs, Button, Badge, Checkbox |
| `/admin/tidak-berangkat` | §5.5 | 38 inline, 17 polos | Card, Table, NativeSelect, Dialog, Button, Badge, Alert |
| `/admin/rekap` | §5.6 | 26 inline, 7 polos | Card, Table, NativeSelect, Button, Skeleton, Alert |
| `/admin/master/karyawan` | §5.7 | 35 inline, 23 polos | Card, Table, Dialog, Button, Badge, Input, Separator |
| `/admin/master/shift` | §5.7 | 25 inline, 14 polos | Card, Table, Dialog, Button, Input, Switch |
| `/admin/master/toko` | §5.7 | 14 inline, 9 polos | Card, Table, Dialog, Button, Badge, Input |
| `/admin/akun` | §5.8 | 24 inline, 13 polos | Card, Table, Dialog, Button, Badge, Input, Alert |
| `/admin/pengaturan` | §5.9 | 7 inline, 2 polos | Card, Input, Button, Label, Alert |
| `/admin/ubah-password` | §5.11 | 11 inline, 1 polos | Card, Input, Button, Label, Alert |
| `layout.tsx` | §4 | 5 inline | Sidebar, Sheet, Separator, Button, Tooltip |
| `komponen.tsx` | — | 5 inline | Alert, Button (hapus inline, jangan ganti warnanya) |
| `tombol-keluar.tsx` | — | 1 inline | Button, DropdownMenu |
| `tautan-menu.tsx` | — | 0 | Button |

## E. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Tidak ada lingkungan DOM** (B-20, jsdom/happy-dom belum diinstal) | 544 tes tidak satu pun memanggil handler klien. Tombol ganti password, tombol keluar, dan isi jadwal/verifikasi/rekap belum teruji pada tingkat interaksi. Yang bisa diuji adalah markup presentasional. |
| `Dialog`/`Sheet`/`Select` berbasis portal | Isi popup tidak masuk render statis. Untuk mengujinya, ekstrak isinya ke komponen sendiri lalu render langsung — itulah yang dilakukan pada `IsiDialogTolak`, `IsiDialogKoreksi`, `IsiLightbox`. |
| Kelas CSS bukan penanda stabil | `disabled:`, `has-data-checked:` di dalam class, `group/card-header` vs `group/card`. Gunakan atribut dan teks. |

## F. Yang TIDAK termasuk UI-2

- **Audit log UI** (`rules/05` §5.10) — milestone M9
- **Hardening, aksesibilitas menyeluruh, QA** — milestone M9
- **Pemasangan jsdom** (B-20) — perlu persetujuan pemilik lebih dulu
- **Halaman karyawan** `/a/[token]` — di luar cakupan sejak awal
- **Fitur baru apa pun** — owners tidak meminta, dan tidak boleh ditambahkan