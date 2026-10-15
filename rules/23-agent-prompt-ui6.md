# 23 — Prompt Agent Milestone UI-6 (Navigasi Bawah Halaman Karyawan)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> Konteks: M15 selesai 2026-10-14 dengan 1032 tes hijau di tiga timezone. UI-5A/B/C selesai
> 2026-10-12. Q&A belum tersimpan sebagai prompt terpisah.

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau ada yang tidak tertulis, BERHENTI dan tulis pertanyaannya.

Milestone ini berisi LIMA langkah berurutan. Ikuti semuanya dalam satu giliran.
Tiap langkah menyebutkan skill mana yang dipakai. Jangan loncat langkah.

################################################################
0. HALTE WAJIB
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
LANGKAH 1 — DOKUMEN (TIDAK ADA SKILL)
################################################################
Baca rules/00-decision-log.md dan rules/05-ui-ux-rules.md §3 lebih dulu, lalu:

  a) rules/00-decision-log.md : tambahkan entri K-67 (K-66 adalah yang terakhir). Isinya:
     - Halaman karyawan /a/[token] memakai NAVIGASI BAWAH, menggantikan tab di atas.
     - Tepat DUA item: "Absen" dan "Agenda". Tidak ada item ketiga, tidak ada tombol tengah
       besar. Alasannya: satu permukaan link saja (K-01), risiko kebocoran link D-1.
     - Navigasi bawah TIDAK memakai URL. Status tab tetap state lokal seperti sekarang.
       Mengganti ke URL adalah fitur baru dan di luar milestone ini.
     - Halaman admin TIDAK ikut berubah. rules/05 §1.2 (desktop-first) tidak diubah.
     - Apa yang TIDAK diputuskan: jumlah item nav tidak boleh bertambah tanpa keputusan baru.

  b) rules/05-ui-ux-rules.md §3 : tambahkan aturan navigasi bawah. Jangan menghapus atau
     mengubah aturan §3 yang sudah ada.
     - Setiap item punya label teks Bahasa Indonesia, bukan ikon saja.
     - Target sentuh minimal 44x44 px (sudah ada di §2 — jangan diduplikasi).
     - Konten halaman WAJIB punya padding bawah secukupnya supaya navigasi tidak menutupi
       tombol utama "Absen". Ini butir yang paling sering terlewat.
     - Tinggi memakai dvh, bukan vh, agar aman dari keyboard virtual.
     - Aman dari tepi bawah iPhone (safe-area-inset-bottom), tanpa ruang kosong ganda.
     - Tab aktif harus bisa dibedakan TANPA mengandalkan warna saja (rules/05 §1.3).
     - Perpindahan tab WAJIB melepas kamera (lihat catatan kamera di §3).

  c) rules/OPEN_QUESTIONS.md : tambahkan entri B-23 (B-22 adalah yang terakhir; catatan
     "ID berikutnya: B-23" di berkas itu bukan usage). Isi:
     - Masalah: navigasi bawah TIDAK dapat dibuktikan oleh tes renderToStaticMarkup, karena
       hasilnya tanpa CSS, tanpa viewport, dan tanpa keyboard virtual.
     - Dampak: tes hanya bisa membuktikan item nav ADA, punya nama aksesibel, dan tombol
       "Absen" ada di dalam <nav>. Posisi melekat, perilaku keyboard, dan safe-area hanya
       bisa dicek manual di browser.
     - Rekomendasi: tetap diterima, dengan verifikasi manual sebagai syarat selesai.

  setelah menulis, TUNJUKKAN ketiga potongan yang Anda tambahkan. Jangan lanjut sebelum
  pemilik menyetujui.

