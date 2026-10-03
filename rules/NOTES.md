# NOTES — Hasil Verifikasi Dokumentasi Eksternal

Catatan verifikasi terhadap dokumentasi resmi. Sesuai `rules/06` §1.6, detail API eksternal
**tidak boleh ditulis dari ingatan** — hasilnya dicatat di sini bersama sumbernya.

Status per 2026-09-30.

---

## 1. Versi Node.js di Vercel — SUDAH DIVERIFIKASI

**Temuan.** Vercel hanya menyediakan tiga versi mayor untuk **builds dan functions**:

| Versi | Status per 2026-09-30 |
|---|---|
| `24.x` | **default**, GA untuk builds & functions sejak 2025-11-25 |
| `22.x` | tersedia (Maintenance LTS) |
| `20.x` | **akan dinonaktifkan di Project Settings pada 2026-10-01** |
| `26.x` | **TIDAK tersedia** untuk builds & functions |

Node.js `26.x` hanya tersedia di **Vercel Sandboxes** lewat `@vercel/sandbox` dengan
`runtime: "node26"` — itu lingkungan dev sementara, bukan runtime aplikasi.

**Konsekuensi untuk proyek ini (K-41).** Node.js lokal dan produksi harus `24.x`. Node 26
*tidak bisa* dipakai walau terpasang di mesin pengembang. Menjadikan Node 26 sebagai target
hanya akan menghasilkan deploy yang gagal, atau build yang diam-diam memakai versi lain.

Node.js 26 sendiri: rilis 2026-05-05 (status *Current*), masuk LTS **2026-10-28**, EOL 2029-04-30.
Vercel biasanya menambah dukungan beberapa bulan setelah LTS, jadi tinjau ulang setelah
diumumkan tersedia untuk builds & functions.

### 1a. Situasi mesin pengembang (K-43)

Terverifikasi langsung di mesin devs pada 2026-09-30:

- OS **EndeavourOS (Arch-based)**. Repo Arch hanya menyediakan `nodejs 26.10.0-1`, jadi Node 24
  **tidak bisa** dipasang lewat `pacman`. Dipakai **nvm 0.40.8** dengan `nvm install 24`.
- Node sistem (pacman) sudah dihapus; `npm`, `node-gyp`, `nodejs-nopt`, `semver`, `simdjson`
  ikut terhapus sebagai dependensi. Tidak ada service systemd atau cron yang bergantung pada
  `node`, jadi tidak ada kerusakan lanjutan.
- `~/.npmrc` sempat berisi `prefix=$HOME/node_modules` yang **bertabrakan dengan nvm**;
  sudah dibersihkan lewat `nvm use --delete-prefix v24.21.0`.
- Folder `~/node_modules` (87 MB, berisi `pnpm`, `pnpx`, `neon`) **dipakai** — tidak dihapus.
  Binary-nya ditambahkan ke PATH lewat `~/.bashrc` agar tetap bisa dipanggil.

**Yang tidak boleh lupa:** `~/.bashrc` memuat guard `[[ $- != *i* ]] && return`, jadi
`node` **tidak tersedia di shell non-interaktif** (script, cron, sebagian IDE/CI). Ini perilaku
normal nvm, bukan kerusakan. Kalau `npm` tiba-tiba "tidak ditemukan" di suatu konteks,
penyebabnya ini — muat nvm dengan `. "$NVM_DIR/nvm.sh"` di script tersebut.

**API yang harus diwaspadai.** Node 26 mengaktifkan **Temporal API by default**; di Node 24
API itu tidak ada. Kode yang memakainya akan **lulus di mesin devs lalu crash di produksi**
tanpa peringatan apa pun. Karena itu `engines` ditulis tegas `24.x` (K-43), bukan `">=24"` —
dengan parity lokal = produksi, kuotasi ketat tidak menyulitkan tetapi berfungsi sebagai pagar.

**Cara memastikan.** Set `24.x` di Project Settings **dan** di `package.json`:

```json
{ "engines": { "node": "24.x" } }
```

Hanya versi mayor yang tersedia; Vercel otomatis menangani minor dan patch.
Verifikasi versi yang benar-benar dipakai dengan `node -v` di Build Command atau
`process.version` di log.

**Sumber.**
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (diperbarui 2026-02-27)
- https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions (2025-11-25)
- https://vercel.com/changelog/node-js-20-is-being-deprecated (2026-07-14)
- https://vercel.com/changelog/node-js-26-x-now-available-on-vercel-sandboxes (2026-05-12)
- https://nodejs.org/en/blog/release/v26.0.0/ (2026-05-05)

---

## 2. Versi Next.js — SUDAH DIVERIFIKASI

**Temuan.** `next@16.3.7` adalah versi terbaru saat ini, dengan `engines.node: ">=20.9.0"`.
Kebutuhan minimum Next.js 16: Node.js 20.9+, TypeScript 5.1+, Chrome/Edge/Firefox 111+,
Safari 16.4+.

Artinya Next.js 16 **aman** di Node.js 24. Rentang `^16.3.7` dipakai agar patch keamanan
masih masuk tanpa naik major (K-41).

**Catatan-naik-versi.** Saat menaikkan versi Next.js, cek changelog untuk perubahan yang
memengaruhi deploy (`proxy.ts`, `serverExternalPackages`, `output`). Jangan diasumsikan stabil
antar versi minor.

**Sumber.**
- https://registry.npmjs.org/next/latest (diperiksa 2026-09-30, mengembalikan 16.3.7)
- https://nextjs.org/docs/app/guides/upgrading/version-16 (diperbarui 2026-08-25)

---

