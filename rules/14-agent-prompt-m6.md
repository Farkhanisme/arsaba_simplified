# 14 — Prompt Agent Milestone M6 (Tandai Tidak Berangkat)

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
Baca rules/00-decision-log.md bagian A dan pastikan K-19, K-22, K-31, K-32 ada.
Kalau ada yang belum ada -> JANGAN menulis kode, tulis ke rules/OPEN_QUESTIONS.md
(ID B-21 seterusnya), tampilkan, lalu BERHENTI.

Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  npm run build   # harus hijau sebelum Anda mengubah apa pun

################################################################
2. KEPUTUSAN PEMILIK — BACA DULU, INI YANG BARU
################################################################
Dokumen tidak menulis apa yang terjadi kalau satu penandaan terblokir di tengah batch.
Pemilik sudah memutuskan (tanggal 2026-10-03):

  Penandaan yang terblokir DILEWATI dan DILAPORKAN per sel. Sel lain tetap tersimpan.

Tabel berikut yang wajib diikuti:

| Kasus                                   | Perlakuan                          |
|-----------------------------------------|------------------------------------|
| BR-X3 ada event aktif                   | ditolak PER SEL, sel lain tersimpan |
| BR-X2 sudah ada penandaan               | ditolak PER SEL + pesan jelas       |
| karyawan tidak ditempatkan di toko mana pun pada tanggal itu | ditolak PER SEL + pesan jelas |
| semua sel ditolak                       | 409 + daftar alasan, nol tersimpan |
| error tak terduga (bukan GalatAturan)   | rollback SELURUH operasi           |
| 403 K-32 periode terekspor, Admin biasa | FAIL-FAST, seluruh operasi GAGAL    |

Pengecualian 403 disengaja dan wajib Keras: K-32 itu soal WEWANGAN, bukan kondisi data.
Mendiamkan Admin melewati batas wewenang Super Admin tidak boleh. Jangan jadikan 403
penolakan per sel.

Dua keputusan turunan dari pemilik (inferensi, bukan teks dokumen — sebut di laporan):

1. Batch TIDAK menimpa penandaan yang sudah ada. BR-X4 sudah menyediakan aksi "Ubah" yang
   eksplisit, jadi tidak perlu mode timpa seperti M5. Penandaan lama = ditolak per sel
   dengan pesan yang mengarah ke Ubah.
2. `toko_id` diambil dari penempatan karyawan PADA TANGGAL ITU. Alasannya BR-P4 (rekap
   memakai snapshot) dan BR-A12 (absensi juga begitu). Kalau tidak ada penempatan pada
   tanggal itu -> ditolak per sel dengan pesan jelas.

################################################################
3. BACA DOKUMEN INI DULU
################################################################
  AGENTS.md
  rules/02-system-spec.md   <- §9 Ketidakhadiran BR-X1..X5, §11 BR-R8, §17 kasus tepi,
                               §3 BR-A9 (sudah jadi, jangan diubah)
  rules/03-system-design.md <- §1 istilah, §5 waktu (K-45)
  rules/04-database-design.md <- DDL ketidakhadiran + catatan constraint
  rules/05-ui-ux-rules.md   <- §5.5 halaman Tandai Tidak Berangkat
  rules/01-prd.md          <- US-A4
  rules/00-decision-log.md <- K-19, K-22, K-31, K-32

################################################################
4. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
WAJIB cek dulu, karena M6 ternyata separuhnya sudah jadi dari M3:

  Tabel `ketidakhadiran` sudah ada dengan UNIQUE (karyawan_id, tanggal). TIDAK PERLU migrasi.
  BR-A9 SUDAH ditegakkan di src/app/api/absen/route.ts, dua kali: cek awal (~baris 151)
  dan di dalam transaksi (~baris 202). JANGAN sentuh file itu.
  Izin 'tidak_berangkat' sudah ada di src/server/izin.ts (ADMIN + SUPER_ADMIN).
  penandaanPadaTanggal() sudah ada di src/server/repo/absensi.ts.
  sudahDiekspor(tanggal, tokoId, ex) sudah ada di src/server/aturan/absensi.ts (dari M4).
  tokoPadaTanggal() dan riwayatPenempatanUntukTanggal() sudah ada.
  Menu "Tandai Tidak Berangkat" sudah ada di menu.ts, masih `segara: true`.

