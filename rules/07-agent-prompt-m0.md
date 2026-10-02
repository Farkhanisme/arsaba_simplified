# 07 — Prompt Agent Milestone M0

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku**.

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan satu milestone dari proyek "Arsaba Management Center" — aplikasi
web internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda adalah MENERJEMAHKAN dokumen menjadi kode, bukan
mengarang keputusan. Kalau sesuatu tidak tertulis, Anda berhenti dan bertanya.

====================================================================
1. HALTE WAJIB — JANGAN MENULIS KODE SEBELUM INI SELESAI
====================================================================
Sebelum menulis satu baris kode pun, pastikan tiga hal di bawah ini sudah terjawab
dan tercatat di rules/00 bagian A. Semuanya SUDAH terjawab saat prompt ini dibuat:

  P1. Batas slot perubahan jadwal khusus satu hari = 2 slot PER KARYAWAN PER TANGGAL
      (bukan per toko). Tercatat di K-27.
  P2. Empat butir usulan teknis tambahan disetujui pemilik: tombol "Kembalikan ke shift
      standar" (BR-J6), ubah jadwal tanggal lampau diizinkan (BR-J8), definisi bentrok
      slot di BR-J7, dan seed password awal diganti saat login pertama (03 §14).
      Tercakup K-40.
  P3. Domain produksi = arsaba.vercel.app, dipakai sebagai nilai APP_ORIGIN.
      Tercatat di K-38.
  P4. Versi runtime dipatok: Next.js ^16.3.7 dan Node.js 24.x (K-41).
      Node 26 TIDAK boleh dipakai — tidak tersedia untuk builds/functions di Vercel.
      Tercatat di K-41 dan rules/03 §2.
  P5. Database uji = SQLite FILE LOKAL di data/uji.db (K-42). Bukan Turso remote,
      bukan :memory:. Tercatat di K-42 dan rules/07 bagian B2.
  P6. Node lokal WAJIB 24.x, sama dengan produksi (K-43). Ada .nvmrc berisi 24.
      Kalau `node -v` menunjukkan v26, BERHENTI — jangan lanjut dengan Node 26.

CARA MEMERIKSA: buka rules/00-decision-log.md bagian A dan pastikan K-27, K-38, K-40,
K-41, K-42, K-43 ada. Jika ada yang belum ada -> JANGAN menulis kode. Tulis pertanyaannya ke
rules/OPEN_QUESTIONS.md (ID B-13 seterusnya), tampilkan di chat, lalu BERHENTI.

SEBELUM MULAI, cek `node -v`. Harus v24.x.x. Kalau bukan, BERHENTI dan laporkan —
jangan memasang versi lain sendiri, dan jangan menaikkan versi Next.js sendiri.

====================================================================
2. BACA DOKUMEN INI DULU, DENGAN URUTAN INI
====================================================================
  AGENTS.md
  rules/00-decision-log.md      <- sumber kebenaran tertinggi
  rules/01-prd.md
  rules/02-system-spec.md
  rules/03-system-design.md
  rules/04-database-design.md
  rules/05-ui-ux-rules.md
  rules/06-agent-instructions.md

Jangan mulai menulis sebelum ketujuh file selesai dibaca. Jangan mengambil keputusan
berdasarkan ingatan atau asumsi tentang isi dokumen.

====================================================================
3. SCOPE MILESTONE M0 — HANYA INI
====================================================================
Versi yang WAJIB dipakai (K-41, sudah diverifikasi — lihat rules/NOTES.md §1–2):

  Node.js   24.x      BUKAN 26.x. Node 26 tidak tersedia untuk builds/functions di Vercel.
  Next.js   ^16.3.7   rentang 16.3.7, jangan naik ke major berikutnya tanpa persetujuan
  TypeScript ^5.1.0 atau lebih baru
  .nvmrc / .node-version  ->  24   (sudah ada, jangan diubah)

package.json wajib memuat:
  "engines": { "node": "24.x" }
Ini yang mengoverride Project Settings Vercel. Jangan menulis pin Node 26 di mana pun.

Jangan pakai API yang hanya ada di Node 26 (mis. Temporal API) — akan jalan di lokal tapi
crash di produksi karena Node 24 tidak memilikinya.

Yang dikerjakan:
  a. Proyek Next.js (App Router) + TypeScript strict + zod, dengan versi di atas.
  b. server/db.ts — klien @libsql/client dan helper transaksi.
  c. scripts/migrate + tabel schema_migrations — runner migrasi maju saja.
  d. migrations/0001_init.sql — DDL PERSIS seperti tertulis di rules/04 §2.
     Jangan menulis ulang, jangan menambah/mengurangi kolom. Salin apa adanya.
  e. server/waktu.ts + tesnya.

