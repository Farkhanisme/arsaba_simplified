# 13 — Prompt Agent Milestone M5 (Jadwal)

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
Baca rules/00-decision-log.md bagian A dan pastikan K-14, K-17, K-22, K-27, K-32, K-37 ada.
Kalau ada yang belum ada -> JANGAN menulis kode, tulis ke rules/OPEN_QUESTIONS.md
(ID B-18 seterusnya), tampilkan, lalu BERHENTI.

Sebelum mulai:
  node -v         # harus v24.x.x (K-43)
  npm run build   # harus hijau sebelum Anda mengubah apa pun

################################################################
2. BACA DOKUMEN INI DULU, DENGAN URUTAN INI
################################################################
  AGENTS.md
  rules/02-system-spec.md   <- §2 shift template BR-T1..T3, §7 JADWAL BR-J1..J9,
                               §8 penempatan (BR-P)
  rules/03-system-design.md <- §1 istilah, §5 waktu (K-45)
  rules/04-database-design.md <- jadwal + jadwal_slot + query acuan
  rules/05-ui-ux-rules.md   <- §5.4 halaman jadwal, §5.7 Data Master > Shift
  rules/01-prd.md          <- US-A3 (jadwal)
  rules/00-decision-log.md <- K-14, K-17, K-27, K-32, K-37

################################################################
3. YANG SUDAH ADA — JANGAN DIBUAT ULANG
################################################################
Fungsi dari M2 yang WAJIB dipakai ulang, bukan ditulis ulang:
  src/server/aturan/shift.ts
    validasiJamShift()    BR-T3 (jam_selesai = jam_mulai ditolak)
    slotTumpangTindih()   sudah menangani shift lintas tengah malam (BR-T3)
    bentrokNamaTipe()     BR-J1 (nama SEMUA vs WEEKDAY/WEEKEND)
  src/server/aturan/penempatan.ts  penempatan dengan tanggal efektif (BR-P)

Fungsi dari M4:
  src/server/aturan/absensi.ts -> sudahDiekspor()   untuk BR-J9
  src/server/aturan/keterlambatan.ts                memilih slot dari SNAPSHOT

Lainnya:
  Izin 'jadwal' sudah ada di src/server/izin.ts (ADMIN + SUPER_ADMIN). Jangan tambah izin.
  Tabel jadwal sudah punya UNIQUE (karyawan_id, tanggal) -> BR-J3 dijamin database.
  Tabel jadwal_slot sudah ada lengkap dengan urutan, nama, jam_mulai, jam_selesai.
  migrations/0001_init.sql TIDAK BOLEH diubah. Butuh CHECK baru? buat 0002_...sql (maju-saja).
  vitest.config.mts fileParallelism: false. JANGAN diubah.
  Menu "Jadwal" di src/app/admin/menu.ts masih `segara: true` -> aktifkan di bagian 7.

################################################################
4. SCOPE MILESTONE M5
################################################################
Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. Tanpa dependensi baru.

--- 4a. src/server/aturan/jadwal.ts (BARU) ---
Fungsi MURNI tanpa database:
  urutkanSlot(slots)            BR-J6: urut jam_mulai naik
  cekBatasSlot(slots)           K-27: maksimal 2 slot
  slotMemenuhiTipeHari(templates, nama, jenisHari)  BR-J2: pilih per NAMA + tipe hari
  adaSlotTakValid(tanggal, slots)  gabungkan validasiJamShift() M2

--- 4b. src/server/waktu.ts (PENAMBAHAN SATU FUNGSI) ---
Grid butuh nama hari Bahasa Indonesia. helper itu BELUM ADA. Tambahkan `namaHariWIB(tanggal)`
di server/waktu.ts. WAJIB memakai pola yang sudah dipakai `tanggalPanjangWIB` di file itu:

  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

