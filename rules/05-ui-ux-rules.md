# 05 — Aturan UI/UX

Semua teks antarmuka **Bahasa Indonesia**. Seluruh konvensi di bawah ini disetujui pemilik (K-40).
Perilaku bisnis mengikuti `02`.

## 1. Prinsip

1. Halaman karyawan: satu tugas, satu tombol utama, sesedikit mungkin teks. Dipakai di HP, sering dengan satu tangan.
2. Halaman admin: efisiensi kerja berulang (verifikasi banyak, jadwal grid). Desktop-first, tetap terpakai di tablet.
3. Jangan pernah mengandalkan warna saja; status selalu punya label teks.
4. Setiap layar punya keadaan: memuat, kosong, error, sukses.
5. Aksi merusak/tidak dapat dibatalkan minta konfirmasi; aksi yang membutuhkan alasan tidak bisa dikirim tanpa alasan.

## 2. Format dan konvensi global

| Hal | Aturan |
|---|---|
| Tanggal | `dd/MM/yyyy` (tabel), `Rabu, 30 Sep 2026` (judul/tulisan panjang) |
| Waktu | `HH:mm` 24 jam, diberi label "WIB" pada konteks pertama di layar |
| Selisih menit | `+7 mnt` (terlambat), `−3 mnt` (lebih awal), `—` (tanpa jadwal) |
| Pekan | Senin sebagai kolom pertama |
| Weekend | Kolom Sabtu/Minggu diberi penanda visual + label "Weekend" |
| Angka besar/tombol | Target sentuh minimum 44×44 px |
| Font | Sistem/sans-serif; ukuran dasar ≥ 16 px di halaman karyawan |
| Aksesibilitas | Kontras teks memadai, fokus terlihat, label pada semua input, ikon disertai teks atau `aria-label` |

**Badge status (teks + warna):**

| Status | Label | Warna |
|---|---|---|
| `MENUNGGU` | Menunggu | Kuning/amber |
| `DISETUJUI` | Disetujui | Hijau |
| `DITOLAK` | Ditolak | Merah |
| Terlambat (sistem) | Terlambat | Oranye |
| Dikoreksi admin | Dikoreksi | Abu/biru + ikon pensil |
| `IZIN` | Izin | Biru |
| `TANPA_KETERANGAN` | Tanpa Keterangan | Merah tua |

## 3. Halaman Karyawan `/a/[token]`

Satu kolom, lebar maksimum ± 480 px, di tengah.

**Susunan dari atas:**

1. Header: nama karyawan, nama toko, tanggal dan jam berjalan (WIB).
2. Kartu **Jadwal hari ini**: daftar slot (mis. "Shift 1 · 07:00–12:00", "Shift 2 · 18:00–23:00") atau "Tidak ada jadwal (absen tetap bisa dilakukan)". Tandai "Jadwal khusus" bila `is_override`.
3. **Tombol utama** lebar penuh: "Check-in" atau "Check-out" sesuai keadaan (BR-A5/A6). Bila tidak ada aksi yang diizinkan: tombol nonaktif + alasan singkat.
4. Daftar **Absen hari ini**: jenis, jam, badge status, alasan penolakan bila ditolak.

**Alur absen (K-52):**

1. Karyawan membuka link → halaman absen dengan **pratinjau kamera langsung**.
2. Dua tombol: **"Foto"** dan **"Ganti Kamera"** (bolak-balik kamera depan ↔ kamera belakang).
   `facingMode` dimulai dari kamera depan. Tidak ada tombol unggah dari galeri — K-02.
3. Karyawan menekan **"Foto"** → foto diambil. Tombol **"Foto" berubah menjadi "Foto Ulang"**,
   dan **tombol "Absen"** muncul.
4. Karyawan boleh menekan **"Foto Ulang"** berkali-kali, atau **"Ganti Kamera"**, selama belum
   menekan **"Absen"**. Setiap kali "Foto Ulang" ditekan, tombol "Absen" **tetap Nonaktif**
   sampai ada foto terbaru — supaya tidak terkirim foto lama.
