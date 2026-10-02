# 11 — Prompt Agent Milestone M3 (Alur Absen)

> **File ini adalah PROMPT untuk ditempel ke sesi agent, bukan spesifikasi.**
> Spesifikasi tetap `rules/00`–`rules/06`. Jika isi prompt ini berbeda dengan `rules/`,
> maka **`rules/00`–`rules/06` yang berlaku.**

## A. Prompt (salin blok di bawah)

```text
Anda mengerjakan SATU milestone dari proyek "Arsaba Management Center" — aplikasi web
internal absensi untuk 26 karyawan di 10 toko. Anda memiliki akses file ke repositori ini.

ATURAN PALING PENTING: pemilik produk menolak asumsi dan halusinasi. Setiap aturan bisnis
sudah tertulis di rules/. Tugas Anda MENERJEMAHKAN dokumen menjadi kode, bukan mengarang
keputusan. Kalau sesuatu tidak tertulis, Anda berhenti dan bertanya.

M3 adalah milestone paling berisiko di proyek: kamera, lokasi, Telegram, dan batas platform
bertemu di satu tempat. Kerjakan perlahan, jangan menebak.

################################################################
1. HALTE WAJIB
################################################################
Baca rules/00-decision-log.md bagian A dan pastikan K-27 s.d. K-53 ada. Kalau ada yang belum
ada -> JANGAN menulis kode, tulis ke rules/OPEN_QUESTIONS.md (ID B-18 seterusnya), tampilkan,
lalu BERHENTI.

Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  npm run build   # harus hijau sebelum Anda mengubah apa pun

################################################################
2. BACA DOKUMEN INI DULU, DENGAN URUTAN INI
################################################################
  AGENTS.md
  rules/00-decision-log.md
  rules/02-system-spec.md   <- §3 aturan absensi BR-A1..A12, §1 istilah
  rules/03-system-design.md <- §6 alur absen, §7 Telegram, §8 sisi klien, §9 keamanan
  rules/04-database-design.md
  rules/05-ui-ux-rules.md   <- §3 halaman karyawan + §3a kompresi (K-52, K-53)
  rules/01-prd.md          <- US-K1..K4
  rules/NOTES.md           <- §5 Telegram, §6 batas Vercel (SUDAH diverifikasi)

################################################################
3. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
- Tabel absensi sudah ada di migrations/0001_init.sql, lengkap dengan request_id (UNIQUE),
  foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status, dan constraint
  CHECK-nya. TIDAK PERLU migrasi baru.
- src/server/guard.ts ada. Halaman /a/[token] adalah PUBLIK (karyawan tidak punya sesi admin),
  jadi jangan pakai guard() di sana. Route /api/absen juga publik —tokensih yang memverifikasi.
- src/server/waktu.ts: sekarangWIB(), tanggalWIB(), menitDalamHari(), serialisasiWIB().
  Satu-satunya tempat boleh menyimpan waktu (K-45, K-51).
- src/server/audit.ts menerima executor untuk dipakai di dalam transaksi.
- src/server/repo/link.ts: buatTokenLink(), urlUntukToken(), linkAktif(), buatLink(),
  cabutLink(), buatUlangLink() — dipakai untuk resolve token.
- src/server/repo/penempatan.ts sudah punya pola transaksi; ikuti gayanya.
- vitest.config.mts sudah fileParallelism: false. JANGAN diubah.

################################################################
4. SCOPE MILESTONE M3
################################################################
Sesuai rules/06 §3: "Halaman /a/[token], POST /api/absen, kamera, lokasi, Telegram, kuota,
pasangan, idempotensi"

Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. package.json JANGAN diubah
kecuali menambah script yang dipakai. Tanpa dependensi baru — semua dari crypto bawaan Node.

--- 4a. Aturan murni (src/server/aturan/absensi.ts) ---
Fungsi TANPA akses database, unit-testable:
  - bolehCheckIn(keadaan, waktu): BR-A5 — tidak ada check-in terbuka DALAM BATAS 20 JAM,
    dan jumlah check-in aktif pada tanggal itu < 2
  - bolehCheckOut(keadaan, waktu): BR-A6 — ada check-in terbuka dalam batas 20 jam
  - dalamBatas20Jam(waktuCheckIn, sekarang): BR-A10 / K-29
  - eventAktif(status): status <> 'DITOLAK'  (BR-A7)
  - tokoPadaTanggal(penempatan, tanggal): BR-A12 — snapshot toko pada tanggal absensi

Batas 20 jam WAJIB dihitung lewat fungsi waktu, bukan aritmetika manual pada string.

--- 4b. Repo (src/server/repo/absensi.ts) ---
  - checkInTerbuka(karyawanId, batas20Jam, ex)   # BR-A5a + BR-A6
  - jumlahCheckInAktifPadaTanggal(karyawanId, tanggal, ex)   # BR-A5b
  - hitungN(karyawanId, tanggal, waktu, id, ex)  # ordinal check-in untuk pemetaan slot
  - sudahPunyaRequestId(requestId, ex)           # BR-A11 idempotensi
  - insertEvent(data, ex)
  - resolveLinkAktif(token, ex): BR-A1 — link aktif milik karyawan berstatus aktif

Query referensi untuk check-in terbuka SUDAH ada di rules/04 §5. Salin polanya.

--- 4c. Telegram (src/server/telegram.ts) ---
ANGKA SUDAH TERVERIFIKASI di rules/NOTES.md §5. Jangan menebak ulang:
  - sendPhoto via multipart: batas 10 MB
  - unduh via getFile: batas 20 MB (aman untuk kita, yang kita unggah <= 10 MB)
  - ambil file_id UKURAN TERBESAR dari array photo di respons
  - caption berisi: nama karyawan, toko, jenis, waktu WIB, dan request_id untuk penelusuran
Simpan: foto_file_id, foto_chat_id, foto_message_id (sudah ada di DDL).

Token bot TIDAK BOLEH: muncul di log, masuk URL yang diberikan ke klien, atau masuk audit.
URL unduhan Telegram mengandung token bot — jadi jangan pernah kirim ke browser.

--- 4d. Route API ---

  POST /api/absen   PUBLIK. Token link yang memverifikasi, bukan sesi admin.
  - Route ini MENERIMA multipart/form-data: token, jenis, foto, lat?, lng?,
    lokasi_status, request_id
  - Validasi dengan zod
  - CUKUPKAN dengan guardTanpaSesi dari src/server/guard.ts supaya cek Origin tetap
    terpusat. JANGAN menulis cek Origin manual.

  GET /api/foto/[absensiId]   Butuh SESI ADMIN (pakai guard).
  - Panggil getFile dengan file_id, unduh, alirkan ke browser
  - Cache-Control: private
  - JANGAN pernah kirim URL unduhan Telegram ke klien

################################################################
5. URUTAN OPERASI -- BR-A4, INI YANG PALING PENTING
################################################################
Urutan di rules/03 §6 wajib diikuti persis:

  1. Validasi bentuk input (zod), ukuran dan tipe foto
  2. Resolve token link aktif -> karyawan aktif. Gagal -> pesan GENERIK (BR-A1),
     tanpa membedakan "token salah" vs "link dicabut" vs "karyawan nonaktif"
  3. request_id sudah ada? -> kembalikan hasil sebelumnya, JANGAN buat record baru (BR-A11)
  4. Ambil waktu server WIB, tentukan tanggal dan toko penempatan
  5. Validasi BR-A5/A6/A7 + blokir tanggal bertanda tidak berangkat (BR-A9)
  6. KIRIM FOTO KE TELEGRAM. GAGAL -> respons error, TIDAK ADA penulisan database (BR-A4)
  7. Transaksi: validasi ULANG aturan (untuk balapan), INSERT event
  8. Respons ringkasan

Jangan membalik langkah 6 dan 7. Kalau langkah 7 gagal setelah 6 berhasil, foto yatim
tersisa di Telegram — itu diterima (rules/03 §6), dicatat di log server TANPA token.

################################################################
6. HALAMAN /a/[token]  -- K-52, K-53
################################################################
Alur persis seperti rules/05 §3 (K-52):

  1. Pratinjau kamera langsung di halaman absen
  2. Tombol "Foto" dan "Ganti Kamera" (bolak-balik depan <-> belakang, mulai dari depan)
  3. Tekan "Foto" -> foto diambil; tombol "Foto" berubah jadi "Foto Ulang",
     tombol "Absen" muncul
  4.Tekan "Foto Ulang" berkali-kali atau "Ganti Kamera" selama belum tekan "Absen"
  5. Tekan "Absen" -> kirim ke server -> Telegram
  6. Mengirim: tombol nonaktif + "Mengirim..."
  7. Sukses: "Absen berhasil dicatat pukul HH:mm WIB. Menunggu verifikasi admin." + "Selesai"

Kompresi (K-53) WAJIB dan otomatis. Karyawan tidak melihat dan tidak perlu melakukan langkah apa pun:
  - JPEG, sisi terpanjang 1600 px, kualitas awal 0,75
  - turunkan kualitas bertahap bila masih > 4,5 MB
  - kalau masih > 4,5 MB di kualitas terendah -> pesan
    "Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik."
    dan JANGAN kirim request yang pasti ditolak 413

Lokasi (BR-A3): navigator.geolocation.getCurrentPosition dimulai saat kamera dibuka, timeout
pendek. Hasil APA PUN (DITOLAK / GAGAL / TERSEDIA) tidak boleh menghalangi kirim (BR-A3).
Simpan HANYA lat/lng — tanpa akurasi, tanpa data lain (BR-A3).

request_id: UUID dibuat saat foto diambil, DIPAKAI ULANG untuk percobaan ulang atas foto
yang sama (rules/03 §8). Kalau karyawan menekan "Foto Ulang", generates request_id BARU.

TIDAK ADA <input type="file"> di seluruh halaman (K-02). Server menolak request tanpa foto (BR-A2).

################################################################
7. KEAMANAN
################################################################
- Token hanya lewat URL. Pesan gagal WAJIB generik dan sama untuk semua penyebab (BR-A1).
- Foto WAJIB; server menolak request tanpa foto (BR-A2).
- Tidak ada validasi radius lokasi. Tidak ada geofence (rules/01 §4).
- Token bot Telegram tidak boleh bocor ke klien maupun log.
- Tidak ada logging token link, password, atau isi foto.
- HTTPS wajib (disediakan Vercel) — getUserMedia dan geolocation tidak jalan di HTTP.
- Header CSP harus mengizinkan kamera untuk origin sendiri (rules/03 §9.7).

################################################################
8. TES -- BAGIAN YANG PALING SERING GAGAL
################################################################
M1 sampai "selesai" dua kali sambil menyimpan 4 bug karena tesnya memeriksa BENTUK.
Jangan ulangi. Setiap aturan wajib punya tes yang MEMANGGIL kodenya.

DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  menguji fungsi privat langsung      # uji lewat API publiknya

WAJIB ada tes untuk:

  Resolve token (BR-A1)
  [ ] Token tidak dikenal -> generik
  [ ] Link sudah dicabut -> pesan IDENTIK dengan token tidak dikenal
  [ ] Karyawan nonaktif -> pesan IDENTIK juga (tidak boleh membocorkan penyebab)
  [ ] Karyawan aktif -> bisa lanjut

  Urutan Telegram (BR-A4) -- INI YANG PALING SERING SALAH
  [ ] Saat Telegram gagal, TIDAK ADA baris absensi yang dibuat (buktikan dengan COUNT)
  [ ] Saat Telegram gagal, tidak ada record di tabel absensi sama sekali
  [ ] Saat Telegram sukses, record TERSIMPAN dengan foto_file_id/foto_chat_id/
      foto_message_id terisi (kolomnya NOT NULL lewat CHECK di DDL)

  Idempotensi (BR-A11)
  [ ] Kirim request_id yang sama dua kali -> hanya SATU record
  [ ] Response kedua mengembalikan hasil yang sama, tidak error

  Kuota & pasangan (BR-A5, A6, A7)
  [ ] Check-in pertama berhasil
  [ ] Check-in kedua pada hari yang sama berhasil (kuota 2, K-07)
  [ ] Check-in ketiga DITOLAK (melebihi 2)
  [ ] Event DITOLAK tidak menghabiskan kuota -> bisa check-in lagi
  [ ] Check-out terhubung ke check-in terbuka yang benar (checkin_id terisi)
  [ ] Check-in terbuka yang sudah lewat 20 jam TIDAK dianggap terbuka -> tombol kembali
      Check-in. Buktikan dengan menggeser waktu check-in ke 21 jam lalu.

  Blokir tanggal bertanda (BR-A9)
  [ ] Absen pada tanggal yang ditandai tidak berangkat DITOLAK
  [ ] Setelah penandaan dihapus, absen BERJALAN (buktikan blokirnya bersyarat)

  Toko snapshot (BR-A12)
  [ ] Event memakai toko penempatan PADA TANGGAL ABSENSI, bukan toko saat ini

  Kompresi (K-53)
  [ ] Foto hasil kompresi < 4,5 MB
  [ ] Sisi terpanjang <= 1600 px
  [ ] Bila dipaksa menghasilkan file besar, kualitas diturunkan (bukanpixel dihapus)

  Pesan generik (BR-A1)
  [ ] Semua kegagalan resolve token menghasilkan pesan yang PERSIS sama

################################################################
9. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] TZ=UTC          npm test   semua lulus
  [ ] TZ=Asia/Jakarta npm test   semua lulus
  [ ] Seluruh checklist bagian 8 punya isi dan LULUS
  [ ] Tidak ada keputusan yang dikarang; yang belum pasti -> OPEN_QUESTIONS.md
  [ ] migrations/0001_init.sql tidak diubah tanpa alasan kuat yang ditulis di laporan
  [ ] src/server/waktu.ts, guard.ts, auth.ts, audit.ts tidak diubah kecuali ada bug;
      kalau ada, laporkan di laporan DULU

Verifikasi eksternal yang WAJIB Anda isi di rules/NOTES.md:
  - Cara mengirim file multipart ke Bot API dari Node 24 (FormData + Blob native, tanpa
    dependensi). source: core.telegram.org/bots/api
  - Batas rate limit unggah Telegram dan apakah Relevant untuk 26 karyawan
  - Cara membaca IP klien di Route Handler Next.js, dan apakah x-forwarded-for boleh
    dipercaya di Vercel (rules/NOTES.md §4 masih belum lengkap)

################################################################
10. CARA KERJA
################################################################
  1. Baca dokumen (bagian 2) dan isi rules/NOTES.md untuk hal-hal di bagian 9
  2. Tulis rencana singkat
  3. Bangun aturan murni + tesnya DULU (tanpa DB, cepat untuk diiterasi)
  4. Bangun repo + tesnya
  5. Bangun telegram.ts dengan tes yang memakai stub (JANGAN panggil Telegram sungguhan
     di tes — jangan kirim pesan ke grup orang)
  6. Bangun route /api/absen + tesnya
  7. Bangun halaman /a/[token]
  8. Jalankan build, typecheck, tes DI DUA TIMEZONE. Laporkan output aslinya.
  9. Tulis laporan (bagian 11)

################################################################
11. LAPORAN -- WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M3
Selesai: <file yang dibuat>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Resolve token: <bukti pesan generik identik untuk 3 penyebab>
Telegram gagal: <bukti tidak ada record yang dibuat>
Idempotensi: <bukti request_id sama -> satu record>
Kuota: <bukti 3 check-in ditolak, DITOLAK tidak menghabiskan kuota>
Batas 20 jam: <bukti check-in lewat 20 jam tidak dianggap terbuka>
Blokir tidak berangkat: <bukti ditolak, dan jalan setelah penandaan dihapus>
Toko snapshot: <bukti memakai toko pada tanggal absensi>
Kompresi: <bukti < 4,5 MB dan sisi terpanjang <= 1600 px>
Proxy foto: <bukti butuh sesi admin, URL Telegram tidak pernah sampai klien>
Verifikasi dokumentasi eksternal: <apa, sumber> (di rules/NOTES.md)
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
12. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M4 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Tabel `absensi` | sudah ada, **tanpa migrasi baru** |
| `karya_link` + repo `link.ts` | sudah ada dari M2 |
| `guardTanpaSesi` | sudah ada di `guard.ts` |
| Batas Telegram & Vercel | sudah diverifikasi di `rules/NOTES.md` §5–6 |

## C. Yang sudah diverifikasi — agent tidak perlu menebak

| Fakta | Nilai | Sumber |
|---|---|---|
| `sendPhoto` multipart | 10 MB | `core.telegram.org/bots/api` |
| `sendPhoto` via URL | 5 MB (jangan dipakai) | idem |
| Unduh `getFile` | 20 MB (aman untuk kita) | idem |
| Batas request Vercel | **4,5 MB** → HTTP 413 | `vercel.com/docs/functions/limitations` |

## D. Perbedaan dari M2

| Hal | M2 | M3 |
|---|---|---|
| Route publik | tidak ada | `/api/absen` — **token**, bukan sesi |
| Guard | `guard()` semua | `guardTanpaSesi()` + verifikasi token |
| Integrasi luar | tidak ada | Telegram Bot API |
| Klien | tidak ada | kamera, geolocation, kompresi |
| Risiko utama | constraint database | urutan Telegram sebelum DB |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Aturan absensi berubah (`rules/02` §3) | bagian 4a dan 8 |
| Batas platform berubah | bagian 6 + `rules/NOTES.md` §5–6 |
| Alur UI berubah (`rules/05` §3) | bagian 6 |
