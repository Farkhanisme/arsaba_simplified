# 10 — Prompt Agent Milestone M2 (Data Master)

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
1. HALTE WAJIB — JANGAN MENULIS KODE SEBELUM INI SELESAI
################################################################
Buka rules/00-decision-log.md bagian A dan pastikan K-27 s.d. K-49 ada. Jika ada yang belum
ada -> JANGAN menulis kode. Tulis pertanyaannya ke rules/OPEN_QUESTIONS.md (ID B-18
seterusnya), tampilkan di chat, lalu BERHENTI.

SEBELUM MULAI:
  node -v        # harus v24.x.x (K-43). Kalau bukan, BERHENTI.
  npm run build  # harus hijau sebelum Anda mengubah apa pun

################################################################
2. BACA DOKUMEN INI DULU, DENGAN URUTAN INI
################################################################
  AGENTS.md
  rules/00-decision-log.md
  rules/01-prd.md
  rules/02-system-spec.md      <- BR-T3, BR-J1, BR-P1..P4, BR-LK1..3, §13 izin, §16 audit
  rules/03-system-design.md
  rules/04-database-design.md  <- DDL: baca kolom yang sudah tersedia
  rules/05-ui-ux-rules.md      <- §4 layout, §5.7 toko, §5.8 akun, §5.9 pengaturan
  rules/06-agent-instructions.md

################################################################
3. FAKTA YANG SUDAH DIVERIFIKASI — JANGAN DIULANG
################################################################
- SEMUA tabel M2 sudah ada di migrations/0001_init.sql: toko, shift_template, karyawan,
  karyawan_penempatan, karyawan_link, pengguna_admin, pengaturan. Tabel jadwal dan
  jadwal_slot juga sudah ada. TIDAK PERLU membuat migrasi baru. Kalau Anda merasa perlu
  migrasi 0002, itu tanda Anda mengira tabel belum ada — tanyakan, jangan diam-diam.
- src/server/guard.ts sudah ada: guard(fitur, handler) dan guardTanpaSesi(handler).
  JANGAN menyalin logika Origin/cookie/izin ke route. Pakai guard.
- src/server/audit.ts sudah menerima executor opsional. Untuk mutasi + audit, pakai
  denganTransaksi() dan teruskan tx ke catatAudit().
- Izin yang tersedia sudah lengkap di src/server/izin.ts: master_toko, master_shift,
  master_karyawan, master_penempatan, master_akun, link_karyawan, pengaturan, audit_log.
- vitest.config.mts sudah fileParallelism: false. JANGAN diubah — semua file tes memakai
  data/uji_*.db dan saling menghapus file itu.
- src/server/aturan/ sudah ada (direktori kosong). Fungsi bisnis murni taruh di sana.
- src/app/admin/ baru berisi ubah-password. Anda yang membuat layout dan halamannya.

################################################################
4. SCOPE MILESTONE M2 — HANYA INI
################################################################
Sesuai rules/06 §3: "Data master: toko, shift template, karyawan, penempatan/pemindahan,
link, akun admin, pengaturan. Selesai jika semua CRUD sesuai 05 §5.7-5.9 dengan audit;
validasi BR-J1/BR-T3/BR-P*"

Versions: Node 24.x, Next.js ^16.3.7, TypeScript strict, zod. package.json JANGAN diubah
kecuali menambah script yang benar-benar dipakai. Tanpa dependensi baru.

--- 4a. Layout admin + sidebar (rules/05 §4) ---
src/app/admin/layout.tsx yang memaksa sesi di server (bukan hanya cek di UI).
Menu yang halamannya ADA di M2:
  Data Master › Toko        Super Admin   /admin/master/toko
  Data Master › Shift       Super Admin   /admin/master/shift
  Data Master › Karyawan    Super Admin   /admin/master/karyawan
  Akun Admin                Super Admin   /admin/akun
  Pengaturan                Super Admin   /admin/pengaturan
  Ubah Password             keduanya      /admin/ubah-password (sudah ada)
  Keluar                    keduanya      POST /api/logout (sudah ada)

Menu Dashboard, Verifikasi, Jadwal, Tandai Tidak Berangkat, Rekap & Ekspor, dan Audit Log
TIDAK tampil sebagai tautan aktif — halamannya milestone lain. Tampilkan nonaktif dengan
label "Segera". JANGAN membuat halaman kosong yang menyesatkan.