DILARANG memakai `new Date(tanggal).getDay()` atau `getDay()` lokal. Alasannya ada di bagian 6
dan hinted di bawah — ini bukan sekadar gaya penulisan, ini kelas bug B-13.
Satu-satunya perubahan pada waktu.ts adalah PENAMBAHAN fungsi ini. Perilaku lama harus utuh;
buktikan dengan tes waktu yang sudah ada tetap lulus.

--- 4c. src/server/repo/jadwal.ts (BARU) ---
  daftarKaryawanDiToko(tokoId, dari, sampai, ex)  BR-J4: penempatan PER TANGGAL
  daftarJadwal(tokoId, dari, sampai, ex)            data grid
  templateUntukTanggal(tokoId, nama, tanggal, ex)  BR-J2
  buatAtauTimpa(input, ex, adminId)                 BR-J5: default DILEWATI, timpa eksplisit
  simpanOverride(karyawanId, tanggal, slots, catatan, ex, adminId)  BR-J6
  kembalikanStandar(karyawanId, tanggal, namaTemplate, ex, adminId)  BR-J6
  pratinjauMassal(tokoId, karyawanIds, dari, sampai, namaTemplate, ex)  BR-J5

WAJIB: saat membuat jadwal, SALIN jam template ke jadwal_slot (SNAPSHOT, BR-J3). Jadwal
lama tidak boleh ikut berubah ketika template shift diubah.

WAJIB: seluruh operasi tulis memakai `denganTransaksi()` + `catatAudit(..., tx)`
di dalam transaksi yang sama. Jangan menulis pemanggilan DB berurutan di luar transaksi.

--- 4d. Route API — SEMUA lewat guard() ---
  GET  /api/admin/jadwal           guard('jadwal')  grid
  GET  /api/admin/jadwal/pilihan   guard('jadwal')  daftar karyawan + template untuk filter
  POST /api/admin/jadwal           guard('jadwal')  buat/timpa satu sel
  POST /api/admin/jadwal/massal    guard('jadwal')  isi massal (mode lewati/timpa)
  POST /api/admin/jadwal/override  guard('jadwal')  perubahan khusus satu hari

Route baru WAJIB langsung didaftarkan di tests/guard-origin.test.ts. Tes itu membandingkan
daftar route terdaftar dengan seluruh route.ts di src/app/api — route yang lupa diuji
membuat tes gagal. Ini bukan opsional.

################################################################
5. ATURAN YANG PALING MUDAH DILANGGAR
################################################################

BR-J7 — Tumpang tindih itu PERINGATAN, BUKAN LARANGAN. Admin TETAP dapat menyimpan.
Godaan besar: slotTumpangTindih() sudah ada dari M2 dan mengembalikan boolean — jangan
dipakai sebagai pemblokir. Tampilkan peringatan di panel dan pada sel terkait, lalu izinkan
simpan.  Wajib ada tes yang membuktikan simpan BERHASIL meski slot tumpang tindih.
Shift lintas tengah malam (BR-T3): jam_selesai <= jam_mulai berarti berakhir keesokan hari,
jadi rentang yang dibandingkan [mulai, selesai+1440).

K-27 — maksimal 2 slot pada perubahan khusus. Tidak bisa dijamin constraint SQL (CHECK tidak
bisa menghitung baris tabel lain), jadi WAJIB dicek di aplikasi dalam transaksi. Berlaku juga
saat menambah slot ke jadwal yang sudah punya 1 slot, dan saat isi massal.

BR-J3 — jadwal menyimpan SNAPSHOT jam. Ubah template shift "Pagi 07:00-17:00" menjadi
"08:00-18:00" TIDAK boleh mengubah jadwal lampau. Jangan hitung keterlambatan dengan membaca
template secara langsung; M4 membaca dari snapshot.

BR-J4 — karyawan hanya bisa dijadwalkan di toko tempat ia DITEMPATKAN PADA TANGGAL ITU.
Penempatan punya tanggal efektif. Catatan: karyawan yang sudah pindah BELUM pada tanggal
lampau tetap BOLEH dijadwalkan di toko lamanya.

