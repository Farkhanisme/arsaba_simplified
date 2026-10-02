# LAPORAN M2 — Data Master

Status: **SELESAI** — 2026-10-03 · terverifikasi audit, bukan hanya laporan agen.

---

## Ringkasan

Data master penuh: 7 entitas, 17 route API ber-`guard`, layout admin + sidebar, 5 halaman,
9 file tes baru.

| | |
|---|---|
| Migrasi | **tidak ada** — `migrations/0001_init.sql` tidak berubah (md5 `466a7b1a…`) |
| Route API | 17, semuanya lewat `guard()` |
| Halaman | toko · shift · karyawan · akun · pengaturan · layout + sidebar |
| Tes | **127 lulus** di `TZ=UTC` **dan** `TZ=Asia/Jakarta` (18 file) |
| Build | hijau · Typecheck | hijau |

Entitas: toko · shift template · karyawan · penempatan · link karyawan · akun admin · pengaturan.

---

## Verifikasi independen (bukan sekadar membaca laporan)

| Klaim | Cara diuji | Hasil |
|---|---|---|
| K-35 memblokir pemindahan | **Mematikan aturannya** (`const jadwal = 0`) lalu jalankan tes | ✅ **2 tes gagal** — tes terbukti menangkap bug |
| Buat-ulang link satu transaksi | Baca kode | ✅ `denganTransaksi` membungkus cabut + buat + audit |
| Token tak bocor ke audit | Baca `sebelum`/`sesudah` | ✅ hanya id + waktu, bukan token |
| Password tak bocor ke audit | Grep seluruh route akun | ✅ nihil |
| `TELEGRAM_BOT_TOKEN` tak terekspos | Grep `TELEGRAM` di `src/` | ✅ nol referensi |
| Semua route pakai guard | Enumerasi 17 route | ✅ 17/17 |
| Permission Super Admin benar | Hitung per fitur | ✅ 7 master_akun, 4 master_toko, 4 master_shift, 4 master_karyawan, 4 link_karyawan, 2 pengaturan, 2 master_penempatan |
| Tes 403 memanggil route | Baca tesnya | ✅ `expect(res.status).toBe(403)` per route |
| Menu Super Admin tak dirender untuk ADMIN | Baca `menu.ts` | ✅ di balik `if (peran === 'SUPER_ADMIN')` |

**Mematikan K-35 adalah uji paling penting.** Kalau tes hanya memeriksa bentuk response,
mematikan aturan tidak akan berpengaruh — dan M1 pernah gagal tepat karena itu.

---

## Dua tes warisan M1 yang diperbaiki

Ditemukan saat audit — keduanya bukan kesalahan M2, tapi tidak bisa dibiarkan:

| File | Masalah | Perbaikan |
|---|---|---|
| `tests/ganti-password.test.ts` | `expect(true).toBe(true)` dengan komentar *"Verifikasi file ada"*; tes "minimal 8 karakter" hanya mengecek `string.length`, bukan aturannya | Ditulis ulang: 5 tes yang memanggil route sungguhan — K-48 ditegakkan, password lama salah ditolak, seluruh sesi dibatalkan (K-47), audit bebas password/hash |
| `tests/auth.test.ts` | Tes Origin masih membaca source (`readFileSync`) | **Dipertahankan** — masih bernilai sebagai pagar anti-duplikasi, meski bukan tes perilaku |

Tes baru juga dibuktikan menangkap bug: mematikan `passwordBaru.length < 8` membuat 2 tes gagal.

---

## Keputusan pemilik yang masuk

**K-50** — Password akun admin **diinput Super Admin**, bukan dihasilkan sistem. Minimal 8
karakter (K-48), ditampilkan sekali di layar, tidak bisa dibaca lagi.

Alasan pemilik: setiap akun admin bisa mengganti password-nya sendiri lewat
`/admin/ubah-password` (§5.11, tersedia untuk **kedua peran**), jadi password awal yang lemah
hanya bersifat sementara dan bisa diputar kapan saja.

> Password ini untuk **akun admin**, bukan karyawan. Hanya tabel `pengguna_admin` punya kolom
> `password_hash`; karyawan masuk lewat token link (`karyawan_link.token`) tanpa password —
> sesuai K-01.

Ketergantungan yang perlu diingat: keputusan ini aman **karena** §5.11 ada. Kalau suatu saat
halaman ganti-password dihapus, K-50 ikut kehilangan dasarnya.

---

## Catatan untuk M3

- Semua entitas M2 siap dipakai: karyawan, toko, shift, link, penempatan.
- `karyawan_link` sudah bisa membuat/cabut/buat-ulang token — M3 tinggal memakainya untuk
  halaman `/a/[token]`.
- **Belum diverifikasi** (`rules/NOTES.md` §5 dan §6, wajib sebelum M3):
  batas & metode Telegram Bot API (`sendPhoto`, `getFile`, ukuran file) · batas ukuran body
  request Vercel Functions. Keduanya menyentuh `rules/03` §15 dan wajib diisi agent M3 dengan
  URL sumber.
- `batch()` **tidak** me-rollback. Untuk M3 yang wajib memakai `denganTransaksi()`.
