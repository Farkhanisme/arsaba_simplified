# OPEN QUESTIONS

Pertanyaan yang **memblokir** atau **membutuhkan keputusan pemilik**. ID berlanjut dari B-16.
Setiap entri: ID · konteks · apa yang sudah diverifikasi · opsi · rekomendasi.

Status per 2026-10-03: **tidak ada pertanyaan terbuka.**
Seluruh B-01 s.d. B-18 sudah tertutup. **ID berikutnya: B-20.**

---

## B-19 — isi massal gagal sepenuhnya saat satu sel ditolak ~~SELESAI 2026-10-03~~

**Status: DITUTUP (diperbaiki saat M5 berjalan).** Keputusan pemilik: **opsi A** —
sel yang ditolak dilewati dan dilaporkan, sel yang valid tetap tersimpan
(bukan membatalkan seluruh operasi).

**Konteks.** `POST /api/admin/jadwal/massal` (apply) membungkus seluruh loop dalam
satu transaksi; `buatAtauTimpa()` melempar `GalatAturan` per sel. Satu sel
BR-J4/BR-J2/BR-J9 me-rollback seluruh operasi: tidak ada satu pun jadwal
tersimpan, dengan pesan generik. Pratinjau menghitung `ditolak` lalu apply
mengabaikannya — dua jalur tidak sejalan.

**Perbaikan.** `klasifikasiSel()` di `src/server/repo/jadwal.ts`: satu classifier
non-melempar untuk pratinjau DAN apply (invarian: hitungan sama persis).
`terapkanMassal()`: GalatAturan 404/409/403 per sel → array `ditolak`;
error lain tetap me-rollback seluruh transaksi. Semua-ditolak → 409
`SEMUA_DITOLAK` (bukan 201 "0 dibuat"). Sel ditolak tanpa audit.
UI menampilkan `ditimpa` + `ditolak` di panel hasil.

**Keputusan terkait yang lahir dari sini:**
- **K-55** — batas 100 karyawan per operasi isi massal (perlindungan beban).

> **Ada 1 catatan teknis (bukan pertanyaan, tidak memblokir):** batas 20 jam dan check-in
> bertanggal masa depan — lihat bagian C di bawah.Owner sudah memutuskan
> 2026-10-03 untuk tidak mengubah M3.

---

## B-17 — `npm run build` crash dengan SIGBUS (memblokir deploy)

**Status:** **DITUTUP** (2026-10-02) · **memblokir:** verifikasi sebelum deploy produksi

### Gejala

```
$ npm run build
> arsaba-management-center@0.1.0 build
> next build

▲ Next.js 16.3.8 (Turbopack)
- Environments: .env.local
✓ Running next.config.mjs took 12ms
exit 135    # 128 + 7 = SIGBUS
```

Crash terjadi **sangat awal** — setelah memuat `next.config.mjs`, sebelum kompilasi apa pun.
`typecheck` dan seluruh tes tetap hijau.

### Sudah dibuktikan: BUKAN kode repositori ini

Build di proyek kosong yang tidak berisi kode kita sama sekali juga crash:

```
/tmp/bt  (package.json + next.config.mjs minimal, node_modules disymlink)
▲ Next.js 16.3.8 (Turbopack)
✓ Running next.config.mjs took 12ms
exit 135
```

Jadi penyebabnya di luar repo: lingkungan mesin, Node 24.21.0, atau Next.js 16.3.8.

### Yang sudah dicek dandikeluarkan (tidak menjadi penyebab)

| Aspek | Hasil |
|---|---|
| `--webpack` (bukan Turbopack) | exit 135, sama |
| `NEXT_TELEMETRY_DISABLED=1` | exit 135, sama |
| `--max-old-space-size=4096` | exit 135, sama |
| Artefak `.next` + `tsconfig.tsbuildinfo` dihapus | exit 135, sama |
| Proyek minimal tanpa kode kita | exit 135, sama |
| `node -e 'require("next/package.json")'` | OK |
| Alokasi 64 MB `Buffer` + `Float64Array` | OK |
| Memori | 5,5 GB tersedia dari 7,6 GB |
| Disk | 111 GB kosong dari 224 GB |
| Swap | ada (8,8 GB, 0 terpakai) |
| Integritas binary node | 126 MB, `node -e` jalan normal |
| Core dump | `Signal: 7 (BUS)` pada biner node itu sendiri |

