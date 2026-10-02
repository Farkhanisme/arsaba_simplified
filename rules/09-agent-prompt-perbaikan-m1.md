# 09 — Prompt Agent Perbaikan M1

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> Prasyarat lingkungan ada di `rules/07` bagian B.

## A. Prompt (salin blok di bawah)

```text
Anda memperbaiki hasil Milestone M1 pada proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau sesuatu tidak tertulis, Anda berhenti dan bertanya.

KODE M0 SUDAH BENAR. JANGAN mengubah src/server/waktu.ts, migrations/0001_init.sql,
dan tests/integrasi.db.test.ts kecuali Anda menemukan bug baru — kalau ada, laporkan dulu
di laporan, jangan diam-diam memperbaiki.

ATURAN LAMA TIDAK BERLAKU: tidak ada kewajiban "ganti password saat login pertama".
Telah diganti jadi halaman ganti password biasa (K-47). Hapus jangan kode lama itu.

====================================================================
1. HALTE WAJIB — JANGAN MENULIS KODE SEBELUM INI SELESAI
====================================================================
Buka rules/00-decision-log.md bagian A dan pastikan K-27 s.d. K-49 ada. Jika ada yang
belum ada -> JANGAN menulis kode. Tulis pertanyaannya ke rules/OPEN_QUESTIONS.md
(ID B-17 seterusnya), tampilkan di chat, lalu BERHENTI.

Pemilik sudah memutuskan: K-46 (batas percobaan login), K-47 (halaman ganti password),
K-48 (password minimal 8 karakter), K-49 (seed dua akun dari env). Tidak perlu bertanya
lagi soal angka batas percobaan.

SEBELUM MULAI, cek `node -v`. Harus v24.x.x (K-43). Kalau bukan, BERHENTI dan laporkan.

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
  rules/OPEN_QUESTIONS.md       <- rekap temuan audit M1

Jangan mulai menulis sebelum semua file selesai dibaca.

====================================================================
3. YANG DIPERBAIKI — PERSIS 8 POIN INI
====================================================================
Setiap poin di bawah adalah temuan audit dengan bukti. Perbaiki, lalu buat tes yang
MEMBUKTIKAN perbaikannya. Tes yang hanya mengulang perilaku lama tidak dihitung.

--------------------------------------------------------------------
[1] BLOCKER — Id sesi tidak di-hash (BR-AUTH1)
--------------------------------------------------------------------
Bukti sekarang:
  auth.ts:43    const idHash = randomBytes(32).toString('base64url');
  auth.ts:48-51 INSERT INTO sesi_admin (id_hash, ...) VALUES (?, ...)  args: [idHash]
  auth.ts:52    return { id_hash: idHash, ... }
  login/route.ts:115  response.cookies.set('sesi', id_hash, ...)

Nilai cookie IDENTIK dengan nilai di database. Kebocoran database = pembajakan sesi
langsung. Laporan M1 mengklaim "id_hash = hash" — itu SALAH: yang ada hanya angka acak,
langkah hashing-nya tidak pernah terjadi.

PERBAIKAN:
  - Generate id_sesi acak (32 byte, base64url) sebagai nilai YANG DIKIRIM ke cookie.
  - Yang disimpan ke sesi_admin.id_hash adalah HASH dari nilai itu (sha256, base64url).
  - getSession(idSesiDariCookie) menghitung hash-nya sendiri lalu mencari.
  - HAPUS fungsi generateSessionId() yang sekarang ada — namanya menyesatkan karena
    "hash"-nya ternyata random kedua yang tidak ada hubungannya dengan "raw".

TES WAJIB: nilai yang disimpan di database BERBEDA dari nilai cookie, dan
getSession(nilaiCookie) tetap berhasil menemukan sesi. Uji juga: knowing id_hash
TIDAK cukup untuk membuat cookie sesi yang valid.

--------------------------------------------------------------------
[2] BLOCKER — new Date().toISOString() di 13 tempat (K-45, rules/04 §1)
--------------------------------------------------------------------
Bukti sekarang:
  src/server/auth.ts          5x  (baris 46, 47, 80, 95, dan turunannya)
  src/app/api/login/route.ts  5x  (baris 30, 52, 72, 88, 104)
  src/server/repo/pengguna.ts 2x  (baris 16, 31)
  scripts/seed.ts             1x  (baris 15)

Semua menulis format "...Z" UTC ke database. Aturan:
  rules/04 §1 -> kolom waktu Berisi ISO 8601 DENGAN offset +07:00
  rules/03 §5 -> new Date() DILARANG di luar server/waktu.ts

PERBAIKAN: semua waktu lewat server/waktu.ts — sekarangWIB() untuk waktu saat ini,
serialisasiWIB() untuk menyimpan. TAPIKSANA yang berbeda:
  - auth.ts  : waktu sesi, waktu percobaan login, batas 24 jam
  - login    : waktu audit
  - pengguna : waktu dibuat_at
  - seed     : waktu dibuat_at
JANGAN memakai new Date().toISOString() di mana pun di src/ maupun scripts/.

TES WAJIB: nilai waktu yang ditulis ke database berakhir dengan "+07:00", bukan "Z".

--------------------------------------------------------------------
[3] BLOCKER — migrate.ts menyimpan waktu seed yang berbohong 7 jam
--------------------------------------------------------------------
Bukti sekarang (scripts/migrate.ts:46):
  const sekarang = new Date().toISOString().replace('Z', '+07:00');

.replace() hanya mengganti LABEL, tidak menggeser waktunya. Bukti reproduksi:
  instant sebenarnya : 2026-10-01T03:25:40.066Z      (= 10:25 WIB)
  tersimpan sebagai   : 2026-10-01T03:25:40.066+07:00 (artinya 03:25 WIB)
Data di schema_migrations.diapplied_at dan seed pengaturan SUDAH salah 7 jam.

PERBAIKAN: pakai serialisasiWIB(sekarangWIB()) dari server/waktu.ts.

TES WAJIB: nilai seed =~ waktu WIB sekarang, selisih maksimal 2 menit. Jangan hanya
membandingkan format string — hitung selisihnya.

--------------------------------------------------------------------
[4] TINGGI — Rate limit mengabaikan IP (BR-AUTH2, K-46)
--------------------------------------------------------------------
Bukti sekarang (auth.ts:78-89): fungsi checkLoginAttempts(username, ip) MENERIMA
parameter ip tapi TIDAK PERNAH memakainya di query. SQL hanya memfilter username.
Akibatnya 5 percobaan gagal untuk satu username = attacker bisa mengunci akun
mana pun dari IP mana pun (account lockout DoS).

PERBAIKAN: hitung percobaan gagal untuk (username DAN ip) secara terpisah, dan
blokir kalau salah satu melewati 5 dalam 24 jam (K-46). Reset jendela: hapus baris
percobaan yang lebih tua dari 24 jam, seperti sekarang.

TES WAJIB:
  - 5 kali gagal dari IP A untuk username X -> X terkunci.
  - 5 kali gagal dari IP A untuk username X, lalu mencoba dari IP B dengan username X
    -> tetap terkunci (username sudah melewati batas).
  - 5 kali gagal dari IP A untuk username X, lalu mencoba dari IP A dengan username Y
    -> Y TIDAK terkunci.
  - Berhasil login me-reset hitungan? TIDAK. rules tidak menyebut reset — jangan
    menambahkan aturan yang tidak tertulis; cukup catat di laporan sebagai pertanyaan.

--------------------------------------------------------------------
[5] TINGGI — Cek Origin bisa dilewati (BR-AUTH4)
--------------------------------------------------------------------
Bukti sekarang (login/route.ts:18):
  if (appOrigin && origin && !origin.startsWith(appOrigin))

Dua celah:
  a) Origin tidak ada (curl/alat server-side) -> origin kosong -> cek DILEWATI.
  b) startsWith -> "https://arsaba.vercel.app.penyerang.com" LOLOS.

PERBAIKAN: Origin WAJIB ada dan WAJIB sama persis dengan APP_ORIGIN. Perbandingan
eksak, bukan parsial. Terapkan pada SEMUA mutasi (login, logout, ganti password).

TES WAJIB:
  - Origin = "https://arsaba.vercel.app" -> diterima.
  - Origin = "https://arsaba.vercel.app.penyerang.com" -> ditolak.
  - Origin kosong/tidak ada -> ditolak.
  - Origin = "http://arsaba.vercel.app" (http, bukan https) -> ditolak.

--------------------------------------------------------------------
[6] SEDANG — Password di-trim() (BR-AUTH5)
--------------------------------------------------------------------
Bukti sekarang (login/route.ts:10):
  const password = String(formData.get('password') || '').trim();
.trim() merusak password yang punya spasi di awal atau akhir. Username boleh di-trim,
password TIDAK BOLEH.

TES WAJIB: password "  test1234  " (ada spasi) berhasil login; "test1234" tanpa spasi
GAGAL. Ini membuktikan trim() benar-benar dihapus.

--------------------------------------------------------------------
[7] SEDANG — Password seed hardcoded dan dicetak (K-49)
--------------------------------------------------------------------
Bukti sekarang (scripts/seed.ts:7 dan :18):
  const { combined } = hashPassword('arsaba2026');
  console.log('Username: superadmin | Password: arsaba2026');

PERBAIKAN sesuai K-49:
  - Password seed dibaca dari process.env.SEED_PASSWORD. Kalau env belum diisi, seed
    GAGAL dengan pesan jelas — JANGAN jatuh ke nilai default.
  - Seed membuat DUA akun: Super Admin dan Admin.
  - Password TIDAK dicetak ke log dalam keadaan apa pun.
  - Username kedua (untuk akun Admin) tidak ditetapkan pemilik. Gunakan "admin" dan
    catat di laporan sebagai keputusan yang perlu konfirmasi.

--------------------------------------------------------------------
[8] FITUR — Halaman ganti password (K-47, K-48, US-A8, rules/05 §5.11)
--------------------------------------------------------------------
Belum ada sama sekali. Yang harus dibuat:
  - src/app/admin/ubah-password/page.tsx — form: password saat ini, password baru,
    konfirmasi. Satu kolom lebar ±480px. Header menampilkan nama akun dan peran.
  - Route Handler untuk mengganti password. WAJIB memeriksa Origin (poin 5) dan sesi valid.
  - Wajib memverifikasi password saat ini. Password baru minimal 8 karakter (K-48).
  - Setelah berhasil: HAPUS SELURUH SESI akun tersebut (K-47), termasuk sesi yang
    sedang dipakai — hasilnya pengguna harus login ulang.
  - Catat di audit_log: aksi ganti password, TANPA memuat password maupun hash-nya.
  - Menu "Ubah Password" di sidebar untuk KEDUA peran (rules/05 §4).

CATATAN STRUKTUR: src/app/admin/ belum ada sama sekali. Milestone ini harus membuat
layout admin MINIMAL — sidebar dengan menu yang benar-benar ada saat ini (Ubah Password,
Keluar) dan nama akun + peran di header. Jangan membuat menu Dashboard/Verifikasi/Jadwal/
Data Master/Akun/Pengaturan/Audit Log — itu milestone lain dan halamannya belum ada.
Menu yang ditautkan ke halaman belum ada WAJIB ditonjolkan sebagai nonaktif, bukan
membuat halaman kosong yang menyesatkan.

====================================================================
4. KRITERIA SELESAI
====================================================================
Milestone perbaikan dianggap selesai HANYA bila SEMUA ini benar:

  [ ] npm run build dan npm run typecheck lulus.
  [ ] TES LULUS DI DUA TIMEZONE (K-44):
        TZ=UTC          npx vitest run     <-- lingkungan produksi Vercel
        TZ=Asia/Jakarta npx vitest run     <-- lingkungan mesin devs
      Keduanya harus lulus. npm test tanpa TZ eksplisit TIDAK memenuhi kriteria ini.

  Bukti per poin:
  [ ] [1] Nilai cookie != id_hash di DB, dan getSession(nilaiCookie) tetap berhasil.
  [ ] [2] grep 'toISOString' di src/ dan scripts/ menghasilkan 0. Semua waktu
        yang ditulis ke DB berakhir dengan "+07:00".
  [ ] [3] Nilai waktu seed =~ waktu WIB nyata, selisih <= 2 menit.
  [ ] [4] Tiga skenario rate limit pada poin [4] semuanya terbukti.
  [ ] [5] Empat skenario Origin pada poin [5] semuanya terbukti.
  [ ] [6] Password ber-spasi depan/belakang berhasil login.
  [ ] [7] grep 'test1234' di scripts/ dan src/ menghasilkan 0. Seed GAGAL dengan
        pesan jelas bila SEED_PASSWORD tidak diisi. Seed membuat 2 akun.
  [ ] [8] Halaman /admin/ubah-password ada; ganti password salah ditolak; berhasil
        menghapus seluruh sesi; minimal 8 karakter ditegakkan; audit tercatat tanpa
        password di dalamnya.

  Yang TIDAK boleh rusak:
  [ ] Tes M0 dan tes M1 yang masih sah tetap lulus. Yang menggantung pada
        perilaku id sesi lama harus diperbarui, bukan dihapus diam-diam.
  [ ] Tidak ada dependensi baru. scrypt, sha256, timingSafeEqual semuanya dari
        crypto bawaan Node.
  [ ] Tidak ada console.log yang memuat password, hash, id sesi, atau token.

====================================================================
5. CARA KERJA
====================================================================
  1. Baca semua dokumen (bagian 2).
  2. Kerjakan poin [1] s.d. [8] BERURUTAN. Jangan menumpuk — bug di [1] dan [2]
     menyentuh file yang sama.
  3. Tulis tes SEBELUM ataubersamaan dengan perbaikan, bukan sesudahnya.
  4. Jalankan build, typecheck, dan tes DI DUA TIMEZONE. Laporkan output aslinya.
  5. Tulis laporan (bagian 6).

====================================================================
6. LAPORAN — WAJIB, PERSIS FORMAT INI
====================================================================
Milestone: Perbaikan M1
Selesai: <per poin 1-8, file yang diubah>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Bukti [1] id sesi di-hash: <nilai cookie vs id_hash, hasil getSession>
Bukti [2] waktu: <hasil grep toISOString, contoh format tersimpan>
Bukti [3] seed waktu: <nilai tersimpan vs waktu nyata>
Bukti [4] rate limit: <hasil tiga skenario>
Bukti [5] Origin: <hasil empat skenario>
Bukti [6] trim: <hasil login dengan dan tanpa spasi>
Bukti [7] seed: <isi SEED_PASSWORD dari env, jumlah akun, perilaku tanpa env>
Bukti [8] ganti password: <alur sukses dan gagal, bukti session terhapus>
Teks M0 yang tidak diubah: <pastikan waktu.ts, 0001_init.sql, integrasi.db.test.ts utuh>
Verifikasi dokumentasi eksternal: <apa, sumber> (di rules/NOTES.md)
Keputusan teknis yang Anda ambil: <mis. username akun Admin, Pertanyaan baru>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

====================================================================
7. BERHENTI
====================================================================
Setelah menulis laporan, BERHENTI. Jangan memulai M2 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

Sama dengan `rules/07` bagian B — Node `24.x` (`nvm use` membaca `.nvmrc`), database uji
`data/uji.db` file lokal (K-42).

Perintah yang harus tetap lulus sebelum dan sesudah:

```
npm run build
npm run typecheck
TZ=UTC          npx vitest run
TZ=Asia/Jakarta npx vitest run
```

## C. Kenapa M1 perlu diperbaiki

M1 melaporkan 28 tes lulus, tetapi **lulus bukan berarti benar**. Tes yang ada hanya menguji
roundtrip nilai sesi yang sama, sehingga secara struktur tidak mungkin menangkap bug [1].

Tiga blocker ini saling menguatkan: id sesi tidak di-hash (bocornya Database berarti sesi
dicuri), waktu ditulis sebagai UTC `Z` padahal kolomnya `+07:00`, dan `migrate.ts`
menyimpan waktu yang bohong 7 jam. Semuanya diam-diam salah di produksi — tidak ada yang
error, tidak ada yang crash.

Yang sudah benar dan tidak perlu diulang: DDL `0001_init.sql`, `server/waktu.ts` (setelah
perbaikan B-13), tes integrasi DB, matriks izin `izin.ts`, dan `audit.ts`.

## D. Penomoran berikutnya

File ini memakai `09`. Jadi prompt **M2** berikutnya menjadi `rules/10-agent-prompt-m2.md`.

---

## F. Status penuntasan (2026-10-02)

Semua poin [1]–[8] **terpenuhi**, plus tiga perbaikan lanjutan:

| Fix | Isi | Tes |
|---|---|---|
| A | `catatAudit(entry, executor?)` bisa menulis di dalam transaksi (`rules/06` §4.6) | `tests/transaksi.audit.test.ts` |
| B | `bukaKunciUsername()` + endpoint Super Admin (K-46) | `tests/buka-kunci.test.ts` |
| C | `src/server/guard.ts` — `guard()` / `guardTanpaSesi()` / `wajibOrigin` / `wajibSesi` | `tests/guard.logout.test.ts` |

Bug tambahan yang ditemukan dan diperbaiki: **logout tidak pernah menghapus sesi**
(`destroySession()` mencari `id_hash` tapi route mengirim nilai cookie mentah).

### Dua hal yang WAJIB diketahui agent berikutnya

**1. `npm run build` gagal dengan SIGBUS (exit 135) — `rules/OPEN_QUESTIONS.md` B-17.**
Ini terbukti **bukan kode repositori** — proyek kosong pun crash sama. Tapi selama build belum
hijau, **M1 belum boleh dideploy**. Coba dulu: restart mesin, lalu `npm run build`. Kalau masih
crash, coba Node 22 LTS lewat nvm sebagai pembeda diagnosis.

**2. File tes tidak boleh jalan paralel.** Semuanya memakai `data/uji_*.db` dan saling
menghapus file itu di `beforeAll`/`afterAll`. Gejalanya bukan error yang jelas, melainkan
kegagalan yang berubah-ubah tiap kali (`6 failed` + `18 skipped`). `vitest.config.mts` sudah
menyetel `fileParallelism: false` — **jangan dihapus**. Kalau butuh menambah file tes, tetap
pakai `file:./data/uji_<nama-unik>.db` dan jangan mengubah setelan itu.

**Pola route yang harus dipakai mulai M2:**

```ts
export const POST = guard('master_toko', async (req, ctx) => {
  await denganTransaksi(async (tx) => {
    await tx.execute({ sql: '...', args: [...] });
    await catatAudit({ ... }, tx);   // audit DI DALAM transaksi yang sama
  });
  return NextResponse.json({ kode: 'OK', pesan: 'Berhasil.' });
});
```

Jangan menyalin logika Origin, cek cookie, atau cek izin secara manual. `guard` sudah
menjaga urutannya: Origin → sesi → izin.

**`batch()` tidak me-rollback.** Untuk operasi atomik — terutama pemindahan karyawan
(BR-P2: tutup penempatan lama + buka yang baru) — wajib pakai `denganTransaksi()`.