BR-J5 — isi massal: kalau (karyawan, tanggal) sudah punya jadwal, defaultnya DILEWATI dan
DILAPORKAN. Opsi timpa ada tapi harus dipilih admin EKSPLISIT. Kalau defaultnya overwrite,
jadwal lama hilang tanpa jejak. Semua tercatat audit.

BR-J2 — pilih template berdasarkan NAMA + tipe hari yang cocok. Tanggal Sabtu dengan template
hanya WEEKDAY = tidak ada padanan -> sel DITOLAK dengan pesan jelas, jangan diam-diam pakai
template lain. Template SEMUA selalu cocok.

BR-J6 — perubahan khusus satu hari: maksimal 2 slot, urut jam_mulai naik, is_override = 1.
Bila tanggal belum punya jadwal, perubahan khusus membuat jadwal baru. Ada aksi
"Kembalikan ke shift standar" yang memilih template lagi (hapus is_override, simpan snapshot).
Catatan OPSIONAL (K-37).

BR-J8 — mengubah jadwal pada tanggal LAMPAU diizinkan, tercatat audit, dan tidak memengaruhi
angka final admin.

BR-J9 — perubahan jadwal khusus atau pembaruan jadwal pada periode yang SUDAH DIEKSPOR hanya
Super Admin (K-32). Gunakan sudahDiekspor() dari M4. Admin biasa 403.

K-22 — Admin boleh jadwal. Admin TIDAK boleh membuat template shift (itu Data Master,
SUPER_ADMIN). Jangan salah izin.

################################################################
6. JEBRAKAN WAKTU — BACA PELAN-PELAN
################################################################
Grid menampilkan nama hari. Cara SALAH yang sangat mungkin terjadi:

  new Date('2026-10-04').getDay()        // IKUTI timezone mesin (K-45, kelas bug B-13)

Tanggal '2026-10-04' di-parse sebagai midnight UTC, lalu getDay() membaca timezone mesin:

  TZ=UTC               -> Minggu   (benar)
  TZ=Asia/Jakarta      -> Minggu   (benar)
  TZ=America/New_York  -> SABTU    (SALAH)

Perhatikan: pola salah itu SALAH di semua 6 tanggal uji di `TZ=America/New_York`, tapi BENAR di
semua 6 di `TZ=UTC` maupun `TZ=Asia/Jakarta`. Keduanya offset non-negatif, jadi memberi jawaban
identik dan **tidak dapat membedakan kode benar dari kode kelihatan benar**.

Karena itu K-44 kini mewajibkan **tiga** timezone, termasuk `TZ=America/New_York` — hanya offset
negatif yang bisa menangkap kelas bug ini. Detail dan tabelnya di `rules/OPEN_QUESTIONS.md` B-18
dan `rules/NOTES.md` §11.

Simpulnya: pola benar di bawah **WAJIB**. Jangan andalkan "tes sudah hijau", karena hijau di dua
timezone offset positif tidak berarti apa-apa untuk kelas bug ini.

Pola benar (sudah dipakai tanggalPanjangWIB di waktu.ts):

  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

Tambahkan tes namaHariWIB untuk beberapa tanggal termasuk 2026-10-04 (Minggu) dan
2026-10-03 (Sabtu) — dua tanggal berturut yang berbeda jenis hari.

################################################################
7. HALAMAN /admin/jadwal
################################################################
Sesuai rules/05 §5.4:
- Pilih toko, mode Hari / Minggu / Bulan, tanggal acuan.
- Grid: baris = karyawan yang ditempatkan di toko itu pada rentang tampil; kolom = tanggal.
  Weekend (Sabtu/Minggu) diberi tanda. Sel = nama shift + jam, atau kosong.
  Mode bulan bisa 31 kolom x 26 baris. Jangan render 800 sel sebagai komponen terpisah
  tanpa pertimbangan — pakai satu tabel dengan positioned cells atau pagination yang wajar.