### PENYEBAB PASTI (terverifikasi 2026-10-02)

Binary native SWC **terpotong di level file**: file hanya **4.570.568 byte** sejak 2026-10-01 07:44 (hari install M0), kemungkinan unduhan terputus yang tidak divalidasi `npm`. Bukti dari `strace -f`: `mmap(NULL, 96725920, ...)` meminta ~92 MB, openat terakhir adalah file `.node` itu, lalu kernel menjawab `+++ killed by SIGBUS` serentak di 12 proses worker. `next dev` sehat karena jalurnya tidak menyentuh segmen yang terpotong.

Perbaikan:

    rm -rf node_modules/@next/swc-linux-x64-gnu node_modules/@next/swc-linux-x64-musl
    npm install --force
    # ls -la -> 96731944 byte (96725920 + header ELF)
    # npm run build -> Compiled successfully in 3.8s

**Bukan masalah kernel, THP, /dev/shm, versi Node, atau kode repositori.** Keenam dugaan itu gugur satu per satu lewat bukti.

### Yang tadinya BELUM terverifikasi (sekarang terjawab)

- Penyebab sebenarnya (mmap/JIT di kernel, filesystem, atau regresi Turbopack).
- Apakah build pernah berhasil di mesin ini **sebelum** hari ini. Build M1/M0 pernah
  hijau, jadi ada regresi lingkungan atau perubahan di antara dua waktu itu.
- Kernel dan versi driver yang dipakai.

### Opsi

1. **Restart mesin lalu ulangi `npm run build`.** Paling murah; banyak penyebab SIGBUS
   hilang setelah restart. Ini yang dicoba pertama.
2. **Coba Node 22 LTS.** Node 22.23.3 tersedia lewat nvm. Kalau build jalan di Node 22,
   penyebabnya ada di Node 24.21.0 dan kita perlu memutuskan antara sekarang atau
   menunggu versi patch yang lebih baik.
3. **Naikkan versi Next.js** dalam rentang `^16.3.7` (mis. ke patch berikutnya). Hanya
   layak kalau ada changelog yang menyebut perbaikan crash build.
4. Laporkan ke Next.js / Vercel bila langkah 1–3 gagal.

### Rekomendasi

**Langkah 1 dulu** (restart), lalu **langkah 2** (Node 22) sebagai pembeda diagnosis.
Jangan menaikkan versi Next.js dulu — itu mengubah dependensi tanpa mengetahui
penyebabnya.

### Dampak

Build sudah hijau: seluruh 10 rute terdaftar. `typecheck` dan 63 tes × 2 timezone hijau, jadi logika dan keamanan M1 sudah terverifikasi.
Yang belum terverifikasi hanya **artefak build produksi**. Sebelum deploy ke Vercel, ini
harus hijau. Selama belum, jangan kirim ke produksi.

---

## B-16 — Angka batas percobaan login ~~BELUM~~ SUDAH DIPUTUSKAN

**Status:** **DITUTUP** (2026-10-01) · Recorded as **K-46**

**Konteks:** `rules/02` §14 menyebut "pembatasan percobaan login gagal per username/IP via
tabel `percobaan_login`" tapi **tidak menyebutkan angka batas**. Tidak ada `[KEPUTUSAN]` yang
menetapkan berapa kali gagal sebelum diblokir.

**Jawaban pemilik:** **5 percobaan gagal dalam 24 jam**, per username **dan** per IP.
Super Admin dapat membuka kunci secara manual.

**Keputusan terkait yang lahir dari sini:**
- **K-46** — tarif 5/24 jam per username + per IP, kunci 24 jam, buka kunci manual oleh Super Admin.
- **BR-AUTH2** di `rules/02` §14 — aturan lengkapnya.
- Selisih yang ditemukan saat audit: implementasi M1 menerima parameter `ip` tetapi **tidak
  pernah memakainya** di query, sehingga rate limit hanya per username. Anyone bisa mengunci
  akun mana pun dengan 5 percobaan gagal. Ini termasuk dalam pekerjaan perbaikan M1
  (`rules/09-agent-prompt-perbaikan-m1.md`).