Menu Super Admin TIDAK boleh dirender untuk peran ADMIN, dan URL-nya tetap 403 di server.

--- 4b. Repo (src/server/repo/) ---
Satu file per entitas: toko.ts, shift.ts, karyawan.ts, penempatan.ts, link.ts,
pengaturan.ts, dan perluas pengguna.ts yang sudah ada.
SQL berparameter dengan placeholder ?. TANPA ORM. Dilarang menyambung string SQL.

--- 4c. Aturan murni (src/server/aturan/) ---
Fungsi tanpa akses database, unit-testable:
  - validasi jam shift (BR-T3)
  - deteksi bentrok nama + tipe hari (BR-J1)
  - deteksi overlap slot (BR-J7) untuk dipakai nanti
  - kalkulator rentang tanggal penempatan (BR-P2)

--- 4d. Route API — WAJIB lewat guard ---
Pola wajib:

  export const POST = guard('master_toko', async (req, ctx) => {
    await denganTransaksi(async (tx) => {
      await tx.execute({ sql: '...', args: [...] });
      await catatAudit({ ... }, tx);
    });
    return NextResponse.json({ kode: 'OK', pesan: 'Berhasil.' });
  });

Aturan yang WAJIB ditegakkan per entitas:

  Toko          master_toko       nama unik; aktif 0/1; tidak ada field lain (rules/05 §5.7)
  Shift         master_shift      BR-T3: jam_mulai = jam_selesai DITOLAK;
                                 jam_selesai <= jam_mulai berarti lintas tengah malam (DITERIMA);
                                 BR-J1: nama sama + SEMUA bersamaan WEEKDAY/WEEKEND DITOLAK;
                                 template antar shift boleh overlap
  Karyawan      master_karyawan   enam field (nama, nik, jabatan, alamat, nomor_hp,
                                 kontak_darurat — K-34); nik unik bila diisi
  Penempatan     master_penempatan  BR-P1 satu penempatan terbuka; BR-P2 rentang tidak tumpang
                                 tindih; BR-P3 + K-35: pemindahan DIBLOKIR bila masih ada
                                 jadwal di toko lama pada/setelah tanggal efektif
  Link          link_karyawan     BR-LK1 token acak min 32 byte base64url, URL /a/{token};
                                 BR-LK2 satu link aktif, "buat ulang" = cabut + buat dalam
                                 SATU transaksi; BR-LK3 token tidak pernah masuk log
  Akun admin    master_akun       K-48 min 8 karakter; hash tidak pernah muncul di audit;
                                 reset password membatalkan sesi akun itu
  Pengaturan    pengaturan        ambang_terlambat_menit >= 0, default 5;
                                 token bot TIDAK pernah ditampilkan atau diubah di sini

--- 4e. Halaman (rules/05 §5.7-5.9) ---
Semua teks Bahasa Indonesia. Filter disimpan di URL agar bisa di-refresh.
Link karyawan ditampilkan lengkap (URL) HANYA di halaman Karyawan.
Toast: hijau hilang sendiri, merah menetap sampai ditutup.

Yang BELUM dikerjakan di M2 — JANGAN dibuat "sambil jalan":
  dashboard · verifikasi absensi · jadwal · tandai tidak berangkat · koreksi manual ·
  rekap & ekspor Excel · baca audit log · halaman /a/{token}
Jangan membuat route API pun untuk halaman yang belum ada.

################################################################
5. ATURAN KEAMANAN
################################################################
- Semua pemeriksaan izin di SERVER pada setiap request. Menu tersembunyi bukan keamanan.
- Semua mutasi + audit dalam SATU transaksi. Audit HARUS ikut rollback bersama mutasi.
- ID sesi hanya ada di cookie; yang disimpan di database adalah sha256-nya. Pola ini sudah
  ada di server/auth.ts — ikuti, jangan ulang dengan Hash yang sama di tempat lain.
- Query berparameter. Tidak ada concat string SQL, termasuk untuk klausa dinamis.
- Password tidak pernah masuk respons, log, atau nilai sebelum/sesudah di audit_log.
- Token link tidak pernah masuk log (BR-LK3).
- Verifikasi header Origin dilakukan oleh guard, bukan oleh Anda.
- Tidak ada console.log yang memuat password, hash, id sesi, atau token.