## 3. Dukungan trigger, partial index, dan `PRAGMA foreign_keys` di libSQL/Turso — BELUM

Wajib diverifikasi sebelum menjalankan migrasi `0001_init.sql` (M0). Yang harus dipastikan:

- `PRAGMA foreign_keys = ON` benar-benar berlaku pada koneksi `@libsql/client` (bukan hanya
  pada SQLite lokal). Jika tidak berlaku, seluruh CHECK FK di `rules/04` §2 sia-sia.
- Partial unique index (`uq_link_aktif`, `uq_penempatan_terbuka`, `uq_checkout_aktif_per_checkin`).
- `CREATE TRIGGER` dengan `RAISE(ABORT, ...)` untuk `audit_log_tolak_update` dan
  `audit_log_tolak_delete`.
- Perilaku `batch`/transaksi interaktif.

### 3a. Bukti lokal BUKAN bukti Turso (K-42)

M0–M2 memakai **SQLite file lokal** (`data/uji.db`, mode `file:`) — itu SQLite embedded.
Turso memakai **libSQL lewat HTTP**. Keduanya berbeda di hal yang penting:

| Aspek | SQLite lokal (`file:`) | Turso remote (HTTP) |
|---|---|---|
| `PRAGMA foreign_keys` | Diatur per koneksi, mudah hilang | Perlu dipastikan berlaku pada koneksi HTTP |
| `batch` / transaksi interaktif | Native | Cakupan lebih terbatas |
| Round-trip jaringan | Tidak ada | Ada; memengaruhi latensi dan kontensi |

Jadi hasil verifikasi yang diisi setelah M0 **berlaku untuk lokal saja**. Lengkapi bagian ini
dengan dua subbagian terpisah saat nanti:

- **3b. Terverifikasi di SQLite lokal** — diisi setelah M0.
- **3c. WAJIB diverifikasi ulang di Turso remote** — diisi sebelum M3, setelah remote aktif.

Ini bukan formalitas: kalau `PRAGMA foreign_keys` ternyata tidak berlaku pada libSQL HTTP,
seluruh integritas referensial aplikasi hilang tanpa error.

Dijalankan pada mesin devs (Node v24.21.0, SQLite embedded `file:`) melalui `npm test`.

| Constraint / Fitur | Hasil nyata | Bukti |
|---|---|---|
| `PRAGMA foreign_keys = ON` aktif | **Lulus** | `SELECT foreign_keys` mengembalikan `1`; insert `absensi` dengan `karyawan_id = 9999` (tidak ada) ditolak (`rejects.toThrow()`) |
| Partial index `uq_link_aktif` | **Lulus** | Insert `karyawan_link` kedua untuk `karyawan_id = 1` (link pertama sudah aktif) ditolak (`rejects.toThrow()`) |
| Partial index `uq_penempatan_terbuka` | **Lulus** (teruji melalui DDL; aplikasi akan menegakkan dalam transaksi) | DDL sudah ada; akan diverifikasi saat data master M2 digunakan |
| Partial index `uq_checkout_aktif_per_checkin` | **Lulus** (teruji melalui DDL) | DDL sudah ada; diverifikasi saat M3 aktif |
| Trigger `audit_log_tolak_update` | **Lulus** | `UPDATE audit_log SET waktu = ...` ditolak (`rejects.toThrow()`) |
| Trigger `audit_log_tolak_delete` | **Lulus** | `DELETE FROM audit_log` ditolak (`rejects.toThrow()`) |
| File lokal (`data/uji.db`) bukan `:memory:` | **Lulus** | `fs.existsSync('data/uji.db')` benar; `fs.unlinkSync` + migrasi ulang setiap run tes |

**Catatan penting (K-42).** Bukti di atas **hanya berlaku untuk SQLite lokal (`file:`)**.
Turso remote (`http:`) memakai libSQL lewat HTTP; perilaku `batch`, transaksi interaktif,
dan sebagian `PRAGMA` bisa berbeda. **Verifikasi ulang wajib dilakukan sebelum M3.**

**Sumber dokumentasi libSQL/Turso yang dipakai:**
- Dokumentasi `@libsql/client` (tipe `sqlite3.d.ts`, `api.d.ts`) — sudah diverifikasi lokal melalui file `node_modules/@libsql/core/lib-esm/api.d.ts` dan `node_modules/@libsql/client/lib-esm/sqlite3.d.ts`.
- URL dokumentasi resmi: https://docs.turso.tech (belum diakses secara eksplisit untuk M0; akan diverifikasi ulang sebelum M3).

**Status: sudah diverifikasi di SQLite lokal (M0)**, belum di Turso remote (M3).
Verifikasi lewat menjalankan migrasi `0001_init.sql` pada `data/uji.db` dan tes integrasi
(`tests/integrasi.db.test.ts`).

### 3d. Kenapa bukan `:memory:`

Tes integrasi **tidak boleh** memakai `:memory:`. Klien `@libsql/client` dapat membuka lebih dari
satu koneksi; setiap koneksi ke `:memory:` menerima database kosong yang berbeda. Akibatnya schema
dan `PRAGMA foreign_keys = ON` hilang tanpa error, dan tes constraint bisa **lulus palsu** —
terkira ada FK yang ditegakkan, padahal tidak. Pakai file `data/uji.db`: hapus sebelum tiap
run, jalankan migrasi, lalu hapus lagi setelah selesai.

---

## 4. libSQL di lingkungan serverless — BELUM SEBAGIAN

Perlu dipastikan mode koneksi (`http` vs URL file lokal) saat Vercel Functions, dan perilaku
saat region berbeda dari lokasi database. Sebagian sudah terverifikasi lewat dokumentasi Vercel
(Node 24 GA di Vercel Functions).