Reuse yang WAJIB (jangan tulis ulang):
  eventAktif(status) dari server/aturan/absensi.ts  -> menentukan "event aktif" BR-X3
  BR-X3 secara presisi: event aktif = status 'MENUNGGU' atau 'DISETUJUI'.
  'DITOLAK' BUKAN event aktif -> penandaan TETAP BOLEH dibuat kalau eventnya DITOLAK.

################################################################
5. SCOPE MILESTONE M6
################################################################
Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. Tanpa dependensi baru.

--- 5a. src/server/aturan/ketidakhadiran.ts (BARU) ---
Fungsi MURNI tanpa database, wajib unit-testable:
  bolehTandai(statusEvent[])        BR-X3: MENUNGGU/DISETUJUI memblokir, DITOLAK tidak
  bentukRentang(dari, sampai)       BR-X5: satu tanggal atau rentang
  klasifikasiPenandaan(...)         status: dibuat | ditolak (+alasan), TANPA melempar

`klasifikasiPenandaan` TIDAK BOLEH melempar untuk kasus penolakan. Inilah yang membedakan
perilaku batch M6 dari bug B-19.

--- 5b. src/server/repo/ketidakhadiran.ts (BARU) ---
  buat(input, ex)                    satu penandaan
  ubah(id, jenis, catatan, ex, adminId)   BR-X4
  hapus(id, ex, adminId)             BR-X4
  daftar(filter, ex)                 filter toko/tanggal/karyawan
  terapkanMassal(input, tanggalan, ex)      BR-X5 + keputusan bagian 2

WAJIB:
  - Mutasi DI DALAM satu denganTransaksi() + catatAudit(..., tx) di transaksi yang sama.
  - Cek BR-X3 DI DALAM transaksi, bukan hanya sebelumnya (pola yang sama seperti BR-A9).
  - Penandaan yang ditolak TIDAK menulis audit (tidak ada mutasi).
  - Todos mutasi yang berhasil harus tercatat dengan nilai SEBELUM dan SESUDAH.

--- 5c. Route API — SEMUA lewat guard('tidak_berangkat', ...) ---
  GET  /api/admin/tidak-berangkat           daftar + filter
  POST /api/admin/tidak-berangkat           buat satu / rentang (massal)
  PUT  /api/admin/tidak-berangkat/[id]      BR-X4 ubah jenis/catatan
  DELETE /api/admin/tidak-berangkat/[id]   BR-X4 hapus

WAJIB langsung daftarkan keempat route di tests/guard-origin.test.ts. Tes itu
membandingkan daftar route terdaftar dengan seluruh route.ts di src/app/api — route yang
lupa diuji membuat tes gagal.

--- 5d. Halaman /admin/tidak-berangkat ---
Sesuai rules/05 §5.5 (lihat bagian 6). Aktifkan menu (hapus `segara: true`); tes hitung
menu dari M2 kemungkinan perlu diperbarui.

################################################################
6. ATURAN YANG PALING MUDAH DILANGGAR
################################################################

BR-X3 — "Event aktif" itu PERSIS 'MENUNGGU' atau 'DISETUJUI'. Event 'DITOLAK' TIDAK
menghalangi penandaan. Ini perbedaan halus yang mudah salah: admin menolak absen dulu (K-19),
lalu baru bisa menandai. Kalau DITOLAK ikut dihitung aktif, admin tidak akan pernah bisa
menandai siapa pun yang absennya sudah ditolak.

