# 21 — Utang Kerja yang Ditunda ke M10

> **Daftar pekerjaan yang SUDAH TAHU, sengaja tidak dikerjakan di M9.**
> Dipindah ke sini oleh pemilik pada 2026-10-03 setelah audit independen terhadap
> hasil M9. Setiap butir punya **cara reproduksi** supaya bisa langsung dibuktikan.
>
> M9 selesai 2026-10-03: 664 tes hijau di tiga timezone. Empat butir di bawah **tidak**
> merusak apa yang sudah dicapai M9 — semuanya tersisa dari luar ruang lingkupnya.

## A. Ringkasan

| ID | Isi | Severity | Status |
|---|---|---|---|
| M10-01 | `/login` dan `/` tanpa satu pun header keamanan | **tinggi** | belum |
| M10-02 | `script-src 'unsafe-eval'` aktif di produksi | sedang | belum |
| M10-03 | `ItemMenu.segera` adalah kode mati | kecil | belum |
| M10-04 | Lingkungan DOM (jsdom) — B-20 | besar | **menunggu keputusan pemilik** |

**Tidak ada satu pun dari butir ini yang disebabkan oleh M9.** M10-01 dan M10-02
adalah batas cakupan yang saya tulis sendiri di prompt M9; M10-03 adalah efek samping
wajar dari penghapusan cabang `(Segera)`.

---

## B. Butir Per Item

### M10-01 — `/login` dan `/` tanpa satu pun header keamanan

**Severity: tinggi.** Ini satu-satunya halaman tanpa autentikasi yang menerima
password — permukaan serangan terbesar di aplikasi — dan justru tidak punya proteksi
header apa pun.

**Fakta terverifikasi (produksi lokal, 2026-10-03):**

```
GET /login   -> HTTP/1.1 200 OK        (tanpa X-Content-Type-Options,
GET /         -> HTTP/1.1 200 OK         tanpa Referrer-Policy,
                                         tanpa X-Frame-Options, tanpa CSP)
GET /admin/* -> 200 + keempat header ada
GET /a/*     -> 200/404 + X-Content-Type-Options + Permissions-Policy
```

`next.config.mjs` hanya punya dua blok `source`: `/a/:path*` dan `/admin/:path*`.

**Aturan:** `rules/03` §9.7 — "Header keamanan dasar (CSP yang mengizinkan kamera untuk
origin sendiri, `X-Content-Type-Options`, dll)." Tidak menyebut path, jadi "/" dan
"/login" termasuk.

**Reproduksi:**

```bash
npm run build && npm run start
curl -s -D - -o /dev/null http://localhost:PORT/login | grep -iE 'x-content-type|x-frame|referrer|content-security'
# kosong — tidak ada satu pun
```

**Saran perbaikan:** tambahkan blok ketiga di `next.config.mjs` untuk `/` dan
`/login`. CSP di sana boleh paling ketat karena tidak ada kamera dan tidak ada grafik —
cukup `default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'`.

**PENTING:** `/login` adalah halaman dengan `<form>`. Kalau `form-action` atau
`base-uri` salah, login mati. Buktikan dengan benar-benar login lewat browser, bukan
hanya `curl`.

---

### M10-02 — `script-src 'unsafe-eval'` aktif di produksi

**Fakta:** `next.config.mjs` memakai

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

`'unsafe-eval'` **dibutuhkan** `next dev`, tapi **tidak** dibutuhkan produksi.
`headers()` mengembalikan nilai yang sama untuk kedua mode, jadi produksi sekarang
membuka `eval()` untuk sumber mana pun yang lolos `'self'`.

Agent M9 sudah menyebut ini sebagai "tradeoff sadar" dan dicatat di `rules/NOTES.md`
§16. Itu benar dan jujur — tapi tradeoff itu belum tentu perlu dibayar.

**Catatan jujur soal risikonya:** dalam aplikasi tanpa input pengguna yang masuk
atribut HTML dan tanpa dependensi pihak ketiga yang evaluating string, risiko praktis
`unsafe-eval` kecil. Yang utama adalah prinsip: header keamanan produksi jangan lebih
longgar dari kebutuhan produksi.