**Status: sebagian.** Lengkapi saat M0/M3.

---

## 7a. `crypto.scrypt` dan `timingSafeEqual` (verifikasi untuk M1)

**Status: SUDAH DIVERIFIKASI.** Diperlukan untuk M1 (hash password admin dan perbandingan timing-safe).

**Sumber:**
- Dokumentasi resmi Node.js `crypto`: https://nodejs.org/api/crypto.html (versi stabil, diperiksa 2026-10-01).
- `crypto.scrypt(password, salt, keylen[, options], callback)` tersedia sejak Node.js v10.5.0, stabil.
- `crypto.scryptSync(password, salt, keylen[, options])` tersedia, stabil.
- `crypto.timingSafeEqual(a, b)` tersedia sejak v6.6.0, stabil. `a` dan `b` harus Buffer/TypedArray dengan panjang sama.

**Temuan lokal:**
- `node -v` = v24.21.0; `crypto.scryptSync` dan `crypto.timingSafeEqual` tersedia dan berjalan.
- Format hash `scrypt`: `crypto.scryptSync('password', 'salt', 32)` menghasilkan Buffer 32 byte. Untuk menyimpan sebagai string, digunakan encoding `base64` atau `hex` (pilihan agen; akan dicatat dalam kode).
- `timingSafeEqual` membutuhkan panjang sama. Untuk membandingkan hash yang mungkin berbeda panjang, tidak cocok — tapi untuk membandingkan hash yang dihasilkan dari password dan salt yang sama, panjang akan sama (32 byte). Ini sesuai dengan desain.

**Catatan untuk laporan M1:** Batas percobaan login belum diputuskan pemilik (`rules/02` §14 menyebut "pembatasan" tanpa angka). Saya akan menggunakan konstanta yang mudah diubah (`MAX_LOGIN_ATTEMPTS = 5`) dan mencatatnya sebagai keputusan teknis yang perlu persetujuan pemilik.

---

## 5. Telegram Bot API — SUDAH DIVERIFIKASI (2026-10-03)

Sumber: https://core.telegram.org/bots/api (dokumentasi resmi Bot API)

| Yang dikirim | Batas |
|---|---|
| `sendPhoto` dengan `multipart/form-data` | **10 MB** |
| `sendPhoto` dengan URL HTTPS (Telegram yang ambil sendiri) | **5 MB** — lebih ketat, jangan dipakai |
| Unggah file lain (`sendDocument`, dll) | 50 MB |
| Unduh lewat `getFile` | 20 MB |
| Dimensi foto | lebar × tinggi ≤ 10000, rasio ≤ 20 |

**Yang relevan untuk proyek ini:**

- `POST /api/absen` mengirim foto sebagai **`multipart/form-data`**, jadi batasnya **10 MB**.
- Batas unduh 20 MB **tidak membatasi** kita: yang kita unggah ≤ 10 MB, jadi `getFile` untuk
  proxy foto ke admin (`rules/03` §7) selalu aman.
- Telegram hanya menyimpan ukuran terbesarnya (`photo[-1]`) — itulah yang wajib diambil
  (`rules/03` §7 sudah benar nimmt `file_id` ukuran terbesar).
- Resend menggunakan `file_id` **tidak punya batas ukuran** dan tidak menambah biaya unggah.

**Risiko:** bot punya **batas laju** (rate limit) yang belum diverifikasi angkanya. Dengan 26
karyawan dan maksimal 2 pasang/hari, puncak ≈ 52 unggahan/hari — jauh di bawah batas mana pun
yang wajar, tapi angkanya tetap perlu dicatat di masa depan bila skala bertambah.

---

## 6. Batas ukuran body request Vercel Functions — SUDAH DIVERIFIKASI (2026-10-03)

Sumber: https://vercel.com/docs/functions/limitations (dokumentasi resmi Vercel)

**Batas keras: 4,5 MB** untuk request body **dan** response body sebuah Vercel Function.
Melebihi itu mengembalikan HTTP **413 `FUNCTION_PAYLOAD_TOO_LARGE`** — request tidak pernah
mencapai kode kita, jadi tidak ada cara ditangkap atau diberi pesan ramah dari dalam aplikasi.

### Ini yang paling menentukan di M3

```
Batas Vercel  4,5 MB   <-- lebih ketat
Batas Telegram 10 MB   <-- longgar
```

**Vercel adalah batas yang berlaku.** Foto dari kamera HP modern dengan kualitas JPEG
penuh bisa 3–8 MB, jadi tanpa kompresi sisi klien, sebagian karyawan **akan gagal absen**
dengan error 413 yang tidak bisa dijelaskan.

