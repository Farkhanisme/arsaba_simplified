# 25 — Prompt Agent Milestone UI-8 Fase A (Audit Tampilan: Opsi Palet + Tipografi)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> **Milestone ini HANYA Fase A dan sepenuhnya READ-ONLY.** Tidak ada satu baris kode yang
> boleh ditulis. Keluarannya adalah dokumen keputusan untuk pemilik — bukan diff.
>
> Konteks: pemilik menyatakan tampilan sekarang "kurang menarik" (2026-10-14). Setelah
> diperiksa, tidak ada satu pun keputusan pemilik yang mengunci warna, tipografi, atau tema
> visual — `rules/00` (183 baris) tidak menyebutnya, dan kolom Keputusan UI-1 di `AGENTS.md`
> berisi tanda `-`. Jadi ini penambahan keputusan baru, bukan pelanggaran keputusan lama.

## A. Skill yang dipakai

| Tahap dalam prompt | Skill | Kenapa |
|---|---|---|
| Langkah 2 | **`@ui-ux-pro-max`** | Punya 192 palet produk + reasoning profile, 74 pasangan font, 119 panduan UX. Lapisan riset murni |
| Langkah 4 | **`@design-system`** | Arsitektur token 3 lapis (primitive → semantic → component). Hanya untuk memetakan, bukan untuk menulis token |
| Langkah 1, 3, 5 | **tidak ada** | Baca dokumen, hitung kontras, susun dokumen keputusan |

**Yang TIDAK boleh dimuat:**

| Skill | Alasan |
|---|---|
| `@design` | Umbrella. Akan mengusulkan logo, banner, dan corporate identity program — semua di luar lingkup |
| `@ui-styling` | Fase A tidak menulis komponen. Memuatnya hanya_validation sia-sia dan berisiko mendorong agent memasang `npx shadcn add` |
| `@brand`, `@banner-design`, `@slides` | Aset pemasaran, bukan antarmuka aplikasi internal |

## B. Prompt (salin blok di bawah, tambahkan `@ui-ux-pro-max` di baris pertama)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi keputusan, bukan
mengarang pilihan desain.

################################################################
1. HALTE WAJIB — DAN INI MILESTONE READ-ONLY
################################################################
Sebelum mulai:
  node -v          # harus v24.x.x (K-43). Kalau v26, BERHENTI.
  git status       # CATAT apa yang sudah berubah.

WAJIB DI AKHIR:
  git status --short
  git diff --stat
  KEDUA-DUAanya harus SAMA dengan yang tercatat di awal. Kalau Anda menulis satu file pun,
  milestone ini GAGAL — bukan "sedikit di luar cakupan", tapi gagal.

Yang Anda buat: satu dokumen keputusan di dalam jawaban Anda sendiri (chat).
Yang Anda TIDAK boleh membuat: file apa pun. Bukan di rules/, bukan di notes/, bukan di
 mana pun. Alasannya: pemilik harus memilih dulu sebelum apa pun ditulis.

################################################################
2. LANGKAH 1 — BACA (TIDAK ADA SKILL)
################################################################
Baca, dalam urutan ini, dan jangan menebak isi file mana pun:
  AGENTS.md                     aturan kerja repo, termasuk larangan keras
  rules/00-decision-log.md      183 baris — keputusan pemilik
  rules/05-ui-ux-rules.md       terutama §1 Prinsip, §2 Konvensi global, §3 Halaman Karyawan
  src/app/globals.css           185 baris — seluruh token tema
  src/components/ui/table.tsx, card.tsx, button.tsx, badge.tsx, sidebar.tsx
  src/app/a/[token]/TabsHalamanClient.tsx

Yang harus Anda KETAHUI sudah benar sebelum mulai:
  - rules/00 tidak memuat SATU PUN keputusan tentang warna, tipografi, atau tema visual.
  - UI-1 dijalankan tanpa keputusan pemilik (kolom Keputusan berisi tanda "-").
  - globals.css memakai shadcn gaya base-nova dengan nilai oklch.
  - Halaman karyawan /a/[token] dipakai di HP, sering di luar ruangan, sering dengan
    satu tangan. Kontras di bawah matahari adalah syarat, bukan Keplerangan.