Database uji (K-42): SQLite file lokal di data/uji.db, bukan Turso remote.
  - .env.local: TURSO_DATABASE_URL=file:./data/uji.db, TURSO_AUTH_TOKEN= (kosong)
  - JANGAN pakai :memory: untuk tes integrasi — tiap koneksi dapat db kosong sendiri,
    schema dan PRAGMA foreign_keys hilang diam-diam, tes constraint bisa lulus palsu.
  - Hapus data/uji.db sebelum setiap run tes, jalankan migrasi, lalu hapus lagi.
  - data/ wajib masuk .gitignore.

Yang BELUM dikerjakan di M0 (untuk milestone berikutnya): login/sesi admin, peran,
data master, halaman /a/[token], Route Handler POST /api/absen, integrasi Telegram,
verifikasi, jadwal, dashboard, rekap, ekspor Excel, audit log UI.
Jangan membuat salah satu dari itu "sambil jalan".

====================================================================
4. LARANGAN KERAS
====================================================================
- TANPA ORM. Tidak boleh Prisma, Drizzle, atau Sequelize apa pun. SQL mentah
  berparameter dengan placeholder `?`. Dilarang menyambung string SQL dengan input pengguna.
- new Date() dan operasi waktu HANYA boleh muncul di server/waktu.ts. Di luar modul itu,
  ambil waktu lewat fungsi dari waktu.ts.
- PRAGMA foreign_keys = ON harus benar-benar aktif pada koneksi yang dipakai, dan
  hal ini harus dibuktikan oleh tes, bukan diasumsikan.
- audit_log tidak boleh pernah di-UPDATE atau di-DELETE, baik di kode maupun manual.
- Tabel/namespace memakai Bahasa Indonesia (rules/04 §1).
- Jangan membuat kolom, tabel, atau endpoint yang tidak tertulis di rules/.
- Jangan menebak batas platform (mis. ukuran file Telegram atau body Vercel) —
  verifikasi ke dokumentasi resmi, lihat bagian 6.
- Kalau ragu antara dua pembacaan dokumen, pilih pembacaan yang paling ketat, lalu
  catat di laporan. Jangan memilih pembacaan yang paling longgar demi negatif.

====================================================================
5. ISI server/waktu.ts (WAJIB ADA, LIHAT rules/03 §5)
====================================================================
  sekarangWIB()          waktu server dalam WIB
  tanggalWIB(instant)    -> 'YYYY-MM-DD'
  menitDalamHari(instant) -> menit 0..1439, detik HARUS diabaikan
  jenisHari(tanggal)     -> 'WEEKDAY' | 'WEEKEND'
  serialisasi ISO 8601 dengan offset +07:00

WIB = UTC+7 tanpa DST, jadi offset selalu +07:00. Karena semua waktu memakai offset yang
sama, perbandingan string ISO sama dengan perbandingan kronologis — andalkan itu.
Weekend = Sabtu dan Minggu (BR-T2).

====================================================================
6. VERIFIKASI KE DOKUMENTASI RESMI (jangan menulis detail API dari ingatan)
====================================================================
rules/NOTES.md §1 (Node/Vercel) dan §2 (Next.js) SUDAH terverifikasi — jangan diulang.

Yang BELUM terverifikasi dan menjadi tugas M0:
  - §3: dukungan trigger, partial index, dan PRAGMA foreign_keys pada libSQL/Turso.
    Ini WAJIB dibuktikan secara nyata di bagian 7, bukan diasumsikan.

PENTING soal §3: bukti di file SQLite lokal (K-42) BELUM cukup untuk Turso remote.
`file:` memakai SQLite embedded, Turso memakai libSQL lewat HTTP; perilaku batch,
transaksi, dan sebagian PRAGMA bisa berbeda. Tulis hasil verifikasi lokal apa adanya di
NOTES.md §3, dan tulis eksplisit bahwa verifikasi ulang di Turso remote masih WAJIB
sebelum M3.

Yang belum terverifikasi tapi BOLEH ditunda (wajib sebelum M3):
  - §5 Telegram Bot API, §6 batas body request Vercel.

Perilaku libSQL di serverless (§4): catat temuan baru di rules/NOTES.md
dengan URL sumbernya. Jangan menulis detail API dari ingatan.