################################################################
LANGKAH 2 — RISET POLA NAVIGASI BAWAH  (muat skill: @ui-ux-pro-max)
################################################################
  Muat skill `@ui-ux-pro-max` dengan menyebut `@ui-ux-pro-max` di prompt Anda sendiri.

  Tugas Anda riset SAJA pada langkah ini. Jangan menulis kode aplikasi, jangan mengubah
  berkas di src/.

  Konteks: 26 karyawan, 10 toko, dipakai di HP, sering dengan satu tangan, sering di
  outdoor. Halaman punya tepat dua tugas: "Absen" (foto + kirim) dan "Agenda" (laporan
  foto). Halaman ini tidak punya versi desktop.

  Yang dibutuhkan:
    1. Pola navigasi bawah dengan tepat 2 item. Apakah 2 item lazim, atau minimumnya 3?
       Jawab dengan rujukan ke panduan yang Anda punya, bukan asumsi pribadi.
    2. Rekomendasi tinggi/lebar item, jarak antar item, dan bentuk aktif (warna, ikon
       terisi, atau garis penanda) yang tetap terbaca di layar kecil dan untuk pengguna
       dengan mata kurang tajam.
    3. Dua ikon lucide untuk "Absen" dan "Agenda". Syarat: bentuknya harus JAUH berbeda satu
       sama lain, bukan hanya beda nama. Usulkan paling banyak 3 pasangan dengan alasan.
    4. Jebakan aksesibilitas khusus navigasi bawah yang sering terlewat di web app,
       dibanding native: aria, fokus keyboard, safe-area, keyboard virtual.

  ATURAN:
    - Semua keluaran Bahasa Indonesia.
    - JANGAN mengusulkan perubahan halaman admin. Admin tetap desktop-first.
    - JANGAN mengusulkan item ketiga, tombol tengah besar, atau tab tersembunyi.
    - Kalau panduan Anda tidak menjawab salah satu pertanyaan, KATAKAN ITU dengan jujur.
      Jangan mengarang angka. Angka harus bisa ditelusuri ke sumber di dalam skill.

  Simpan hasilnya sebagai catatan singkat, lalu lanjut ke langkah 3.