################################################################
3. LANGKAH 2 — RISET PALET  (muat skill: @ui-ux-pro-max)
################################################################
  Muat skill `@ui-ux-pro-max` dengan menyebutnya di prompt Anda sendiri.

  Tugas Anda pada langkah ini: riset dan SAJIKAN OPSI. Jangan pilih satu dan fatally.

  Yang perlu Anda kerjakan:
    1. Bangun 3 sampai 4 OPSI palet yang berbeda jelas satu sama lain — bukan 4 variasi
       dari ide yang sama. Satu opsi boleh konservatif, satu boleh berani.
    2. Setiap opsi wajib memuat, dalam bentuk oklch agar bisa langsung ditempel ke
       globals.css tanpa konversi:
         --primary, --primary-foreground, --background, --card, --accent, --accent-foreground,
         --secondary, --muted, --muted-foreground, --border, --input, --ring,
         --sidebar, --sidebar-foreground, --sidebar-accent, --sidebar-accent-foreground,
         --sidebar-border, --sidebar-primary
       untuk mode TERANG dan mode GELAP.
    3. Setiap opsi wajib menyebut alasan pick: untuk siapa aplikasi ini, apa yang membuat
       opsi itu cocok atau tidak cocok.
    4. Setiap opsi wajib menyebut risikonya secara jujur.

  WAJIB DIJAWAB, kalau panduan skill tidak bisa menjawabnya maka KATAKAN tidak bisa:
    a. Apakah palet ini tetap terbaca di mode gelap pada latar oklch(0.145 0 0)?
    b. Apakah status GREEN/AMBER/RED yang sudah ada (badge absensi) tetap TERBEDA dari
       warna primer baru? Kalau tidak, sebutkan opsinya.
    c. Apa yang terjadi pada tombol"DIVERIFIKASI" dan tautan Biru yang sekarang? Opsi
       apa yang membuat link tetap terlihat seperti link?

################################################################
4. LANGKAH 3 — HITUNG KONTRAS, JANGAN MATAH  (TIDAK ADA SKILL)
################################################################
  Untuk setiap opsi, dan untuk setiap pasangan yang dipakai sungguhan di aplikasi:
    foreground di atas background, foreground di atas card, primary-foreground di atas
    primary, muted-foreground di atas background, teks di atas sidebar, teks di atas
    sidebar-accent, teks di atas accent, dan setiap cincin fokus di atas latar yang
    dipakai.

  HITUNG dengan rumus rasio kontras WCAG 2.x. Tulis angkanya. Jangan menulis "cukup
  kontrasnya" atau "sepertinya aman" — kalau tidak dihitung, jangan disebut aman.

  Ambang yang wajib dipenuhi:
    - Teks biasa         minimal 4.5 : 1
    - Teks besar         minimal 3.0 : 1
    - Komponen non-teks, termasuk cincin fokus, minimal 3.0 : 1
    - Halaman karyawan /a/[token] dianggap dipakai outdoor: rasio TEKS UTAMA minimal
      7 : 1, karena
      dipakai di bawah matahari. Ini lebih ketat dari WCAG dan itu disengaja.

  Untuk setiap angka yang GAGAL ambang, sebutkan pasangan mana, angkanya, dan opsi apa
  yang harus diubah supaya lolos. Jangan diamkan.

################################################################
5. LANGKAH 4 — PETA TOKEN DAN TIPOGRAFI  (muat skill: @design-system)
################################################################
  Muat skill `@design-system` dengan menyebutnya di prompt Anda sendiri.

  5a. PETA TOKEN — petakan saja, JANGAN menulis token baru:
      Klasifikasikan seluruh variabel di globals.css ke tiga lapis:
        PRIMITIVE  : nilai warna dasar, belum punya makna
        SEMANTIC   : punya makna (surface, teks, batas, aksi)
        COMPONENT  : dipakai satu komponen saja
      Lalu petakan: variabel mana yang sekarang dipakai lebih dari satu tempat tapi punya
      makna berbeda. Setiap temuan harus menyebut nama variabel dan tempat pakainya.

  5b. URUTAN KERJA — JANGAN propose "ubah semua variabel sekaligus":
      Satu_hintAyat: "ubah semua variabel sekaligus" adalah jawaban yang salah. Jelaskan
      urutan yang aman: mana yang boleh diubah lebih dulu tanpa merusak apa pun, mana yang
      harus bersamaan, mana yang harus menunggu.

  5c. TIPOGRAFI — jawab dengan jujur, jangan buru-buru ke webfont:
      Fakta sekarang: font-family: system-ui di body; --font-heading: var(--font-sans)
      (yaitu alias dirinya sendiri, jadi judul tidak punya hierarki visual); tidak ada
      next/font dan tidak ada webfont di seluruh src/.
      Bandingkan dua pilihan, dan JAUH lebih seriously:
        Opsi 1 — tetap system-ui, perbaiki hierarki lewat ukuran, berat, jarak, dan
                  --font-heading yang benar-benar berbeda.
        Opsi 2 — menambah webfont lewat next/font.
      Untuk tiap opsi, sebutkan konsekuensi nyata: ukuran unduhan, cara teks Bahasa
      Indonesia ditampilkan, perilaku tanpa jaringan, dan apakah menambah aset berarti
      perubahan pada next.config.mjs atau CSP. Jangan menjanjikan bahwa CSP otomatis aman.