5. Tekan **"Absen"** → foto dikirim ke server, lalu ke Telegram.
6. Saat mengirim: tombol nonaktif + indikator; teks "Mengirim…".
7. Sukses: "Absen berhasil dicatat pukul HH:mm WIB. Menunggu verifikasi admin." + tombol
   "Selesai" kembali ke halaman utama. Teks menyebut **jenis** absen, bukan selalu "Check-in":
   untuk check-out berbunyi "Absen checkout berhasil dicatat pukul …".

**Karyawan tidak pernah mengirim foto mentah.** Kompresi ke JPEG dilakukan **otomatis** di
dalam browser sebelum dikirim (§3a). Karyawan tidak melihat, tidak memilih, dan tidak perlu
memahami ukuran, kualitas, maupun resolusi. Tidak ada langkah tambahan untuk karyawan.


### 3a. Kompresi foto otomatis (K-53)

Batas keras Vercel untuk request body adalah **4,5 MB** (`rules/NOTES.md` §6). Foto dari
kamera HP dengan kualitas JPEG penuh bisa 3–8 MB, sehingga tanpa kompresi sebagian karyawan
akan gagal absen dengan HTTP 413 — dan error itu datang dari Vercel **sebelum** mencapai
kode aplikasi, sehingga tidak bisa ditangkap atau diberi pesan ramah.

Karena itu aplikasi **wajib** mengompres foto otomatis di sisi klien sebelum mengirim:

- Format keluaran: **JPEG** (bukan PNG).
- Sisi terpanjang dipotong ke **1600 px** dengan rasio aspek dipertahankan.
- Kualitas JPEG awal **0,75**, diturunkan bertahap bila ukuran masih melebihi batas.
- Hasil akhir **wajib di bawah 4,5 MB**; bila masih besar, kualitas diturunkan lagi.
- Karyawan tidak pernah melihat proses ini.

Kalau setelah kualitas diturunkan ke titik terendah ukurannya masih melebihi 4,5 MB,
tampilkan pesan: **"Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik."**
Jangan diam-diam mengirim request yang pasti ditolak Vercel dengan 413.

> Angka 1600 px / 0,75 adalah keputusan pemilik. Boleh diubah pemilik; yang **wajib** adalah hasil
> akhir di bawah 4,5 MB dan tidak ada langkah manual untuk karyawan.

**Teks pesan:**

| Kondisi | Pesan |
|---|---|
| Link tidak valid/dicabut | "Link tidak berlaku. Hubungi admin." |
| Kamera ditolak | "Izin kamera diperlukan untuk absen. Aktifkan izin kamera di pengaturan browser, lalu coba lagi." |
| Kamera tidak ada | "Kamera tidak ditemukan di perangkat ini." |
| Lokasi ditolak/gagal | "Lokasi tidak aktif. Absen tetap bisa dikirim tanpa lokasi." (peringatan kuning, tidak memblokir) |
| Kuota tercapai | "Batas absen hari ini sudah tercapai." |
| Upload gagal | "Absen gagal dikirim dan tidak tersimpan. Silakan coba lagi." |
| Foto masih melebihi batas setelah dikompresi | "Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik." |
| Tanpa koneksi | "Tidak ada koneksi internet. Sambungkan lalu coba lagi." |
| Keadaan berubah | "Data absen berubah. Halaman dimuat ulang." |
| Ditolak (di daftar) | "Ditolak: {alasan}" |

Perilaku batas 20 jam (K-29) dan blokir tanggal bertanda tidak berangkat (K-31) mengikuti `02`
BR-A9/BR-A10; pesan terkait tercantum di §7.

## 4. Layout Admin