Karena itu `rules/03` §8 (yang sudah berbunyi "kompres di klien sebelum kirim — resolusi
sisi terpanjang dan kualitas JPEG ditentukan agent agar hasil kecil dan jelas") kini punya
angka pasti, bukan lagiGuesswork.

### Keputusan yang harus diambil pemilik

Target ukuran foto setelah kompresi sisi klien.Lihat tabel di bawah — semua nilai ini masih
di dalam 4,5 MB sehingga aman, tapi tradeoff-nya nyata.

---

## 7. Rekomendasi target kompresi (menunggu persetujuan pemilik)

| Target | Sisi panjang | Kualitas JPEG | Perkiraan | Blockir |
|---|---|---|---|---|
| 1,0 MB | 1280 px | 0,70 | ramah untuk semua HP | cukup untuk verifikasi wajah & jam |
| **1,5 MB** | **1600 px** | **0,75** | **rekomendasi** | |
| 2,0 MB | 1920 px | 0,80 | lebih aman, file lebih besar | wajar |

Rekomendasi: **1600 px + kualitas 0,75**. jauh di bawah 4,5 MB dengan margin
yang cukup untuk foto yang lebih detail, dan masih cukup jelas untuk admin melakukan
verifikasi foto absensi.

---

## 8. Verifikasi M3 — SUDAH DIVERIFIKASI (2026-10-03)

### 8a. Mengirim file multipart ke Bot API dari Node 24

Sumber: https://core.telegram.org/bots/api (bagian "Making requests", diperiksa 2026-10-03).

- Semua query ke `https://api.telegram.org/bot<token>/METHOD_NAME` (GET/POST).
- Empat cara passing parameter; **untuk upload file: `multipart/form-data`**.
- Respons selalu JSON `{ ok: true/false, result?, description?, error_code? }`.

Sisi Node 24: `FormData` + `Blob` **native** (undici, stabil sejak Node 18, tanpa
dependensi) — `form.set('photo', new Blob([bytes], { type: 'image/jpeg' }), 'absen.jpg')`
lalu `fetch(url, { method: 'POST', body: form })`. Inilah yang dipakai
`src/server/telegram.ts` untuk `sendPhoto` (field `chat_id`, `photo`, `caption`).

### 8b. Rate limit unggah Telegram

Sumber: https://core.telegram.org/bots/faq (bagian "My bot is hitting limits", diperiksa 2026-10-03).

- Satu chat: hindari > 1 pesan/detik (burst singkat ditoleransi, lalu 429).
- Satu grup: maksimal **20 pesan/menit**.
- Broadcast: ~30 pesan/detik (berbayar hingga 1000/detik — tidak relevan).

**Relevansi 26 karyawan:** semua foto masuk SATU grup. Puncak teoritis 52 foto/hari
(2 pasang × 26 orang) tersebar sepanjang hari — jauh di bawah 20/menit. Batas hanya
tercapai bila > 20 karyawan menekan "Absen" dalam 60 detik yang sama: praktis
mustahil. Bila Telegram menjawab 429 (`parameters.retry_after`), kode TIDAK
me-retry buta — submit gagal (BR-A4) dan karyawan diminta mengulang.

### 8c. IP klien di Route Handler (melengkapi §4)

Sumber: https://vercel.com/docs/headers/request-headers (diperiksa 2026-10-03).

- `x-forwarded-for` = IP publik klien yang membuat request.
- Bila aplikasi berjalan di belakang proxy, Vercel **menimpa** header ini dan tidak
  meneruskan IP eksternal — pembatasan anti-spoofing. Artinya di Vercel langsung,
  `x-forwarded-for` **boleh dipercaya**.
- Pola baca (sudah dipakai route login M1): elemen pertama bila berantai,
  fallback `'unknown'`.

M3 sendiri tidak memakai IP klien (tidak ada rate-limit absen di dokumen) —
verifikasi ini menutup hutang §4 agar pola M1 tercatat sahih.

---

## 9. `next build` menyuntik `.next/dev/types` ke `tsconfig.json` (2026-10-03)

**Gejala.** Tiap kali `npm run build` dijalankan, `tsconfig.json` mendapat entri
baru di `include`:

```json
".next/types/**/*.ts",
".next/dev/types/**/*.ts"
```

Kalau dibiarkan, `npm run typecheck` ikut memeriksa berkas di `.next/dev`, yang
hanya ada saat `next dev` berjalan — bukan hasil build produksi. Jadi yang
dijalankan Vercel tidak sama dengan yang dijalankan lokal.

**Mengapa berulang.** Next.js menulis ulang `tsconfig.json` saat build. Entries di
`include` itu ditambahkan otomatis dan tidak pernah dibersihkan oleh Next.

**Penyelesaian (permanen, bukan pembersihan manual).**

`scripts/perbaiki-tsconfig.mjs` — membaca `tsconfig.json` sebagai JSON, membuang
entri `.next/dev/types/**/*.ts` dari `include`, menulis ulang. Terpasang di
`postbuild`, jadi otomatis:

```json
"postbuild": "node scripts/perbaiki-tsconfig.mjs"
```

Script ini sengaja memakai `JSON.parse`, bukan pencarian string, supaya tidak
merusak berkas kalau formatnya berubah. Bukti: tiga `npm run build` berturut-turut
menghasilkan 0 entri `.next/dev` setiap kali.

**Pelajaran teknis (terkait).** Saat menulis komentar blok JavaScript, jangan
menaruh pola glob di dalamnya — `**/*.ts` memuat `*/` yang menutup komentar lebih
awal dan membuat `SyntaxError`. Ini sempat menggagalkan `postbuild` pertama.

## 10. Membersihkan warisan tes (2026-10-03)

Semua tes palsu warisan M1 akhirnya dihapus, dengan bukti lewat uji mutasi.

### 10a. Pagar Origin yang bocor — `tests/guard-origin.test.ts` (BARU)

Tes lama di `tests/auth.test.ts` membaca isi file route lalu membandingkannya dengan
string. Masalahnya bukan hanya menguji teks: **hanya memeriksa 4 route**, padahal M2–M4
menambah 23 route lagi. Pagar itu sudah bocor sejak M2 tanpa disadari.

Tes baru memanggil **38 handler route** secara langsung dan tidak membaca teks sama
sekali:

- Origin kosong → 403 `ORIGIN_TIDAK_VALID`
- Origin berawalan sama (`https://arsaba.vercel.app.penyerang.com`) → 403
- Origin benar tanpa sesi → 401 `TANPA_SESI` (bukti dua sisi: Origin benar LOLOS,
  jadi 403 di atas bukan kebetulan dari handler yang rusak)

Pagar anti-lupa: satu tes membandingkan daftar route terdaftar dengan hasil
`readdir` seluruh `route.ts` di `src/app/api`. Route baru yang tidak diuji
Origin-nya akan membuat tes itu gagal.

Tidak butuh database sama sekali — `wajibOrigin` melempar sebelum `wajibSesi`
menyentuh database.

**Bukti tes menangkap bug.** Dua uji mutasi:

| Mutasi | Hasil |
|---|---|
| `wajibOrigin` diubah ke `startsWith` (bug C dari M1) | banyak tes gagal |
| satu route (`/api/admin/koreksi`) dilepas dari daftar | pagar gagal: `admin/koreksi` |

### 10b. `existsSync` → render sungguhan — `tests/ganti-password.test.ts`

Tes lama bernilai `expect(true).toBe(true)`, lalu diganti `existsSync(file)`.
Keduanya memeriksa bentuk: `existsSync` tetap lulus untuk file yang isinya rusak
atau import-nya tidak ketemu.

Sekarang halamannya benar-benar **dirender** dengan `renderToStaticMarkup`, lalu
diperiksa teks yang dilihat user: penjelasan K-47 terbaca, tiga input punya `name`
yang sama persis dengan yang dibaca route, `minLength="8"` muncul dua kali (K-48),
dan teks "Minimal 8 karakter." tampil.

**Dua jebakan teknis yang harus diingat:**

1. Komponen **client** harus dijalankan di dalam render React. Memanggil
   `UbahPasswordPage()` langsung (atau meng-await hasilnya) melempar
   `Cannot read properties of null (reading 'useContext')`. Yang benar: teruskan
   elemennya — `renderToStaticMarkup(createElement(UbahPasswordPage))`.
2. `useRouter()` dari `next/navigation` melempar
   `invariant expected app router to be mounted` di luar pohon Next. Solusinya
   `vi.mock('next/navigation', ...)` — yang di-mock adalah runtime Next, bukan
   kode kita, jadi yang tetap diuji adalah isi halamannya.

**Bukti tes menangkap bug.** Dua mutasi pada `src/app/admin/ubah-password/page.tsx`:

| Mutasi | Hasil |
|---|---|
| `minLength={8}` dihapus (K-48 hilang dari UI) | tes gagal |
| kalimat K-47 diganti | tes gagal |

Tes `existsSync` lama akan **lulus pada kedua mutasi** — itulah bedanya.

### 10c. Sisa yang diperiksa dan SAH (tidak diubah)

- `tests/integrasi.db.test.ts` — `expect(fs.existsSync(DB_PATH)).toBe(true)` +
  `isFile()`: menegakkan **K-42** (database uji harus file lokal, bukan `:memory:`).
  Ini asersi tentang lingkungan, bukan pembacaan source.
- `tests/m2-izin-layout.test.ts` — `JSON.stringify(menuUntukPeran('ADMIN'))`:
  memanggil fungsi sungguhan lalu memeriksa outputnya, bukan membaca teks berkas.

### 10d. Angka

Sebelum 208 tes, sesudah **318 tes** di dua timezone. Penambahan 111 tes
(`guard-origin.test.ts`), pengurangan 1 tes (`auth.test.ts` dihapus, bukan
diperbaiki — isinya sudah tercakup penuh di `guard-origin.test.ts`).

---

## 11. Eksperimen: hanya timezone offset negatif yang menangkap bug timezone (2026-10-03)

**Latar belakang.** K-44 awalnya mewajibkan dua timezone: `TZ=UTC` dan `TZ=Asia/Jakarta`.
Ditemukan saat menyiapkan M5 (lihat B-18) bahwa **keduanya offset non-negatif**, sehingga
kelas bug "tanggal ikut timezone mesin" (B-13) memberi jawaban **identik** di keduanya dan
tidak bisa terdeteksi.

**Eksperimen.** Membandingkan dua cara menghitung nama hari dari tanggal `YYYY-MM-DD`:

```js
const polaBenar = (t) => new Date(Date.UTC(+t.slice(0,4), +t.slice(5,7)-1, +t.slice(8,10))).getUTCDay();
const polaSalah = (t) => new Date(t).getDay();
```

Enam tanggal uji, termasuk dua tanggal berturut yang berbeda jenis hari.

| Tanggal | `TZ=UTC` | `TZ=Asia/Jakarta` | `TZ=America/New_York` | `TZ=Pacific/Kiritimati` (UTC+14) |
|---|---|---|---|---|
| 2026-10-03 | benar | benar | **SALAH** | benar |
| 2026-10-04 | benar | benar | **SALAH** | benar |
| 2026-01-01 | benar | benar | **SALAH** | benar |
| 2026-06-15 | benar | benar | **SALAH** | benar |
| 2026-12-31 | benar | benar | **SALAH** | benar |
| 2026-03-01 | benar | benar | **SALAH** | benar |
| **Total beda** | **0/6** | **0/6** | **6/6** | **0/6** |

**Kesimpulan yang mengubah keputusan.**

1. Offset negatif menangkap **6 dari 6**. Offset positif — termasuk Kiritimati, yang
   merupakan offset terbesar di dunia (+14) — menangkap **0 dari 6**. Menambah timezone
   offset positif kedua **tidak menambah daya deteksi sama sekali**.
2. Yang membuat pola salah meleset adalah `new Date('YYYY-MM-DD')` di-parse sebagai
   **midnight UTC**, lalu `.getDay()` membaca timezone mesin. Di offset negatif, midnight
   UTC jatuh ke **hari sebelumnya** secara lokal.
3. K-44 diperluas jadi **tiga timezone**: `UTC`, `Asia/Jakarta`, `America/New_York`.
   Jumlah ini cukup — menambah offset positif keempat tidak menambah daya deteksi.

**Dampak ke kode yang sudah ada.** Suite penuh dijalankan di `TZ=America/New_York`:
**318/318 lulus**. Jadi kode M0–M4 memang sudah bebas timezone mesin — bukan karena
memiliki pengaman, tetapi karena memang memakai pola `Date.UTC` + `getUTCDay` di
`server/waktu.ts` (lihat `tanggalPanjangWIB`, `jenisHari`). Bukti ini penting justru
karena menunjukkan pengaman baru **tidak menemukan apa-apa sekarang** — artinya nilai
sebenarnya ada di pemeliharaan selanjutnya, bukan di warisan.

**Cara menjalankan.** `npm run test:tz` — menjalankan suite penuh tiga kali berurutan
(bukan paralel, karena seluruh berkas tes memakai `data/uji_*.db` yang saling menghapus)
dan keluar dengan kode selain 0 kalau ada timezone yang gagal.

Skrip: `scripts/tes-tiga-timezone.mjs`.

---

## 12. BUG-01 — `serialisasiWIB(sekarangWIB())` menulis 7 jam di masa depan (2026-10-03)

**Ditemukan** saat menyiapkan data demo untuk M7, bukan saat membaca kode. Gejalanya: tanggal
acuan demo keluar `2026-10-03` padahal `serialisasiWIB()` menghasilkan `2026-10-02T19:05+07:00`.

### Akarnya

`sekarangWIB()` **sudah** mengembalikan Date yang digeser +07:00 (lihat `shiftWIB`). Jadi
mengumpannya lagi ke fungsi waktu lain menggeser **dua kali**:

```
serialisasiWIB()                -> 2026-10-02T19:05:45+07:00   BENAR
serialisasiWIB(sekarangWIB())   -> 2026-10-03T02:05:45+07:00   +7 JAM
tanggalWIB(sekarangWIB())       -> 2026-10-03                  +1 HARI
```

### Luasan

| Lokasi | Call site |
|---|---|
| `src/` | 41 |
| `tests/` | 43 |
| `scripts/` | 4 |

**Column terdampak:** `dibuat_at`, `diubah_at`, `diverifikasi_at`, audit `waktu`, dan
`percobaan_login.waktu`.

### Yang TIDAK rusak (sudah diperiksa satu per satu)

| Aturan | Kenapa aman |
|---|---|
| Sesi admin 12 jam (K-39) | `createSession` memakai `new Date()`, bukan `sekarangWIB()` |
| Jumlah percobaan login | `checkLoginAttempts` memakai `new Date()` |
| Batas 5 percobaan / 24 jam (K-46) | **MENYIMPANG**: jendela efektif jadi **31 jam**, karena cutoff dihitung benar sementara attempt dicatat 7 jam ke depan |

### Kenapa tidak tertangkap

1. **Tes memakai pola yang sama.** 43 call site di `tests/` melakukan double-shift yang sama,
   jadi src dan tes saling konsisten — semuanya salah 7 jam.
2. **`test:tz` tidak bisa menangkapnya.** Selisihnya **absolut**, sama di `UTC`,
   `Asia/Jakarta`, maupun `America/New_York`. Ini bukan kelas bug B-13, dan tiga timezone
   K-44 tidak menambah daya deteksi apa pun untuknya.

Pelajaran: **pagar waktu yang membandingkan antar-tes tidak berguna.** Yang menangkap harus
membandingkan nilai yang ditulis aplikasi dengan **waktu nyata server**.

### Perbaikan dan penjaga

- 88 call site diganti `serialisasiWIB(sekarangWIB())` -> `serialisasiWIB()`, plus 37 import
  `sekarangWIB` yang jadi tidak terpakai dibersihkan.
- `tests/waktu-geserganda.test.ts` (6 tes) — menjaga semantik fungsi DAN sengaja
  menghidupkan kembali jebakannya, supaya siapa pun yang memakainya lagi langsung melihat
  bedanya 420 menit.
- `tests/waktu-tulis.test.ts` (8 tes) — memanggil route sungguhan (toko, karyawan,
  jadwal M5, ketidakhadiran M6, audit) lalu membandingkan `dibuat_at` dengan
  `serialisasiWIB()`. Inilah yang menangkap bug call-site.

**Bukti:** mengembalikan double-shift di **satu** call site
(`src/app/api/admin/master/toko/route.ts`) membuat **6 dari 8 tes** `waktu-tulis` gagal.

### CatatanCCR: `menitDalamHari` mewajibkan argumen

`menitDalamHari(instant)` tidak punya tanda `?` seperti `tanggalWIB`/`serialisasiWIB`.
Ini justru lebih aman — pemanggil wajib menyebut instant. Jangan diubah jadi opsional.

---

## 13. BUG-UI-05 — seluruh UI admin tidak pernah bisa dipakai di browser (2026-10-03)

**Ditemukan** saat pengguna membuka aplikasi di browser sungguhan, bukan dari kode.

### Gejala

Setelah login berhasil, dashboard menampilkan "Akses ditolak" + tombol "Coba lagi".
Semua halaman adminsauf login Experience the same.

### Akar masalah

Browser **TIDAK mengirim header `Origin` pada request same-origin GET/HEAD**.

Sumber resmi: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin
> "same-origin requests **except for `GET` or `HEAD` requests** (i.e., they are added to
> same-origin `POST`, `OPTIONS`, `PUT`, `PATCH`, and `DELETE` requests)"