################################################################
6. YANG TIDAK BOLEH DISENTUH (memang TIDAK akan disentuh, karena read-only)
################################################################
  rules/00 dan rules/05    Jangan diubah. Anda hanya MEMBACA dan merekomendasikan.
  src/**                   Tidak boleh ditulis.
  tests/**                 Tidak boleh ditulis.
  migrations/**            Tidak boleh ditulis.

  tapi TIDAK BOLEH merekomendasikan pelonggaran:
    - Badge status absensi punya makna. Warna amber/hijau/merah di rules/05 §2 adalah
      SEMANTIK, bukan dekorasi. Jangan usulkan mengganti atau merapikannya jadi warna
      primer baru.
    - Aturan §1.3 (jangan pernah mengandalkan warna saja) tidak bisa dilonggarkan demi
      palet yang lebih cantik.
    - Aturan §2 (kontras memadai, fokus terlihat, target sentuh 44x44, font halaman
      karyawan minimal 16px) tidak bisa dilonggarkan.
    - K-24 (Bahasa Indonesia saja) tidak bisa dilonggarkan.
    - rules/05 §1.2 (admin desktop-first) tidak bisa dilonggarkan.
    - Jangan mengusulkan menurunkan ukuran teks di halaman karyawan dengan alasan "lebih rapi".
    - Jangan mengusulkan mengganti komponen shadcn yang sudah ada, dan jangandysentrusalkan
      install paket baru.

################################################################
7. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: UI-8 Fase A (audit tampilan — READ-ONLY)
Selesai: <tidak ada file. Tulis "tidak ada berkas yang diubah atau dibuat">
Versi: Node <node -v> / Next.js <versi terpasang>
Git bersih: <hasil git status --short dan git diff --stat di akhir>
Yang terkunci: <daftar aturan dari rules/00 dan rules/05 yang tidak boleh disentuh,
  beserta nomor pasal>
Yang bebas: <apa saja yang TIDAK diatur di dokumen>
Diagnosis: <kenapa tampilan sekarang terasa datar, dengan bukti nama variabel dan
  baris, bukan pendapat>
Opsi palet: <3-4 opsi, masing-masing dengan nilai oklch lengkap untuk terang dan gelap>
Kontras: <angka rasio per pasangan per opsi, plus daftar yang gagal ambang>
Tipografi: <perbandingan Opsi 1 dan Opsi 2 dengan konsekuensi nyata>
Peta token: <klasifikasi tiga lapis + temuan variabel yang dipakai dengan makna berbeda>
Urutan kerja: <urutan perubahan yang aman>
Rekomendasi: <opsi mana yang Anda sarankan dan kenapa — tapi ini hanya REKOMENDASI,
  pemilik yang memutuskan>
Yang TIDAK dikerjakan: <daftar perubahan yang sengaja tidak diusulkan karena mengunci
  aturan>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>

################################################################
8. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan implements apa pun, jangan menulis file,
jangan menjalankan npm run dev. Tunggu pemilik memutuskan dan menjawab "lanjut".
```

## C. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Milestone sebelumnya | M15 selesai 2026-10-14, 1032 tes hijau |
| md5 `migrations/0001_init.sql` | `466a7b1a5aa5b1ab0a88e0a5f63a8a98` |
| Prompt UI-6 dan UI-7 | Ada di `rules/23` dan `rules/24` — **tidak perlu dijalankan lebih dulu** untuk milestone ini |

## D. Yang sudah diverifikasi (jangan diulang)

| Hal | Sumber | Tanggal |
|---|---|---|
| `rules/00` (183 baris) tidak memuat satu pun keputusan warna/tema/tipografi | `grep -niE` | 2026-10-14 |
| Kolom Keputusan UI-1 di `AGENTS.md` berisi tanda `-` | `AGENTS.md:476` | 2026-10-14 |
| `--primary`, `--card`, `--sidebar`, `--accent`, `--border`, `--ring`, `--sidebar-primary` di mode terang semuanya kroma `0` | `globals.css:59-87` | 2026-10-14 |
| `font-family: system-ui` di body; `--font-heading: var(--font-sans)` | `globals.css:5`, `:13-14` | 2026-10-14 |
| Tidak ada `next/font` maupun webfont di `src/` | `grep -rn "next/font\|@import url" src/` → 0 | 2026-10-14 |
| Badge status sudah berwarna (amber/hijau/merah), ditambahkan untuk BUG-UI-07 | `globals.css:89-98`, `:137-142` | 2026-10-14 |
| Palet grafik kategorik sudah menimpa abu-abu bawaan, dengan komentar alasannya | `globals.css:156-174` | 2026-10-14 |
| `--sidebar-primary` terang abu-abu, gelap biru — **tidak konsisten** | `globals.css:82` vs `:127` | 2026-10-14 |
| `color-scheme` disetel untuk popup `<select>` dan scrollbar browser | `globals.css:176-185` | 2026-10-14 |
| Empat berkas tes menyapu warna literal | `grep -rln "rgb\|#[0-9a-f]\|oklch" tests/` | 2026-10-14 |
| Tidak ada komponen navigasi bawah di `src/components/ui/` | `grep -rln "BottomNav\|TabBar" src/` → 0 | 2026-10-14 |

## E. Peta UI-8 Fase A → spec → berkas

Milestone ini **tidak mengubah berkas apa pun**. Peta ini untuk menunjukkan keluaran ke mana
nantianya, kalau pemilik menyetujui.

| Bagian | Spec | Berkas tujuan (Fase C) | Status |
|---|---|---|---|
| Palet mode terang + gelap | `rules/05` §2 (kontras) | `src/app/globals.css` | hanya rekomendasi |
| `--sidebar-primary` tidak konsisten | — | `src/app/globals.css:82,127` | hanya rekomendasi |
| Peta token 3 lapis | — | `src/app/globals.css` | hanya pemetaan |
| Tipografi | `rules/05` §2 (≥16px karyawan) | `globals.css` + `next/font` bila disetujui | hanya rekomendasi |
| Aturan baru | — | `rules/00` (K berikutnya) | **Fase B, setelah pemilik memilih** |
| Pelebaran konvensi | `rules/05` §2 | `rules/05-ui-ux-rules.md` | **Fase B, setelah pemilik memilih** |

## F. Pemeriksaan silang

| Path | hanya di "wajib" | hanya di "dilarang" |
|---|---|---|
| — (tidak ada berkas yang boleh ditulis) | — | semua |

Tidak ada tumpang tindih. Milestone read-only tidak punya tabel bentrok.

## G. Batasan yang diketahui

| Batasan | Dampak |
|---|---|
| **Rasio kontras dihitung, bukan dilihat** | Angka yang kamu tulis adalah hitungan, dan bisa kamu cek ulang. Tapi rasio kontras **tidak** memperhitungkan layar==> exposure, pantulan, atau penglihatan di bawah matahari. Ambang 7:1 yang diminta adalah heuristik, bukan standar resmi. Sumbernya harus kamu sebut. |
| **Tidak ada browser** | Palet yang lolos hitungan belum tentu terlihat bagus. Sebelum----------
       Sebelum Fase C, pemilik WAJIB melihat hasilnya sendiri di mode terang dan gelap, di `/admin` dan di `/a/[token]`. |
| **Empat tes menyapu warna literal** | Kalau palet baru memakai format yang berbeda dari `oklch`, sapuan itu bisa gagal. Pola sweep harus dibaca dulu di Fase C, bukan ditebak. |
| **`text-xs` di kelas Badge, `text-sm` di kelas Card** | Kalau tipografi diubah, teks di dalam Badge/Card tanpa ukuran eksplisit bisa bergeser diam-diam. Harus disapu, bukan diasumsikan. |
| **`color-scheme` terpisah dari token** | `globals.css:176-185` mengatur skema warna browser untuk popup `<select>` dan scrollbar. Mengganti palet TIDAK boleh menghapus blok ini — kalau hilang, popup select selalu putih walau mode gelap aktif. |
| **Badge = semantik** | `rules/05` §2 mengunci warnanya. Palet baru harus menyatu dengan badge, bukan menimpanya. |
| **Mengubah `--sidebar-primary` pada mode gelap saja** | Saat ini terang dan gelap berbeda warna. Kalau hanya satu yang diubah, hasilnya justru terlihat seperti bug. Keduanya harus berpasangan. |

## H. Yang TIDAK termasuk UI-8 Fase A

- **Fase B** — menulis K baru ke `rules/00` dan merevisi `rules/05` §2. Butuh pemilik memilih opsi dulu
- **Fase C** — implementasi token, tes, dan bukti mutasi. Prompt-nya baru bisa dibuat setelah Fase B
- **Logo dan brand identity** — di luar lingkup, dan `@design` sengaja tidak dipakai supaya tidak masuk ke sini
- **Perombakan alur, layout, dan komponen** — itu Lapis 3 dan 4, milestone terpisah dengan risiko lebih tinggi
- **Navigasi bawah karyawan** — sudah ada promptnya di `rules/23`
- **Jadwal bergeser + toast admin** — sudah ada promptnya di `rules/24`
- **Checkout massal** — pemilik menunda; fitur baru yang butuh keputusan aturan bisnis
- **Paginasi, modal edit/tambah, perbaikan verifikasi** — milestone terpisah
- **jsdom / B-20** — masih ditunda pemilik