- Klik sel -> panel: pilih shift (hanya template yang sesuai tipe hari tanggal itu) atau
  "Ubah khusus hari ini".
- Editor perubahan khusus: daftar slot (nama, jam mulai, jam selesai), tambah/hapus slot
  dengan BATAS MAKSIMAL 2 (K-27), peringatan tumpang tindih real-time (kuning, TIDAK
  memblokir), catatan opsional, tombol Simpan.
- Sel berisi perubahan khusus diberi badge "Khusus" + ikon.
- Isi massal: pilih karyawan (multi) + rentang + shift -> PRATINJAU ringkasan (berapa sel
  baru, dilewati, ditimpa) -> Terapkan. Hasil menampilkan daftar sel yang dilewati.
- Filter disimpan di URL agar bisa di-refresh.
- Kosong: "Belum ada karyawan di toko ini." Bila belum ada shift template: arahkan Super
  Admin ke Data Master > Shift.
- Sidebar: menu "Jadwal" untuk kedua peran — HAPUS `segara: true` di src/app/admin/menu.ts.
  Tes menu yang sudah ada dari M2 kemungkinan menghitung item aktif; perbarui kalau gagal.
- Every route baru harus ikut rules/03 §7: foto tidak relevan di halaman ini, jangan
  menambahkan URL Telegram atau token apa pun ke klien.

################################################################
8. TES — BAGIAN YANG PALING SERING GAGAL
################################################################
DILARANG:
  expect(kodeFile).toContain('...')   # menguji teks
  expect(true).toBe(true)             # menguji apa pun
  expect(existsSync('page.tsx')).toBe(true)   # lulus walau halaman rusak
  menguji fungsi privat langsung      # uji lewat API publiknya

WAJIB ada tes untuk:

  Waktu (K-45)
  [ ] namaHariWIB: 2026-10-04 = 'Minggu', 2026-10-03 = 'Sabtu'
  [ ] Test waktu yang sudah ada (waktu.ts) tetap lulus setelah penambahan fungsi

  Snapshot (BR-J3)
  [ ] Ubah template shift (07:00-17:00 -> 08:00-18:00) -> jadwal lampau TETAP 07:00-17:00
  [ ] jadwal_slot berisi jam yang sama persis dengan template saat dibuat

  Tumpang tindih = PERINGATAN (BR-J7) — INI YANG SERING SALAH
  [ ] Dua slot tumpang tindih TETAP BISA DISIMPAN, status 200 (bukan 403/400)
  [ ] Shift lintas tengah malam terdeteksi: 23:00-02:00 vs 01:00-04:00 = TUMPANG TINDIH
  [ ] Dua slot berbeda (07:00-12:00 vs 18:00-23:00) = TIDAK tumpang tindih
  [ ] Peringatan dikembalikan di respons, tapi tidak menghalangi

  Batas slot (K-27)
  [ ] 3 slot DITOLAK saat membuat override
  [ ] Menambah slot ke jadwal yang sudah punya 1 slot -> jadi 2 BOLEH, jadi 3 DITOLAK
  [ ] Batas berlaku juga saat isi massal

  Penempatan per tanggal (BR-J4)
  [ ] Karyawan yang belum ditempatkan di toko itu pada tanggal itu DITOLAK
  [ ] Karyawan yang sudah pindah ke toko lain TAPI belum pada tanggal lampau ->
      BOLEH dijadwalkan di toko lamanya (tanggal lampau)

  Isi massal (BR-J5)
  [ ] Default: sel yang sudah punya jadwal DILEWATI, dan daftarnya dikembalikan
  [ ] Opsi timpa harus dipilih eksplisit; tanpa itu tidak ada yang ditimpa
  [ ] Tanpa pilihan mode sama sekali -> DITOLAK (jangan default diam-diam ke timpa)

  Pemilihan template (BR-J2)
  [ ] Tanggal Sabtu + template hanya WEEKDAY -> DITOLAK dengan pesan jelas
  [ ] Template SEMUA cocok untuk tanggal kapan pun
  [ ] Dua template bernama sama (WEEKDAY + WEEKEND) memilih yang sesuai tanggal

  Perubahan khusus (BR-J6)
  [ ] Slot tersimpan urut jam_mulai naik walau diinput terbalik
  [ ] is_override = 1
  [ ] Tanggal tanpa jadwal -> perubahan khusus membuat jadwal baru
  [ ] "Kembalikan ke shift standar" menghapus is_override dan menyimpan snapshot template
  [ ] Catatan opsional: kosong diterima (K-37)

  Tanggal lampau & ekspor
  [ ] Mengubah jadwal 3 bulan lalu DITERIMA (BR-J8)
  [ ] Periode terekspor: ADMIN 403, Super Admin 200 (BR-J9)

  Audit
  [ ] Setiap buat/timpa/override/return tercatat dengan nilai SEBELUM dan SESUDAH
  [ ] Mutasi + audit yang di-ROLLBACK tidak meninggalkan jejak

  Izin
  [ ] ADMIN bisa membuat jadwal (200)
  [ ] ADMIN TIDAK bisa membuat template shift (403, K-22)
  [ ] Route baru terdaftar di tests/guard-origin.test.ts (tes itu gagal kalau lupa)

  Grid
  [ ] Sebar test benar-benar mengembalikan 26 baris x N kolom tanpa error
  [ ] Weekend ditandai pada kolom yang benar