---

## Catatan audit M1 (bukan pertanyaan, tapi belum dikerjakan)

Temuan audit terhadap hasil M1 yang MASIH perlu diperbaiki. Semuanya dikerjakan lewat
`rules/09-agent-prompt-perbaikan-m1.md`; daftar ini hanya rekap agar tidak hilang.

| Temuan | Severity | Status |
|---|---|---|
| Id sesi tidak di-hash — `createSession` sudah benar, tapi `login/route.ts` menaruh `hash` ke cookie sehingga **setiap login ditolak** | blocker | **SELESAI** 2026-10-02 |
| Endpoint izin memakai `izinDiperlukan('test_admin', ...)`; nama itu tidak ada di `IZIN_MATRIX` sehingga menolak semua peran | blocker | **SELESAI** 2026-10-02 |
| 13x `new Date().toISOString()` — melanggar `rules/04` §1 (`+07:00`) dan `rules/03` §5 | blocker | **SELESAI** 2026-10-01 |
| `migrate.ts` menyimpan waktu seed berbohong 7 jam (`.replace('Z','+07:00')`) | blocker | **SELESAI** 2026-10-01 |
| `trim()` masih ada pada tiga field password di route ubah-password (BR-AUTH5) | sedang | **SELESAI** 2026-10-02 |
| Tes Origin membaca teks file; `izin.test.ts` punya `expect(true).toBe(true)` | sedang | **SELESAI** 2026-10-02 — diganti `tests/route.e2e.test.ts` |
| Halaman ubah-password menampilkan JSON mentah, tidak kembali ke `/login` | sedang | **SELESAI** 2026-10-02 |
| Rate limit per-IP diabaikan | tinggi | **SELESAI** 2026-10-01 |
| Cek `Origin` bisa dilewati (header kosong + `startsWith`) | tinggi | **SELESAI** 2026-10-01 |
| Password di-trim() di route login | sedang | **SELESAI** 2026-10-01 |
| Password seed hardcoded di source + dicetak ke log | sedang | **SELESAI** 2026-10-01 |
| Tidak ada halaman ubah-password (K-47) | fitur | **SELESAI** 2026-10-01 |

### Pelajaran yang perlu diingat

M1 sempat dua kali dilaporkan "selesai" padahal masih ada blocker. Penyebabnya:

1. Tes menguji `createSession` dan `getSession` **langsung**, sehingga keduanya selalu konsisten
   dan **tidak mungkin** menangkap bug yang ada di route.
2. Tes Origin membaca teks file dengan `expect(...).toContain('origin !== appOrigin')`.
3. `izin.test.ts` punya `expect(true).toBe(true)` dengan komentar penjelas.

Semuanya lulus tanpa memeriksa perilaku apa pun.

**Rumus:** setiap aturan yang bisa diam-diam merusak harus punya tes yang memanggil
kode jalannya, bukan membaca teksnya.

Semua poin `rules/09` sudah terpenuhi. `tests/route.e2e.test.ts` memanggil Route Handler
sungguhan lewat `NextRequest`, dan sudah dibuktikan menangkap bug: dengan `login/route.ts`
sengaja dikembalikan ke versi salah, 4 dari 9 tes gagal.

---

## C. Catatan teknis (bukan pertanyaan — tidak memblokir apa pun)

### C-1. `dalamBatas20Jam()` menerima check-in bertanggal masa depan

**Ditemukan saat audit M3 (2026-10-03).** Bukan bug yang berbahaya — dampaknya nol untuk
produksi — tapi dicatat agar tidak hilang.

**Gejalanya.** Fungsi ini di `src/server/aturan/absensi.ts`:

```ts
export function dalamBatas20Jam(waktuCheckInISO: string, sekarangISO: string): boolean {
  return waktuCheckInISO >= geserJamISO(sekarangISO, -BATAS_CHECKOUT_JAM);
}
```

Satu perbandingan string. Untuk `waktuCheckInISO` bertanggal **30 jam di masa depan**, hasilnya
`true` — check-in dianggap masih terbuka, padahal seharusnya tidak.