BR-X3 juga WAJIB dicek di dalam transaksi. Kalau hanya dicek sebelum transaksi, dua
request bersamaan bisa sama-sama lolos lalu dua-duanya menulis.

BR-X2 + UNIQUE(karyawan_id, tanggal) — penandaan ganda harus ditolak dengan pesan jelas,
bukan error constraint mentah dari database. Pesan harus Bahasa Indonesia dan mengarah ke
aksi Ubah.

BR-X4 — boleh diubah jenis/catatan DAN boleh dihapus kembali. Keduanya tercatat audit.
Hapus TIDAK boleh lebih dari itu: tidak ada hapus massal diam-diam, tidak ada cascade ke
tabel lain. Penandaan boleh dihapus karena itulah cara admin memblokir dibuka lagi (K-31).

BR-R8 / K-32 — penandaan pada periode yang sudah diekspor hanya Super Admin. Admin biasa
mendapat 403. Gunakan sudahDiekspor(). Cek ini yang FAIL-FAST (lihat bagian 2), bukan
penolakan per sel.

K-31 — sampai penandaan DIHAPUS, karyawan tetap diblokir absen. Ini sudah ditangani
BR-A9 di route absen (jangan diubah). Yang M6 bangun adalah sisi admin untuk membuat,
mengubah, dan menghapus penandaan itu.

Tidak ada aturan "tidak boleh menandai tanggal lampau" di dokumen. BR-X4 dan BR-X3 sudah
menutup kasusnya: kalau tanggal lampau masih ada event aktif, BR-X3 yang menolak. Jangan
tambah aturan tanggal sendiri.

################################################################
7. HALAMAN /admin/tidak-berangkat (rules/05 §5.5)
################################################################
- Formulir: karyawan (multi-pilih), tanggal (satu ATAU rentang), jenis (Izin / Tanpa
  Keterangan), catatan opsional.
- Bila ada event aktif pada tanggal terkait: pesan blokir **persis** —
  "Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu." —
  DENGAN TAUTAN ke halaman Verifikasi. Pesan ini ada di rules/05 §5.5, gunakan persis.
- Setelah berhasil: tampilkan rincian — jumlah dibuat, jumlah ditolak **beserta alasan
  perolyanya**. Jangan hanya tampilkan "berhasil".
- Daftar di bawah form: filter toko/tanggal; aksi Ubah dan Hapus (Hapus dengan konfirmasi).
- Filter disimpan di URL agar bisa di-refresh.
- Kosong: pesan "Belum ada penandaan ketidakhadiran."
- Tampilan badge untuk jenis: Izin / Tanpa Keterangan, plus catatan kalau ada.
- Jangan pernah menampilkan URL Telegram, token, atau data internal apa pun.

################################################################
8. TES — BAGIAN YANG PALING SERING GAGAL
################################################################
DILARANG:
  expect(kodeFile).toContain('...')            # menguji teks
  expect(true).toBe(true)                      # menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)    # lulus walau halaman rusak
  menguji fungsi privat langsung