################################################################
9. KRITERIA SELESAI
################################################################
  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] npm run test:tz     lulus di TIGA timezone (K-44):
                            TZ=UTC, TZ=Asia/Jakarta, TZ=America/New_York
      Offset negatif itu wajib, bukan tambahan. Kalau Anda hanya menjalankan dua timezone
      pertama, K-44 BELUM terpenuhi dan namaHariWIB yang salah tidak akan ketahuan.
  [ ] Seluruh checklist bagian 8 punya isi dan LULUS
  [ ] migrations/0001_init.sql tidak berubah tanpa alasan kuat yang ditulis di laporan
  [ ] waktu.ts hanya bertambah fungsi namaHariWIB, tidak ada perilaku lama yang berubah
  [ ] guard.ts, auth.ts, audit.ts, izin.ts, db.ts tidak diubah kecuali ada bug;
      kalau ada, laporkan di laporan DULU
  [ ] Tidak ada dependensi baru

BUKTI WAJIB sebelum melapor: untuk tiap aturan utama (BR-J7, K-27, BR-J3, BR-J4, BR-J5,
BR-J2), matikan aturannya sementara, jalankan tes, dan catat BERAPA tes yang gagal. Tes yang
tidak pernah gagal saat aturannya dimatikan berarti tes itu tidak menguji apa pun — tulis
hasilnya di laporan bagian 11, bukan klaim "sudah dites".

################################################################
10. CARA KERJA
################################################################
  1. Baca dokumen (bagian 2)
  2. namaHariWIB di waktu.ts + tesnya (bagian 4b dan 6) — ini yang paling mudah salah
  3. src/server/aturan/jadwal.ts + tesnya
  4. repo/jadwal.ts + tesnya (snapshot BR-J3 dulu, karena M4 bergantung padanya)
  5. Route API + tesnya — daftarkan di tests/guard-origin.test.ts sekalian
  6. Halaman /admin/jadwal + aktifkan menu
  7. Jalankan build, typecheck, lalu `npm run test:tz` (TIGA timezone)
  8. Jalankan bukti mutasi (bagian 9)
  9. Tulis laporan (bagian 11)

