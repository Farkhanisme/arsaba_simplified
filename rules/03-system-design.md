# 03 — Desain Sistem

Semua keputusan teknis di bawah ini **disetujui pemilik** (K-40). Lihat `00-decision-log.md`.

## 1. Arsitektur

```
 HP Karyawan (browser)                Browser Admin
        │  HTTPS                            │  HTTPS
        ▼                                   ▼
 ┌────────────────────────────── Vercel (Next.js) ──────────────────────────────┐
 │  Halaman:  /a/[token]                    /login, /admin/...                  │
 │  API:      POST /api/absen               /api/admin/...  /api/foto/[id]      │
 │            (Route Handlers, Node runtime)                                    │
 └───────────────┬─────────────────────────────────┬────────────────────────────┘
                 │ libSQL client (SQL mentah)      │ HTTPS (Bot API)
                 ▼                                 ▼
          Turso (SQLite/libSQL)            Telegram Bot API → Grup privat (foto)
```

Prinsip: seluruh aturan bisnis dijalankan di server. Klien hanya menampilkan dan mengumpulkan input.

## 2. Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js `^16.3.7` (App Router) |
| Runtime | Node.js `24.x` — **wajib sama di lokal dan Vercel** (lihat catatan di bawah) |
| Hosting | Vercel |
| Database | Turso (libSQL/SQLite) |
| Akses data | Klien `@libsql/client` + **SQL mentah berparameter, tanpa ORM** |
| Bahasa | TypeScript strict (`^5.1.0` minimum) |
| Validasi input | `zod` |
| Ekspor Excel | `exceljs` |
| Hash password | `crypto.scrypt` bawaan Node |
| Migrasi | File `migrations/NNNN_nama.sql` + `scripts/migrate` yang mencatat ke `schema_migrations` |
| Runtime route | Node.js runtime (bukan Edge) untuk route yang memakai `crypto`, Telegram, Excel |

> **Kenapa Node 24, bukan Node 26.** Terverifikasi 2026-09-30 (sumber di `NOTES.md`): Vercel
> hanya menyediakan `24.x` (default), `22.x`, dan `20.x` untuk **builds dan functions**. Node.js
> `26.x` baru tersedia di *Vercel Sandboxes* (lingkungan dev sementara), **bukan** runtime
> aplikasi. Selain itu Node.js 20 dinonaktifkan di Project Settings pada **2026-10-01**, jadi
> 24 adalah satu-satunya pilihan yang aman sekarang. Node 26 baru masuk LTS 2026-10-28; tinjau
> ulang setelah Vercel mengumumkannya tersedia untuk builds/functions.
> `package.json` harus memuat `"engines": { "node": "24.x" }` agar override Project Settings,
> dan tidak boleh ada pin Node 26 di `.nvmrc` atau `.node-version`.

## 3. Variabel lingkungan (hanya server)

| Nama | Isi |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Koneksi database |
| `TELEGRAM_BOT_TOKEN` | Token bot. **Tidak boleh** sampai ke klien/log |
| `TELEGRAM_CHAT_ID` | ID grup penyimpan foto |
| `APP_ORIGIN` | Origin resmi untuk validasi `Origin`, nilainya `https://arsaba.vercel.app` (K-38) |

## 4. Struktur direktori

```
src/
  app/
    a/[token]/page.tsx              # halaman absen karyawan
    login/page.tsx
    admin/(dashboard|verifikasi|jadwal|tidak-berangkat|rekap)/...
    admin/master/(toko|shift|karyawan|akun)/...   # Super Admin
    admin/(pengaturan|audit-log)/...              # Super Admin
    api/absen/route.ts
    api/foto/[id]/route.ts
    api/admin/**/route.ts
  server/
    db.ts                # klien libSQL, helper transaksi
    waktu.ts             # semua logika WIB/tanggal/menit (satu-satunya tempat)
    auth.ts, izin.ts     # sesi, peran
    telegram.ts
    aturan/              # fungsi murni: kuota, pasangan, keterlambatan, jadwal
    repo/                # query SQL per entitas
    audit.ts
  lib/                   # util klien (kamera, kompres foto)
migrations/
scripts/
tests/
data/                   # database uji lokal (K-42); isi masuk .gitignore
```

