# 06 — Instruksi untuk AI Agent

Anda membangun "Sistem Absensi" (nama aplikasi: **Arsaba Management Center**) berdasarkan dokumen `00`–`05`. Pemilik produk tidak ingin ada asumsi atau halusinasi. **Semua keputusan produk sudah ada di tangan pemilik.**

## 1. Aturan utama

1. **Baca semua dokumen `00`–`05` sebelum menulis kode.** `00-decision-log.md` adalah sumber kebenaran; jika konflik, prioritas `00` > `01` > `02` > `03` > `04` > `05`.
2. **Seluruh keputusan sudah diambil pemilik** (K-27 s.d. K-40). Tidak ada lagi tag `[USULAN]` atau `[BELUM DIPUTUSKAN]` di dokumen `00`–`05`, sehingga **tidak ada lagi aturan yang terlarang diimplementasikan.** Bila menemukan ambiguitas baru, perlakukan seperti butir 3.
3. Jika menemukan ambiguitas, kekosongan, atau kontradiksi: **berhenti pada bagian itu**, tulis pertanyaan di `OPEN_QUESTIONS.md` (ID `B-13` seterusnya, konteks, opsi, rekomendasi Anda), lalu lanjutkan ke pekerjaan lain yang tidak terblokir. Jangan mengarang jawaban.
4. **Jangan menambah fitur, kolom, halaman, atau aturan** yang tidak tertulis. Jika terasa perlu, masukkan ke `OPEN_QUESTIONS.md`.
5. Jangan mengubah keputusan pemilik walau ada cara "lebih baik". Sampaikan sebagai saran di `OPEN_QUESTIONS.md`.
6. **Jangan mengarang detail API eksternal** (Telegram, Vercel, Turso/libSQL). Verifikasi ke dokumentasi resmi (daftar di `03` §15) dan catat sumbernya di `NOTES.md`.
7. Bahasa antarmuka: Bahasa Indonesia. Kode, komentar, dan nama tabel mengikuti konvensi `04`.
8. Kerjakan **satu milestone per giliran**; setelah selesai tulis laporan (§6) lalu berhenti dan tunggu persetujuan pemilik.

## 2. Larangan keras

- Tidak memakai ORM (Prisma, Drizzle, dll). SQL mentah berparameter saja.
- Tidak menyediakan jalur unggah foto dari galeri/file untuk absen.
- Tidak memakai jam perangkat klien untuk waktu absen.
- Tidak membuat login untuk karyawan.
- Tidak menghapus permanen `absensi`; tidak ada UPDATE/DELETE pada `audit_log`.
- Tidak menampilkan token bot Telegram atau URL unduhan Telegram ke klien; tidak mencatat token link, password, atau secret ke log.
- Tidak mengandalkan pemeriksaan peran/aturan di UI saja; wajib di server.
- Tidak menyimpan data lokasi selain lat/lng.
- Tidak membuat perhitungan gaji, geofence, notifikasi, atau hari libur.
- Tidak menyambung string SQL dengan input pengguna.

## 3. Urutan pembangunan dan definisi selesai

Kerjakan berurutan. Setiap milestone selesai jika kriterianya terpenuhi **dan** tes lulus.
**Tidak ada milestone yang lagi terblokir**; kolom "Terblokir oleh" berisi keputusan yang sudah dipakai.