WAJIB ada tes untuk:

  BR-X3 event aktif — INI YANG PALING PENTING
  [ ] Event MENUNGGU pada tanggal itu -> penandaan DITOLAK
  [ ] Event DISETUJUI pada tanggal itu -> penandaan DITOLAK
  [ ] Event DITOLAK pada tanggal itu -> penandaan BOLEH (dan TIDAK kehitung sebagai aktif)
  [ ] Event pada tanggal LAIN -> penandaan BOLEH
  [ ] Event belonging to karyawan LAIN -> penandaan BOLEH
  [ ] Penandaan yang gagal karena BR-X3 tidak menulis audit

  BR-X2
  [ ] Dua penandaan untuk (karyawan, tanggal) yang sama -> DITOLAK dengan pesan jelas
  [ ] Pesan yang muncul berbahasa Indonesia, bukan error constraint mentah

  BR-X4
  [ ] Ubah jenis IZIN -> TANPA_KETERANGAN tersimpan, tercatat audit dengan before/after
  [ ] Ubah catatan tersimpan
  [ ] Hapus penandaan -> afterwards, karyawan BISA absen lagi pada tanggal itu
      (bukti: hapus penandaan, lalu route absen tidak lagi mengembalikan TANGGAL_BERTANDA)
  [ ] Hapus tercatat di audit

  BR-X5 + keputusan batch (bagian 2)
  [ ] Rentang 3 hari untuk 1 karyawan -> 3 penandaan
  [ ] BATCH SEPARUH: 1 dari N karyawan punya event aktif -> 201; yang lain TERSIMPAN;
      yang ditolak DILAPORK dengan alasan; dan GET daftar MEMBUKTIKAN yang tersimpan
  [ ] Semua ditolak -> 409 + daftar alasan, dan TIDAK ADA penandaan tersimpan
  [ ] 403 K-32 (Admin, periode terekspor) -> FAIL-FAST, seluruh operasi gagal,
      penandaan di luar periode itu TIDAK ikut tersimpan
  [ ] Super Admin pada periode terekspor -> BOLEH
  [ ] Error tak terduga -> rollback SELURUH, nol penandaan tersimpan
  [ ] Penandaan yang sudah ada di tengah rentang -> hanya sel itu ditolak, sisanya tersimpan

  K-32
  [ ] ADMIN 403 pada periode terekspor (buat, ubah, hapus)
  [ ] Super Admin 200 pada periode terekspor

  Audit
  [ ] Setiap buat/ubah/hapus tercatat dengan SEBELUM dan SESUDAH
  [ ] Mutasi + audit yang di-ROLLBACK tidak meninggalkan jejak audit

  Izin
  [ ] ADMIN bisa membuat penandaan (K-22)
  [ ] Route baru terdaftar di tests/guard-origin.test.ts

  UI
  [ ] Pesan blokir BR-X3 tampil PERSIS seperti rules/05 §5.5
  [ ] Ada tautan ke Verifikasi pada pesan itu

################################################################
9. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone (K-44):
                            TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
      Offset negatif itu wajib. Kalau hanya dua timezone pertama, K-44 BELUM terpenuhi.
  [ ] Seluruh checklist bagian 8 punya isi dan LULUS
  [ ] migrations/0001_init.sql TIDAK berubah (md5 harus 466a7b1a5aa5b1ab0a88e0a5f63a8a98)
  [ ] src/app/api/absen/route.ts TIDAK berubah (BR-A9 sudah benar sejak M3)
  [ ] guard.ts, auth.ts, audit.ts, izin.ts, db.ts, waktu.ts, aturan/absensi.ts TIDAK berubah
  [ ] vitest.config.mts dan package.json TIDAK berubah
  [ ] Tidak ada dependensi baru

BUKTI WAJIB sebelum melapor: untuk tiap aturan utama (BR-X3, BR-X2, BR-X4, BR-R8/K-32,
keputusan batch bagian 2), matikan aturannya sementara, jalankan tes, lalu catat BERAPA tes
yang gagal. Tes yang TIDAK gagal saat aturannya dimatikan berarti tes itu tidak menguji apa
pun — tulis hasilnya di laporan, jangan diklaim "sudah dites".

################################################################
10. CARA KERJA
################################################################
  1. Baca dokumen (bagian 3) dan pastikan dulu isi bagian 4
  2. aturan/ketidakhadiran.ts + tesnya (bagian 5a) — mulai dari sini, tanpa DB
  3. repo/ketidakhadiran.ts + tesnya (transaksi + audit)
  4. Route API + tesnya — daftarkan di tests/guard-origin.test.ts sekalian
  5. Halaman /admin/tidak-berangkat + aktifkan menu
  6. Jalankan build, typecheck, lalu npm run test:tz
  7. Jalankan bukti mutasi (bagian 9)
  8. Tulis laporan (bagian 11)

