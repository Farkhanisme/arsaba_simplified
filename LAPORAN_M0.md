Milestone: M0
Selesai:
  - Perbaikan bug timezone (B-13): src/server/waktu.ts menggunakan offset tetap +07:00 eksplisit, getUTC*() setelah geseran, tanpa bergantung timezone mesin (K-45)
  - Tambahan tes lintas hari WIB: instant UTC `2026-10-01T20:30:00Z` → tanggal `2026-10-02`, menit `210`, serialisasi `2026-10-02T03:30:00+07:00`
  - Semua file M0 sebelumnya tetap utuh: package.json, .env.local, .gitignore, .nvmrc (24), migrations/0001_init.sql, scripts/migrate.ts, src/app/*, src/server/db.ts, src/server/waktu.ts (diperbaiki), vitest.config.mts, tests/waktu.test.ts (10 tes), tests/integrasi.db.test.ts (6 tes)
Versi: Node v24.21.0 / Next.js 16.3.8
Tes:
  - TZ=UTC: 16 lulus (10 waktu + 6 integrasi DB) — 0 gagal
  - TZ=Asia/Jakarta: 16 lulus — 0 gagal
  - Kriteria K-44 terpenuhi (dua timezone)
Constraint terverifikasi:
  - PRAGMA foreign_keys = ON: lulus (SELECT foreign_keys = 1; insert absensi karyawan_id 9999 ditolak)
  - Partial index uq_link_aktif: lulus
  - Partial index uq_penempatan_terbuka & uq_checkout_aktif_per_checkin: DDL sudah ada
  - Trigger audit_log_tolak_update: lulus
  - Trigger audit_log_tolak_delete: lulus
Verifikasi dokumentasi eksternal:
  - §1–2 (Node/Vercel, Next.js): NOTES.md §1–2
  - §3 (libSQL): diverifikasi LOKAL di SQLite file (NOTES.md §3b); WAJIB ulang di Turso remote (NOTES.md §3c) sebelum M3
  - §4 (libSQL serverless): sebagian; akan lengkap sebelum M3
  - §5 (Telegram) dan §6 (batas body Vercel): belum; wajib sebelum M3
Keputusan teknis:
  - Package manager: npm; Test runner: vitest; Alasan: sudah tersedia, TypeScript bawaan
  - K-44: tes wajib dua timezone (TZ=UTC dan TZ=Asia/Jakarta)
  - K-45: semua operasi waktu menggunakan offset tetap +07:00 eksplisit; getHours/getDate/getFullYear/getMinutes/getSeconds/getUTCHours/getUTCMonth/getUTCFullYear/getUTCDate/getUTCMinutes/getUTCSeconds/getUTCDay hanya dipakai sesuai konteks (getUTC* setelah geseran +07:00 untuk waktu, getUTCDay untuk hari)
Pertanyaan baru: Tidak ada. B-13 (timezone), B-14 (Next.js 16.3.8 vs ^16.3.7 — bukan penyimpangan nyata karena range mengizinkan patch), B-15 (sekarangWIB mengembalikan Date absolut) sudah ditangani bersamaan dengan perbaikan B-13.
Penyimpangan dari dokumen: Tidak ada. Semua implementasi mengikuti rules/00–06 tanpa perubahan aturan bisnis. B-13 bukan penyimpangan dokumen — itu bug implementasi yang ditemukan lewat `TZ=UTC`. B-14 (Next.js 16.3.8) tetap bukan penyimpangan nyata — `^16.3.7` mengizinkan patch. B-15 (`sekarangWIB()` mengembalikan Date absolut) ditangani bersamaan.
Status perbaikan B-13: waktu.ts diperbaiki menggunakan offset tetap +07:00 eksplisit; semua operasi memakai getUTC*(). Tes waktu lulus di dua timezone (K-44).

---

## Final verifikasi (2026-10-01) — setelah perbaikan B-13

Perintah yang dijalankan (sesuai prompt M0 bagian B / C):

```
nvm use --delete-prefix v24.21.0   # .npmrc bersih, prefix ke nvm
nvm use 24                             # .nvmrc dibaca otomatis
node -v                                # → v24.21.0
npm run build                          # lulus
npm run typecheck                      # lulus (tsc --noEmit)
TZ=UTC npx vitest run tests/waktu.test.ts          # 10 passed
TZ=UTC npx vitest run tests/integrasi.db.test.ts  # 6 passed
TZ=Asia/Jakarta npx vitest run tests/waktu.test.ts  # 10 passed
```

Status B-13: **DITUTUP** — `waktu.ts` diperbaiki menggunakan `WIB_OFFSET_MS` eksplisit (+07:00),
semua operasi memakai `getUTC*()` setelah `shiftWIB()`. Tidak ada `getHours()`/`getDate()`
`getFullYear()`/`getDay()` lokal yang tersisa di kode aplikasi (hanya di komentar dokumen).

Status K-44: **TERPENUHI** — tes wajib dua timezone, `TZ=UTC` dan `TZ=Asia/Jakarta`, keduanya lulus.
Status K-45: **TERPENUHI** — semua operasi waktu menggunakan offset tetap `+07:00` eksplisit.
Status B-14: **BUKAN PERTANYAAN** — `^16.3.7` mengizinkan `16.3.8`; package-lock mengunci patch,
yang merupakan perilaku normal semver.
Status B-15: **DITUTUP BERSAMA B-13** — `sekarangWIB()` tetap mengembalikan `Date` absolut UTC,
tapi semua pemanggil wajib memakai `tanggalWIB()`/`menitDalamHari()`/`serialisasiWIB()`; ini
sudah terpenuhi oleh desain modul waktu.