- Sidebar kiri (tablet ke bawah: menu bisa dilipat), header dengan nama akun, peran, tombol Keluar.
- **Menu Admin:** Dashboard · Verifikasi Absensi · Jadwal · Tandai Tidak Berangkat · Rekap & Ekspor.
- **Menu tambahan hanya Super Admin:** Data Master (Toko, Shift, Karyawan) · Akun Admin · Pengaturan · Audit Log.
- **Menu untuk kedua peran:** Ubah Password (`/admin/ubah-password`) · Ubah Password diletakkan di bawah area akun di sidebar, bukan di antara menu kerja.
- Menu yang tidak diizinkan **tidak ditampilkan**, dan URL-nya tetap ditolak server.
- Tabel besar: header lengket, dapat digulir horizontal pada layar sempit.
- Filter tersimpan di URL agar bisa di-refresh/dibagikan.

## 5. Halaman Admin

### 5.1 Login `/login`
Username, password, tombol Masuk. Pesan gagal generik: "Username atau password salah." Tidak ada "lupa password" (reset oleh Super Admin).

### 5.2 Dashboard
- Tanggal tetap "Hari ini" (tanpa pemilih tanggal di versi 1).
- Satu kartu per toko (10 kartu): Terjadwal · Sudah absen · Terlambat · Belum absen. Definisi mengikuti `02` §12.
- Kartu tersendiri **Antrean verifikasi**: jumlah `MENUNGGU`, tautan ke Verifikasi.
- Kartu berwarna netral; angka "Belum absen" dan "Terlambat" diberi penekanan.

### 5.3 Verifikasi Absensi
- Filter: toko, rentang tanggal, karyawan, jenis, status (default `Menunggu`), dan chip **"Check-in belum check-out"**.
- Baris (urut waktu): kotak centang · waktu (tanggal + jam) · karyawan · toko · jenis · **foto mini** (klik untuk lightbox) · lokasi (koordinat + tautan "Buka peta"; atau "Lokasi tidak tersedia") · **selisih vs jadwal** + badge Terlambat · status · aksi.
- Tautan peta dibentuk dari koordinat.
- Lightbox foto: foto besar + detail event + tombol Setujui/Tolak/Berikutnya.
- Untuk check-in: kolom **Menit terlambat (final)**, input angka **0 s.d. 1440** (K-54). **Wajib diisi** bila check-in ditandai terlambat oleh sistem; `0` tetap harus diketik eksplisit (K-30). Nilai di luar rentang ditolak — jangan hanya disables Tombol di UI, server juga harus memeriksanya.
- **Aksi massal:** pilih baris → bar aksi "Setujui terpilih" / "Tolak terpilih". Tolak membuka dialog dengan kolom alasan wajib; satu alasan berlaku untuk semua terpilih.
- Tolak satuan: dialog alasan wajib.
- Baris ditandai badge: Dikoreksi (`KOREKSI_ADMIN`), dan indikator "Pasangan": check-in dengan check-out terkait ditampilkan dikelompokkan (karyawan + tanggal).
- Aksi **Koreksi** per baris/kelompok membuka form: jenis, waktu (tanggal + jam), alasan wajib. Untuk check-in terbuka tersedia tombol cepat "Tambah check-out".
- Keputusan yang sudah dibuat dapat diubah selama periode belum diekspor; pada periode terekspor hanya Super Admin (K-32/K-36).
- Loading: skeleton baris. Kosong: "Tidak ada absensi yang menunggu verifikasi." Error: pesan + tombol "Coba lagi".

### 5.4 Jadwal
- Pilih **toko**, mode **Hari / Minggu / Bulan**, dan tanggal acuan.
- Grid: baris = karyawan yang ditempatkan di toko itu pada rentang tampil; kolom = tanggal (Sabtu/Minggu bertanda Weekend). Sel = nama shift + jam, atau kosong.
- Klik sel → panel: pilih shift (daftar hanya template yang sesuai tipe hari tanggal itu) atau **"Ubah khusus hari ini"**.
- **Editor perubahan khusus:** daftar slot (nama, jam mulai, jam selesai), tambah/hapus slot dengan **batas maksimal 2 slot** (K-27), peringatan tumpang tindih real-time (kuning, tidak memblokir), catatan opsional (K-37), tombol Simpan. Sel yang berisi perubahan khusus diberi badge "Khusus" dan ikon.
- **Isi massal:** pilih karyawan (multi) + rentang tanggal + shift → pratinjau ringkasan (berapa sel baru, dilewati, ditimpa) → Terapkan. Hasil menampilkan daftar sel yang dilewati.
- Peringatan tampil di panel "Peringatan" dan pada sel terkait; simpan tetap diizinkan.
- Kosong: "Belum ada karyawan di toko ini." Bila belum ada shift template: arahkan Super Admin ke Data Master › Shift.

