# 16 — Prompt Agent Milestone M8 (Rekap & Ekspor)

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
Baca rules/00-decision-log.md bagian A dan pastikan K-13, K-32, K-33, K-39 ada.
Kalau ada yang belum ada -> JANGAN menulis kode, tulis ke rules/OPEN_QUESTIONS.md
(ID B-21 seterusnya), tampilkan, lalu BERHENTI.

Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  npm run build   # harus hijau sebelum Anda mengubah apa pun

################################################################
2. INI MILESTONE YANG MENGHIDUPKAN KUNCI PERIODE
################################################################
Cek ini dulu sebelum menulis apa pun:

  grep -rn "INSERT INTO log_ekspor" src/

Hasilnya harus TIDAK ADA. Kalau ternyata sudah ada, laporkan dan BERHENTI.

SudahDiekspor() dibaca di 11 tempat (verifikasi, koreksi, jadwal, ketidakhadiran), tapi
belum ada satu pun kode yang MENULIS log_ekspor. Artinya K-32 dan BR-R8 selama ini hanya
hidup di test fixture, belum pernah terjadi dalam alur nyata.

Anda yang pertama kali mengaktifkannya. Kalau penulisan log_ekspor salah saja, seluruh kunci
periode yang sudah dibangun empat milestone menjadi tidak berarti.

################################################################
3. BACA DOKUMEN INI DULU
################################################################
  AGENTS.md
  rules/02-system-spec.md   <- §11 REKAP DAN EKSPOR (BR-R1..R8), §5 Kehadiran (BR-H1/H2),
                               §6 Keterlambatan (BR-L3!), §4 verifikasi (BR-V4/V5),
                               §9 ketidakhadiran, §16 audit log
  rules/05-ui-ux-rules.md   <- §5.6 Rekap & Ekspor
  rules/04-database-design.md <- absensi + log_ekspor + indeksnya
  rules/03-system-design.md <- §1 istilah, §5 waktu, §7 Telegram (jangan sampai token bocor)
  rules/00-decision-log.md <- K-13, K-32, K-33

################################################################
4. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
WAJIB dipakai ulang:
  src/server/aturan/keterlambatan.ts (M4)   pilihSlot, hitungN, hitungSelisih
      -> dipakai untuk kolom "selisih sistem (menit)" di sheet Detail Harian (BR-R5)
  src/server/aturan/absensi.ts (M3)
      eventAktif(status)        status <> 'DITOLAK'
      sudahDiekspor(tanggal, tokoId, ex)   sudah digunakan M4/M5/M6
  src/server/repo/absensi.ts (M3)
      checkInTerbukaTanpaBatas()  -> DEFINISI "check-in terbuka" (lihat Jebakan 3)
  src/server/repo/pengaturan.ts  bacaAmbang()
  src/server/db.ts               denganTransaksi()
  src/server/audit.ts            catatAudit(entry, executor)

Lainnya:
  Izin 'rekap' dan 'ekspor' sudah ada (ADMIN + SUPER_ADMIN). Jangan tambah izin.
  exceljs ^4.4.0 SUDAH ADA di package.json sejak M0. TANPA dependensi baru.
  src/server/waktu.ts punya tanggalWIB(), tanggalPanjangWIB(), serialisasiWIB(), geserJamISO().
  Menu "Rekap & Ekspor" masih `segara: true` -> aktifkan di bagian 8.
  vitest.config.mts fileParallelism: false. JANGAN diubah.

################################################################
5. JEBRAKAN — BACA DULU SEBELUM MENULIS QUERY
################################################################

--- Jebakan 1 — REKAP memakai angka FINAL, DASHBOARD memakai SISTEM ---
Ini kebalikan total dari M7, dan itu jebakan nomor satu milestone ini.

  M7 dashboard  "Terlambat"    -> terlambat_sistem, DIHITUNG ULANG
  M8 rekap      "Total menit"   -> keterlambatan_final_menit, KOLOM di database

BR-L3: "Rekap memakai HANYA angka final; NULL dihitung 0."

Kalau Anda menyalin `terlambatSistem()` dari M7 ke rekap, hasilnya TERBALIK SEPENUHNYA.

Dan BR-R5 meminta sheet "Detail Harian" memuat KEDUA angka sekaligus:
  - "selisih sistem (menit)"        -> hitung ulang, sama seperti M7
  - "keterlambatan final (menit)"   -> kolom, apa adanya