> **Database uji (K-42).** Sampai Turso remote diisi, seluruh pengembangan dan pengujian memakai
> SQLite **file lokal** `data/uji.db` (`TURSO_DATABASE_URL=file:./data/uji.db`). Folder `data/` masuk
> `.gitignore`. Tes integrasi tidak boleh memakai `:memory:` — tiap koneksi mendapat database
> kosong sendiri sehingga constraint bisa lulus palsu (lihat `NOTES.md` §3d).
> Bukti constraint di SQLite lokal **bukan bukti** untuk Turso remote dan wajib diulang
> sebelum M3 (`NOTES.md` §3c).

Fungsi bisnis inti (`server/aturan/*`) harus **fungsi murni** yang mudah diuji.

## 5. Penanganan waktu

- Satu modul `waktu.ts` menyediakan: `sekarangWIB()`, `tanggalWIB(instant)`, `menitDalamHari(instant)`, `jenisHari(tanggal)` (WEEKDAY/WEEKEND), serialisasi ISO dengan offset `+07:00`.
- WIB tidak memakai DST sehingga offset tetap +07:00.
- Karena semua `waktu` memakai offset yang sama, perbandingan string ISO sama dengan perbandingan kronologis.
- Dilarang memakai jam klien atau `new Date()` tersebar di luar `waktu.ts`.

> **WAJIB: offset eksplisit, bukan andalkan timezone mesin (K-45).** Semua operasi tanggal/jam
> harus dilakukan dalam offset tetap `+07:00`. Metode `getHours()`, `getDate()`, `getFullYear()`,
> `getMonth()`, `getDay()` **dilarang di seluruh kode** — termasuk di dalam `waktu.ts` — karena
> semuanya mengikuti **timezone mesin**, bukan WIB. Kesalahan ini nyata dan sudah terjadi (lihat
> `OPEN_QUESTIONS.md` B-13): di mesin `TZ=UTC`, `tanggalWIB()` mengembalikan tanggal yang salah
> dan `serialisasiWIB()` menempelkan jam UTC-local ke label `+07:00`.
>
> Pola yang benar: geser instant ke `+07:00` secara eksplisit, lalu baca komponennya dengan
> varian `getUTC*()`. Contoh:
>
> ```
> const d = new Date(new Date(instant).getTime() + 7 * 3600 * 1000);
> d.getUTCHours(); d.getUTCDay(); // dst.
> ```
>
> Catatan tambahan: meski namanya `sekarangWIB()`, fungsi itu mengembalikan `Date` absolut UTC,
> bukan waktu WIB. Pemanggil **tidak boleh** memakai metode `get*` lokal pada hasilnya; harus selalu
> lewat fungsi turunan `tanggalWIB()` / `menitDalamHari()` / `serialisasiWIB()`.


> **Aplikasi ini HANYA punya satu zona waktu: WIB (K-51).** Tidak ada konversi, tidak ada
> preferensi zona per pengguna, tidak ada tabel zona. `UTC` yang muncul di kode hanyalah
> bahasa internal JavaScript untuk menyimpan *titik absolut* — bukan zona waktu aplikasi.
>
> **JANGAN "memperbaiki" ini.** Mengganti `getUTC*()` dengan `getHours()`/`getDate()` yang
> terbaca benar secara sekilas, tapi justru mengembalikan bug B-13: metode `get*` lokal mengikuti
> **timezone mesin**, sedangkan server produksi berjalan di `TZ=UTC`. Gejalanya tidak error
> dan tidak crash — seluruh tanggal bergeser 7 jam secara diam-diam.
>
> Kalau di masa depan ada karyawan di luar WIB (WITA, WIT), itu **bukan** penyesuaian kecil:
> seluruh asumsi `rules/02` §2 dan `rules/04` §1 harus ditinjau ulang.

> **Tes wajib tiga timezone (K-44).** Karena kode ini sensitif timezone, seluruh tes harus
> dijalankan **tiga kali**: `TZ=UTC` (lingkungan produksi Vercel), `TZ=Asia/Jakarta`
> (mesin devs), dan `TZ=America/New_York` (offset negatif -04:00). Semuanya harus lulus.
> Menjalankan `npm test` tanpa `TZ` eksplisit **tidak memenuhi** kriteria ini — pakai
> `npm run test:tz`.
>
> Offset negatif bukan tambahan bureaucrat: UTC dan Jakarta sama-sama offset non-negatif,
> jadi keduanya memberi jawaban identik untuk kelas bug "tanggal ikut timezone mesin"
> (B-13) dan tidak dapat menangkapnya. Hanya offset negatif yang bisa. Bukti di
> `rules/OPEN_QUESTIONS.md` B-18 dan `rules/NOTES.md` §11.