====================================================================
7. KRITERIA M0 SELESAI
====================================================================
Milestone dianggap selesai HANYA bila SEMUA ini benar:
  [ ] npm run build (atau perintah build yang Anda pilih) dan typecheck lulus.
  [ ] package.json memuat "engines": { "node": "24.x" }, dan versi Node lokal
      benar-benar 24.x (buktikan dengan `node -v`). .nvmrc tidak berubah isinya (harus 24).
  [ ] Tidak ada kode yang memakai API khusus Node 26 (mis. Temporal) — grep dan pastikan.
  [ ] data/ ada di .gitignore dan TIDAK ikut ter-commit.
  [ ] Migrasi 0001_init.sql berhasil dijalankan pada database uji SQLite lokal.
  [ ] TES HARUS LULUS DI DUA TIMEZONE (K-44). Jalankan seluruh tes minimal dua kali:
        TZ=UTC        npx vitest run     <-- lingkungan produksi Vercel
        TZ=Asia/Jakarta npx vitest run   <-- lingkungan mesin devs
      Semua harus lulus di KEDUA-nya. Wajib, bukan opsional: bug di B-13 lolos karena tes
      hanya dijalankan pada satu timezone. Kalau Anda hanya menjalankan `npm test` tanpa
      TZ eksplisit, kriteria ini BELUM terpenuhi.
  [ ] src/server/waktu.ts TIDAK bergantung pada timezone mesin. Semua operasi tanggal/jam
      dilakukan dalam offset tetap +07:00. Lihat B-13 di rules/OPEN_QUESTIONS.md.
  [ ] Tes waktu lulus di kedua timezone: konversi WIB, klasifikasi weekend vs weekday,
      batas menit (detik diabaikan, midnight, 23:59:59), dan kasus lintas hari WIB
      (instant UTC yang jatuh ke tanggal WIB berikutnya).
  [ ] Constraint terverifikasi oleh tes nyata, bukan asumsi (CATATAN: ini bukti lokal,
      belum bukti Turso remote — lihat bagian 6):
        - PRAGMA foreign_keys = ON benar-benar menolak insert violate FK
        - partial index bekerja: uq_link_aktif, uq_penempatan_terbuka,
          uq_checkout_aktif_per_checkin
        - trigger bekerja: audit_log_tolak_update dan audit_log_tolak_delete
          benar-benar menolak
  [ ] Tes integrasi memakai file, bukan :memory: — buktikan dengan menghapus data/uji.db
      lalu menggagalkan tes constraint yang harus gagal.
  [ ] npm run build, npm run typecheck, dan npm test lulus.
  [ ] Tidak ada console.log yang memuat data sensitif.

Hasil verifikasi §3 (trigger/partial index/FK di libSQL) diisi di rules/NOTES.md §3 beserta
URL sumber dokumentasinya.

Package manager dan test runner bebas Anda pilih (npm / pnpm, node:test / vitest) karena
tidak diatur di rules/ — tapi JANGAN mengubah aturan bisnis demi kenyamanan tooling, dan
catat pilihan Anda beserta alasannya di laporan.

====================================================================
8. CARA KERJA
====================================================================
  1. Baca ketujuh dokumen (bagian 2).
  2. Tulis rencana singkat singkat apa yang akan dibuat.
  3. Implementasikan. Tests ditulis SEBAIL-BERSAMA kode, bukan menyusul.
  4. Jalankan build, typecheck, dan test. Laporkan output aslinya, bukan ringkasan.
  5. Tulis laporan (bagian 9).

====================================================================
9. LAPORAN — WAJIB, PERSIS FORMAT INI
====================================================================
Milestone: M0
Selesai: <daftar file/fungsi yang dibuat>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus/gagal, jumlah>
Constraint terverifikasi: <FK / partial index / trigger, masing-masing hasil nyata>
Verifikasi dokumentasi eksternal: <apa, sumber> (di NOTES.md §3 — tandai jelas mana
  yang sudah terbukti di SQLite LOKAL dan mana yang masih WAJIB diulang di Turso remote)>
Keputusan teknis yang Anda ambil: <package manager, test runner, alasan>
Pertanyaan baru: <tidak ada, atau ID di OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