**Saran perbaikan:** jadikan `headers()` bernilai dinamis berdasarkan `NODE_ENV`,
lalu bangun produksi untuk membuktikan halamannya tetap berfungsi tanpa `unsafe-eval`.

**PERINGATAN:** jangan menaikkan ketatnya tanpa membuktikan halaman admin masih
merender. Recharts, base-ui, dan Next App Router semuanya bisa memakai inline script.

---

### M10-03 — `ItemMenu.segera` adalah kode mati

**Fakta:** `src/app/admin/menu.ts:7` masih mendeklarasikan

```ts
segera?: boolean;
```

tapi tidak ada lagi yang membacanya. Cabang yang memakainya (label "Segera" di
`layout.tsx`) sudah dihapus saat M9 mengaktifkan Audit Log.

**Reproduksi:** `grep -rn 'segera' src/app/` → hanya satu baris, yaitu deklarasinya.

**Dua pilihan, jangan diambil diam-diam:**
  (a) Hapus field-nya. Paling bersih, tapi begitu ada milestone "Segera" lain, field
      ini harus ditambahkan ulang.
  (b) Biarkan dengan komentar yang menjelaskan tuannya untuk milestone berikutnya.

**Rekomendasi pemilik:** (b), dengan komentar. Proyek ini memang memakai pola
"Segera" untuk menu yang belum ada, dan menghapus field itu akan membuat pola itu
rusak tanpa alasan.

---

### M10-04 — Lingkungan DOM (B-20) — menunggu keputusan pemilik

**Status:** pemilik menunda dua kali. Pertama kali dengan alasan "kita install jsdom
nanti saja" (2026-10-03, sebelum M9). M9 sudah selesai dan B-20 **tidak** dikerjakan
sesuai instruksi. **Belum ada persetujuan memasang.**

**Fakta:** `vitest.config.mts` memakai `environment: 'node'`. 664 tes berjalan tanpa
satu pun `document`. Semua markup diuji lewat `renderToStaticMarkup`, yang hanya
menghasilkan string HTML — tidak ada interaksi.

**Yang tetap tidak teruji akibatnya:**

| Alur | Risiko nyata |
|---|---|
| `tombol-keluar.tsx` | Kalau `fetch('/api/logout')` gagal, `finally` tetap `router.push('/login')`. User melihat halaman login tapi **sesinya masih hidup** — mundur atau ketik `/admin` lagi akan masuk. |
| `admin/ubah-password` | Sesi lain benar-benar dibatalkan? (K-47) |
| Isi massal jadwal | Persis tempat **B-19** dulu hidup: pratinjau menghitung, apply mengabaikan |
| Setujui massal verifikasi | `keterlambatan_final_menit: 0` benar-benar terkirim? (K-30) |
| Semua halaman | Apakah `disabled` benar-benar mati setelah fetch gagal; apakah pesan galat muncul |

**Kalau nanti disetujui — cakupan sempit, bukan 12 halaman:**

Pasang `jsdom` + `@testing-library/react` + `@testing-library/user-event`, lalu kunci
**empat alur** di atas. Ketiga paket dibeli beriringan; jsdom saja hanya memberi
`document` sehingga Anda akan memanggil `dispatchEvent` tangan — itu menguji tes
sendiri, bukan kode Anda.

**Batas jsdom yang harus diingat:** jsdom **bukan browser**. Tidak ada layout, tidak
ada cat, tidak ada scroll/fokus sungguhan, tidak ada `fetch` nyata. Jadi jsdom tidak
menggantikan pemeriksaan visual di browser.

---

## C. Yang SUDAH benar di M9 — jangan dirusak

Hasil audit independen 2026-10-03, semuanya terbukti. Jangan diubah saat M10.