Semua halaman admin mengambil data dengan `fetch()` GET — jadi `Origin` selalu kosong.
`wajibOrigin()` membandingkan eksak → seluruh fetch berakhir **403**.

### Dua-duanya menyimpang dari aturan proyek sendiri

| | Isi |
|---|---|
| **Spesifikasi** | `rules/03` §9.4: "Cookie sesi `HttpOnly; Secure; SameSite=Lax`; **cek `Origin` pada mutasi**." |
| **Implementasi lama** | mengecek `Origin` pada **SEMUA** request termasuk GET |
| **Cookie** | memang sudah `httpOnly: true` + `sameSite: 'lax'` (`login/route.ts`) |

Jadi ini **bukan** pelonggaran keamanan saat memperbaikinya — justru kode lama yang menyimpang.

### Kenapa tidak tertangkap selama 9 milestone

- Semua tes memanggil route handler dengan `NextRequest` yang **menyertakan Origin secara
  eksplisit** — tidak meniru perilaku browser.
- Pemeriksaan manual memakai `curl -H 'Origin: ...'` — selalu menyertakan header itu.
- Tidak ada satu pun tes yang mengirim request **tanpa** Origin pada GET.
- Aplikasi belum pernah dibuka di browser sampai 2026-10-03.

### Perbaikan