Jangan sampai keduanya tertukar.

--- Jebakan 2 — "Hari hadir" BUKAN jumlah pasangan ---
BR-H1: hadir pada tanggal T jika ada >= 1 pasangan valid dengan tanggal T
BR-H2: dihitung per tanggal unik. Dua pasangan valid di tanggal sama tetap 1 hari.

Tiga kesalahan yang mudah terjadi:
  a) menghitung JUMLAH pasangan, bukan tanggal unik -> dua pasangan sehari jadi 2 hari
  b) menghitung pasangan SETENGAH disetujui -> harus 0
     (pasangan sah hanya bila check-in DAN check-out sama-sama DISETUJUI, BR-V4)
  c) menghitung check-out dari check-in DITOLAK sebagai pasangan -> SALAH
     BR-V5: check-out itu berdiri sendiri, bukan pasangan

--- Jebakan 3 — syarat ekspor punya DUA kondisi, bukan satu ---
BR-R2: dalam filter tidak boleh ada event MENUNGGU DAN tidak boleh ada check-in terbuka.

Definisi check-in terbuka sudah ada di checkInTerbukaTanpaBatas() (M3):
  CHECKIN dengan status <> 'DITOLAK' yang TIDAK punya CHECKOUT dengan status <> 'DITOLAK'

Perhatikan efeknya: check-out yang DITOLAK membuat check-in-nya tetap terbuka, sehingga
MEMBLOKIR ekspor. Admin harus menolak check-in-nya juga, atau memperbaiki datanya.
Ini konsisten dengan BR-V5, tapi harus disadari.

Fungsi M3 itu per karyawan. Untuk M8 butuh SATU query rentang — jangan issuing 26 query.

Pemeriksaan WAJIB di server, bukan hanya di UI (lihat AGENTS.md).

--- Jebakan 4 — peringatan tidak boleh memblokir ---
BR-R3 (K-33): karyawan terjadwal tanpa absen dan tanpa penandaan = PERINGATAN SAJA.
Tombol ekspor TETAP AKTIF. Yang paling mudah salah: agent melihat kata "peringatan" lalu
mematikan tombol ekspor. Jangan.

--- Jebakan 5 — pratinjau dan ekspor harus memberi angka yang SAMA ---
§5.6 menampilkan pratinjau tabel ringkasan, lalu tombol "Unduh Excel". Kalau keduanya
menghitung terpisah, angkanya bisa berbeda — itu persis bug B-19. Pakai SATU jalur
perhitungan, dua tampilan.

--- Jebakan 6 — race antara pemeriksaan dan pembuatan file ---
Jangan: periksa -> keluar transaksi -> buat file -> tulis log_ekspor.
Pemeriksaan syarat ekspor harus DI DALAM transaksi yang sama dengan penulisan log_ekspor.
Kalau tidak, ada jendela di mana admin lain memverifikasi sesuatu di antara keduanya.

--- Jebakan 7 — NULL toko berarti SEMUA toko ---
sudahDiekspor() memperlakukan toko_id IS NULL sebagai mencakup semua toko. Jadi ekspor
untuk "semua toko" akan mengunci SELURUH toko pada periode itu. Ini harus disadari,
bukan kejutan.

################################################################
6. SCOPE MILESTONE M8
################################################################
Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. Tanpa dependensi baru.

--- 6a. src/server/aturan/rekap.ts (BARU) ---
Fungsi MURNI tanpa database:
  pasanganValid(checkin, checkout) -> boolean     BR-V4 + BR-V5
  hitungHariHadir(pasangan) -> Set<tanggal>       BR-H1/H2 (per tanggal unik)
  rekapKaryawan(input) -> KartuRingkasan          BR-R4 (WAJIB pakai angka FINAL)
  hitungPeringatan(terjadwal, tanpaAbsen, bertanda) -> number   BR-R3

PENTANG: fungsi-fungsi ini tidak boleh menerima maupun membaca keterlambatan_final_menit
sebagai sumber "terlambat". Yang dipakai hanya kolom itu untuk TOTAL, bukan untuk
penentuan siapa yang terlambat.

--- 6b. src/server/rekap.ts atau src/server/repo/rekap.ts (BARU) ---
  periksaSyaratEkspor(filter, ex) -> { boleh, jumlahMenunggu, jumlahCheckinTerbuka,
                                        peringatan }
  barisRingkasan(filter, ex)       BR-R4
  barisDetail(filter, ex)          BR-R5
  catatEkspor(filter, pelakuId, ex)  BR-R6: log_ekspor + audit, di transaksi yang sama

