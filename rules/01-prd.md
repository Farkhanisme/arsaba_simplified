# 01 — Product Requirements Document (PRD)

> Nama aplikasi: **Arsaba Management Center** (K-38). Di dokumen ini disebut "Sistem Absensi".
> Seluruh keputusan sudah diambil pemilik; tidak ada aturan `[BELUM DIPUTUSKAN]`.

## 1. Ringkasan

Aplikasi web internal untuk mencatat absensi 26 karyawan di 10 toko. Karyawan absen lewat link pribadi dengan foto kamera langsung dan koordinat lokasi. Admin memverifikasi setiap check-in dan check-out, mengatur jadwal shift, menandai ketidakhadiran, mengoreksi data, dan mengekspor rekap ke Excel.

## 2. Tujuan

1. Menggantikan pencatatan absensi manual dengan bukti foto dan koordinat.
2. Memberi admin satu tempat untuk verifikasi, jadwal, dan rekap.
3. Menyediakan rekap yang siap dipakai untuk kebutuhan penggajian (perhitungan gaji sendiri di luar cakupan).

## 3. Pengguna

| Peran | Jumlah | Akses |
|---|---|---|
| Karyawan | 26 | Halaman absen lewat link unik, tanpa login |
| Admin | 1 akun | Login username/password; semua toko; ganti password sendiri |
| Super Admin | 1 akun | Login username/password; semua fitur Admin + master data, akun, pengaturan, audit log |

## 4. Cakupan versi 1

**Termasuk:**

1. Halaman absen karyawan (check-in/check-out, foto kamera, koordinat).
2. Verifikasi absensi (satuan dan massal), dengan alasan penolakan.
3. Jadwal shift per toko (per hari/minggu/bulan) + perubahan jadwal khusus satu hari.
4. Perhitungan selisih keterlambatan (sistem) + input keterlambatan final (admin).
5. Penandaan izin/tanpa keterangan.
6. Koreksi manual oleh admin.
7. Dashboard.
8. Manajemen data master: toko, shift, karyawan, penempatan, link karyawan, akun admin.
9. Rekap dan ekspor Excel dengan penguncian oleh status verifikasi.
10. Audit log (dicatat + dibaca Super Admin lewat UI).
11. Pengaturan sistem (ambang terlambat).
12. Ganti password akun sendiri oleh Admin dan Super Admin.
13. **Agenda** (K-57 s.d. K-65): dibuat admin atau karyawan sendiri, di-assign ke satu karyawan /
    satu toko / seluruh karyawan, dikerjakan karyawan lewat halaman yang sama dengan absen, lalu
    diverifikasi admin. Agenda masuk rekap dan memblokir ekspor selama masih `MENUNGGU`.

**Di luar cakupan:**

- Perhitungan gaji, lembur, potongan.
- Validasi radius/geofence lokasi (koordinat hanya dicatat).
- Login karyawan, notifikasi/email/WhatsApp, hari libur nasional, kuota karyawan per shift.
- Pengenalan wajah otomatis.
- Aplikasi native mobile, multi-bahasa.
- Cadangan (backup) foto di luar Telegram.
- Batas jumlah agenda yang boleh dibuat satu karyawan dalam satu periode (tidak ada — lihat catatan).
- Edit judul/keterangan agenda setelah pembuatan, dan hapus permanen agenda (K-62).
- Fitur lain yang tidak tertulis di dokumen ini.

## 5. Kebutuhan fungsional (user story + acceptance criteria)

### 5.1 Karyawan

**US-K1 Membuka halaman absen.**
- Given link aktif, when dibuka, then tampil nama karyawan, toko, tanggal/jam WIB, jadwal hari ini (atau "Tidak ada jadwal"), dan riwayat absen hari ini beserta statusnya.
- Given link tidak dikenal/dicabut, then tampil pesan generik "Link tidak berlaku" tanpa membocorkan data.

