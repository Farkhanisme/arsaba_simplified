# 15 — Prompt Agent Milestone M7 (Dashboard)

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
Baca rules/00-decision-log.md bagian A dan pastikan K-22, K-32, K-45, K-51 ada.
Kalau ada yang belum ada -> JANGAN menulis kode, tulis ke rules/OPEN_QUESTIONS.md
(ID B-21 seterusnya), tampilkan, lalu BERHENTI.

Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  npm run build   # harus hijau sebelum Anda mengubah apa pun

################################################################
2. INI MILESTONE AGREGASI PERTAMA — BACA BAGIAN 5 DULU
################################################################
M0-M6 semua bekerja pada SATU baris: satu karyawan, satu tanggal, satu event. M7
menjumlahkan. Agregasi punya kelas kegagalan sendiri: definisi yang salah tidak error,
hanya angkanya salah, dan tidak ada yang mengetahuinya sampai angka itu dipercaya.

Spesifikasinya kecil (rules/02 §12 dan rules/05 §5.2). Yang besar adalah definisinya.
Jangan terburu-buru menulis query sebelum bagian 5 Anda pahami.

################################################################
3. BACA DOKUMEN INI DULU
################################################################
  AGENTS.md
  rules/02-system-spec.md   <- §12 DASHBOARD (tabel metrik, WAJIB persis), §6 keterlambatan,
                               §4 verifikasi, §9 ketidakhadiran
  rules/03-system-design.md <- §1 istilah, §5 waktu (K-45/K-51)
  rules/05-ui-ux-rules.md   <- §5.2 Dashboard
  rules/04-database-design.md <- indeks absensi & jadwal
  rules/00-decision-log.md <- K-22 (izin dashboard), K-28, K-30, K-36

################################################################
4. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
WAJIB dipakai ulang, bukan ditulis ulang:
  src/server/aturan/keterlambatan.ts (dari M4)
      pilihSlot(slots, n)        K-28: slot ke-N, atau slot TERAKHIR
      hitungN(items, targetId)   BR-L1: hanya CHECKIN status <> 'DITOLAK', urut waktu lalu id
      hitungSelisih(menit, slot, ambang)  -> { selisih, terlambatSistem }
  src/server/aturan/absensi.ts (dari M3)
      eventAktif(status)         status <> 'DITOLAK'
  src/server/repo/pengaturan.ts (dari M2)
      bacaAmbang(ex)             BR-L4: ambang dari tabel pengaturan, BUKAN angka 5

Lainnya:
  Izin 'dashboard' sudah ada di src/server/izin.ts (ADMIN + SUPER_ADMIN). Jangan tambah izin.
  src/server/waktu.ts punya tanggalWIB() — sumber tunggal untuk "hari ini".
  src/app/api/admin/test/route.ts sudah memakai guard('dashboard') sejak M1. Jangan diubah.
  Menu "Dashboard" di src/app/admin/menu.ts masih `segara: true` -> aktifkan di bagian 7.
  vitest.config.mts fileParallelism: false. JANGAN diubah.

################################################################
5. DEFINISI METRIK — INI INTI M7
################################################################

Terjadwal    Jumlah karyawan dengan jadwal hari ini
Sudah absen  Karyawan dengan >= 1 check-in AKTIF hari ini
Terlambat    Dari yang sudah absen: ada check-in dengan `terlambat_sistem`
Belum absen  Terjadwal, tanpa check-in aktif, tanpa penandaan tidak berangkat hari ini
Antrean      Jumlah event MENUNGGU (SEMUA TANGGAL, bukan hanya hari ini)

--- Jebakan A — "Terlambat" memakai nilai SISTEM, BUKAN angka final ---
rules/02 §12 menulisnya eksplisit: "ada check-in dengan `terlambat_sistem`
(bukan angka final)". JANGAN PERNAH memakai kolom `keterlambatan_final_menit` untuk
metrik ini. Kolom itu adalah keputusan admin per event, sedangkan dashboard memakai
penilaian sistem yang seragam.