| Skenario | Hasil | Benar? |
|---|---|---|
| 19 jam lalu | `true` | ✅ |
| tepat 20 jam | `true` | ✅ |
| 20 jam + 1 detik | `false` | ✅ |
| 21 jam lalu | `false` | ✅ |
| **masa depan 30 jam** | **`true`** | ❌ seharusnya `false` |

**Mengapa dampaknya nol di produksi.** Waktu absensi selalu diambil dari server —
`sekarangWIB()` di `src/app/api/absen/route.ts` baris 129 — bukan dari klien. Jadi
`absensi.waktu` tidak mungkin bertanggal masa depan, kecuali jam server melompat mundur
(lompat NTP, atau pengujian Database dengan waktu buatan).

**Mengapa tetap dicatat.** Fungsi ini murni dan akan dipakai ulang di M4 (koreksi manual,
BR-K3) dan M5 (jadwal, BR-A10). Kalau nanti dipakai untuk keputusan selain "apakah tombol
checkout tampil", konsekuensinya tidak lagi nol.

**Patch yang siap (satu baris).** Diterapkan owner 2026-10-03 untuk dilakukan di **M4**, saat
`src/server/aturan/absensi.ts` kebetulan disentuh:

```ts
export function dalamBatas20Jam(waktuCheckInISO: string, sekarangISO: string): boolean {
  return (
    sekarangISO >= waktuCheckInISO &&   // check-in bertanggal masa depan ditolak
    waktuCheckInISO >= geserJamISO(sekarangISO, -BATAS_CHECKOUT_JAM)
  );
}
```

**Tes yang menyertainya** (wajib ikut saat patch diterapkan):

```ts
it('check-in bertanggal masa depan tidak dianggap terbuka', () => {
  expect(dalamBatas20Jam('2026-10-04T18:00:00+07:00', '2026-10-03T12:00:00+07:00')).toBe(false);
});
```

### C-2. Constraint DB tidak membatasi batas atas `keterlambatan_final_menit`

**Ditemukan saat menyiapkan M4 (2026-10-03).** Bukan bug — keputusan pemilik sudah menutup bagian
ini (K-54) — tapi tidak ada yang menegakkannya selain aplikasi.

**Situasi.** `migrations/0001_init.sql` baris ~143:

```sql
keterlambatan_final_menit INTEGER CHECK (keterlambatan_final_menit IS NULL OR keterlambatan_final_menit >= 0),
```

Hanya mengecek `>= 0`. **Tidak ada batas atas di database.** Nilai `5000` atau `999999` akan
diterima database.

**Kenapa tidak ditambah ke CHECK.** Menambahnya butuh mengubah `0001_init.sql`, yang sudah
dipakai di database uji dan saat ini sengaja tidak diubah sejak M0 (prinsip maju-saja, dan
`rules/04` §6 melarang mengubah migrasi yang sudah dijalankan).

**Yang WAJIB dilakukan di M4.** Batas **0–1440** (K-54) ditegakkan di route/server dengan
pesan "Menit terlambat harus antara 0 dan 1440." Tes wajib: 1440 diterima, 1441 dan -1
ditolak, dan penolakan tetap terjadi ketika route dipanggil langsung (UI di-bypass).

**Risiko kalau ini terlewat.** Admin salah ketik `700` untuk check-in jam 07:00 → angka 700
lolos ke rekap (BR-L3 memakai angka final) dan baru terlihat saat rekap bulanan.
Tidak ada error, tidak ada crash — hanya salah angka yang diam-diam.

**Kalau nanti mau menutup di database juga**, buat migrasi baru `0002_...sql` (maju-saja,
lihat `rules/04` §6), jangan mengubah `0001_init.sql`.

---

## B-18. ~~K-44 (dua timezone) tidak bisa menangkap bug tanggal bergantung timezone mesin~~ **SELESAI 2026-10-03 — pemilik menyetujui timezone ketiga. K-44 sekarang tiga timezone.**

**Ditemukan saat menyiapkan M5 (2026-10-03). ID berikutnya: B-19.**

**Konteks.** K-44 mewajibkan tes lulus di dua timezone:

```
TZ=UTC          npm test
TZ=Asia/Jakarta npm test
```