| M | Isi | Selesai jika | Keputusan yang dipakai | Status |
|---|---|---|---|---||
| M0 | Proyek Next.js + TS, koneksi Turso, runner migrasi, `0001_init.sql`, modul `waktu.ts` + tesnya | Migrasi berjalan; tes waktu (WIB, weekend, batas menit) lulus; constraint diverifikasi (FK, partial index, trigger) | K-38 | **SELESAI** (2026-10-01) |
| M1 | Login admin, sesi DB (12 jam), peran, pembatasan login, util audit log | Dua peran teruji; endpoint menolak peran salah; login tercatat audit | K-39 | **SELESAI** 2026-10-02 |
| M2 | Data master: toko, shift template, karyawan (NIK/jabatan/alamat/HP/kontak darurat), penempatan/pemindahan, link (buat/cabut/buat ulang), akun admin, pengaturan | Semua CRUD sesuai `05` §5.7–5.9 dengan audit; validasi BR-J1/BR-T3/BR-P* | K-34, K-35, K-50 | **SELESAI** 2026-10-03 |
| M3 | Halaman `/a/[token]`, `POST /api/absen`, kamera, lokasi, Telegram, kuota, pasangan, idempotensi | Alur `01` US-K1..K4 lulus; Telegram gagal = tanpa record; tes kuota/pasangan/tengah malam/batas 20 jam lulus | K-28, K-29, K-31, K-52, K-53 | **SELESAI** 2026-10-03 |
| M4 | Verifikasi (satuan, massal, alasan tolak), foto proxy, selisih keterlambatan, keterlambatan final, koreksi manual | US-A2, US-A5 lulus; tes keterlambatan sesuai `02` §6 lulus | K-28, K-30, K-32, K-36 | — |
| M5 | Jadwal: grid hari/minggu/bulan, isi massal, perubahan khusus satu hari, peringatan | US-A3 lulus; snapshot slot; unik per karyawan-tanggal | K-27, K-37, K-55 | **SELESAI** 2026-10-03 |
| M6 | Tandai tidak berangkat | US-A4 lulus; blokir saat ada event aktif; absen diblokir saat tanggal bertanda | K-19, K-31, K-32, K-56 | **SELESAI** 2026-10-03 |
| M7 | Dashboard | Metrik `02` §12 sesuai data uji | K-22, K-28, K-30, K-36 | **SELESAI** 2026-10-03 |
| M8 | Rekap, pemeriksaan pra-syarat, ekspor Excel, `log_ekspor`, penguncian periode | US-A7 lulus; ekspor diblokir di server bila ada `MENUNGGU`/check-in terbuka | K-32, K-33 **SELESAI** 2026-10-03 |
| UI-1 | Pondasi desain + dashboard (Tailwind v4 + shadcn) | Mode gelap, grafik Recharts v3 | — | prompt siap |
| M9 | Audit log UI, hardening, aksesibilitas, QA menyeluruh | Semua acceptance criteria di `01` terpenuhi; daftar tes `03` §13 lulus | — | — |

Jika sebuah milestone terblokir sebagian, kerjakan bagian yang tidak terblokir dan catat sisanya di `OPEN_QUESTIONS.md`.

## 4. Standar kode

1. TypeScript strict; validasi semua input dengan `zod` di batas server.
2. Logika bisnis sebagai fungsi murni di `server/aturan/`, diuji tanpa database. Query di `server/repo/`. Route handler tipis.
3. Satu-satunya tempat manipulasi waktu: `server/waktu.ts`.
4. Operasi multi-langkah di dalam transaksi (`03` §10).
5. Respons error seragam `{ kode, pesan }` (pesan Bahasa Indonesia).
6. Setiap aksi admin yang mengubah data memanggil util audit di transaksi yang sama.
7. Tidak ada `console.log` yang memuat data sensitif.

## 5. Pengujian minimum

Ikuti `03` §13. Tambahkan tes integrasi pada database uji (SQLite/libSQL lokal) untuk: kuota check-in, penolakan tidak menghabiskan jatah, check-out lintas tengah malam, check-out dalam/selepas batas 20 jam, blokir absen pada tanggal bertanda, hari hadir, pra-syarat ekspor, blokir penandaan, izin per peran.

## 6. Format laporan setiap selesai satu milestone

```
Milestone: M?
Selesai: <daftar>
Tes: <lulus/gagal, jumlah>
Verifikasi dokumentasi eksternal: <apa, sumber> (di NOTES.md)
Pertanyaan baru: <ID di OPEN_QUESTIONS.md>
Penyimpangan dari dokumen: <harus "tidak ada"; jika ada, jelaskan dan minta persetujuan>
```

## 7. Jika tidak yakin

Bertanya lebih murah daripada membangun ulang. Untuk hal apa pun yang memengaruhi aturan bisnis, struktur data, atau perilaku yang terlihat pengguna dan tidak ada di dokumen: **berhenti dan tanyakan.**