################################################################
LANGKAH 3 — KOMPONEN DAN PEMASANGAN  (muat skill: @ui-styling)
################################################################
  Muat skill `@ui-styling` dengan menyebut `@ui-styling` di prompt Anda sendiri.

  BACAKAN DULU, URUTAN INI PENTING:
    rules/00 (entri K-67), rules/05 §3, dan AGENTS.md di root repo.

  ATURAN YANG MENAUNGI SKILL INI — kalau bertentangan dengan instruksi skill, YANG INI MENANG:
    1. Gaya shadcn proyek ini adalah "base-nova", bukan gaya default yang diasumsikan skill.
    2. JANGAN menjalankan `npx shadcn add` tanpa.awasi. Repo sudah punya komponennya di
       src/components/ui/. Hasil yang menghasilkan import `from "cn"` HARUS diperbaiki
       manual menjadi `from "@/lib/utils"`, kalau tidak gagal typecheck.
    3. JANGAN menerima teks Bahasa Inggris apa pun dari skill. "Close", "Sidebar", dan
       sejenisnya wajib diganti Bahasa Indonesia.
    4. Komponen Select base-ui TIDAK boleh dipakai untuk filter di halaman ini. SelectItem
       ada di dalam portal yang tidak ter-mount saat popup tertutup, hasilnya kode mentah
       tampil ke pengguna (BUG-UI-06). Kalau butuh filter, pakai NativeSelect.
    5. Tidak boleh ada warna hex atau rgb literal. Tidak boleh ada style inline.

  YANG DIKERJAKAN:
    a) src/components/ui/navigasi-bawah.tsx (baru) — komponen presentational murni.
       Mengembalikan <nav> dengan dua item. Ia tidak tahu apa itu absensi, agenda, kamera,
       atau token. Ia hanya menerima daftar item dan nilai aktif, lalu memanggil balik saat
       item dipilih. Tanpa warna hex, tanpa teks Inggris.
       Wajib: <nav> punya aria-label Bahasa Indonesia; setiap item punya nama aksesibel
       (teks atau aria-label), bukan ikon saja.

    b) src/app/a/[token]/TabsHalamanClient.tsx — ganti TabsList di atas dengan navigasi
       bawah. Nama berkas boleh Anda ubah kalau lebih jujur terhadap isinya; kalau diubah,
       perbarui SEMUA pengimpornya. Saat ini hanya dua berkas di luar dirinya yang mengimpor
       file ini: src/app/a/[token]/page.tsx dan tests/ui3-halaman-absen-gelap.test.ts.

    c) src/app/a/[token]/page.tsx — sesuaikan importnya.

  WAJIB DIPERHATIKAN — INI BISA MEMATIKAN ABSEN 26 ORANG:
    AbsenClient meminta getUserMedia di useEffect saat mount (sekitar baris 219). Berkas
    sekarang sengaja memakai key={nilaiTab} supaya komponen benar-benar di-REMOUNT saat
    pindah tab, sehingga stream kamera benar-benar dilepas. Sembunyikan saja TIDAK cukup —
    komponen tetap memegang perangkat kamera, dan di Android tertentu kamera depan gagal
    dibuka, dan itu mematikan absen.

    Pertahankan perilaku ini PERSIS. JANGAN menghapus docblock yang menjelaskannya di
    TabsHalamanClient.tsx (baris 3-15). Kalau Anda merasa remount tidak lagi diperlukan,
    jangan ikut mengubahnya — laporkan sebagai pertanyaan.

  SELESAI KALAU:
    - Navigasi bawah ter-render di markup statis, dua item, keduanya punya nama aksesibel.
    - Konten halaman punya padding bawah yang mencegah nav menutupi tombol "Absen".
    - Tinggi memakai dvh, bukan vh, dan ada penanganan safe-area-inset-bottom tanpa ruang
      kosong ganda di perangkat yang punya notch.
    - Berpindah tab tetap me-remount AbsenClient.
    - Tidak ada teks Inggris, tidak ada warna literal, tidak ada style inline.

  DILARANG:
    src/app/api/** · src/app/admin/** · src/app/a/[token]/AbsenClient.tsx ·
    src/app/a/[token]/AgendaClient.tsx · src/server/guard.ts · src/server/waktu.ts ·
    migrations/** · package.json · rules/01 s.d. rules/04 dan rules/06 ·
    git checkout / reset --hard / stash / clean / commit

  Jangan menulis tes pada langkah ini. Lanjut ke langkah 4.

################################################################
LANGKAH 4 — TES DAN BUKTI MUTASI  (TIDAK ADA SKILL)
################################################################
  Jangan muat skill apa pun pada langkah ini. Bagian ini soal disiplin, bukan desain.

  Tidak ada kode fitur yang boleh Anda ubah, kecuali tes itu sendiri. Kalau Anda merasa
  perlu mengubah kode fitur, itu tanda ada bug — laporkan, jangan menambalnya diam-diam.

  POLA YANG WAJIB DIIKUTI — baca dua berkas ini lebih dulu dan ikuti polanya:
    tests/ui3-halaman-absen-gelap.test.ts
    tests/ui5-keadaan-layar.test.ts
      - Komponen client HARUS dijalankan di dalam render. Teruskan createElement(Komponen),
        jangan memanggil Komponen() langsung dan jangan meng-await hasilnya.
      - useRouter() dari next/navigation melempar di luar pohon Next — pakai
        vi.mock('next/navigation', ...).
      - File tes tidak boleh jalan paralel. Sudah diatur fileParallelism: false.

  TES YANG DILARANG (menguji teks, bukan perilaku):
    toContain pada isi file · expect(true).toBe(true) · existsSync(...) ·
    membaca berkas lalu mencari string · menghitung berkas lalu membandingkan angka tetap

  TES YANG WAJIB ADA:
    [ ] Navigasi bawah ter-render sebagai <nav> dengan tepat dua item
    [ ] Kedua item punya label teks Bahasa Indonesia yang terbaca pengguna
    [ ] Setiap item punya nama aksesibel — bukan ikon saja
    [ ] Berpindah dari "Absen" ke "Agenda" benar-benar ME-REMOUNT AbsenClient
    [ ] Konten halaman punya padding bawah yang mencegah nav menutupi tombol "Absen"
    [ ] Tinggi memakai dvh, bukan vh
    [ ] Ada penanganan safe-area-inset-bottom
    [ ] Tidak ada warna hex/rgb literal di keluaran
    [ ] Tidak ada teks di bawah 16px di halaman karyawan
    [ ] src/app/a/[token]/TabsHalamanClient.tsx (atau penggantinya) masih punya docblock
        yang menjelaskan alasan remount kamera

  BUKTI MUTASI — WAJIB, dan mutasi harus VALID:
    1. Hapus key pada AbsenClient -> tes remount harus gagal
    2. Hapus aria-label pada satu item -> tes aksesibilitas harus gagal
    3. Hapus padding bawah konten -> tes penutupan tombol harus gagal
    4. Ubah dvh menjadi vh -> tes tinggi harus gagal
    Mutasi yang gagal karena syntax error atau karena berkas gagal import BUKAN bukti.
    Baca hasilnya PER-EKSPEKTASI, jangan cuma melihat jumlah kegagalan.
    Kalau memakai `vitest -t`, pastikan ada tes yang benar-benar dieksekusi — pola filter
    yang tidak cocok nama tes mana pun tetap terlihat "lulus".

  JEBAKAN TES YANG SUDAH TERJADI DI PROYEK INI — jangan diulang:
    - Kelas dasar Button shadcn memuat literal "disabled:". Assertion tidak boleh memakai
      kata itu; penanda benar adalah atribut disabled="".
    - Badge shadcn memuat "text-xs" di kelas dasarnya. Assertion text-xs terhadap seluruh
      HTML akan selalu gagal, dan itu BUKAN bug aplikasi. Periksa elemen yang teksnya dibaca.
    - Card shadcn memuat "text-sm" di kelas dasarnya; teks di dalam Card tanpa ukuran
      eksplisit diam-diam turun ke 14px.
    - Class CSS bukan penanda stabil. Pola /data-checked/ bisa salah cocok.
    - React 19 menulis maxLength="500" dengan huruf besar-kecil aslinya — pakai pola /i.
    - Menambah atribut JSX memecah satu baris jadi beberapa. Pakai \s+ atau [\s\S]{0,200}?
      JANGAN melonggarkan assertion-nya.
    - Sapuan sumber yang membaca komentarnya sendiri akan menggagalkan tesnya sendiri.
      Buang komentar sebelum menyapu.
    - Melonggarkan tes supaya lulus itu melonggarkan pelarasan, bukan hanya tesnya.

  GERBANG:
    npm run test:tz   # hijau di TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
    npm run typecheck
    npm run build     # WAJIB. tsc hijau tidak berarti build hijau.

################################################################
LANGKAH 5 — VERIFIKASI MANUAL  (TIDAK ADA SKILL)
################################################################
  npm run build && APP_ORIGIN='http://localhost:3100' npm run start

  Buka di browser pada dua lebar, karena alasan yang berbeda:

  iPhone SE — 375 px:
    [ ] Navigasi melekat di bawah, tidak ikut ter-scroll bersama konten
    [ ] Tombol "Absen" dan "Foto" TIDAK tertutup navigasi
    [ ] Keyboard virtual tidak menutupi field "Keterangan"
    [ ] Beralih tab -> ikon kamera di address bar hilang (kamera benar-benar dilepas)
    [ ] Tidak ada ruang kosong aneh di bawah (safe-area tidak dobel)

  Layar lebar:
    [ ] Halaman tetap utuh, tidak rusak hanya karena diberi navigasi bawah
    [ ] Tab aktif bisa dibedakan tanpa melihat warna saja

  Semua lebar:
    [ ] Tidak ada satu pun kata Inggris yang terlihat pengguna
    [ ] Status tab aktif tetap punya label teks (rules/05 §1.3)

  Kemungkinan besar Anda perlu data demo:
    scripts/isi-data-demo.ts

  Kalau ada butir yang gagal, JANGAN menulis laporan. Perbaiki, lalu ulangi dari awal.

################################################################
6. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: UI-6 (navigasi bawah halaman karyawan)
Selesai: <berkas yang diubah dan berkas yang dibuat>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus atau gagal, jumlah, di masing-masing timezone>
K-67: <isi entri yang Anda tulis di rules/00>
B-23: <isi entri yang Anda tulis di rules/OPEN_QUESTIONS.md>
Riset navigasi: <hasil @ui-ux-pro-max — pasangan ikon yang dipilih dan alasan pilihannya>
Komponen: <apa yang diterima dari skill dan apa yang harus diperbaiki manual>
Kamera: <bukti bahwa remount masih bekerja>
Bukti mutasi: <empat mutasi dan hasilnya per ekspektasi>
Tidak terbukti oleh tes: <apa yang hanya bisa dicek manual di browser>
Verifikasi manual: <hasil seluruh butir langkah 5>
Tidak boleh disentuh: <bukti git diff kosong untuk src/app/api, src/app/admin,
 src/server/guard.ts, src/server/waktu.ts, migrations>
Migrasi: <md5 migrations/0001_init.sql>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
7. BERHENTI
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
| Data demo | `scripts/isi-data-demo.ts` — untuk langkah 5, bukan fixture tes |
| Port dev | `3100` (`npm run dev`) |
| `APP_ORIGIN` | `http://localhost:3100` wajib disetel manual (BUG-UI-02) |

## C. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber |
|---|---|
| Halaman karyawan sudah punya `Tabs` di atas, di `TabsHalamanClient.tsx:33-45` | baca berkas |
| Hanya 2 berkas luar yang mengimpor `TabsHalamanClient` | `grep -rln "TabsHalamanClient"` |
| `AbsenClient` meminta `getUserMedia` di `useEffect` mount | `AbsenClient.tsx:219` |
| `key={tab}` dipakai supaya kamera dilepas saat pindah tab | `TabsHalamanClient.tsx:47` + docblock baris 3-15 |
| Tidak ada satu pun aturan navigasi bawah di `rules/` | `grep` "bottom"/"navigasi bawah"/"WhatsApp" → 0 |
| Admin sudah punya drawer mobile (`collapsible="offcanvas"`) | `layout.tsx:57` |
| Belum ada komponen navigasi bawah di `src/components/ui/` | `grep -rln "BottomNav\|TabBar"` → 0 |
| Aplikasi native mobile ada di daftar **di luar lingkup** | `rules/01-prd.md:48` |
| Nomor K terakhir K-66, nomor B terakhir B-22 | `grep`, 2026-10-14 |

## D. Peta UI-6 → spec → berkas

| Bagian | Spec | Berkas | Status |
|---|---|---|---|
| Keputusan pemilik | — | `rules/00-decision-log.md` | tambah K-67 |
| Aturan navigasi bawah | `rules/05` §3 | `rules/05-ui-ux-rules.md` | tambah |
| Batas tes | `rules/03` | `rules/OPEN_QUESTIONS.md` | tambah B-23 |
| Komponen | `rules/05` §3 | `src/components/ui/navigasi-bawah.tsx` | baru |
| Pemasangan | `rules/05` §3 | `src/app/a/[token]/TabsHalamanClient.tsx` | ganti TabsList |
| Import | — | `src/app/a/[token]/page.tsx` | sesuaikan |
| Tes | — | `tests/ui6-navigasi-bawah.test.ts` | baru |

## E. Pemeriksaan silang

Pelajaran dari kontradiksi prompt M9, di mana `src/app/admin/verifikasi/**` ada di daftar
"dilarang" sekaligus diminta dikerjakan di berkas itu. Sudah diperiksa untuk file ini:

| Path | hanya di "wajib" | hanya di "dilarang" |
|---|---|---|
| `rules/00-decision-log.md` | ya | — |
| `rules/05-ui-ux-rules.md` | ya | — |
| `rules/OPEN_QUESTIONS.md` | ya | — |
| `src/components/ui/navigasi-bawah.tsx` | ya | — |
| `src/app/a/[token]/TabsHalamanClient.tsx` | ya | — |
| `src/app/a/[token]/page.tsx` | ya | — |
| `tests/ui6-*.test.ts` | ya | — |
| `src/app/a/[token]/AbsenClient.tsx` | — | ya |
| `src/app/a/[token]/AgendaClient.tsx` | — | ya |
| `src/app/api/**`, `src/app/admin/**` | — | ya |
| `src/server/guard.ts`, `src/server/waktu.ts` | — | ya |
| `migrations/**`, `package.json` | — | ya |
| `rules/01`–`rules/04`, `rules/06` | — | ya |

Tidak ada tumpang tindih.

## F. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Tidak ada lingkungan DOM** (B-20 ditunda pemilik) | `renderToStaticMarkup` tidak bisa mengukur posisi, jarak, atau tapping. Batas bawah yang bisa diuji: ada/tidaknya item, nama aksesibel, remount, dan kelas pembungkus. |
| **Tidak ada browser terhubung ke sesi agent** | Posisi melekat di bawah, perilaku keyboard, dan safe-area hanya bisa dicek pemilik sendiri. Agent harus menyerahkan checklist, bukan mengklaim sudah terbukti. |
| **`renderToStaticMarkup` tidak memproses CSS** | Kelas `pb-*` yang;= ada di HTML, tidak berarti tombolnya benar-benar tidak tertutup. Jangan menulis tes yang mengaku membuktikannya. |
| **B-20 masih ditunda** | Navigasi bawah justru salah satu dari empat alur yang paling butuh DOM. Keputusan ini belum diambil pemilik. |
| Renaming berkas menyentuh 2 berkas lain | `page.tsx` dan `tests/ui3-halaman-absen-gelap.test.ts`. Kalau tidak dihitung, `next build` atau tes akan gagal. |

## G. Yang TIDAK termasuk UI-6

- **Navigasi bawah di halaman admin** — pemilik memutuskan admin tetap desktop-first (`rules/05` §1.2 tidak diubah)
- **Item ketiga / tombol tengah besar / FAB** — tidak diputuskan
- **Status tab di URL** — fitur baru, di luar milestone
- **Paginasi halaman verifikasi** — UI-5D, milestone terpisah
- **Modal untuk tambah/edit di halaman master** — milestone terpisah
- **Checkout massal** — pemilik memutuskan menunda; ini fitur baru yang butuh keputusan aturan bisnis
- **jsdom / B-20** — masih ditunda pemilik