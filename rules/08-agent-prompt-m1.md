# 08 — Prompt Agent Milestone M1

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**
>
> Prasyarat lingkungan (Node 24, database uji lokal) ada di `rules/07` bagian B.

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau sesuatu tidak tertulis, Anda berhenti dan bertanya.

====================================================================
1. HALTE WAJIB — JANGAN MENULIS KODE SEBELUM INI SELESAI
====================================================================
Buka rules/00-decision-log.md bagian A dan pastikan K-27, K-38, K-40, K-41, K-42, K-43,
K-44, K-45 ada. Jika ada yang belum ada -> JANGAN menulis kode. Tulis pertanyaannya ke
rules/OPEN_QUESTIONS.md (ID B-16 seterusnya), tampilkan di chat, lalu BERHENTI.

M0 sudah selesai dan terverifikasi. Rapornya di LAPORAN_M0.md. JANGAN mengubah hasil M0
kecuali menemukan bug — kalau ada bug, laporkan dulu di laporan, jangan diam-diam memperbaiki.

SEBELUM MULAI, cek `node -v`. Harus v24.x.x (K-43). Kalau bukan, BERHENTI dan laporkan.
Jangan memasang versi lain sendiri, dan jangan menaikkan versi Next.js sendiri.

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

Bagian M1 yang paling relevan: rules/02 §13 (peran dan izin), §14 (autentikasi admin),
§16 (audit log); rules/03 §9 (keamanan), §3 (env); rules/04 §2 (DDL tiga tabel auth);
rules/05 §5.1 (halaman login); rules/06 §3 (baris M1).

Jangan mulai menulis sebelum semua file selesai dibaca.

====================================================================
3. SCOPE MILESTONE M1 — HANYA INI
====================================================================
Milestone M1 dari rules/06 §3: "Login admin, sesi DB (12 jam), peran, pembatasan login,
util audit log". Selesai jika: "Dua peran teruji; endpoint menolak peran salah; login
tercatat audit".

Versi: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. package.json sudah benar —
JANGAN mengubahnya kecuali menambah script yang benar-benar dipakai.

Yang dikerjakan:
  a. src/server/auth.ts
     - Hash password dengan crypto.scrypt BAWAAN NODE (tanpa dependensi baru),
       dengan salt UNIK per password. Verifikasi pakai timing-safe compare.
     - Sesi disimpan di tabel sesi_admin. Kolom id_hash = HASH dari id sesi acak,
       bukan id sesi mentah. Id sesi hanya ada di cookie.
     - Durasi sesi 12 JAM sejak login berhasil (K-39), disimpan di kedaluwarsa_at.
     - Pembatasan percobaan login via tabel percobaan_login, per username DAN per IP.
     - Pesan gagal login GENERIK. Akun nonaktif tidak bisa login DAN sesinya dicabut.
  b. src/server/izin.ts
     - Matriks izin dari rules/02 §13, dieksekusi di SERVER pada setiap endpoint.
     - HANYA SUPER_ADMIN boleh: data master, cabut/buat ulang link karyawan,
       kelola akun admin, pengaturan sistem, baca audit log, ubah data pada periode
       terekspor (K-32).
     - Admin biasa: dashboard, verifikasi, jadwal, tandai tidak berangkat,
       koreksi manual, rekap dan ekspor.
  c. src/server/audit.ts
     - Util audit: waktu, pelaku, aksi, entitas + id, sebelum, sesudah (JSON), catatan.
     - WAJIB dipanggil DI DALAM transaksi yang sama dengan mutasinya (rules/06 §4.6).
     - PERNAH melakukan UPDATE atau DELETE pada audit_log (BR-AU3).
  d. src/server/repo/pengguna.ts — query berparameter untuk pengguna_admin, sesi_admin,
     percobaan_login. Tanpa ORM.
  e. Halaman /login sesuai rules/05 §5.1, dan Route Handler untuk login + logout.
  f. Skrip seed untuk membuat satu akun SUPER_ADMIN awal (rules/03 §14).
  g. Tes.

CATATAN PENTING: next.config.mjs punya serverActions dinonaktifkan. Gunakan Route
Handlers untuk API, bukan Server Actions.

Yang BELUM dikerjakan di M1 (untuk milestone berikutnya):
  - Halaman dashboard dan seluruh layout admin dengan sidebar (M7)
  - CRUD data master: toko, shift, karyawan, penempatan (M2)
  - Halaman kelola akun admin (Super Admin) (M2)
  - Halaman verifikasi absensi, jadwal, tandai tidak berangkat, koreksi manual (M4–M6)
  - Rekap dan ekspor Excel (M8)
  - Halaman baca audit log (M9)
  - Link karyawan / token / halaman /a/[token] (M3)
Jangan membuat salah satu dari itu "sambil jalan". Kalau butuh endpoint sementara untuk
menguji izin, buat endpoint tes minimal, jangan jadi fitur utuh.