Keduanya **offset nol atau positif**. B-13 (bug asli yang pernah terjadi) adalah kelas bug
"tanggal ikut timezone mesin" — dan kelas bug itu justru **paling lemah** di dua timezone itu,
karena keduanya memberi jawaban yang sama.

**Bukti konkret.** Grid jadwal M5 butuh nama hari. Dua cara menulisnya:

```ts
// SALAH — ikut timezone mesin
new Date('2026-10-04').getDay()
```

| Tanggal | `TZ=UTC` | `TZ=Asia/Jakarta` | `TZ=America/New_York` |
|---|---|---|---|
| 2026-10-04 | Minggu ✓ | Minggu ✓ | **Sabtu** ✗ |
| 2026-10-03 | Sabtu ✓ | Sabtu ✓ | **Minggu** ✗ |

Artinya kode salah ini **lulus seluruh kriteria tes yang sekarang**, dan baru salah saat
dipakai. Pola benar sudah dipakai `tanggalPanjangWIB()` di `server/waktu.ts`:
`new Date(Date.UTC(y, m - 1, d)).getUTCDay()`.

**Opsi.**

1. **Tambah timezone ketiga** `TZ=America/New_York` (offset −04:00) ke K-44.
   Tidak menambah dependensi, hanya satu perintah lagi:
   `TZ=America/New_York npm test`.
   Menangkap kelas bug B-13 sepenuhnya.
2. **Tetap dua timezone**, andalkan disiplin pola benar + review manual.
   Murah, tapi tidak ada pengaman otomatis — dan B-13 dulu lolos justru karena tes hijau.
3. **Tambah timezone ketiga + audit** semua pemakaian `Date`/`get*` di `src/`.
   Paling kuat, paling mahal.

**Rekomendasi: opsi 1.** Alasannya murah dan menutup lubang yang nyata. Opsi 3 bisa jadi
pekerjaan terpisah menjelang produksi (M9 sudah menjadwal QA menyeluruh).

**Yang sudah dilakukan meanwhile.** M5 tidak menunggu keputusan ini — `rules/13-agent-prompt-m5.md`
bagian 4b dan 6 memerintahkan `namaHariWIB()` memakai pola `Date.UTC` + `getUTCDay` dan
menegaskan alasannya. Jadi M5 aman meski K-44 belum diubah. Yang belum tertutup adalah
**pengaman otomatis**, bukan implementasinya.


---

## Penutup B-18 (2026-10-03)

**Keputusan pemilik: disetujui.** K-44 diperluas menjadi **tiga timezone**:
`TZ=UTC`, `TZ=Asia/Jakarta`, `TZ=America/New_York`. Satu perintah: `npm run test:tz`.

**Bukti pendukung sudah dijalankan, bukan hanya hypothesised:**

| Pengujian | Hasil |
|---|---|
| Pola salah `new Date(tanggal).getDay()` di `TZ=America/New_York` | meleset **6 dari 6 tanggal** |
| Pola salah di `TZ=UTC` | meleset **0 dari 6** |
| Pola salah di `TZ=Asia/Jakarta` | meleset **0 dari 6** |
| Pola salah di `TZ=Pacific/Kiritimati` (UTC+14) | meleset **0 dari 6** |
| Suite penuh 318 tes di `TZ=America/New_York` | **318 lulus** |

**Temuan sampingan yang tidak terduga.** `Pacific/Kiritimati` adalah offset terbesar di dunia
(+14) dan **tetap tidak menangkap apa pun** — sama saja dengan UTC. Jadi menambah timezone
offset positif kedua tidak menambah daya deteksi sama sekali; hanya offset negatif yang
berguna. Itu sebabnya cukup tiga, bukan empat.

**Artinya untuk warisan.** Kode M0–M4 ternyata memang sudah bebas timezone mesin. Ini
kabar baik, tapi perlu dibaca jujur: itu karena `server/waktu.ts` sudah memakai pola
`Date.UTC` + `getUTCDay` — **bukan** karena ada pengaman yang menangkapnya. Pengaman baru
tidak menemukan apa-apa sekarang karena memang tidak ada bug warisan; nilainya ada di
pemeliharaan selanjutnya. Detail di `rules/NOTES.md` §11.

**ID berikutnya: B-19.**
