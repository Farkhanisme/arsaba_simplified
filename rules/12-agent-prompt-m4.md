# 12 — Prompt Agent Milestone M4 (Verifikasi Absensi)

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
2. WAJIB KERJAKAN PERTAMA — PATCH C-1
################################################################
Buka rules/OPEN_QUESTIONS.md bagian C. Ada satu patch yang pemilik sudah menyetujui dan
ditunda dari M3 ke M4. Kerjakan ITU lebih dulu, lengkap dengan tesnya:

File: src/server/aturan/absensi.ts
Fungsi: dalamBatas20Jam()

Patch dan tesnya sudah tertulis lengkap di rules/OPEN_QUESTIONS.md §C-1. Salin apa adanya.
Alasan owner: fungsi ini dipakai ulang di M4 lewat BR-K3 (tombol "Tambah check-out" untuk
check-in yang sudah lewat 20 jam), sehingga konsekuensinya tidak lagi nol seperti di M3.

################################################################
3. BACA DOKUMEN INI DULU, DENGAN URUTAN INI
################################################################
  AGENTS.md
  rules/02-system-spec.md   <- §4 verifikasi BR-V1..V7, §5 kehadiran, §6 KETERLAMBATAN,
                               §10 koreksi manual BR-K1..K6, §16 audit
  rules/03-system-design.md <- §1 istilah
  rules/04-database-design.md <- kolom absensi + query acuan
  rules/05-ui-ux-rules.md   <- §5.3 halaman verifikasi
  rules/01-prd.md          <- US-A2, US-A5
  rules/00-decision-log.md <- K-28, K-30, K-32, K-36

################################################################
4. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
- Tabel absensi sudah punya SEMUA kolom verifikasi dan koreksi: status, alasan_tolak,
  diverifikasi_oleh, diverifikasi_at, keterlambatan_final_menit, sumber, alasan_koreksi,
  dikoreksi_oleh. TIDAK PERLU migrasi baru.
- Tabel jadwal DAN jadwal_slot sudah ada dengan snapshot jam. Keterlambatan BISA dihitung
  tanpa membangun fitur jadwal (itu M5) — cukup baca kedua tabel itu.
- src/app/api/foto/[id] sudah ada dari M3 dengan guard('verifikasi'). JANGAN tulis ulang;
  pakai untuk foto mini dan lightbox.
- Izin 'verifikasi' dan 'koreksi' sudah ada di src/server/izin.ts (ADMIN + SUPER_ADMIN).
- src/server/aturan/absensi.ts sudah ada dari M3 (dalamBatas20Jam, bolehCheckIn, dll).
- src/server/repo/absensi.ts sudah ada dari M3. src/server/waktu.ts punya menitDalamHari(),
  tanggalWIB(), serialisasiWIB(), geserJamISO().
- Tabel log_ekspor sudah ada (dipakai untuk sudahDiekspor, lihat 6).
- vitest.config.mts sudah fileParallelism: false. JANGAN diubah.

################################################################
5. SCOPE MILESTONE M4
################################################################
Sesuai rules/06 §3: "Verifikasi (satuan, massal, alasan tolak), foto proxy, selisih
keterlambatan, keterlambatan final, koreksi manual"

Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. Tanpa dependensi baru.

--- 5a. src/server/aturan/keterlambatan.ts (BARU, file terpisah) ---
Jantung M4. Fungsi MURNI tanpa database, wajib unit-testable:

  pilihSlot(slots, n)            K-28: slot ke-N, atau slot TERAKHIR kalau N > jumlah slot
  hitungN(absensiHari, target)    BR-L1: hanya CHECKIN status <> 'DITOLAK' dengan
                                  (waktu, id) <= (target.waktu, target.id)
  hitungSelisih(menitDalamHari, slotDipakai, ambangMenit) -> { selisih, terlambatSistem }