## 6. Alur absen (`POST /api/absen`)

Request `multipart/form-data`: `token`, `jenis` (`CHECKIN`|`CHECKOUT`), `foto` (JPEG), `lat?`, `lng?`, `lokasi_status` (`DITOLAK`|`GAGAL` bila tanpa koordinat), `request_id`.

1. Validasi bentuk input (zod), ukuran dan tipe foto. Batas ukuran mengikuti batas platform `[perlu dicek]`.
2. Cari link aktif berdasarkan token → karyawan aktif. Gagal → respons generik.
3. Jika `request_id` sudah ada → kembalikan hasil sebelumnya.
4. Ambil `sekarang` WIB, tentukan `tanggal` dan toko penempatan.
5. Baca keadaan (event hari itu + check-in terbuka dalam batas 20 jam BR-A10) lalu validasi BR-A5/A6/A7, termasuk blokir tanggal bertanda tidak berangkat (BR-A9).
6. Kirim foto ke Telegram. Gagal → respons error, **tidak ada penulisan database**.
7. Transaksi database: validasi ulang aturan (untuk balapan), `INSERT` event. Pelanggaran constraint → respons "keadaan berubah, muat ulang".
8. Respons: ringkasan event (jenis, waktu WIB, status `MENUNGGU`).

Catatan: jika langkah 7 gagal setelah 6 berhasil, foto yatim tersisa di Telegram. Diterima; dicatat di log server tanpa token.

## 7. Integrasi Telegram

> **Belum diverifikasi** terhadap dokumentasi resmi. Agent wajib memeriksa dokumentasi Telegram Bot API sebelum implementasi.

- Kirim foto: metode `sendPhoto` ke `TELEGRAM_CHAT_ID`, dengan `caption` berisi nama karyawan, toko, jenis, waktu WIB, dan `request_id` untuk penelusuran.
- Simpan dari respons: `file_id` ukuran foto terbesar, `chat.id`, `message_id` (kolom `foto_file_id`, `foto_chat_id`, `foto_message_id`).
- Menampilkan foto ke admin: `GET /api/foto/[absensiId]` (butuh sesi admin) memanggil `getFile` dengan `file_id`, lalu mengunduh dari server Telegram dan mengalirkannya ke browser. **URL unduhan Telegram mengandung token bot**, sehingga tidak boleh diberikan ke klien.
- Grup harus privat; bot menjadi anggota. Kepemilikan grup dan bot sebaiknya dipegang akun yang stabil (risiko D-3).
- Respons proxy: `Cache-Control: private`.

## 8. Sisi klien halaman absen

- Kamera: `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })`, tangkap ke `<canvas>`, ekspor JPEG. **Tidak ada** `<input type="file">`.
- Kompres di klien sebelum kirim (resolusi sisi terpanjang dan kualitas JPEG ditentukan agent agar hasil kecil dan jelas; ukuran mengikuti batas platform).
- Lokasi: `navigator.geolocation.getCurrentPosition` dimulai saat karyawan membuka kamera, dengan timeout pendek; hasil apa pun (ditolak/gagal/sukses) tidak menghalangi kirim.
- Buat `request_id` (UUID) saat foto diambil dan pakai ulang pada percobaan ulang atas foto yang sama.
- Nonaktifkan tombol kirim selama proses.
- Halaman butuh HTTPS (disediakan Vercel).

## 9. Keamanan

1. Semua pemeriksaan peran dan aturan di server.
2. Query berparameter saja; dilarang menyambung string SQL.
3. Token link: entropi tinggi; respons untuk token salah/dicabut identik.
4. Cookie sesi `HttpOnly; Secure; SameSite=Lax`; cek `Origin` pada mutasi.
5. Pembatasan percobaan login.
6. Secret hanya di env server; jangan dikirim ke klien atau ditulis ke log.
7. Header keamanan dasar (CSP yang mengizinkan kamera untuk origin sendiri, `X-Content-Type-Options`, dll).
8. Halaman absen tidak menampilkan data karyawan lain.
9. Foto wajah = data pribadi; akses hanya lewat proxy dengan sesi admin.