filter = { dari: string; sampai: string; tokoId: number | null }  BR-R1 (tokoId null = semua)

--- 6c. src/server/ekspor.ts (BARU) ---
  buatWorkbook(filter, data) -> Buffer
  Pakai exceljs (SUDAH terpasang). Tepat DUA sheet, nama PERSIS:
      "Ringkasan"      kolom BR-R4
      "Detail Harian"  kolom BR-R5, seluruh 12 kolom
  BR-R7: waktu di Excel ditampilkan WIB.
  Jangan menambah sheet, jangan menambah kolom di luar daftar BR-R4/BR-R5, jangan
  menulis apa pun ke sel yang berasal dari URL Telegram atau token bot.

--- 6d. Route API ---
  POST /api/admin/rekap/periksa   guard('rekap')    hasil pemeriksaan
  GET  /api/admin/rekap           guard('rekap')    pratinjau + ringkasan
  POST /api/admin/rekap/ekspor    guard('ekspor')   file .xlsx

Route ekspor wajib: periksa syarat -> catat log_ekspor + audit -> baru susun file.
Semua dalam SATU transaksi untuk bagian periksa + catat.

Daftarkan ketiga route di tests/guard-origin.test.ts.

--- 6e. Halaman /admin/rekap ---
Sesuai rules/05 §5.6:
1. Filter rentang tanggal + toko (Semua / satu). Tombol "Periksa & Buat Rekap".
2. Panel Pemeriksaan:
   - Lolos -> hijau "Semua absensi pada periode ini sudah diverifikasi."
   - Gagal -> merah: jumlah MENUNGGU dan jumlah check-in belum check-out, DENGAN TAUTAN
     ke /admin/verifikasi yang filter-nya sudah terisi. Tombol ekspor NONAKTIF.
   - Peringatan (tidak memblokir): jumlah karyawan terjadwal tanpa absen dan tanpa
     penandaan (K-33).
3. Pratinjau tabel ringkasan (nama, toko, hari hadir, izin, tanpa keterangan,
   total menit terlambat final).
4. Tombol "Unduh Excel (.xlsx)".

Filter disimpan di URL agar bisa di-refresh.

################################################################
7. TES — BAGIAN YANG PALING SERING GAGAL
################################################################
DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)
  menguji fungsi privat langsung