### 5.5 Tandai Tidak Berangkat
- Formulir: karyawan (multi-pilih), tanggal (satu atau rentang), jenis (Izin / Tanpa Keterangan), catatan.
- Bila ada event aktif pada tanggal terkait: pesan blokir "Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu." dengan tautan ke Verifikasi.
- Daftar di bawah form: filter toko/tanggal; aksi Ubah dan Hapus (dengan konfirmasi).

### 5.6 Rekap & Ekspor
1. Filter: rentang tanggal + toko (Semua / satu toko). Tombol "Periksa & Buat Rekap".
2. Panel **Pemeriksaan**:
   - Lolos → hijau: "Semua absensi pada periode ini sudah diverifikasi."
   - Gagal → merah: tampil jumlah `MENUNGGU` dan jumlah check-in belum check-out, dengan tautan ke Verifikasi (filter terisi). Tombol ekspor **nonaktif**.
   - Peringatan (tidak memblokir ekspor): jumlah karyawan terjadwal tanpa absen dan tanpa penandaan (K-33).
3. Pratinjau tabel ringkasan (nama, toko, hari hadir, izin, tanpa keterangan, total menit terlambat final).
4. Tombol **"Unduh Excel (.xlsx)"** (2 sheet: Ringkasan, Detail Harian).

### 5.7 Data Master (Super Admin)
- **Toko:** daftar, tambah/ubah nama, nonaktifkan. Tidak ada field lain.
- **Shift:** dipilih per toko; tabel template (nama, tipe hari, jam mulai/selesai). Validasi sesuai BR-J1/BR-T3. Bantuan teks: "Pilih 'Semua hari' bila jam sama setiap hari; buat dua baris bernama sama (Weekday & Weekend) bila berbeda."
- **Karyawan:** daftar dengan kolom nama, NIK, jabatan, nomor HP, kontak darurat, toko saat ini; tambah/ubah keenam field, nonaktifkan; tombol **Pindahkan** (toko tujuan + tanggal efektif; **diblokir** selama masih ada jadwal di toko lama pada/setelah tanggal efektif — K-35); kolom **Link** dengan tombol Salin, Cabut, Buat Ulang (konfirmasi; link lama langsung tidak berlaku).
- Link ditampilkan lengkap (URL) hanya di halaman ini.

### 5.8 Akun Admin (Super Admin)

Daftar akun admin (Super Admin dan Admin), tambah, nonaktifkan, reset password.

**Password ditetapkan oleh Super Admin, bukan oleh sistem (K-50).** Formulir tambah akun
meminta Super Admin mengisi password secara langsung, minimal **8 karakter** (K-48). Tidak ada
tombol "generate" — nilai yang diketik Super Admin itulah yang dipakai.

Alasan pemilik: setiap akun admin bisa mengganti password-nya sendiri lewat
`/admin/ubah-password` (§5.11, tersedia untuk kedua peran), jadi password awal yang lemah
hanya bersifat sementara dan bisa diputar kapan saja.

Password ditampilkan **sekali** di layar setelah dibuat atau di-reset, lalu tidak bisa
dibaca lagi. Pastikan password baru berbeda dari password lama saat reset.

### 5.9 Pengaturan (Super Admin)
Ambang terlambat (menit, bilangan bulat ≥ 0, default 5). Konfigurasi bot Telegram bersifat variabel lingkungan; halaman ini **tidak** menampilkan atau menyimpan token bot.

### 5.10 Audit Log (Super Admin)
Tabel hanya-baca: waktu · pelaku · aksi · entitas · ringkasan; baris dapat dibuka untuk melihat nilai sebelum/sesudah. Filter waktu, pelaku, aksi, entitas. Tidak ada tombol ubah/hapus.