Aturan yang TIDAK BOLEH salah:
  - Detik diabaikan. Pakai menitDalamHari() dari waktu.ts, jangan hitung sendiri.
  - Tanpa jadwal -> selisih null dan terlambatSistem false.
  - terlambatSistem = selisih !== null && selisih > ambangMenit   (KETAT '>', BUKAN '>=')
  - hitungN mengurutkan waktu dulu baru id, bukan hanya waktu (dua check-in bisa jam sama)
  - DITOLAK TIDAK dihitung dalam N -> penomoran BERgeser otomatis (BR-L1)

--- 5b. Perluasan src/server/aturan/absensi.ts ---
  bolehUbahKeputusan(absensi, sudahDiekspor)        BR-V6 + K-36
  bolehKoreksi(absensi, sudahDiekspor, peran)       BR-K6 + K-32 (hanya SUPER_ADMIN bila terekspor)
  sudahDiekspor(tanggal, tokoId, ex)                query READ-ONLY ke log_ekspor

sudahDiekspor WAJIB ada walau ekspor (M8) belum dibangun — K-32/K-36 perlu dia untuk menegakkan
BR-V6 dan BR-K6. Cukup SELECT, tanpa UI ekspor dan tanpa menulis log_ekspor.

--- 5c. src/server/repo/verifikasi.ts ---
  daftarEvent(filter, ex)     filter: status, toko, rentang tanggal, karyawan, jenis,
                               chip "check-in belum check-out". Default status MENUNGGU.
  slotUntuk(absensiId, ex)     jadwal + snapshot slot pada tanggal absensi itu
  detailEvent(eventId, ex)      satu event lengkap untuk aksi tunggal

--- 5d. Route API — SEMUA lewat guard() ---
  GET  /api/admin/verifikasi            guard('verifikasi')  daftar + selisih + badge
  POST /api/admin/verifikasi/[id]       guard('verifikasi')  setujui/tolak satuan
  POST /api/admin/verifikasi/massal     guard('verifikasi')  massal, satu alasan bersama
  POST /api/admin/koreksi               guard('koreksi')    tambah/ubah waktu

Semua mutasi WAJIB dengan denganTransaksi() dan catatAudit(..., tx) di dalam transaksi yang
sama. Jangan menulis pemanggilan DB berurutan di luar transaksi.

################################################################
6. ATURAN YANG PALING MUDAH DILANGGAR
################################################################

BR-V7 (K-30) — Menyetujui check-in yang terlambat sistem WAJIB mengisi keterlambatan_final_menit.
Nilai 0 harus diketik EKSPLISIT, bukan default. Kalau diisi 0 diam-diam, kolom "0 menit"
menjadi tidak bisa dibedakan dari NULL (belum diisi), padahal BR-L3 menghitung NULL sebagai 0.
Check-in yang TIDAK terlambat sistem tidak wajib diisi.

BR-V4/V5 — Check-in dan check-out diverifikasi TERPISAH. Check-out yang check-in-nya DITOLAK
tetap berdiri sendiri (bukan pasangan valid) dan tetap harus diverifikasi.

BR-V6 (K-36) — Keputusan yang sudah dibuat boleh diubah DISETUJUI <-> DITOLAK selama periode
belum diekspor. Saat mengubah ke status aktif pada check-out, periksa ulang constraint satu
check-out aktif per check-in.

BR-K1 — Record koreksi: sumber = 'KOREKSI_ADMIN', tanpa foto, lokasi_status = 'TIDAK_ADA',
alasan_koreksi WAJIB. Jangan membuat kolom foto dari request.

BR-K2 — Record koreksi langsung berstatus DISETUJUI dengan diverifikasi_oleh = admin pelaku.
Tidak masuk antrean verifikasi.

BR-K3 — Kasus utama: menambah check-out untuk check-in yang terbuka, termasuk yang sudah lewat
batas 20 jam (pakai dalamBatas20Jam yang sudah dipatch di bagian 2). Check-out koreksi
terhubung ke check-in itu (checkin_id terisi).