Dua kasus yang harus benar (bisa keduanya dipakai sebagai tes):

  1. Check-in 07:03 (selisih 3 menit, TIDAK terlambat sistem), tapi admin mengisi
     keterlambatan_final_menit = 30.
     -> Dashboard HARUS TIDAK menghitungnya terlambat.

  2. Check-in 07:20 (terlambat sistem 20 menit), tapi admin mengisi
     keterlambatan_final_menit = 0 karena menganggapnya tidak terlambat.
     -> Dashboard HARUS tetap menghitungnya terlambat.

Kalau angka keduanya dibalik, definisi Anda terbalik.

--- Jebakan B — terlambat_sistem DIHITUNG, tidak disimpan ---
Tidak ada kolomnya di database. Hitung saat tampil, WAJIB dengan urutan ini:

  slot   <- jadwal_slot pada tanggal itu (SNAPSHOT, BR-J3) — jangan baca shift_template
  N      <- hitungN(): hanya CHECKIN status <> 'DITOLAK', urut waktu lalu id (BR-L1)
  slot   <- pilihSlot(): slot ke-N, atau slot TERAKHIR kalau N > jumlah slot (K-28)
  ambang <- bacaAmbang() dari tabel pengaturan (BR-L4)
  hasil  <- hitungSelisih(menitDalamHari(waktu), slot, ambang).terlambatSistem

Query naif seperti `waktu > jam_mulai + 5 menit` SALAH pada lima kasus:
jadwal dua slot · perubahan khusus satu hari · N melebihi jumlah slot ·
event DITOLAK menggeser N · admin mengubah ambang di Pengaturan.

--- Jebakan C — "Terjadwal" BUKAN "Sudah absen + Belum absen" ---
Belum absen = terjadwal - sudah_absen - bertanda. Kalau Anda memakai
terjadwal - sudah_absen, karyawan yang bertanda tidak berangkat ikut dihitung sebagai
"belum absen" — padahal mereka memang sengaja tidak masuk.

Penting untuk UI: karena itu, empat angka per toko TIDAK WAJIB berjumlah. Ada karyawan
yang tidak muncul di kolom mana pun. JanganMemaksa penyamaan.

--- Jebakan D — hitung ORANG, bukan event ---
"Karyawan dengan >= 1 check-in aktif". Kalau seorang karyawan check-in dua kali
(kuota BR-A5 mengizinkan maksimal 2), dia dihitung SATU. Gunakan COUNT(DISTINCT
karyawan_id) atau Set, bukan COUNT(*).

--- Jebakan E — "Aktif" berarti bukan DITOLAK ---
Pakai eventAktif() dari server/aturan/absensi.ts. Check-in berstatus DITOLAK tidak
menghitung sebagai sudah absen.

--- Jebakan F — "Hari ini" dari SERVER ---
Semua waktu dari server (K-51). Dilarang jam perangkat klien. Dilarang juga
date('now') atau datetime('now') di SQL — rules/03 §5 menetapkan satu-satunya tempat
manipulasi waktu adalah server/waktu.ts. Panggil tanggalWIB() di server, lalu teruskan
tanggal itu ke query sebagai parameter.

Dan JANGAN TULIS serialisasiWIB(sekarangWIB()). itu menggeser dua kali (BUG-01,
rules/NOTES.md §12). Bentuk benar: tanggalWIB() dan serialisasiWIB() tanpa argumen.

--- Jebakan G — TIDAK BOLEH ada pemilih tanggal ---
rules/05 §5.2: "Tanggal tetap 'Hari ini' (tanpa pemilih tanggal di versi 1)."
Jangan menambah input tanggal, dropdown periode, atau query parameter tanggal.

################################################################
6. SCOPE MILESTONE M7
################################################################
Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. Tanpa dependensi baru.

--- 6a. src/server/aturan/dashboard.ts (BARU) ---
Fungsi MURNI tanpa database, wajib unit-testable:
  terlambatSistem(checkin, itemsSesiKaryawan, slot, ambang) -> boolean
        WAJIB memakai hitungN + pilihSlot + hitungSelisih dari M4
  hitungBelumAbsen(terjadwal, sudahAbsen, bertanda) -> number
  kartuToko(metrik) -> ... (kalau perlu memetakan ke bentuk kartu)