WAJIB ada tes untuk:

  Angka FINAL, bukan sistem (Jebakan 1)
  [ ] check-in terlambat sistem, final NULL -> total 0
  [ ] check-in TIDAK terlambat sistem, final 45 -> total 45
  [ ] Sheet Detail menampilkan KEDUA kolom: selisih sistem DAN keterlambatan final,
      dan nilainya tidak tertukar (bangun kasus di mana keduanya berbeda)

  Hari hadir (Jebakan 2)
  [ ] Satu pasangan sah -> 1 hari hadir
  [ ] DUA pasangan sah di tanggal sama -> TETAP 1 hari
  [ ] Pasangan setengah disetujui (hanya check-in DISETUJUI) -> 0 hari
  [ ] Check-out dari check-in DITOLAK -> 0 hari (BR-V5)
  [ ] Dua karyawan berbeda di tanggal sama -> masing-masing 1 hari

  Syarat ekspor (Jebakan 3)
  [ ] Ada MENUNGGU -> GAGAL, dengan jumlahnya benar
  [ ] Ada check-in terbuka -> GAGAL, dengan jumlahnya benar
  [ ] Keduanya ada -> GAGAL, kedua jumlah ditampilkan
  [ ] Bersih -> LOLOS
  [ ] Check-out DITOLAK pada check-in DISETUJUI -> check-in itu TERBUKA dan memblokir
  [ ] Cek dilakukan di SERVER: panggil route langsung tanpa lewat UI

  Peringatan tidak memblokir (Jebakan 4)
  [ ] Karyawan terjadwal tanpa absen tanpa penandaan -> hanya PERINGATAN, ekspor tetap LOLOS
  [ ] Jumlah peringatan benar
  [ ] Peringatan TIDAK muncul sebagai alasan gagal

  Pratinjau == ekspor (Jebakan 5)
  [ ] Angka pratinjau ringkasan sama persis dengan isi sheet "Ringkasan"

  Race (Jebakan 6)
  [ ] Pemeriksaan + tulis log_ekspor dalam SATU transaksi: buktikan dengan membuat
      kegagalan setelah cek (mis. injeksi galat saat menulis log_ekspor) -> TIDAK ada
      file yang dihasilkan dan TIDAK ada baris log_ekspor

  Kunci periode hidup (bagian 2)
  [ ] Setelah ekspor, verifikasi pada periode itu: ADMIN 403, Super Admin 200 (BR-R8)
  [ ] Setelah ekspor, koreksi pada periode itu: ADMIN 403, Super Admin 200 (BR-K6)
  [ ] Setelah ekspor, penandaan pada periode itu: ADMIN 403 (BR-X4)
  [ ] Setelah ekspor, jadwal pada periode itu: ADMIN 403 (BR-J9)
  [ ] Ekspor "semua toko" (tokoId null) mengunci SEMUA toko, bukan hanya satu
  [ ] Diuji END-TO-END: ekspor lewat route dulu, baru cek kunci. JANGAN pakai
      fixture log_ekspor yang disisipkan manual — itu yang sudah dilakukan M4-M6
      dan tidak pernah menguji alur nyata.

  log_ekspor & audit (BR-R6)
  [ ] Setiap ekspor menulis 1 baris log_ekspor dengan pelaku, waktu, rentang, toko
  [ ] Audit tercatat
  [ ] Penulisan dua kali berurutan menghasilkan 2 baris (bukan menimpa)

  Excel (BR-R5, BR-R7)
  [ ] Tepat DUA sheet dengan nama persis "Ringkasan" dan "Detail Harian"
  [ ] Sheet Ringkasan punya kolom BR-R4
  [ ] Sheet Detail Harian punya SEMUA kolom BR-R5
  [ ] Waktu tampil WIB — buktikan nilainya, bukan hanya nama kolom
  [ ] File yang dihasilkan bisa dibaca ulang (baca balik dengan exceljs, cek isi sel)

  UI
  [ ] Gagal: tombol ekspor nonaktif + jumlah tampil + tautan ke Verifikasi dengan filter
  [ ] Peringatan: tombol ekspor TETAP aktif
  [ ] Nama sheet sesuai

################################################################
8. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone (K-44):
                            TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
  [ ] Seluruh checklist bagian 7 punya isi dan LULUS
  [ ] migrations/0001_init.sql TIDAK berubah (md5 harus 466a7b1a5aa5b1ab0a88e0a5f63a8a98)
  [ ] src/server/aturan/keterlambatan.ts, absensi.ts, repo/absensi.ts TIDAK diubah
  [ ] src/app/api/absen/route.ts TIDAK berubah
  [ ] waktu.ts, guard.ts, auth.ts, audit.ts, izin.ts, db.ts TIDAK berubah
  [ ] vitest.config.mts TIDAK berubah
  [ ] package.json TIDAK berubah (exceljs sudah ada)
  [ ] Tidak ada dependensi baru
  [ ] Tidak ada URL Telegram atau token bot yang masuk ke workbook maupun ke respons

BUKTI WAJIB sebelum melapor: untuk tiap aturan utama (BR-L3 angka final, BR-R2 syarat
ekspor, BR-H1/H2 hari hadir, BR-R3 peringatan, BR-R6 log, K-32 kunci), matikan aturannya
sementara, jalankan tes, lalu catat BERAPA tes yang gagal. Tes yang TIDAK gagal saat
aturannya dimatikan berarti tes itu tidak menguji apa pun — tulis hasilnya di laporan,
jangan diklaim "sudah dites".

KHUSUS untuk kunci periode: buktikan bahwa MULAI MENJADI NYATA di milestone ini, yaitu
tes yang mengekspor lewat route sungguhan lalu membuktikan ADMIN terkunci. Kalau tes Anda
masih menyisipkan baris log_ekspor secara manual, itu belum membuktikan apa pun.