BR-K4 — Aturan kuota TETAP berlaku pada koreksi: maks 2 check-in aktif per tanggal, dan satu
check-out aktif per check-in. Koreksi bukan jalan pintas melewati kuota.

BR-K5 — Tidak ada hapus permanen. Untuk membatalkan, ubah status jadi DITOLAK dengan alasan.

BR-K6 (K-32) — Koreksi pada periode terekspor hanya Super Admin, tercatat di audit.

BR-H1/H2 — Hari hadir = ada >= 1 pasangan valid (check-in DAN check-out sama-sama DISETUJUI)
pada tanggal itu. Dihitung per tanggal unik.

BR-L4 — Ambang terlambat dibaca dari tabel pengaturan (ambang_terlambat_menit, default 5),
BUKAN angka hardcode. Mengubah ambang mengubah tanda terlambat pada data lama saat ditampilkan;
angka final admin tidak berubah.

BR-L2 (K-54) — keterlambatan_final_menit hanya 0 s.d. 1440 menit. Di luar rentang itu DITOLAK
DI SERVER dengan pesan "Menit terlambat harus antara 0 dan 1440." PENTING: constraint di
migrations/0001_init.sql baris ~143 hanya mengecek `>= 0` — TIDAK ada batas atas di database.
Jadi bounded-check ini WAJIB ada di lapisan route/server, bukan hanya disables tombol di UI.
Tambahkan tes yang membuktikan nilai 1441 dan -1 DITOLAK.