################################################################
11. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M6
Selesai: <file yang dibuat / diubah>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
BR-X3 event aktif: <bukti MENUNGGU dan DISETUJUI memblokir>
BR-X3 DITOLAK: <bukti event DITOLAK TIDAK memblokir penandaan>
BR-X2 ganda: <bukti ditolak + pesan Bahasa Indonesia, bukan error constraint>
BR-X4 ubah/hapus: <bukti keduanya tersimpan + tercatat audit>
BR-X4 hapus membuka blokir: <bukti setelah dihapus, absen tidak lagi TANGGAL_BERTANDA>
BR-X5 rentang: <bukti 3 hari -> 3 penandaan>
Batch sebagian: <bukti 1 dari N terblokir -> 201, yang lain tersimpan, ditolak dilapor>
Semua ditolak: <bukti 409 + alasan, nol tersimpan>
403 fail-fast: <bukti Admin periode terekspor -> seluruh operasi gagal, sel lain TIDAK tersimpan>
Rollback: <bukti error tak terduga me-rollback seluruh operasi>
K-32: <bukti ADMIN 403, Super Admin 200 pada buat/ubah/hapus>
Audit: <bukti setiap mutasi tercatat dengan before/after; sel ditolak menambah 0>
Pagar Origin: <bukti keempat route terdaftar di guard-origin.test.ts>
UI pesan blokir: <bukti pesan persis rules/05 §5.5 + tautan ke Verifikasi>
BUKTI MUTASI: <WAJIB. Tabel: aturan yang dimatikan -> berapa tes gagal. Kalau ada aturan
  yang saat dimatikan TIDAK membuat tes gagal, tulis APA dan kenapa>
Keputusan turunan: <1. batch tidak menimpa; 2. toko_id dari penempatan pada tanggal itu>
K-56: <batas batch dicatat di rules/00? berapa? alasan?>
Verifikasi dokumentasi eksternal: <tidak ada, atau apa dan sumber>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
12. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M7 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| Tabel `ketidakhadiran` + `UNIQUE` | sudah ada, **tanpa migrasi baru** |
| BR-A9 di route absen | sudah ada dari M3, **jangan diubah** |
| Izin `tidak_berangkat` | sudah ada |
| `eventAktif()`, `sudahDiekspor()`, `tokoPadaTanggal()` | sudah ada |
| `tests/guard-origin.test.ts` | 4 route baru wajib didaftarkan |

## C. Yang sudah diverifikasi

- **BR-A9 sudah ditegakkan dua kali** di route absen: cek awal (~baris 151) dan di dalam
  transaksi (~baris 202). Cek awal terjadi **sebelum unggah foto ke Telegram**, jadi karyawan
  bertanda tidak berangkat dapat 409 tanpa foto terunggah — sesuai BR-A4.
- "Event aktif" punya definisi presisi di BR-X3: `MENUNGGU` atau `DISETUJUI`. `DITOLAK`
  tidak termasuk.
- `eventAktif()` sudah ada di `server/aturan/absensi.ts` — pakai itu, jangan tulis ulang.
- Tidak ada migrasi baru. Kalau merasa butuh, **berhenti** dan tulis pertanyaan.

## D. Perbedaan dari M5

| Hal | M5 | M6 |
|---|---|---|
| Aturan ID | BR-J1..J9 | BR-X1..X5 |
| Sumber data | jadwal + jadwal_slot | ketidakhadiran (sudah ada) |
| Pondasi | template shift | event absensi |
| Risiko utama | overlap terblokir | batch gagal diam-diam (B-19) |
| Pelaporan | pratinjau + apply | hanya apply (tanpa pratinjau) |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Aturan ketidakhadiran berubah (`rules/02` §9) | bagian 5a, 6, 8 |
| BR-R8/K-32 berubah | bagian 2, 6, 8 |
| UI berubah (`rules/05` §5.5) | bagian 7 |
| K-19 berubah | bagian 6 |
| Kolom `ketidakhadiran` berubah | `rules/04` §2 lalu bagian 4 |