################################################################
9. CARA KERJA
################################################################
  1. Baca dokumen (bagian 3), pastikan bagian 4 dan bagian 2
  2. aturan/rekap.ts + tesnya (bagian 6a) — fungsi murni dulu, tanpa DB
  3. repo rekap + tesnya (periksa syarat ekspor sebagai SATU query rentang)
  4. Kunci periode end-to-end (bagian 7) — ini yang membedakan M8 dari semua M sebelumnya
  5. ekspor.ts (exceljs) + tesnya — termasuk membaca balik file yang dihasilkan
  6. Route + tesnya — daftarkan di tests/guard-origin.test.ts sekalian
  7. Halaman /admin/rekap + aktifkan menu
  8. Jalankan build, typecheck, lalu npm run test:tz
  9. Jalankan bukti mutasi (bagian 8)
 10. Tulis laporan (bagian 10)

################################################################
10. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M8
Selesai: <file yang dibuat / diubah>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
BR-L3 angka final: <bukti final NULL -> 0, final 45 -> 45>
Kedua kolom sheet: <bukti selisih sistem dan keterlambatan final tidak tertukar>
BR-H1/H2 hari hadir: <bukti dua pasangan satu tanggal = 1; setengah disetujui = 0>
BR-V5: <bukti check-out dari check-in DITOLAK bukan pasangan>
BR-R2 syarat ekspor: <bukti MENUNGGU memblokir; check-in terbuka memblokir; keduanya>
BR-R2 definisi: <bukti check-out DITOLAK membuat check-in tetap terbuka dan memblokir>
BR-R3 peringatan: <bukti peringatan tidak memblokir, tombol tetap aktif>
Pratinjau == Excel: <bukti angka sama persis>
BR-R6: <bukti log_ekspor + audit, dua ekspor = dua baris>
Kunci periode NYATA: <bukti ekspor lewat route lalu ADMIN 403 / Super Admin 200 pada
  verifikasi, koreksi, penandaan, dan jadwal>
Ekspor semua toko: <bukti tokoId null mengunci semua toko>
Race: <bukti kegagalan saat tulis log_ekspor -> tidak ada file, tidak ada baris>
BR-R7 waktu WIB: <bukti nilai waktu di dalam workbook>
Sheet: <bukti tepat dua sheet, nama persis, baca balik file berhasil>
UI: <bukti tombol nonaktif saat gagal, tautan terfilter, aktif saat hanya ada peringatan>
Pagar Origin: <bukti ketiga route terdaftar>
BUKTI MUTASI: <WAJIB. Tabel: aturan yang dimatikan -> berapa tes gagal>
Verifikasi dokumentasi eksternal: <tidak ada, atau apa dan sumber>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
11. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M9 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| `exceljs ^4.4.0` | **sudah ada** di `package.json` sejak M0 |
| Izin `rekap`, `ekspor` | sudah ada di `IZIN_MATRIX` |
| `sudahDiekspor()` + `pastikanBelumDiekspor()` | sudah dipakai M4/M5/M6 |
| `checkInTerbukaTanpaBatas()` | sudah ada (M3), definisi "check-in terbuka" |
| Tabel `log_ekspor` | sudah ada, **belum pernah ditulis** |

## C. Yang sudah diverifikasi

- **`INSERT INTO log_ekspor` tidak ada di `src/`.** Kunci periode K-32 belum pernah
  terjadi dalam alur nyata — hanya di test fixture M4/M5/M6.
- `sudahDiekspor()` memakai `toko_id IS NULL` untuk mencakup semua toko.
- `checkInTerbukaTanpaBatas()` menyaring `status <> 'DITOLAK'` di **kedua** sisi
  (check-in dan check-out).
- `BR-L3` dan definisi `M7` berlawanan arah — ini pembeda utama M8 dari M7.

## D. Perbedaan dari M7

| Hal | M7 | M8 |
|---|---|---|
| Sumber angka terlambat | dihitung ulang (sistem) | **kolom** (final admin) |
| Sifat | baca | **tulis + mengunci** |
| Output | angka di layar | **file** yang dibaca manusia |
| Efek samping | tidak ada | **mengunci periode** (K-32) |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Aturan rekap berubah (`rules/02` §11) | bagian 5, 6, 7 |
| UI rekap berubah (`rules/05` §5.6) | bagian 6e |
| BR-L3 berubah | bagian 5 (Jebakan 1) |
| BR-H1/H2 berubah | bagian 5 (Jebakan 2) |
| K-13 / K-33 berubah | bagian 5 (Jebakan 3, 4) |
| K-32 berubah | bagian 2, 6b, 7 |
| Aturan `log_ekspor` berubah (`rules/04` §2) | bagian 4 lalu bagian 7 |