################################################################
7. HALAMAN /admin/verifikasi
################################################################
Sesuai rules/05 §5.3. Kolom baris: kotak centang · waktu (tanggal + jam) · karyawan · toko ·
jenis · foto mini (klik lightbox) · lokasi (koordinat + tautan "Buka peta", atau "Lokasi tidak
tersedia") · selisih vs jadwal + badge Terlambat · status · aksi.

- Untuk CHECKIN ada kolom "Menit terlambat (final)", input angka >= 0. Wajib diisi bila
  check-in terlambat sistem (BR-V7); 0 tetap diketik eksplisit.
- Aksi massal: pilih baris -> "Setujui terpilih" / "Tolak terpilih". Tolak membuka dialog
  alasan WAJIB; satu alasan berlaku untuk semua terpilih.
- Tolak satuan: dialog alasan WAJIB.
- Badge: Dikoreksi untuk sumber = KOREKSI_ADMIN.
- Indikator "Pasangan": check-in dengan check-out terkait dikelompokkan (karyawan + tanggal).
- Aksi Koreksi per baris/kelompok: jenis, waktu (tanggal + jam), alasan wajib. Untuk check-in
  terbuka ada tombol cepat "Tambah check-out".
- Filter tersimpan di URL agar bisa di-refresh.
- Loading: skeleton baris. Kosong: "Tidak ada absensi yang menunggu verifikasi."
  Error: pesan + tombol "Coba lagi".
- Sidebar: menu "Verifikasi Absensi" untuk kedua peran (sudah ada di menu.ts dari M2).

Foto mini dan lightbox memakai /api/foto/[id] yang SUDAH ADA. Jangan tulis ulang proxy-nya.

################################################################
8. TES -- BAGIAN YANG PALING SERING GAGAL
################################################################
DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  menguji fungsi privat langsung      # uji lewat API publiknya

WAJIB ada tes untuk:

  Keterlambatan -- INI YANG PALING WAJIB, boundaries harus PERSIS
  [ ] 06:50:10 vs shift 07:00 -> selisih -10, TIDAK terlambat
  [ ] 07:05:59 vs shift 07:00 -> selisih 5, TIDAK terlambat  (toleransi, batasnya KETAT)
  [ ] 07:06:00 vs shift 07:00 -> selisih 6, TERLAMBAT
  [ ] Detik diabaikan: 07:00:59 dan 07:00:01 menghasilkan menit yang sama
  [ ] Tanpa jadwal -> selisih null dan TIDAK terlambat

  Penomoran slot
  [ ] Dua slot: check-in aktif N=1 -> slot 1; N=2 -> slot 2
  [ ] N melebihi jumlah slot -> memakai slot TERAKHIR (K-28)
  [ ] BR-L1: di antara dua check-in ada satu DITOLAK -> check-in yang aktif
      berikutnya jadi N=1 (bukan N=2). Buktikan nilai N-nya secara langsung.
  [ ] Dua check-in dengan waktu SAMA -> diurutkan dengan id

  Ambang dari pengaturan (BR-L4)
  [ ] Ambang diubah dari 5 ke 30 -> tanda terlambat pada event LAMA ikut berubah
  [ ] Ambang diubah TIDAK mengubah keterlambatan_final_menit yang sudah diisi admin

  Verifikasi (BR-V2, V4, V6, V7)
  [ ] Tolak tanpa alasan DITOLAK (constraint database, bukan hanya aplikasi)
  [ ] Setujui check-in terlambat tanpa menit final DITOLAK (BR-V7)
  [ ] Setujui check-in terlambat dengan 0 eksplisit BERHASIL
  [ ] Keterlambatan final 1440 DITERIMA, 1441 DITOLAK (K-54)
  [ ] Keterlambatan final -1 DITOLAK, dan DITOLAK-nya terjadi di SERVER bukan hanya UI
  [ ] Batas atas ditegakkan walau UI di-bypass (panggil route langsung dengan angka 5000)
  [ ] Setujui check-in yang TIDAK terlambat tanpa menit final BERHASIL
  [ ] Memverifikasi check-out tidak mengubah status check-in (BR-V4 terpisah)
  [ ] Check-out dari check-in DITOLAK berdiri sendiri, belum pasangan valid (BR-V5)
  [ ] Keputusan bisa diubah saat periode belum diekspor
  [ ] Keputusan pada periode terekspor: ADMIN DITOLAK, Super Admin boleh (K-36)

  Koreksi (BR-K1..K6)
  [ ] Koreksi tanpa alasan DITOLAK
  [ ] Record koreksi: sumber = KOREKSI_ADMIN, tanpa foto, lokasi_status = TIDAK_ADA,
      status = DISETUJUI, diverifikasi_oleh = admin pelaku (BR-K1, K2)
  [ ] Koreksi yang membuat 3 check-in aktif DITOLAK (BR-K4 kuota berlaku)
  [ ] Koreksi check-out kedua untuk check-in yang sama DITOLAK (BR-K4)
  [ ] "Tambah check-out" untuk check-in yang SUDAH lewat 20 jam berhasil (BR-K3)
  [ ] Koreksi pada periode terekspor: ADMIN DITOLAK, Super Admin boleh (K-32)
  [ ] Tidak ada hapus permanen: membatalkan = ubah jadi DITOLAK dengan alasan (BR-K5)

  Audit
  [ ] Setiap keputusan dan koreksi tercatat dengan nilai SEBELUM dan SESUDAH
  [ ] Mutasi + audit yang di-ROLLBACK tidak meninggalkan jejak audit

  Kehadiran (BR-H1/H2) -- jika ikut dibangun
  [ ] Satu pasangan valid = 1 hari hadir
  [ ] Dua pasangan valid di tanggal sama = tetap 1 hari hadir
  [ ] Pasangan setengah disetujui = BUKAN hadir

################################################################
9. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] TZ=UTC          npm test   semua lulus
  [ ] TZ=Asia/Jakarta npm test   semua lulus
  [ ] Patch C-1 di bagian 2 sudah diterapkan beserta tesnya
  [ ] Seluruh checklist bagian 8 punya isi dan LULUS
  [ ] Tidak ada angka ambang terlambat yang di-hardcode (harus dari tabel pengaturan)
  [ ] migrations/0001_init.sql tidak diubah tanpa alasan kuat yang ditulis di laporan
  [ ] waktu.ts, guard.ts, auth.ts, audit.ts, izin.ts tidak diubah kecuali ada bug;
      kalau ada, laporkan di laporan DULU