## 10. Transaksi dan konkurensi

- SQLite/libSQL menulis serial. Gunakan transaksi (`batch`/transaksi interaktif klien libSQL) untuk: submit absen, koreksi, cabut+buat link, pemindahan karyawan, jadwal massal, ekspor+log.
- Aturan penting dijaga ganda: pemeriksaan di aplikasi **dan** constraint/index database (lihat `04`).
- Pastikan `PRAGMA foreign_keys = ON` benar-benar aktif pada koneksi yang dipakai; verifikasi dengan tes.

## 11. Ekspor Excel

- Dibuat di Route Handler (Node runtime) dengan `exceljs`, dikirim sebagai unduhan `.xlsx`.
- Pra-syarat BR-R2 diperiksa server sebelum membuat file (bukan hanya di UI).
- Format sel: tanggal `dd/MM/yyyy`, waktu `HH:mm`, angka menit sebagai angka.

## 12. Penanganan error dan log

- Respons error API memakai bentuk seragam `{ kode, pesan }` dengan pesan Bahasa Indonesia.
- Log server memuat kode error dan id terkait; **tidak** memuat token link, token bot, password, atau isi foto.
- Error tak terduga → halaman error umum tanpa detail teknis.

## 13. Pengujian

Wajib ada tes otomatis untuk fungsi murni dan repo pada database uji:

1. Keterlambatan: tabel contoh di `02` §6 (termasuk batas 07:05:59 vs 07:06:00, tanpa jadwal, dua slot, satu slot check-in kedua).
2. Kuota check-in, keterhubungan pasangan, check-out setelah tengah malam, penolakan tidak menghabiskan jatah.
3. Hadir: satu pasangan valid, pasangan setengah disetujui, dua pasangan di satu tanggal.
4. Pemilihan template weekday/weekend/semua.
5. Blokir ekspor, blokir penandaan tidak berangkat.
6. Izin per peran pada setiap endpoint.

## 14. Deploy

- Satu proyek Vercel; variabel env di dashboard Vercel.
- Node.js Version di Project Settings **harus `24.x`**, dan `package.json` menegaskan hal yang sama
  dengan `"engines": { "node": "24.x" }`. Setelah deploy, verifikasi versi nyata dengan
  menambahkan sementara `process.version` ke log build atau `node -v` di Build Command.
- Migrasi dijalankan manual/otomatis terkontrol sebelum deploy versi yang membutuhkannya.
- Seed awal: pengaturan `ambang_terlambat_menit = 5`, **dua akun** (Super Admin + Admin) dengan password dari env `SEED_PASSWORD` (K-49). Password **tidak ditulis di source dan tidak dicetak ke log**; kalau env belum diisi, seed **gagal** alih-alih memakai nilai default.
- **Langkah wajib setelah seed di produksi:** buka `/admin/ubah-password` dan ganti password kedua akun. Password seed `test1234` (K-49) bersifat sementara dan diketahui siapa pun yang punya akses repo — tidak ada lagi kewajiban ganti password otomatis saat login pertama (K-47), jadi langkah ini hanya dilaporkan oleh dokumen deploy, tidak ditegakkan aplikasi.

## 15. Hal yang harus diverifikasi agent ke dokumentasi resmi sebelum implementasi

1. Metode dan batas Telegram Bot API (`sendPhoto`, `getFile`, ukuran file, batas laju).
2. Batas ukuran body request pada Vercel Functions.
3. Dukungan trigger, partial index, dan transaksi pada klien libSQL/Turso.
4. Cara klien libSQL dipakai di lingkungan serverless (mode HTTP vs lainnya).

Sudah terverifikasi (lihat `NOTES.md`): butir versi Node/Next.js, butir 3, dan sebagian butir 4.
Belum terverifikasi: **butir 1 (Telegram) dan butir 2 (batas body Vercel)** — wajib diverifikasi
sebelum M3, dan hasilnya dicatat di `NOTES.md`.

Tambahan yang wajib dicek ulang bila versi dinaikkan:
5. Perubahan Next.js yang memengaruhi deploy (mis. `proxy.ts`, `serverExternalPackages`, `output`).
   Jangan diasumsikan stabil antar versi minor.