====================================================================
4. ATURAN KEAMANAN YANG WAJIB DIPENUHI
====================================================================
- Query berparameter dengan placeholder `?`. DILARANG menyambung string SQL dengan
  input pengguna, termasuk saat membangun klausa dinamis.
- Password di-hash scrypt dengan salt unik. Password TIDAK PERNAH masuk log, respons
  API, atau audit_log (BR-AU2 tidak menyimpan password).
- Id sesi hanya di cookie HttpOnly. Yang disimpan di database adalah hash-nya.
- Cookie sesi WAJIB HttpOnly; Secure; SameSite=Lax.
- Pemeriksaan peran WAJIB di server pada setiap endpoint, bukan hanya menyembunyikan
  menu di UI (rules/02 §13).
- Semua mutasi memverifikasi header Origin terhadap APP_ORIGIN
  (https://arsaba.vercel.app, K-38). Jangan bandingkan dengan string longgar.
- Pesan gagal login harus sama persis: "Username atau password salah."
  Jangan pernah Membedakan "user tidak ada" vs "password salah" vs "akun nonaktif" —
  informasi itu bocor.
- Tidak ada console.log yang memuat password, hash password, id sesi, atau token.
- Error tak terduga -> pesan umum tanpa detail teknis.

====================================================================
5. AUDIT LOG — WAJIB (BR-AU1)
====================================================================
Login BERHASIL dan login GAGAL keduanya harus tercatat (BR-AU1 menyebut "login
berhasil/gagal").

Perhatikan kolom pengguna_id pada audit_log adalah NULLABLE. Untuk login gagal dengan
username yang tidak ada, pengguna_id harus NULL — jangan memaksakan nilai. Untuk login
gagal dengan username yang ADA tapi password salah, isi pengguna_id-nya, dan jangan
menyimpan password maupun hash-nya di kolom sebelum/sesudah.

Audit yang diminta M1: autentikasi (login berhasil, login gagal, logout). Audit untuk
fitur lain menyusul di milestone masing-masing.

====================================================================
6. HAL YANG TIDAK BOLEH DIASUMSIKAN
====================================================================
Aturan di bawah WAJIB diverifikasi ke dokumentasi resmi, lalu dicatat di rules/NOTES.md
dengan URL sumbernya. Jangan menulis dari ingatan:
  - Cara `scrypt` dipakai di @types/node 22 (parameter N/r/p, format hash yang disimpan,
    timingSafeEqual)
  - Cara membaca IP klien di Route Handler Next.js App Router, dan apakah
    x-forwarded-for boleh dipercaya di lingkungan Vercel (rules/NOTES.md §4 belum lengkap)
  - Batas jumlah attempt login yang wajar sebelum diblokir — rules/02 §14 menyebut
    "pembatasan" tanpa angka. TIDAK ADA angka yang diputuskan pemilik. Kalau Anda perlu
    angka, jangan mengarang: pakai konstanta yang mudah diubah, beri nama jelas, dan
    tulis di laporan sebagai keputusan teknis yang perlu persetujuan.

rules/NOTES.md §1 dan §2 sudah terverifikasi (Node/Vercel dan Next.js) — jangan diulang.

====================================================================
7. KRITERIA M1 SELESAI
====================================================================
Milestone dianggap selesai HANYA bila SEMUA ini benar:

  [ ] npm run build dan npm run typecheck lulus.
  [ ] TES LULUS DI DUA TIMEZONE (K-44):
        TZ=UTC          npx vitest run     <-- lingkungan produksi Vercel
        TZ=Asia/Jakarta npx vitest run     <-- lingkungan mesin devs
      Keduanya harus lulus. npm test tanpa TZ eksplisit TIDAK memenuhi kriteria ini.

  Dua peran (BR-AU / §13):
  [ ] Tes membuktikan SUPER_ADMIN dan ADMIN bisa login.
  [ ] Tes membuktikan endpoint yang butuh SUPER_ADMIN MENOLAK sesi ADMIN dengan
      Forbidden — dan penolakannya terjadi di server, bukan hanya disembunyikan di UI.
  [ ] Tes membuktikan endpoint umum (mis. dashboard) menerima kedua peran.

  Sesi (K-39, §14):
  [ ] Durasi sesi tepat 12 jam, dihitung dan disimpan di kedaluwarsa_at.
  [ ] Tes membuktikan sesi yang sudah kedaluwarsa ditolak.
  [ ] Yang tersimpan di sesi_admin.id_hash adalah HASH, bukan id sesi mentah.
  [ ] Password di-hash scrypt dengan salt unik; dua password sama menghasilkan hash
      berbeda (salt unik).
  [ ] Verifikasi password memakai perbandingan timing-safe.
  [ ] Cookie sesi punya HttpOnly; Secure; SameSite=Lax.

  Pembatasan login (§14):
  [ ] Percobaan login berhasil/gagal tercatat di percobaan_login.
  [ ] Setelah melewati batas percobaan, login diblokir.
  [ ] Akun dengan aktif = 0 tidak bisa login.

  Audit log (BR-AU1 s.d. BR-AU3):
  [ ] Tes membuktikan login berhasil tercatat di audit_log.
  [ ] Tes membuktikan login gagal tercatat di audit_log, dengan pengguna_id NULL
      bila username tidak ada.
  [ ] Audit log tidak pernah ditulis lewat UPDATE atau DELETE.
  [ ] Password, hash, dan id sesi tidak muncul di isi audit_log.

  Mutasi (K-38):
  [ ] Header Origin diverifikasi terhadap APP_ORIGIN pada endpoint mutasi.

  Lain-lain:
  [ ] Tidak ada dependensi baru yang ditambahkan tanpa alasan kuat yang tercatat di
      laporan. scrypt memakai crypto bawaan Node.
  [ ] Tidak ada console.log yang memuat data sensitif.

Package manager dan test runner TIDAK diubah — M0 sudah memakai npm dan vitest.

====================================================================
8. CARA KERJA
====================================================================
  1. Baca semua dokumen (bagian 2).
  2. Tulis rencana singkat apa yang akan dibuat.
  3. Implementasikan. Tes ditulis SEBAIL-BERSAMA kode, bukan menyusul.
  4. Jalankan build, typecheck, dan tes DI DUA TIMEZONE. Laporkan output aslinya,
     bukan ringkasan.
  5. Tulis laporan (bagian 9).

====================================================================
9. LAPORAN — WAJIB, PERSIS FORMAT INI
====================================================================
Milestone: M1
Selesai: <daftar file/fungsi yang dibuat>
Versi: Node <node -v> / Next.js <versi terpasang>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Peran teruji: <apa yang membuktikan ADMIN vs SUPER_ADMIN ditolak di server>
Sesi: <bukti 12 jam, hash tersimpan, cookie flag>
Pembatasan login: <bukti percobaan diblokir, akun nonaktif ditolak>
Audit: <apa yang tercatat, bukti pengguna_id NULL untuk username tak dikenal>
Verifikasi dokumentasi eksternal: <apa, sumber> (di rules/NOTES.md)
Keputusan teknis yang Anda ambil: <batas percobaan login, alasan, dan mana yang
  MENJADI PERTANYAAN BARU untuk persetujuan pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

====================================================================
10. BERHENTI
====================================================================
Setelah menulis laporan, BERHENTI. Jangan memulai M2 atau milestone berikutnya
walau terlihat mudah. Tunggu pemilik menjawab "lanjut".
```

## B. Persiapan lingkungan

Sama dengan `rules/07` bagian B — tidak diulang. Ringkas:

| Prasyarat | Cara memastikan |
|---|---|
| Node `24.x` | `node -v` → `v24.x.x`, atau `nvm use` di folder repo (`.nvmrc` isi `24`) |
| Folder `rules/` terbaca | Agent membuka `rules/00-decision-log.md` |
| Database uji | `data/uji.db` file lokal (K-42), **bukan** `:memory:` |

Perintah M0 yang harus tetap lulus sebelum dan sesudah M1:

```
npm run build
npm run typecheck
TZ=UTC          npx vitest run
TZ=Asia/Jakarta npx vitest run
```

## C. Cara memakai

1. Salin seluruh blok dari bagian A.
2. Paste sebagai pesan pertama di sesi agent baru (atau sesi yang sama, setelah M0 selesai).
3. Agent akan membaca `rules/00` bagian A dulu, lalu mengerjakan M1.
4. Setelah laporan M1 keluar, balas **"lanjut"** untuk M2 — perlu `rules/09-agent-prompt-m2.md`.

## D. Perbedaan penting dari M0

| Hal | M0 | M1 |
|---|---|---|
| Package manager / test runner | Agent bebas memilih | **Tetap** npm + vitest (sudah terpasang) |
| Database uji | Dibuat M0 | Sudah ada, jangan diubah |
| Angka batas percobaan login | — | **Belum diputuskan** — pakai konstanta, tulis di laporan |
| Server Actions | Dimatikan di M0 | Tetap Route Handlers |

## E. Catatan pemeliharaan

| Perubahan | Yang harus diedit di bagian A |
|---|---|
| Matriks izin berubah (`rules/02` §13) | Bagian 3b dan 7 |
| Durasi sesi berubah | Bagian 3a dan 7 |
| Aturan audit berubah (`rules/02` §16) | Bagian 5 |
| Angka batas percobaan login diputuskan pemilik | Bagian 6 (hapus dari "belum diputuskan") |
| Turso remote aktif | Bagian 6 dan `rules/NOTES.md` §3c |