################################################################
10. CARA KERJA
################################################################
  1. Baca dokumen (bagian 3)
  2. Patch C-1 (bagian 2) beserta tesnya
  3. Tulis aturan murni keterlambatan.ts + tesnya DULU. Boundaries 07:05:59 dan 07:06:00
     harus hijau SEBELUM apa pun yang lain dibangun. Jangan lanjut kalau belum hijau.
  4. Perluasan aturan absensi.ts (bolehUbahKeputusan, bolehKoreksi, sudahDiekspor) + tesnya
  5. Repo verifikasi.ts + tesnya
  6. Route API + tesnya
  7. Halaman /admin/verifikasi
  8. Jalankan build, typecheck, tes DI DUA TIMEZONE. Laporkan output aslinya.
  9. Tulis laporan (bagian 11)

################################################################
11. LAPORAN -- WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M4
Selesai: <file yang dibuat>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Patch C-1: <sudah diterapkan? bukti tes masa depan ditolak>
Keterlambatan batas: <bukti 06:50:10, 07:05:59, 07:06:00>
Penomoran slot: <bukti 2 slot -> N=1 ke slot 1, N=2 ke slot 2>
BR-L1: <bukti DITOLAK tidak dihitung dalam N>
Slot terakhir: <bukti N melebihi jumlah slot memakai slot terakhir>
Ambang pengaturan: <bukti diubah dari 5 ke 30 mengubah tanda pada data lama>
BR-V7: <bukti setujui terlambat tanpa menit final ditolak, dengan 0 eksplisit berhasil>
BR-L2/K-54: <bukti 1440 diterima, 1441 dan -1 ditolak>
BR-V4/V5: <bukti check-out dari check-in DITOLAK berdiri sendiri>
BR-V6: <bukti keputusan bisa diubah sebelum ekspor, ADMIN ditolak setelah ekspor>
Koreksi: <bukti tanpa alasan ditolak, record KOREKSI_ADMIN tanpa foto>
BR-K4: <bukti koreksi yang melewati kuota ditolak>
BR-K3: <bukti tambah check-out untuk check-in lewat 20 jam berhasil>
Kehadiran: <bukti pasangan valid, setengah, dan dua pasang per tanggal>
Audit: <bukti setiap keputusan tercatat dengan before/after>
Izin: <bukti ADMIN dan Super Admin bisa verifikasi + koreksi>
Verifikasi dokumentasi eksternal: <tidak ada, atau apa dan sumber>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
12. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M5 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Tabel `absensi` + `jadwal` + `jadwal_slot` + `log_ekspor` | sudah ada, **tanpa migrasi baru** |
| `/api/foto/[id]` | sudah ada dari M3 |
| Izin `verifikasi`, `koreksi` | sudah ada |
| **C-1 patch** | tertunda dari M3, **wajib dikerjakan di sini** |

## C. Yang sudah diverifikasi

Tabel `jadwal` + `jadwal_slot` punya **snapshot jam** — jadi keterlambatan bisa dihitung tanpa
membangun fitur jadwal M5. Query acuan untuk hitung-N sudah ada di `rules/04` §5.

## D. Perbedaan dari M3

| Hal | M3 | M4 |
|---|---|---|
| Aktor | karyawan (token) | Admin (sesi + izin) |
| Route | publik | semua `guard()` |
| Inti | urutan operasi | perhitungan batas menit |
| Risiko utama | gagal sebelum DB | **salah 1 detik** di batas 5 menit |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Aturan keterlambatan berubah (`rules/02` §6) | bagian 5a dan 8 |
| Aturan verifikasi berubah (`rules/02` §4) | bagian 6 dan 8 |
| Aturan koreksi berubah (`rules/02` §10) | bagian 6 dan 8 |
| Kolom absensi berubah | `rules/04` §2 lalu bagian 4 |