**US-K2 Check-in.**
- Given tidak ada check-in terbuka dan jumlah check-in non-DITOLAK hari ini < 2, then tombol Check-in aktif.
- When karyawan memotret dengan kamera langsung dan mengirim, then server mencatat waktu server WIB, mengunggah foto ke Telegram, lalu menyimpan record berstatus `MENUNGGU`.
- Given kamera tidak diizinkan, then absen tidak bisa dikirim dan tampil petunjuk mengaktifkan kamera.
- Given izin lokasi ditolak/gagal, then absen tetap bisa dikirim dan record ditandai lokasi tidak tersedia.
- Given upload Telegram gagal, then tidak ada record tersimpan dan karyawan diminta mengulang.
- Given jumlah check-in non-DITOLAK hari ini sudah 2, then tombol nonaktif dengan penjelasan.

**US-K3 Check-out.**
- Given ada check-in terbuka yang masih dalam batas **20 jam** sejak check-in (K-29), then tombol Check-out aktif dan record check-out terhubung ke check-in tersebut.
- Setelah 20 jam, tombol kembali menjadi "Check-in" dan check-out hanya dapat dibuat admin lewat koreksi manual.
- Tanggal check-out mengikuti tanggal check-in walau lewat tengah malam.

**US-K4 Melihat hasil verifikasi.**
- Then tiap record menampilkan badge status; jika ditolak tampil alasannya dan tombol Check-in tersedia lagi sesuai batas.
- Given tanggal ini sudah ditandai tidak berangkat, then absen **diblokir** dengan pesan yang mengarahkan menghubungi admin (K-31).

**US-K5 Mengerjakan agenda.**
- Given ada agenda yangditugaskan ke karyawan tersebut, then daftar agenda tampil di tab Agenda pada
  halaman absen yang sama.
- Given agenda wajib foto, then karyawan memotret foto before, dan "Simpan" menyimpan status
  `DRAFT`; setelah dikerjakan, karyawan mengirim foto after lalu "Simpan" lagi → `MENUNGGU`.
- Given agenda tidak wajib foto, then keterangan opsional sudah cukup untuk menyelesaikan.
- Given karyawan membuat agenda sendiri, then judul dan keterangan opsional diisi, foto before diambil,
  dan status berjalan `DRAFT` → `MENUNGGU` dengan cara yang sama.
- Then tiap laporan menampilkan status; yang ditolak menampilkan alasannya dan bisa diulang.
- Draft tidak pernah terlihat admin dan tidak memblokir apa pun.

### 5.2 Admin

**US-A9 Agenda.**
- Buat agenda: judul, keterangan opsional, pilihan wajib foto before–after, tanggal target opsional.
- Assign ke satu karyawan / satu toko / seluruh karyawan. Penerima dihitung dari penempatan saat ini.
- Daftar tujuan bisa diubah dan agenda bisa dibatalkan (wajib alasan) selagi masih `AKTIF`.
- Judul/keterangan tidak bisa diedit setelah pembuatan; tidak ada hapus permanen (K-62).
- Verifikasi laporan agenda: setujui / tolak (tolak wajib alasan). Menolak tidak membakar percobaan —
  karyawan boleh mengulang. Halaman verifikasi agenda terpisah dari verifikasi absensi.
- Laporan agenda `MENUNGGU` memblokir ekspor pada periode yang sama (K-63).

**US-A1 Login.** Given username/password benar, then masuk dashboard. Akun nonaktif atau salah gagal dengan pesan generik.

**US-A2 Verifikasi.**
- Daftar default menampilkan `MENUNGGU`, dengan filter toko, tanggal, karyawan, jenis, status, dan filter "Check-in belum check-out".
- Tiap baris menampilkan waktu WIB, karyawan, toko, jenis, foto (bisa diperbesar), koordinat + tautan peta atau "Lokasi tidak tersedia", selisih vs jadwal, status.
- Setujui satuan/massal. Tolak satuan/massal **wajib alasan**.
- Pada check-in, admin **wajib** mengisi **menit terlambat final** bila check-in ditandai terlambat oleh sistem; `0` tetap harus diisi eksplisit (K-30).