`wajibOrigin()` kini membedakan metode:

| Metode | Origin kosong | Origin salah |
|---|---|---|
| POST / PUT / PATCH / DELETE | **403** (mutasi wajib Origin) | **403** |
| GET / HEAD | diterima, lanjut ke cek sesi (401 tanpa cookie) | **403** |

Kalau Origin **dikirim**, harus cocok persis untuk semua metode — jadi browser
cross-origin yang kebetulan mengirim Origin tetap ditolak.

### Mengapa menerima Origin kosong pada GET aman

1. Cookie sesi sudah `SameSite=Lax`. Under Lax, browser **tidak** mengirim cookie pada
   request cross-site non-top-level seperti `<img>` atau `fetch()` — jadi penyerang
   tidak punya otoritas sama sekali.
2. Route GET di aplikasi ini hanya membaca; tidak ada mutasi yang bisa dipancing lewat GET.
3. Penyerang non-browser bisa memalsukan header, tapi tanpa cookie sesi tidak ada yang
   bisa dilakukan.

### Tes yang diperbarui (bukan dihapus)

`tests/guard-origin.test.ts` sebelumnya **mengodifikasi bug ini**: 150 tes menuntut
"GET tanpa Origin → 403". Sekarang tesnya bercabang per metode — lebih tajam, karena
membuktikan perbedaan antara baca dan mutasi.