################################################################
6. TES — INI BAGIAN YANG PALING SERING GAGAL SEBELUMNYA
################################################################
M1 sampai "selesai" dua kali padahal masih ada 4 bug, karena tesnya memeriksa BENTUK
bukan PERILAKU. Jangan mengulangi.

DILARANG:
  expect(kodeFile).toContain('SELECT ...')      # menguji teks, bukan hasil
  expect(true).toBe(true)                        # menguji apa pun
  menguji createSession langsung                 # menguji create -> pakai -> hapus

WAJIB: setiap aturan bisnis punya tes yang MEMANGGIL kodenya dan membuktikan akibatnya.

Tes minimal (semua via repo/route sungguhan, bukan reading file):

  Layout & izin
  [ ] ADMIN mendapat 403 di SETIAP route Super Admin (bukan hanya "menu disembunyikan")
  [ ] Menu Super Admin tidak dirender untuk ADMIN
  [ ] Layout admin mengarahkan tanpa sesi ke /login

  Toko
  [ ] Insert nama ganda ditolak oleh database (bukan hanya dicek di aplikasi)
  [ ] Nonaktifkan: insert karyawan ke toko nonaktif ditolak

  Shift (BR-T3 dan BR-J1)
  [ ] jam_mulai = jam_selesai (mis. 07:00-07:00) DITOLAK
  [ ] jam_selesai < jam_mulai (mis. 22:00-06:00) DITERIMA sebagai lintas tengah malam
  [ ] nama "Pagi" dengan SEMUA + nama "Pagi" dengan WEEKDAY DITOLAK
  [ ] nama "Pagi" WEEKDAY + nama "Pagi" WEEKEND DITERIMA (kasus valid)

  Karyawan
  [ ] Enam field tersimpan dan terbaca kembali persis, termasuk yang berisi spasi
  [ ] NIK ganda ditolak; NIK kosong pada dua karyawan DITERIMA (nullable)

  Penempatan (BR-P1, BR-P2, BR-P3/K-35) — INI YANG PALING SERING SALAH
  [ ] Hanya boleh ada SATU penempatan terbuka per karyawan
  [ ] Rentang penempatan yang tumpang tindih ditolak
  [ ] Memindahkan karyawan yang MASIH PUNYA JADWAL di toko lama pada/setelah tanggal efektif
      DITOLAK dengan pesan jelas (BR-P3 + K-35). Jadwal cukup disisipkan langsung ke tabel
      jadwal — Anda tidak perlu membangun fitur jadwal.
  [ ] Setelah jadwal dihapus, pemindahan BERJALAN (membuktikan blokir benar-benar bersyarat)

  Link (BR-LK1, BR-LK2)
  [ ] Hanya satu link aktif per karyawan (partial unique index)
  [ ] "Buat ulang" mencabut yang lama DAN membuat yang baru dalam satu transaksi
  [ ] Jika pembuatan yang baru gagal, link lama TIDAK ikut tercabut (bukti satu transaksi)

  Akun admin
  [ ] Password < 8 karakter ditolak di server
  [ ] Password tidak pernah muncul di isi audit_log (buka nilainya, assert)
  [ ] Reset password membatalkan seluruh sesi akun itu

  Pengaturan
  [ ] Nilai ambang negatif ditolak
  [ ] Token bot tidak pernah ada di respons mana pun

  Audit — WAJIB untuk setiap entitas
  [ ] Setiap mutasi menghasilkan baris audit_log dengan BEFORE dan AFTER yang benar
  [ ] Mutasi + audit yang di-ROLLBACK tidak meninggalkan jejak audit
    (ini yang diuji di tests/transaksi.audit.test.ts untuk M1 — ikuti pola yang sama)

################################################################
7. KRITERIA SELESAI
################################################################
Milestone dianggap selesai HANYA bila SEMUA ini benar:

  [ ] npm run build       0 error
  [ ] npm run typecheck   0 error
  [ ] TZ=UTC          npm test   semua lulus
  [ ] TZ=Asia/Jakarta npm test   semua lulus
  [ ] Seluruh checklist tes bagian 6 punya isi dan LULUS

  [ ] Tidak ada satu pun tag [BELUM DIPUTUSKAN] atau keputusan yang dikarang
  [ ] migrations/0001_init.sql tidak diubah tanpa alasan kuat yang ditulis di laporan
  [ ] src/server/waktu.ts, src/server/auth.ts, src/server/guard.ts, src/server/audit.ts
      tidak diubah kecuali memang ada bug — kalau ada, laporkan di laporan DULU