--- 6b. src/server/repo/dashboard.ts (BARU) ---
  metrikPerToko(tanggal, ex)   -> kartu per toko: terjadwal, sudah_absen, terlambat, belum_absen
  antreanVerifikasi(ex)         -> jumlah MENUNGGU semua tanggal
  angkaBanding(tanggal, ex)     -> angka acuan (lihat bagian 8), HANYA untuk pembanding tes

WAJIB: ambil slot, event, dan penandaan untuk HARI INI dengan beberapa query massal.
Jangan issuing satu query per karyawan di dalam loop — baca sekumpulan, lalu hitung
di memori dengan fungsi murni dari 6a. 26 karyawan masih aman, tapi pola yang salah
akan meledak begitu datanya bertambah.

--- 6c. Route ---
  GET /api/admin/dashboard   guard('dashboard')   -> 10 kartu + antrean verifikasi

Daftarkan route ini di tests/guard-origin.test.ts. Tes itu membandingkan daftar route
terdaftar dengan seluruh route.ts di src/app/api — route yang lupa diuji membuat tes gagal.

--- 6d. Halaman /admin ---
Sesuai rules/05 §5.2:
- Satu kartu per toko (10 kartu): Terjadwal · Sudah absen · Terlambat · Belum absen.
- Kartu terpisah "Antrean verifikasi": jumlah MENUNGGU, dengan TAUTAN ke /admin/verifikasi.
- Kartu berwarna NETRAL. Angka "Belum absen" dan "Terlambat" diberi PENEKANAN visual.
- Tanpa pemilih tanggal. Judul mencantumkan tanggal hari ini dari server.
- Toko tanpa karyawan masih tampil dengan angka 0.
- Loading: skeleton. Error: pesan + tombol "Coba lagi".
- Sidebar: menu "Dashboard" untuk kedua peran — HAPUS `segara: true` di menu.ts.
  Tes hitung menu dari M2 kemungkinan perlu diperbarui.

################################################################
7. TES — BAGIAN YANG PALING SERING GAGAL
################################################################
DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)
  menguji fungsi privat langsung

WAJIB ada tes untuk:

  Terlambat = SISTEM, bukan final  (INI YANG PALING PENTING)
  [ ] Kasus 1: tidak terlambat sistem TAPI final = 30 -> dashboard TIDAK terlambat
  [ ] Kasus 2: terlambat sistem TAPI final = 0 -> dashboard TERLAMBAT
  [ ] Tanpa jadwal (slot null) -> TIDAK terlambat, selisih kosong

  Perhitungan slot (lewat fungsi murni, kasus batas)
  [ ] Jadwal 2 slot: N=1 ke slot 1, N=2 ke slot 2
  [ ] N melebihi jumlah slot -> memakai slot TERAKHIR (K-28)
  [ ] Di antara dua check-in ada satu DITOLAK -> check-in aktif berikutnya N=1 (BR-L1)
  [ ] Perubahan khusus is_override=1 dipakai, bukan template asli (BR-J3)

  Ambang dari pengaturan (BR-L4)
  [ ] Ubah ambang 5 -> 30 lewat repo pengaturan -> tanda terlambat PADA DATA LAMA ikut berubah
  [ ] Tidak ada angka 5 hardcode di mana pun di kode dashboard

  Aktif = bukan DITOLAK (BR-A7)
  [ ] Check-in DITOLAK -> TIDAK menambah "sudah absen"
  [ ] Check-out DITOLAK tidak berpengaruh pada sudah absen

  Hitung orang, bukan event
  [ ] Satu karyawan 2 check-in aktif -> sudah_absen = 1, bukan 2

  Belum absen (Jebakan C)
  [ ] terjadwal 5, sudah_absen 3, bertanda 1 -> belum_absen 1 (bukan 2)
  [ ] Karyawan bertanda TIDAK masuk kolom mana pun
  [ ] Karyawan tanpa penandaan dan tanpa absen -> masuk belum_absen

  Antrean verifikasi
  [ ] Menghitung MENUNGGU dari SEMUA tanggal, termasuk kemarin dan turun
  [ ] Hanya status MENUNGGU; DISETUJUI dan DITOLAK tidak dihitung

  Per toko
  [ ] 10 toko, masing-masing dengan angka sendiri
  [ ] Toko tanpa karyawan / tanpa jadwal -> kartu tetap tampil dengan 0
  [ ] Karyawan dipindah ke toko lain TIDAK bocor ke kartu toko lama untuk "terjadwal"

  Hari ini dari server (Jebakan F)
  [ ] Route dipanggil tanpa parameter tanggal -> memakai tanggalWIB() server
  [ ] Tidak ada date('now') di SQL mana pun (buktikan dengan menutup kolom tanggal
      agar query tanpa parameter akan mengembalikan 0 baris — bukan diam-diam benar)

  UI
  [ ] 10 kartu + 1 kartu antrean verifikasi
  [ ] Kartu antrean punya href ke /admin/verifikasi
  [ ] Tidak ada pemilih tanggal di halaman
  [ ] Route baru terdaftar di tests/guard-origin.test.ts