====================================================================
10. BERHENTI
====================================================================
Setelah menulis laporan, BERHENTI. Jangan memulai M1 atau milestone berikutnya
walau terlihat mudah. Tunggu pemilik menjawab "lanjut".
```

## B. Persiapan lingkungan

Prasyarat ini dicek **sebelum** prompt bagian A dikirim. Kalau belum siap, siapkan dulu —
jangan biarkan agent menebak.

### B1. Checklist prasyarat

| Prasyarat | Cara memastikan | Kalau belum siap |
|---|---|---|
| Node.js `24.x` aktif | `node -v` → `v24.x.x` | Hentikan. **Jangan** suruh agent memasang versi lain. Vercel hanya menyediakan 24/22/20 (K-41) |
| Versi nvm terpetakan | di folder repo: `nvm use` membaca `.nvmrc` (isi `24`) | Kalau belum terpasang: `nvm install 24 && nvm use 24` |
| Folder `rules/` terbaca | Agent membuka `rules/00-decision-log.md` | Kalau tidak bisa, pakai blok A langsung, bukan trigger pendek |
| Folder `data/` siap | `mkdir -p data` | Agent boleh membuatnya, tapi isi `data/` masuk `.gitignore` |
| Node modules belum ada | — | Normal. `npm install` adalah bagian dari M0 |

> **Node 26 dilarang di repo ini (K-43).** Mesin pengembang boleh punya Node 26, tapi di folder
> ini versinya harus `24.x`. Alasannya bukan sekadar formalitas: Node 26 mengaktifkan **Temporal
> API** by default yang **tidak ada** di Node 24. Kode yang memakainya akan jalan di lokal lalu
> crash di produksi tanpa peringatan. Karena itu `engines` ditulis tegas `24.x`, bukan `">=24"` —
> dengan parity, kuotasi ketat tidak menimbulkan masalah tapi menjadi pagar yang menolak install
> dengan versi salah.

### B2. Database uji — lokal dulu (K-42)

M0 memakai **SQLite file lokal**, bukan Turso remote:

```
data/uji.db          # database uji, MASUK .gitignore
```

`.env.local` (jangan di-commit):

```
TURSO_DATABASE_URL=file:./data/uji.db
TURSO_AUTH_TOKEN=   # kosong dulu, tidak dipakai pada mode file lokal
```

Turso remote diisi belakangan. Selama masih lokal, **tidak ada** `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, atau kredensial lain yang perlu disiapkan — itu baru dibutuhkan M3.

**Dua aturan yang wajib dijaga soal tes (K-42):**

1. **Jangan pakai `:memory:` untuk tes integrasi.** Klien `@libsql/client` dapat membuka lebih
   dari satu koneksi, dan tiap koneksi ke `:memory:` mendapat database kosong sendiri. Akibatnya
   schema dan `PRAGMA foreign_keys = ON` hilang tanpa error, dan tes constraint bisa **lulus
   palsu**. Pakai file sementara: hapus `data/uji.db` sebelum setiap run tes, buat ulang lewat
   migrasi, lalu hapus lagi setelah selesai.

2. **Lokal bukan Turso.** `file:` memakai SQLite embedded; Turso memakai libSQL lewat HTTP.
   Pemanggilan `batch`, transaksi, dan beberapa perilaku PRAGMA bisa berbeda. Hasil verifikasi
   M0 di file lokal **belum cukup** — wajib diulang setelah Turso remote aktif, sebelum M3.

### B3. Perintah yang diharapkan ada setelah M0

```
npm run migrate    # menjalankan migrations/*.sql, mencatat ke schema_migrations
npm test           # tes unit server/waktu.ts + tes integrasi di data/uji.db
npm run build      # build produksi
npm run typecheck  # tsc --noEmit
```

## C. Cara memakai

**Opsi 1 — pakai blok A (paling deterministik).**
Salin seluruh blok dari bagian A, paste sebagai pesan pertama di sesi agent baru.

**Opsi 2 — trigger pendek (hanya kalau agent pasti membuka file).**

```text
Baca rules/07-agent-prompt-m0.md bagian A, lalu kerjakan milestone M0 sesuai prompt itu.

Baca rules/00-decision-log.md bagian A lebih dulu. Jangan menulis kode sebelum
K-27, K-38, K-40, K-41, K-42, dan K-43 terkonfirmasi ada.
Cek `node -v` harus v24.x.x sebelum mulai (K-43).

Satu milestone saja. Setelah selesai, tulis laporan format bagian 9 lalu BERHENTI.

Kalau file rules/ tidak bisa dibaca, BERHENTI dan minta isinya. Jangan mengarang
konteks milestone dari ingatan.
```

Opsi 2 hanya aman bila agent benar-benar membuka filenya — itu sebabnya kalimat terakhir.
Kalau ragu, pakai opsi 1.

**Setelah laporan M0 keluar:** balas **"lanjut"** untuk menjalankan M1. Tapi **prompt ini hanya
untuk M0**; M1 butuh `rules/08-agent-prompt-m1.md` yang ruang lingkupnya disesuaikan dengan
tabel M0–M9 di `rules/06` §3.

## D. Catatan pemeliharaan

Prompt ini harus diperbarui bila salah satu hal berikut berubah:

| Perubahan | Yang harus diedit di bagian A |
|---|---|
| Keputusan M0 berubah (waktu, sesi, domain, DDL) | Bagian 1 (halte) dan bagian 5 |
| Versi runtime berubah | Bagian 1 (P4) dan bagian 3 |
| Database uji berubah (mis. Turso remote aktif) | Bagian 6, plus K-42 di `rules/00` |
| `rules/04` §2 berubah | Bagian 3d |
| `rules/03` §15 berubah | Bagian 6 |
| Kriteria selesai M0 berubah di `rules/06` §3 | Bagian 7 |
| Milestone selesai | Buat `rules/08-agent-prompt-m1.md` dst., jangan diedit ulang file ini |