### 5.11 Ubah Password `/admin/ubah-password`

Tersedia untuk **Admin dan Super Admin**. Satu tugas: mengganti password akun sendiri.

- Satu kolom, lebar maksimum ±480 px, sama seperti halaman login.
- Header: nama akun dan peran saat ini. Ini yang membuat pengguna tahu sedang mengubah akun mana.
- Tiga input berurutan: **Password saat ini**, **Password baru**, **Ulangi password baru**.
- Tombol "Simpan". Tombol nonaktif selama salah satu kolom kosong atau dua password baru tidak sama.
- Setelah berhasil: pesan sukses, lalu **logout otomatis** ke `/login` karena seluruh sesi akun dibatalkan (K-47). Sesi di perangkat lain ikut berakhir.

**Perilaku:**

| Kondisi | Perilaku |
|---|---|
| Password saat ini salah | Ditolak. Pesan: "Password saat ini salah." |
| Password baru < 8 karakter | Ditolak. Pesan: "Password baru minimal 8 karakter." |
| Dua password baru tidak sama | Ditolak. Pesan: "Konfirmasi password tidak cocok." |
| Berhasil | Sesi dibatalkan, audit tercatat, kembali ke `/login` |

- Halaman hanya bisa diakses dengan sesi valid. Tanpa sesi, server mengarahkan ke `/login`.
- Password **tidak pernah** ditampilkan kembali, tidak pernah masuk log, dan tidak pernah masuk nilai `sebelum`/`sesudah` di audit log (hanya catatan bahwa password diubah).

## 6. Komponen bersama

| Komponen | Aturan |
|---|---|
| Dialog konfirmasi | Judul menyebut aksi dan objek; tombol destruktif berwarna berbeda; tombol batal di kiri |
| Dialog alasan | Textarea wajib; tombol Kirim nonaktif selama kosong |
| Toast | Sukses hijau (hilang otomatis), error merah (tetap sampai ditutup) |
| Pemilih toko | Opsi "Semua toko" hanya di halaman yang mendukungnya |
| Badge | Sesuai §2 |
| Tabel | Header lengket, kolom terkunci nama pada layar sempit, paginasi/infinite scroll untuk daftar panjang |
| Form | Validasi inline; pesan error di bawah field; kirim ganda dicegah |

## 7. Pesan validasi kunci (admin)

| Kondisi | Pesan |
|---|---|
| Tolak tanpa alasan | "Alasan penolakan wajib diisi." |
| Koreksi tanpa alasan | "Alasan koreksi wajib diisi." |
| Kuota 2 check-in tercapai (koreksi) | "Karyawan sudah memiliki 2 check-in aktif pada tanggal ini." |
| Check-in sudah punya check-out aktif | "Check-in ini sudah memiliki check-out." |
| Check-in terbuka lewat 20 jam | "Batas check-out sendiri sudah habis. Hubungi admin untuk perbaikan." |
| Absen pada tanggal bertanda tidak berangkat | "Tanggal ini ditandai tidak berangkat. Hubungi admin." |
| Karyawan bukan penghuni toko | "Karyawan tidak ditempatkan di toko ini pada tanggal tersebut." |
| Shift tidak ada padanan hari | "Shift '{nama}' tidak memiliki jam untuk hari {weekday/weekend}." |
| Ekspor diblokir | "Ekspor belum bisa dilakukan: masih ada {n} absensi menunggu verifikasi dan {m} check-in tanpa check-out." |
| Slot tumpang tindih | "Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan." |
| Izin ditolak | "Anda tidak memiliki akses ke fitur ini." |
| Password lama salah saat ganti password | "Password saat ini salah." |
| Password baru terlalu pendek | "Password baru minimal 8 karakter." |
| Menit terlambat final di luar 0–1440 | "Menit terlambat harus antara 0 dan 1440." |
| Konfirmasi password tidak cocok | "Konfirmasi password tidak cocok." |
| Ganti password berhasil | "Password berhasil diubah. Silakan masuk kembali." |