################################################################
8. ANGKA ACUAN DARI DATA DEMO
################################################################
scripts/isi-data-demo.ts mengisi data/demo.db dengan 10 toko, 26 karyawan, dan 981 baris
absensi. Berguna untuk pengecekan manual, tapi JANGAN dipakai sebagai tes — tes wajib
membuat fixture sendiri agar tidak rapuh.

Kalau Anda menjalankan:
  TURSO_DATABASE_URL='file:./data/demo.db' npx tsx scripts/isi-data-demo.ts --force

maka (tanggal acuan bergeser mengikuti hari_server):

  Toko                 Terjadwal  Sudah absen  Terlambat  Belum absen  Bertanda
  al madad widuri           2           0          0           1          1
  arsaba dieng              3           3          0           0          0
  arsaba induk              6           5          3           0          1
  arsaba mart               2           1          0           1          0
  arsaba temanggung         2           1          1           1          0
  beras wangi               1           0          0           1          0
  bgm dieng                 5           3          0           2          0
  dapur rumah               1           0          0           1          0
  mie ayam                  2           2          0           0          0
  sambal bakar busan        2           1          1           1          0
  TOTAL                     26          16          5           8          2

Perhatikan TOTAL: 26 = 16 + 8 + 2. Dua sisanya adalah karyawan bertanda — mereka
sengaja tidak masuk kolom mana pun. Kalau perhitungan Anda menghasilkan
"belum absen = 10", berarti penandaan belum dikecualikan.

Angka ini dihitung dengan fungsi M4 yang sungguhan, jadi bisa dipakai sebagai
pembanding cepat kalau ragu. Tetap tulis tes dengan fixture sendiri.

################################################################
9. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone (K-44):
                            TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
      Offset negatif itu wajib. Kalau hanya dua timezone pertama, K-44 BELUM terpenuhi.
  [ ] Seluruh checklist bagian 7 punya isi dan LULUS
  [ ] migrations/0001_init.sql TIDAK berubah (md5 harus 466a7b1a5aa5b1ab0a88e0a5f63a8a98)
  [ ] src/server/aturan/keterlambatan.ts, absensi.ts, repo/pengaturan.ts TIDAK diubah
  [ ] src/app/api/absen/route.ts TIDAK berubah
  [ ] waktu.ts, guard.ts, auth.ts, audit.ts, izin.ts, db.ts TIDAK berubah
  [ ] vitest.config.mts, package.json TIDAK berubah
  [ ] Tidak ada dependensi baru
  [ ] Tidak ada angka ambang terlambat yang di-hardcode
  [ ] Tidak ada date('now')/datetime('now') di SQL

BUKTI WAJIB sebelum melapor: untuk tiap definisi metrik (terlambat sistem, belum absen,
aktif, antrean), matikan aturannya sementara, jalankan tes, lalu catat BERAPA tes yang gagal.
Tes yang TIDAK gagal saat aturannya dimatikan berarti tes itu tidak menguji apa pun —
tulis hasilnya di laporan, jangan diklaim "sudah dites".

Khusus untuk Jebakan A, gunakan arah sebaliknya: ubah definisi "terlambat" agar memakai
keterlambatan_final_menit, lalu lihat berapa tes yang gagal. Itu bukti terkuat bahwa
definisi sistem benar-benar diuji — bukan hanya kebetulan menghasilkan angka sama.

