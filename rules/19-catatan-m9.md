# 19 — Utang Kerja yang Ditunda ke M9

> **Daftar pekerjaan yang SUDAH TAHU, sengaja tidak dikerjakan di UI-2.**
> Dipindah ke sini oleh pemilik pada 2026-10-03 setelah audit independen terhadap
> hasil UI-2. Setiap-butir punya **cara reproduksi** supaya bisa langsung
> dibuktikan, bukan menerima begitu saja.
>
> Kalau M9 dikerjakan, kerjakan butir ini lebih dulu — semuanya murah, dan
> semuanya adalah pagar yang saat ini hilang.

## A. Ringkasan

| ID | Isi | Severity | Status |
|---|---|---|---|
| M9-01 | Empty state "Minta Super Admin menambah template…" tidak punya tes | sedang | belum |
| M9-02 | Empty state "Tidak ada absensi yang menunggu verifikasi." tidak punya tes | sedang | belum |
| M9-03 | Batas `maxLength` pada input tidak punya tes | sedang | belum |
| M9-04 | Teks petunjuk "(min 8)" tidak punya tes | kecil | belum |
| M9-05 | `aria-label="Panel sel"` hilang di jadwal (regresi aksesibilitas) | kecil | belum |
| B-20 | Tidak ada lingkungan DOM (jsdom/happy-dom) | besar | menunggu persetujuan |

---

## B. Butir Per Item

### M9-01 — Empty state jadwal "belum ada template" tidak teruji

**Aturan:** `rules/05` §5.4 — *"Bila belum ada shift template: arahkan Super Admin ke
Data Master › Shift."*

**Lokasi:** `src/app/admin/jadwal/page.tsx`

**Reproduksi:**

```
hapus kalimat "Minta Super Admin menambah template di Data Master › Shift."
TZ=UTC npx vitest run tests/ui2-*.test.ts
# hasil: 124/124 HIJAU  <- seharusnya gagal
```

**Kenapa bisa lolos:** string itu masih hidup di `page.tsx`, bukan di `komponen.tsx`.
`page.tsx` tidak bisa dirender di tes karena butuh `next/navigation`.

**Perbaikan:** pindahkan ke komponen yang bisa dirender, lalu tambahkan tes
`renderToStaticMarkup` — sama seperti yang sudah dilakukan untuk string lain.

---

### M9-02 — Empty state verifikasi "tidak ada absensi" tidak teruji

**Aturan:** `rules/05` §5.3 — *"Kosong: `Tidak ada absensi yang menunggu verifikasi.`"*
Kata per kata, jadi kalimatnya tidak boleh berubah.

**Lokasi:** `src/app/admin/verifikasi/page.tsx`

**Reproduksi:**

```
hapus kalimat "Tidak ada absensi yang menunggu verifikasi."
TZ=UTC npx vitest run tests/ui2-*.test.ts
# hasil: 124/124 HIJAU  <- seharusnya gagal
```

**Catatan:** butir ini berutang pada halaman verifikasi yang dibangun sendiri, bukan
pada agent UI-2. **Pagar ini tidak pernah ada sejak halaman itu dibuat.**

**Perbaikan:** sama seperti M9-01.

---

### M9-03 — Batas `maxLength` pada input tidak teruji

**Fakta:** ada 16 `maxLength` di `src/app/admin/` (50, 100, 200, 500). **Nol** tes yang
menyebut `maxLength`.

**Reproduksi:**

```
hapus satu "              maxLength={500}" dari src/app/admin/master/karyawan/komponen.tsx
TZ=UTC npx vitest run tests/ui2-*.test.ts
# hasil: 116/116 HIJAU  <- seharusnya gagal
```

**Kenapa belum berbahaya:** server tetap memvalidasi dengan zod
(`src/app/api/admin/master/karyawan/route.ts`: `z.string().max(500, ...)`). Jadi ini
bukan lubang keamanan — hanya pagar sisi klien yang bisa regresi diam-diam.

**Perbaikan:** tambahkan tes yang memeriksa `maxLength` per field. Kalaudeterministik
 Forge-dipakai rules/04 sebagai sumber panjang kolom, lebih baik_assert angka itu
datang dari satu tempat.

---

### M9-04 — Teks petunjuk "(min 8)" tidak teruji

**Aturan:** K-48 (password minimal 8 karakter).

**Status fungsi: AMAN.** `minLength={8}` **sudah** diuji di
`tests/ui2-akun-karyawan.test.ts`. Yang tidak teruji hanya teks petunjuk yang
terlihat pengguna.

**Reproduksi:**

```
hapus "(min 8)" dari src/app/admin/akun/komponen.tsx
TZ=UTC npx vitest run tests/ui2-*.test.ts
# hasil: 116/116 HIJAU
```

**Perbaikan:**_assert `(min 8)` di tes yang sama dengan yang sudah memeriksa
`minLength="8"`.

---

### M9-05 — `aria-label="Panel sel"` hilang (regresi aksesibilitas)

**Sebelum:** `<section aria-label="Panel sel">` di `src/app/admin/jadwal/page.tsx`.

**Sesudah:** `PanelSel` di `src/app/admin/jadwal/komponen.tsx` adalah `Card` tanpa
nama aksesibel.