| Hal | Bukti |
|---|---|
| 664 tes hijau di tiga timezone | UTC, Asia/Jakarta, America/New_York |
| `src/app/a/`, `src/server/guard.ts`, `src/server/waktu.ts`, `migrations/` | `git diff` kosong |
| md5 `0001_init.sql` | `466a7b1a5aa5b1ab0a88e0a5f63a8a98` |
| SQL audit log aman | `klausa` hanya literal hardcoded; nilai lewat `args` (`?`) |
| `guard('audit_log')` persis | ada di matriks `src/server/izin.ts` |
| `pengguna_admin.nama` | cocok dengan skema |
| M9-01..M9-05 tertutup | 5 mutasi audit sendiri, semuanya tertangkap |
| Mutasi bonus: hapus `X-Frame-Options`, longgarkan CSP, ubah nama sumber, tambah CSP ke `/a/`, salah nama guard | semuanya tertangkap |
| `formatWaktuAudit` aman timezone | pakai `slice()`, nol `new Date()` / `getHours()` |
| `password_hash` tidak pernah masuk audit | hanya `{id, username, nama, peran}` |
| Route mutasi 405 | handler murni tanpa DB dan tanpa data |
| Tidak ada teks Inggris di halaman audit log | sapuan teks node JSX |
| Tidak ada tombol ubah/hapus di audit log | 0 di HTML nyata |

## D. Cara membuktikan CSP tidak merusak aplikasi

Bukti yang dipakai agent M9 ("header terkirim di 307") **tidak cukup** — 307 berarti
halaman tidak pernah dirender. Cara yang benar, dipakai saat audit:

```bash
npm run build && APP_ORIGIN=http://localhost:PORT PORT=PORT npm run start
# login dengan Origin yang cocok supaya dapat sesi sungguhan
# (produksi mengabaikan APP_ORIGIN_DEV — lihat BUG-UI-02)
curl -s -H "Cookie: sesi=..." http://localhost:PORT/admin/audit-log > h.html
# lalu inventarisasi sumber daya:
#   - <script src>  : semua harus self (script-src 'self')
#   - <script> inline: diizinkan oleh 'unsafe-inline'
#   - <link href>   : semua harus self
#   - atribut style= : diizinkan oleh style-src 'unsafe-inline'
```

Pada M9 hasilnya: 13 script src (**0 non-self**), 5 inline, 2 link (**0 non-self**),
1 atribut style — di 12 halaman. Jadi CSP tidak memblokir apa pun yang dipakai.

**Catatan:** ini masih belum membuktikan apa yang terjadi di browser. Pelanggaran CSP
muncul di konsol browser, bukan di respons HTTP. Bukti terakhir tetap membuka
halamannya di browser.

## E. Pelajaran untuk menulis prompt berikutnya

Prompt M9 punya **kontradiksi internal** yang saya buat sendiri:

```
Baris 244, daftar DILARANG:
  src/app/admin/verifikasi/**  Sudah disetujui pemilik pada UI-2.

 barcode 8 dan tabel D, daftar WAJIB:
  M9-02 harus dikerjakan di src/app/admin/verifikasi/page.tsx
```

Agent menanganinya dengan benar — footprint minimum, lalu minta persetujuan di
laporan. Tapi supaya tidak terjadi.

**Aturan untuk prompt selanjutnya:** satu bagian berisi yang harus dilakukan, satu
bagian berisi yang dilarang. Sebelum mengirim, **grep setiap path yang muncul di kedua
bagian** dan pastikan tidak ada yang bentrok.

Kasus ini mengulang pola yang sama seperti BUG-UI-05: **menulis aturan yang membuat
sesuatu mustahil tanpa disadari.** Prompt saat ini ditulis tangan tanpa pemeriksaan
silang, jadi kesalahan seperti ini hampir pasti akan terulang.

---

## F. Yang TIDAK termasuk M10

- **Fitur baru apa pun** — pemilik tidak meminta
- **Perubahan aturan bisnis** — K-1 s.d. K-56 sudah final
- **Optimasi indeks database** — `audit_log` tidak punya indeks untuk `pengguna_id`
  atau `aksi`, jadi filter pelaku akan memindaai seluruh tabel. Datanya masih kecil
  dan diterima. Menambah indeks adalah perubahan skema dan perlu keputusan tersendiri.
- **Halaman karyawan** `/a/[token]` — di luar cakupan sejak awal