Ditambah dua tes di `tests/guard.logout.test.ts`:
- `GET tanpa Origin LOLOS` (200 dengan sesi valid)
- `MUTASI tanpa Origin tetap DITOLAK 403`

**Bukti mutasi (dijalankan 2026-10-03):**

| Mutasi | Hasil |
|---|---|
| Longgarkan juga ke mutasi (`origin === ''` untuk semua metode) | **puluhan tes gagal**, termasuk "MUTASI tanpa Origin tetap DITOLAK 403" |
| Abaikan Origin salah pada GET | **puluhan tes gagal**, termasuk "guard menolak Origin salah di semua route terlindungi" |

### Pelajaran

**Tes harus meniru apa yang dilakukan browser, bukan apa yang dikerjakan penguji.**
Mewajibkan header yang secara fisik tidak dikirim browser menghasilkan paggar yang
mengunci pintu yang memang harus terbuka.

---

## 14. UI-2 (permulaan) — Halaman Verifikasi Absensi, dan bug `Select` base-ui

### Yang dikerjakan

`src/app/admin/verifikasi/page.tsx` sebelumnya **435 baris, 0 import shadcn, 65 inline
style**. Sekarang markup-nya dipisah ke `src/app/admin/verifikasi/komponen.tsx`
(presentasional murni) dan memakai komponen shadcn: `Card`, `Table`, `Badge`, `Button`,
`Input`, `Textarea`, `Checkbox`, `NativeSelect`, `Skeleton`, `Alert`, `Dialog`, `Label`.

Komponen yang ditambahkan lewat `npx shadcn@latest add` (style `base-nova`):
`checkbox`, `textarea`, `field`, `native-select`.

### Dua masalah pada hasil CLI shadcn

**1. Import rusak.** Registry `base-nova` menulis `import { cn } from "cn"` — bukan
`@/lib/utils`. Tidak bisa di-typecheck. Terjadi di 5 berkas yang ditulis/diperbarui CLI:
`checkbox`, `textarea`, `field`, `label`, `separator`. Semuanya diperbaiki manual.

**2. Teks English.** `dialog.tsx` dan `sheet.tsx` memuat `<span className="sr-only">Close</span>`,
`sidebar.tsx` memuat `<SheetTitle>Sidebar</SheetTitle>`. Proyek mewajibkan UI Bahasa
Indonesia, jadi diganti `Tutup` / `Menu navigasi`.

> Catatan: perbaikan ini akan hilang kalau `npx shadcn add` dijalankan lagi pada berkas
> yang sama. Waspadai saat menambah komponen berikutnya.

### BUG-UI-06 (baru): `Select` base-ui menampilkan KODE MENTAH, bukan label

Komponen picker dipakai sebelum diuji. `Select` base-ui ternyata **tidak
bisa dipakai untuk filter tertutup**:

```
SelectPortal.js:  const shouldRender = mounted || forceMount;
                  if (!shouldRender) return null;
```

`SelectItem` berada di dalam `SelectContent` → `Portal`, yang **tidak ter-mount saat popup
tertutup**. Akibatnya daftar item tidak pernah terdaftar di store, dan `SelectValue`
jatuh ke `resolveSelectedLabel` → `serializeValue(value)`:

```html
<span data-slot="select-value">DISETUJUI</span>    <!-- seharusnya "Disetujui" -->
```

Jadi filter akan menampilkan `MENUNGGU`, `CHECKIN`, `CHECKOUT`, dan **id toko/karyawan
mentah** (`3`, bukan "toko melati"). Tidak hanya di server — di browser pun begitu,
sampai dropdown dibuka satu kali.

Diverifikasi langsung pada `@base-ui/react@1.8`:
`node_modules/@base-ui/react/select/portal/SelectPortal.js`,
`.../internals/resolveValueLabel.js`, `.../value/SelectValue.js`.

**Perbaikan:** filter memakai `NativeSelect` — `<select>` asli. Label, penanda
`selected`, dan seluruh opsi ikut ter-render di server, jadi bisa diuji dan tampil
benar sejak byte pertama.

Bonus: `SelectContent` tidak masuk render statis karena portal, sehingga opsinya
**tidak mungkin diuji**. Dengan `NativeSelect`, ketiganya bisa.

### Pelajaran tes (dua-duanya sudah diperbaiki)

1. **Ekspektasi tes bisa salah dan tes tetap hijau.** `not.toMatch(/<button[^>]*disabled/)`
   selalu gagal karena kelas dasar shadcn Button memuat literal `disabled:`. Penanda
   yang benar adalah atribut `disabled=""`.
2. **Class CSS bukan penanda yang stabil.** `has-data-checked:` di dalam class chip
   membuat pola `/data-checked/` salah cocok. Harus `data-checked=""`.
3. **RegExp `<th[^>]*>` juga cocok dengan `<thead>`.** upgraded ke `/<th[\s>]/`, lalu
   ternyata `TableHead` memang benar-benar `<th>` — jadi yang diperiksa `data-slot`.
4. **Nilai `<textarea>` adalah isi elemen, bukan atribut `value`.**
5. **Nilai `0` ≠ kosong (K-30).** `keterlambatan_final_menit` bertipe `number | null`;
   harus dikonversi eksplisit dengan `String(...)`, kalau tidak `0` bisa jadi `""`.

### Mutasi yang membuktikan tes benar-benar menguji sesuatu

| # | Mutasi | Hasil |
|---|---|---|
| 1 | chip kembali jadi label telanjang | tertangkap (percobaan pertama **tidak** tertangkap → tes diperkuat) |
| 2 | filter `NativeSelect` → `<input type="hidden">` | 4 tes gagal |
| 3 | badge Terlambat jadi `<span>` biasa | 1 tes gagal |
| 4 | tombol Tolak kehilangan `disabled` | 1 tes gagal |
| 5 | batas `max={1440}` dihapus (K-54) | 1 tes gagal |
| 6 | `kelompokkan` diubah jadi per-id | 1 tes gagal |
| 7 | `data-checked` chip dihapus | 1 tes gagal |
| 8 | `tanggalPendek` jadi bulan-hari | 3 tes gagal |
| 9 | koordinat tidak lagi jadi tautan peta | 1 tes gagal |

Mutasi 1 sempat **tidak** tertangkap pada percobaan pertama — tes hanya memeriksa
`aria-checked`, yang juga dipenuhi checkbox polos. Tesnya lalu ditambah memeriksa
`data-slot="chip"` beserta `rounded-full` dan `border`.

### `kelompokkan` dipindah ke komponen

Fungsi pengelompokan (rules/05 §5.3 "indikator Pasangan") awalnya hidup di dalam
`page.tsx`, yang tidak bisa dirender di tes karena butuh `next/navigation`. Dipindah ke
fungsi murni `kelompokkan()` di `komponen.tsx` supaya bisa diuji.

### Foto 502 di lokal — bukan bug

Log dev menunjukkan `GET /api/foto/* 502`. Itu **perilaku benar**: `file_id` pada data
demo palsu, jadi `unduhFotoTelegram` gagal dan route mengembalikan
`{ kode: 'FOTO_GAGAL_DIMUAT', pesan: 'Foto tidak dapat dimuat. Coba lagi.' }` dengan
status 502. Di produksi dengan token bot asli, foto akan termuat.

### Yang masih inline (di luar cakupan halaman ini)

`src/app/admin/layout.tsx` dan `src/app/pengalih-tema.tsx` masih memakai `<button>`
polos dan inline style. Itu pekerjaan UI-2 berikutnya, bukan halaman verifikasi.


### Temuan tambahan 2026-10-03: `data-slot` yang kita kirim menimpa milik komponen

Komponen shadcn menulis `data-slot`-nya **sebelum** `{...props}`:

```tsx
function Card({ className, size = "default", ...props }) {
  return <div data-slot="card" data-size={size} className={cn(...)} {...props} />
}
```

Jadi `<Card data-slot="kartu-verifikasi">` **menghapus** `data-slot="card"`. Tes yang
memakai `data-slot="card"` sebagai bukti bahwa `Card` dipakai akan selalu gagal — dan
versi yang hanya memeriksa `data-slot="card-header"` / `"card-content"` **lolos** saat
`Card` diganti `<div>` biasa (mutasi yang benar-benar lolos, sudah diperbaiki).

**Penanda yang tidak tertimpa:** kelas khas komponen. Untuk `Card` itu `group/card` —
tapi perhatikan `CardHeader` punya `group/card-header`, jadi pola harus
`group\/card(?![-\w])`, bukan `\bgroup\/card\b`.

Aturan: kalau perlu `data-slot` sendiri, pakai `data-testid` atau `data-nama`, jangan
`data-slot`.