**Dampak:** pengguna reader layar kehilangan penanda landmark untuk panel edit sel.
Tidak ada teks yang hilang bagi pengguna sighted.

**Reproduksi:** `grep -rn 'Panel sel' src/app/admin/` → kosong.

**Perbaikan:** beri `aria-label` (atau `aria-labelledby` ke `CardTitle`) pada
`PanelSel`.

---

### B-20 — Tidak ada lingkungan DOM

**Status:** pemilik menunda pada 2026-10-03 dengan alasan "`kita install jsdom nanti
saja`". **Belum ada persetujuan untuk memasang.**

**Fakta:** `vitest.config.mts` memakai `environment: 'node'`. 622 tes berjalan tanpa
satu pun `document`. Semua markup diuji lewat `renderToStaticMarkup`, yang hanya
menghasilkan string HTML.

**Yang tidak teruji akibatnya:**

| Alur | Risiko |
|---|---|
| `tombol-keluar.tsx` | Kalau `fetch('/api/logout')` gagal, `finally` tetap `router.push('/login')`. User melihat halaman login tapi **sesinya masih hidup** — mundur atau ketik `/admin` lagi akan masuk. |
| `admin/ubah-password` | Sesi lain benar-benar dibatalkan? (K-47) |
| Isi massal jadwal | Persis tempat **B-19** dulu hidup: pratinjau menghitung, apply mengabaikan |
| Setujui massal verifikasi | `keterlambatan_final_menit: 0` benar-benar terkirim? (K-30) |
| Semua halaman | Apakah `disabled` benar-benar mati setelah fetch gagal; apakah pesan galat muncul |

**Saran cakupan kalau nanti disetujui — sempit, bukan 12 halaman:**

Pasang `jsdom` + `@testing-library/react` + `@testing-library/user-event`, lalu kunci
**empat alur** di atas. Paket tiga itu dibeli beriringan; jsdom saja hanya memberi
`document` sehingga Anda akan memanggil `dispatchEvent` tangan — itu menguji tes
sendiri, bukan kode Anda.

**Perhatikan:** jsdom **bukan browser**. Tidak ada layout, tidak ada cat, tidak ada
scroll/fokus sungguhan, tidak ada `fetch` nyata. Jadi jsdom tidak menggantikan
pemeriksaan visual di browser.

---

## C. Yang SUDAH benar dan tidak boleh dirusak

Hasil audit independen 2026-10-03 — semuanya terbukti, jangan diubah saat M9:

| Hal | Bukti |
|---|---|
| 248 inline style → 0 | hitung ulang independent |
| 117 elemen polos → 0 | tinggal 3 `<input aria-hidden="true">` dari `Checkbox` base-ui |
| 212 string user-visible pindah ke `komponen.tsx` | teruji; 12 tertinggal di `page.tsx` (M9-01, M9-02, + judul halaman) |
| Tidak ada endpoint/method/URL berubah | diff semua `fetch()` dan `router.replace` kosong |
| `maxLength` 16→16, `required` 19→19 | jumlah kemunculan sama |
| K-17 `maks 2`, K-48 `min 8`, K-54 `1440` | utuh |
| Tidak ada `Select` base-ui (BUG-UI-06) | `grep` kosong |
| Tidak ada hex/rgb literal | `grep` kosong |
| `src/app/a/` `src/server/` `src/app/api/` `migrations/` | `git diff` kosong |
| md5 `0001_init.sql` | `466a7b1a5aa5b1ab0a88e0a5f63a8a98` |
| 622 tes × 3 timezone | UTC, Asia/Jakarta, America/New_York |

## D. Pelajaran dari audit UI-2

**10 mutasi yang dipilih agent semuanya lulus — tapi 4 mutasi lain tidak diketahui.**

Bedanya bukan teknik, tapi **pilihan**. Mutasi agent dipusatkan pada apa yang ia
kerjakan; mutasi audit dipilih dari **spec** (`rules/05` §5.3 dan §5.4) dan dari
**yang tidak ada di tes** (`maxLength`).

Kalau audit berikutnya hanya mengulang mutasi yang sudah ada, audit itu tidak
menambah nilai. Pilih mutasi dari dokumen, bukan dari kode.

**Cara lain yang gagal di tangan audit sendiri:**

1. `cp -r backup src/` **tidak meng-undo** mutasi kalau `src/` sudah ada — hasilnya
   `src/jadwal` di dalam `src/jadwal`, jadi file asli tidak tersentuh dan mutasi
   tetap hidup. Restoration harus `rm -rf` dulu.
2. `grep -oE '<button[^>]*>' | grep -c data-slot` **tidak bisa menghitung** —
   `grep -o` hanya mengambil tag pembuka, yang memang tidak pernah mengandung
   atribut. Harus cocokkan tag lengkap.
3. Menghitung string "yang hilang" dengan `>\s*([^<>{}]+?)\s*<` ikut menangkap
   TypeScript (`(null);`, `([]);`). Filter harus menyaring artefak sebelum
   menyimpulkan ada konten yang hilang.

Tiga kesalahan itu sempat membuat audit melaporkan "84 elemen polos tersisa" dan
"mutasi gagal" yang sebenarnya salah. **Ukur ulang sebelum melapor.**