**US-A3 Jadwal.**
- Pilih toko dan tampilan hari/minggu/bulan; isi jadwal massal (rentang tanggal × karyawan × shift).
- Hanya karyawan yang ditempatkan di toko itu pada tanggal tersebut yang muncul.
- Satu karyawan satu jadwal per tanggal.
- Peringatan (bukan larangan) untuk slot yang saling tumpang tindih.
- Perubahan jadwal khusus satu hari (lihat 02, §5).

**US-A4 Tandai tidak berangkat.** Pilih karyawan (satu/banyak), tanggal (satu/rentang), jenis `IZIN`/`TANPA_KETERANGAN`, catatan. Diblokir jika ada absen aktif pada tanggal itu. Boleh diubah/dihapus kembali.

**US-A5 Koreksi manual.**
- Tambah check-out untuk check-in tanpa pasangan (kasus lupa check-out).
- Tambah/ubah check-in/check-out lain dengan waktu manual.
- Alasan wajib; record ditandai "dikoreksi admin", tanpa foto/lokasi.
- Tidak ada hapus permanen; untuk membatalkan gunakan status `DITOLAK` dengan alasan.

**US-A6 Dashboard.** Per toko, hari ini: jumlah hadir (sudah check-in), terlambat, belum absen; total antrean verifikasi.

**US-A7 Rekap & ekspor.**
- Pilih rentang tanggal dan toko (semua/satu), lalu sistem memeriksa syarat K-13.
- Jika ada `MENUNGGU` atau check-in tanpa check-out: ekspor diblokir dan ditampilkan daftar/tautan ke halaman verifikasi.
- Jika lolos: pratinjau dan unduh `.xlsx` (2 sheet: Ringkasan, Detail Harian). Ekspor dicatat.
- Karyawan terjadwal tanpa absen dan tanpa penandaan hanya muncul sebagai **peringatan**, tidak memblokir ekspor (K-33).

**US-A8 Ganti password.**
- Given pengguna sudah login, when membuka `/admin/ubah-password`, then tampil form password saat ini, password baru, dan konfirmasi.
- Password saat ini salah atau password baru kurang dari 8 karakter atau konfirmasi tidak cocok, then ditolak dengan pesan yang jelas.
- When berhasil, then seluruh sesi akun dibatalkan (termasuk sesi berjalan) dan pengguna dikembalikan ke `/login`. Perubahan tercatat di audit log tanpa memuat password.

### 5.3 Super Admin

**US-S1** Semua kemampuan Admin.
**US-S2** Kelola akun admin (buat, nonaktifkan, reset password).
**US-S3** Kelola data master: toko, shift template, karyawan (termasuk NIK, jabatan, alamat, nomor HP, kontak darurat), penempatan/pemindahan, cabut dan buat ulang link.
**US-S4** Ubah pengaturan sistem: ambang terlambat (default 5 menit).
**US-S5** Baca audit log (filter waktu, pengguna, aksi, entitas), hanya-baca.
**US-S6** Perubahan data pada periode yang sudah diekspor hanya dapat dilakukan **Super Admin** dan tercatat di audit log (K-32).

## 6. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Skala | 26 karyawan, 10 toko, 2 akun admin. Tidak perlu optimasi skala besar. |
| Perangkat | Karyawan: browser HP modern dengan kamera. Admin: desktop-first, tetap usable di tablet/HP. |
| Bahasa | Bahasa Indonesia saja. |
| Waktu | Semua waktu WIB dari server. |
| Keamanan | HTTPS wajib; token link tidak dapat ditebak; secret hanya di server; peran divalidasi di server. |
| Integritas | Aturan kuota/pasangan ditegakkan di server dan database, bukan hanya di UI. |
| Ketersediaan | Bergantung pada Vercel, Turso, dan Telegram; tidak ada mekanisme fallback pada versi 1. |
| Retensi | Data absensi dan foto disimpan permanen (K-05). |

## 7. Asumsi dan risiko

Lihat `00-decision-log.md` bagian C dan D.