################################################################
8. CARA KERJA
################################################################
  1. Baca semua dokumen (bagian 2).
  2. Tulis rencana singkat: entitas mana, route mana, halaman mana.
  3. Bangun repo + aturan dulu, dengan tesnya.
  4. Bangun route API dengan guard, dengan tesnya.
  5. Bangun layout + halaman.
  6. Jalankan build, typecheck, dan tes DI DUA TIMEZONE. Laporkan output aslinya.
  7. Tulis laporan (bagian 9).

  Untuk setiap entitas: selesaikan repo + tes REPO lebih dulu sebelum route-nya.
  Jangan menumpuk semua tes di akhir.

################################################################
9. LAPORAN — WAJIB, PERSIS FORMAT INI
################################################################
Milestone: M2
Selesai: <entitas yang selesai, file yang dibuat>
Versi: Node <node -v> / Next.js <versi>
Tes: <lulus/gagal, jumlah, di masing-masing timezone>
Migrasi: <tidak ada / apa yang berubah dan mengapa>
Toko: <bukti nama ganda ditolak, nonaktifkan bekerja>
Shift: <bukti BR-T3 jam sama ditolak, lintas malam diterima, BR-J1 bentrok nama ditolak>
Karyawan: <bukti 6 field, NIK ganda ditolak>
Penempatan: <bukti BR-P3/K-35 memblokir pemindahan saat masih ada jadwal, dan jalan setelah jadwal dihapus>
Link: <bukti satu link aktif, buat ulang satu transaksi, link lama tidak ikut tercabut saat gagal>
Akun admin: <bukti min 8 karakter, password tidak ada di audit>
Pengaturan: <bukti nilai negatif ditolak, token bot tidak pernah keluar>
Izin: <bukti ADMIN mendapat 403 di setiap route Super Admin>
Audit: <bukti setiap mutasi tercatat + audit ikut rollback>
Verifikasi dokumentasi eksternal: <apa, sumber> (di rules/NOTES.md)
Keputusan teknis yang Anda ambil: <password ditampilkan sekali berapa lama, nama lain yang perlu konfirmasi>
Pertanyaan baru: <tidak ada, atau ID di rules/OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>

################################################################
10. BERHENTI
################################################################
Setelah menulis laporan, BERHENTI. Jangan memulai M3 atau milestone berikutnya.
Tunggu pemilik menjawab "lanjut".
```

## B. Prasyarat

Sama dengan `rules/07` bagian B — Node `24.x` (`nvm use` membaca `.nvmrc`), database uji
`data/uji.db` file lokal (K-42).

Perintah yang harus hijau sebelum dan sesudah:

```
npm run build
npm run typecheck
TZ=UTC          npm test
TZ=Asia/Jakarta npm test
```

## C. Prasyarat yang sudah dipastikan

- Tabel untuk seluruh entitas M2 sudah ada di `migrations/0001_init.sql` — **tanpa migrasi baru**
- `jadwal` dan `jadwal_slot` juga sudah ada, jadi K-35 bisa diuji tanpa membangun fitur jadwal
- `guard.ts`, `audit.ts` dengan executor, dan matriks izin lengkap sudah tersedia

## D. Perbedaan dari M1

| Hal | M1 | M2 |
|---|---|---|
| Setiap route perlu Izin berbeda | hanya dashboard | 7 permission berbeda |
| Mutasi + audit | 1 route | ~30 route, semuanya wajib dalam transaksi |
| Tes | repo + route | diberi daftar skenario terperinci di bagian 6 |
| Need migrasi | tidak | **tidak** — semuanya sudah ada |

## E. Catatan pemeliharaan

| Perubahan | Yang harus diedit |
|---|---|
| Kolom tabel berubah | `rules/04` §2 lalu bagian 3 di sini |
| Izin baru | `src/server/izin.ts` lalu bagian 4d |
| Aturan baru di `rules/02` | bagian 4 dan 6 |