################################################################
11. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M5
Selesai: <file yang dibuat / diubah>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
namaHariWIB: <bukti 2026-10-04 = Minggu, 2026-10-03 = Sabtu; pola Date.UTC + getUTCDay>
BR-J3 snapshot: <bukti ubah template tidak mengubah jadwal lampau>
BR-J7 peringatan: <bukti simpan BERHASIL meski tumpang tindih, termasuk lintas tengah malam>
K-27 batas slot: <bukti 3 slot ditolak, termasuk menambah ke jadwal yang sudah ada>
BR-J4 penempatan: <bukti karyawan belum ditempatkan ditolak; yang lampau tetap boleh>
BR-J5 isi massal: <bukti default dilewati + daftar dikembalikan; timpa harus eksplisit>
BR-J2 template: <bukti WEEKDAY tidak dipakai untuk tanggal Sabtu>
BR-J6 override: <bukti urut jam_mulai naik, is_override = 1, kembali ke standar>
BR-J8 lampau: <bukti mengubah jadwal 3 bulan lalu diterima>
BR-J9 ekspor: <bukti ADMIN 403, Super Admin 200 pada periode terekspor>
Audit: <bukti setiap mutasi tercatat dengan before/after>
Izin: <bukti ADMIN bisa jadwal, tidak bisa template shift>
Pagar Origin: <bukti route baru terdaftar di guard-origin.test.ts>
Grid: <bukti jumlah baris x kolom dengan 26 karyawan>
BUKTI MUTASI: <WAJIB. Tabel: aturan yang dimatikan -> berapa tes gagal. Kalau ada aturan
  yang saat dimatikan TIDAK membuat tes gagal, tulis APA dan kenapa>
Verifikasi dokumentasi eksternal: <tidak ada, atau apa dan sumber>
Keputusan teknis yang Anda ambil: <yang perlu konfirmasi pemilik>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
12. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M6 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

| Prasyarat | Status |
|---|---|
| Node `24.x` | `nvm use` membaca `.nvmrc` |
| `slotTumpangTindih()`, `validasiJamShift()`, `bentrokNamaTipe()` | sudah ada dari M2 |
| `sudahDiekspor()` | sudah ada dari M4 |
| Izin `jadwal` | sudah ada di `IZIN_MATRIX` |
| Tabel `jadwal` + `jadwal_slot` | sudah ada, **tanpa migrasi baru** |
| `tests/guard-origin.test.ts` | route baru wajib didaftarkan |

## C. Yang sudah diverifikasi

- `jadwal` sudah punya `UNIQUE (karyawan_id, tanggal)` → BR-J3 dijamin database.
- `jadwal_slot` sudah punya `urutan`, `nama`, `jam_mulai`, `jam_selesai`, `CHECK jam_mulai <>
  jam_selesai` — BR-T3 partly ditegakkan database.
- `slotTumpangTindih()` dari M2 sudah menangani shift lintas tengah malam, jadi tidak perlu
  menulis ulang.
- Menu "Jadwal" sudah ada di `menu.ts`, tinggal hapus `segara: true`.
- Role Admin **boleh** jadwal (K-22), tapi **tidak boleh** template shift.

## D. Perbedaan dari M4

| Hal | M4 | M5 |
|---|---|---|
| Aturan-DD yang dijamin | sebagian (constraint) | hampir semua **tidak**, wajib aplikasi |
| Konsekuensi salah | keterlambatan meleset | jadwal hilang / overlap terblokir |
| Cara memastikan | batas menit presisi | **bukti mutasi per aturan** |
| Risiko khusus | — | nama hari + `TZ` negatif (lihat §6) |

## E. Catatan pemeliharaan

| Perubahan | Yang diedit |
|---|---|
| Aturan jadwal berubah (`rules/02` §7) | bagian 5 dan 8 |
| K-27 berubah | bagian 5 dan 8 |
| UI jadwal berubah (`rules/05` §5.4) | bagian 7 |
| K-32 berubah | bagian 5 (BR-J9) |
| K-45 berubah | bagian 4b dan 6 |
| Kolom `jadwal` berubah | `rules/04` §2 lalu bagian 3 |