################################################################
10. CARA KERJA
################################################################
  1. Baca dokumen (bagian 3) dan pastikan isi bagian 4
  2. aturan/dashboard.ts + tesnya (bagian 6a) — fungsi murni dulu, tanpa DB
  3. repo/dashboard.ts + tesnya (query massal, bukan N+1)
  4. Route + tesnya — daftarkan di tests/guard-origin.test.ts sekalian
  5. Halaman /admin + aktifkan menu
  6. Jalankan build, typecheck, lalu npm run test:tz
  7. Jalankan bukti mutasi (bagian 9)
  8. Tulis laporan (bagian 11)

################################################################
11. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M7
Selesai: <file yang dibuat / diubah>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Terlambat memakai sistem: <bukti kasus 1 (final 30 tapi tidak terlambat) dan kasus 2 (final 0 tapi terlambat)>
Slot dipakai: <bukti 2 slot (N=1 ke slot 1, N=2 ke slot 2), N melebihi jumlah slot, override is_override=1>
BR-L1: <bukti DITOLAK menggeser N>
Ambang pengaturan: <bukti diubah 5 -> 30 mengubah tanda pada data lama>
Aktif bukan DITOLAK: <bukti DITOLAK tidak menambah sudah absen>
Orang bukan event: <bukti 2 check-in satu karyawan = 1>
Belum absen: <bukti terjadwal 5, absen 3, bertanda 1 -> 1>
Kartu per toko: <bukti 10 kartu, toko kosong tetap tampil>
Antrean verifikasi: <bukti menghitung semua tanggal>
Hari ini dari server: <bukti tidak ada date('now'), tanggal dari tanggalWIB()>
Pemilih tanggal: <tidak ada — rules/05 §5.2 melarangnya di versi 1>
UI: <bukti 10 kartu + antrean dengan tautan, tanpa pemilih tanggal>
Pagar Origin: <bukti route dashboard terdaftar>
BUKTI MUTASI: <WAJIB. Tabel: definisi yang dimatikan -> berapa tes gagal. Termasuk
  bukti bahwa memakai keterlambatan_final_menit membuat tes gagal>
Angka banding demo: <hasil hitungan Anda vs tabel bagian 8 — boleh berbeda kalau tanggal
  acuan berbeda, tapi jelaskan>
Verifikasi dokumentasi eksternal: <tidak ada, atau apa dan sumber>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
12. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M8 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| `hitungN`, `pilihSlot`, `hitungSelisih` | sudah ada dari M4 |
| `eventAktif()` | sudah ada dari M3 |
| `bacaAmbang()` | sudah ada dari M2 |
| Izin `dashboard` | sudah ada di `IZIN_MATRIX` |
| Data demo | `scripts/isi-data-demo.ts` sudah jadi dan terisi |

## C. Yang sudah diverifikasi

- **Tidak ada kolom `terlambat_sistem`** di database — memang begitu,_atas desain (BR-L4).
  Wajib dihitung saat tampil.
- Angka pada bagian 8 dihitung dengan **fungsi M4 yang sungguhan** terhadap `data/demo.db`,
  bukan hasil perkiraan. `26 = 16 + 8 + 2`, dan sisanya adalah karyawan bertanda.
- `rules/05` §5.2 melarang pemilih tanggal di versi 1.

## D. Perbedaan dari M6

| Hal | M6 | M7 |
|---|---|---|
| Sifat | satu entitas | **agregasi** |
| Gagal | data salah per baris | angka salah, tanpa error |
| Sumber angka | Kolom database | **hitungan ulang saat tampil** |
| Perilaku menguji | rute yang dipanggil | **definisi yang dimatikan** |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Definisi metrik berubah (`rules/02` §12) | bagian 5, 7, 8 |
| UI dashboard berubah (`rules/05` §5.2) | bagian 6d |
| BR-V7 / `keterlambatan_final_menit` berubah | bagian 5 (Jebakan A) |
| BR-J3 snapshot berubah | bagian 5 (Jebakan B) |
| K-51 waktu server berubah | bagian 5 (Jebakan F) |
