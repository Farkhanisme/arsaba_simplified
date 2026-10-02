# 02 — Spesifikasi Sistem dan Aturan Bisnis

Tag mengikuti `00-decision-log.md`. Seluruh keputusan sudah diambil pemilik (K-27 s.d. K-40);
tidak ada aturan `[BELUM DIPUTUSKAN]`.

## 1. Istilah

| Istilah | Arti |
|---|---|
| Event | Satu record absensi: `CHECKIN` atau `CHECKOUT` |
| Aktif | Event dengan status `MENUNGGU` atau `DISETUJUI` (bukan `DITOLAK`) |
| Pasangan | Satu check-in + satu check-out yang menunjuk ke check-in itu (`checkin_id`) |
| Pasangan valid | Pasangan yang check-in **dan** check-out-nya `DISETUJUI` |
| Check-in terbuka | Check-in aktif yang belum punya check-out aktif |
| Tanggal absensi | Tanggal WIB dari waktu check-in; check-out mewarisi tanggal check-in-nya |
| Slot | Satu rentang jam (mulai–selesai) pada jadwal seorang karyawan di satu tanggal |

## 2. Aturan waktu

- **BR-T1** Semua waktu diambil dari server dan diinterpretasikan sebagai WIB (UTC+7, tanpa DST). Jam perangkat karyawan tidak dipakai.
- **BR-T2** Weekend = Sabtu dan Minggu; sisanya weekday. Tidak ada hari libur.
- **BR-T3** Jam slot/shift disimpan `HH:MM`. Jika `jam_selesai <= jam_mulai`, shift berakhir di hari berikutnya. `jam_mulai` selalu berada dalam hari yang sama (00:00–23:59). `jam_mulai = jam_selesai` ditolak.

## 3. Aturan absensi (karyawan)

- **BR-A1** Akses hanya lewat token link aktif milik karyawan berstatus aktif. Token tidak valid/dicabut → pesan generik, tanpa membedakan penyebab.
- **BR-A2** Foto wajib, berasal dari kamera langsung. Tidak ada jalur unggah file. Server menolak request tanpa foto.
- **BR-A3** Koordinat opsional. `lokasi_status`:
  - `TERSEDIA` jika lat/lng valid diterima,
  - `DITOLAK` jika pengguna menolak izin lokasi,
  - `GAGAL` jika lokasi tidak bisa didapat,
  - `TIDAK_ADA` khusus record koreksi admin.

  Hanya lat/lng yang disimpan (tanpa akurasi atau data lain). Tidak ada validasi radius.
- **BR-A4** **Urutan operasi submit:** validasi aturan → unggah foto ke Telegram → simpan ke database. Jika unggah Telegram gagal, **tidak ada record** dan karyawan menerima pesan gagal.
- **BR-A5** **Check-in diizinkan** jika: (a) tidak ada check-in terbuka yang masih dalam batas 20 jam (BR-A10), dan (b) jumlah check-in aktif karyawan itu pada tanggal hari ini < 2.
- **BR-A6** **Check-out diizinkan** jika ada check-in terbuka yang masih dalam batas 20 jam (BR-A10). Check-out terhubung ke check-in tersebut.
- **BR-A7** Event berstatus `DITOLAK` tidak dihitung pada BR-A5 dan tidak dianggap check-in terbuka atau pasangan.
- **BR-A8** Absen pada hari tanpa jadwal atau di luar jam shift diizinkan; selisih keterlambatan kosong bila tidak ada jadwal.
- **BR-A9** Absen pada tanggal yang sudah ditandai tidak berangkat **diblokir** (K-31). Respons: pesan mengarahkan menghubungi admin; admin harus menghapus penandaan lebih dulu.
- **BR-A10** Batas check-out mandiri untuk check-in terbuka dari tanggal sebelumnya (K-29): **20 jam** sejak `waktu` check-in, dihitung pada waktu check-in + 20 jam. Selama dalam batas, karyawan seesua check-out. Setelah lewat batas, event check-in itu **tidak lagi dianggap terbuka** oleh karyawan (tombol kembali ke "Check-in") dan hanya admin yang dapat menutupnya lewat koreksi manual (BR-K3). Admin tetap dapat melihat dan memperbaiki kapan saja.
- **BR-A11** Idempotensi: setiap submit membawa `request_id` unik; pengulangan `request_id` yang sama mengembalikan hasil sebelumnya dan tidak membuat record baru.
- **BR-A12** Toko pada event = toko penempatan karyawan pada tanggal absensi (snapshot, tidak berubah walau karyawan dipindah kemudian). Tidak ada pembatasan lokasi fisik toko.

## 4. Aturan verifikasi

- **BR-V1** Setiap event dibuat dengan status `MENUNGGU` (kecuali koreksi admin, lihat BR-K).
- **BR-V2** Admin/Super Admin dapat `DISETUJUI` atau `DITOLAK` per event, satuan atau massal. `DITOLAK` wajib `alasan_tolak` tidak kosong; penolakan massal memakai satu alasan bersama yang berlaku untuk semua event terpilih.
- **BR-V3** Pencatatan `diverifikasi_oleh` dan `diverifikasi_at`. Setiap keputusan masuk audit log.
- **BR-V4** Check-in dan check-out diverifikasi **terpisah**. Pasangan valid hanya jika keduanya `DISETUJUI`.
- **BR-V5** Check-out yang check-in-nya `DITOLAK` tetap berdiri sendiri (bukan pasangan valid); admin perlu memverifikasinya juga (biasanya menolak).
- **BR-V6** Keputusan yang sudah dibuat dapat diubah `DISETUJUI` ↔ `DITOLAK` **selama periode belum diekspor** (K-36). Perubahan ke status aktif pada check-out harus memeriksa ulang constraint satu check-out aktif per check-in (BR-V5). Semua perubahan tercatat di audit log, dan pada periode terekspor hanya Super Admin yang boleh (BR-R8).
- **BR-V7** Menyetujui check-in yang ditandai terlambat sistem **wajib** mengisi `keterlambatan_final_menit` (K-30); `0` harus diisi eksplisit agar tidak ada nol diam-diam. Check-in yang tidak terlambat sistem tidak wajib diisi.

## 5. Kehadiran

- **BR-H1** Karyawan **hadir** pada tanggal T jika ada ≥ 1 pasangan valid dengan tanggal absensi T.
- **BR-H2** Hadir dihitung per tanggal unik. Dua pasangan valid di tanggal yang sama tetap dihitung 1 hari hadir.

## 6. Keterlambatan

**Algoritma (dihitung saat ditampilkan, tidak disimpan):**

```
untuk sebuah CHECKIN c dari karyawan K pada tanggal T:
  menit_c   = jam*60 + menit dari waktu WIB c   (detik dibuang)
  N         = jumlah CHECKIN aktif K pada T dengan (waktu, id) <= (c.waktu, c.id)
  jadwal    = jadwal K pada T
  jika jadwal tidak ada:                 selisih = NULL
  selain itu:
    slot    = slot ke-N (berdasarkan urutan) jika ada, selain itu slot terakhir   ← K-28
    selisih = menit_c - (slot.jam_mulai dalam menit)
  terlambat_sistem = selisih != NULL dan selisih > ambang_terlambat_menit (default 5)
```

**Contoh (shift 07:00):**

| Check-in (WIB) | Menit efektif | Selisih | Terlambat (sistem) |
|---|---|---|---|
| 06:50:10 | 06:50 | −10 | Tidak (lebih awal) |
| 07:05:59 | 07:05 | 5 | Tidak (toleransi) |
| 07:06:00 | 07:06 | 6 | Ya |

**Contoh dua slot** (perubahan khusus 07:00–12:00 dan 18:00–23:00): check-in aktif pertama dibandingkan ke slot 1, kedua ke slot 2.

**Contoh satu slot, check-in kedua:** dibandingkan dengan slot yang sama (satu-satunya), sehingga hampir pasti terlambat. Ini konsekuensi yang **diterima pemilik** (K-18) dan admin memutuskan angka final.

- **BR-L1** Event `DITOLAK` tidak dihitung dalam N (sehingga penomoran ulang otomatis karena dihitung saat tampil).
- **BR-L2** Angka final (`keterlambatan_final_menit`) hanya diisi admin, hanya pada `CHECKIN`.
  `NULL` = belum diisi. **Rentang yang sah: 0 s.d. 1440 menit** (24 jam, K-54). Nilai di luar
  rentang itu ditolak di **server** dengan pesan jelas — validasi di UI saja tidak cukup.
  Batas atas mencegah salah ketik digit (mis. `700` untuk check-in jam 07:00) yang akan lolos ke
  rekap tanpaketahuan. **Catatan:** constraint di `rules/04` §2 saat ini hanya mengecek `>= 0`,
  jadi batas atas **wajib** ditegakkan di lapisan aplikasi.
- **BR-L3** Rekap memakai **hanya** angka final; `NULL` dihitung 0. Menyetujui check-in terlambat sistem wajib mengisi angka final (BR-V7, K-30).
- **BR-L4** Ambang terlambat diambil dari pengaturan; perubahan mengubah tanda sistem pada data lama saat ditampilkan (angka final tetap).

## 7. Jadwal

- **BR-J1** Setiap toko memiliki *shift template*: `nama`, `tipe_hari` (`SEMUA`/`WEEKDAY`/`WEEKEND`), `jam_mulai`, `jam_selesai`. Unik per (toko, nama, tipe_hari).
  - Toko dengan jam sama tiap hari: template `SEMUA`.
  - Toko dengan jam berbeda: template dengan nama sama untuk `WEEKDAY` dan `WEEKEND`.
  - Aplikasi menolak nama yang sama dengan tipe `SEMUA` sekaligus `WEEKDAY`/`WEEKEND`.
  - Template antar shift dalam satu toko **boleh overlap**.
- **BR-J2** Memilih shift berdasarkan **nama**: untuk tanggal d, sistem memilih template bernama itu yang tipe harinya sesuai d (atau `SEMUA`). Jika tidak ada padanannya untuk d, sel itu ditolak dengan pesan jelas.
- **BR-J3** Jadwal dasar = **satu jadwal per karyawan per tanggal** (ditegakkan database). Jadwal menyimpan **snapshot** jam (tabel slot) sehingga perubahan template tidak mengubah jadwal lampau.
- **BR-J4** Karyawan hanya bisa dijadwalkan di toko tempat ia ditempatkan pada tanggal tersebut (K-14 opsi b). Tidak ada kuota jumlah karyawan per shift.
- **BR-J5** Pembuatan massal per hari/minggu/bulan: pilih toko + rentang + karyawan + shift. Jika (karyawan, tanggal) sudah punya jadwal: default **dilewati dan dilaporkan**; opsi **timpa** tersedia dan wajib dipilih eksplisit. Semua tercatat audit.
- **BR-J6** **Perubahan jadwal khusus satu hari (K-17):**
  - Mengganti seluruh slot jadwal seorang karyawan **hanya pada satu tanggal**; template dan tanggal lain tidak berubah.
  - Admin menentukan jumlah slot dan jam tiap slot. **Batas jumlah slot: 2** (K-27), konsisten dengan batas 2 pasang pada BR-A5.
  - Slot diurutkan menurut `jam_mulai` naik. Jadwal ditandai `is_override = 1`.
  - Jika tanggal itu belum punya jadwal, perubahan khusus membuat jadwal baru.
  - Aksi "Kembalikan ke shift standar" memilih template lagi.
  - Catatan bersifat **opsional** (K-37).
- **BR-J7** **Peringatan (bukan larangan) W-01:** slot-slot milik satu karyawan pada satu tanggal saling tumpang tindih. Definisi bentrok: dua slot pada jadwal karyawan yang sama dan tanggal yang sama dengan rentang `[jam_mulai, jam_selesai)` beririsan, dengan `jam_selesai <= jam_mulai` dihitung berakhir keesokan hari (BR-T3). Peringatan ditampilkan sebelum simpan; admin tetap dapat menyimpan.
- **BR-J8** Mengubah jadwal pada tanggal lampau diizinkan; tercatat audit. Tidak memengaruhi angka final admin.
- **BR-J9** Perubahan jadwal khusus atau pembaruan jadwal pada periode yang sudah diekspor hanya boleh oleh Super Admin (K-32, BR-R8).

## 8. Penempatan dan pemindahan

- **BR-P1** Setiap karyawan aktif punya tepat satu penempatan terbuka (`berlaku_sampai IS NULL`).
- **BR-P2** Memindahkan karyawan: menutup penempatan lama (`berlaku_sampai` = hari sebelum tanggal efektif) dan membuka penempatan baru mulai tanggal efektif. Rentang penempatan satu karyawan tidak boleh tumpang tindih.
- **BR-P3** Memindahkan karyawan yang masih punya jadwal di toko lama pada/setelah tanggal efektif **diblokir** (K-35). Admin harus menghapus jadwal di toko lama pada/setelah tanggal efektif terlebih dahulu, lalu mengulang pemindahan. Pemeriksaan dan perubahan penempatan dilakukan dalam satu transaksi.
- **BR-P4** Rekap memakai toko yang tercatat pada event/penandaan (snapshot), bukan penempatan saat ini.

## 9. Ketidakhadiran

- **BR-X1** Jenis: `IZIN`, `TANPA_KETERANGAN`. Kolom `catatan` opsional.
- **BR-X2** Satu penandaan per (karyawan, tanggal).
- **BR-X3** Penandaan **diblokir** jika pada tanggal itu ada event aktif (`MENUNGGU`/`DISETUJUI`) karyawan tersebut (K-19). Admin menolak event tersebut lebih dulu.
- **BR-X4** Penandaan boleh diubah jenis/catatan atau dihapus kembali; tercatat audit.
- **BR-X5** Penandaan satu tanggal atau rentang tanggal sekaligus.

## 10. Koreksi manual

- **BR-K1** Admin dapat menambahkan atau mengubah waktu check-in/check-out. `alasan_koreksi` wajib. Record ditandai `sumber = KOREKSI_ADMIN`, tanpa foto, `lokasi_status = TIDAK_ADA`.
- **BR-K2** Record koreksi langsung berstatus `DISETUJUI` dengan `diverifikasi_oleh` = admin pelaku.
- **BR-K3** Kasus utama: check-out untuk check-in terbuka (lupa check-out, termasuk yang sudah lewat batas 20 jam pada BR-A10); check-out koreksi terhubung ke check-in itu.
- **BR-K4** Aturan kuota (maks 2 check-in aktif per tanggal) dan satu check-out aktif per check-in **tetap berlaku** pada koreksi.
- **BR-K5** Tidak ada hapus permanen. Perubahan menyimpan nilai sebelum/sesudah di audit log.
- **BR-K6** Koreksi pada periode yang sudah diekspor hanya boleh oleh **Super Admin** (K-32), tercatat di audit log.

## 11. Rekap dan ekspor

- **BR-R1** Filter: rentang tanggal (inklusif) dan toko (semua atau satu).
- **BR-R2** **Syarat ekspor (K-13):** dalam filter tidak boleh ada event `MENUNGGU` dan tidak boleh ada check-in terbuka. Jika ada, ekspor diblokir dan sistem menampilkan jumlah + tautan ke daftar verifikasi yang terfilter.
- **BR-R3** Karyawan terjadwal tanpa absen dan tanpa penandaan: **peringatan saja**, tidak memblokir ekspor (K-33).
- **BR-R4** **Sheet "Ringkasan"** (satu baris per karyawan per toko dalam periode): nama karyawan, toko, hari hadir (BR-H1), hari izin, hari tanpa keterangan, total menit terlambat final.
- **BR-R5** **Sheet "Detail Harian"** (satu baris per pasangan/event, per tanggal): tanggal, karyawan, toko, slot jadwal acuan, waktu check-in, waktu check-out, status check-in, status check-out, selisih sistem (menit), keterlambatan final (menit), penandaan (jenis + catatan), catatan koreksi.
- **BR-R6** Setiap ekspor mencatat baris `log_ekspor` (pelaku, waktu, rentang, toko) dan audit log.
- **BR-R7** Waktu di Excel ditampilkan WIB.
- **BR-R8** Perubahan data pada tanggal/toko yang sudah masuk `log_ekspor` (verifikasi BR-V6, koreksi BR-K6, penandaan BR-X4, jadwal BR-J9) **hanya boleh oleh Super Admin**, tercatat di audit log (K-32). Admin biasa mendapat penolakan.

## 12. Dashboard (hari ini, WIB, per toko)

| Metrik | Definisi |
|---|---|
| Terjadwal | Jumlah karyawan dengan jadwal hari ini |
| Sudah absen | Karyawan dengan ≥ 1 check-in aktif hari ini |
| Terlambat | Dari yang sudah absen: ada check-in dengan `terlambat_sistem` (bukan angka final) |
| Belum absen | Terjadwal, tanpa check-in aktif, tanpa penandaan tidak berangkat hari ini |
| Antrean verifikasi | Jumlah event `MENUNGGU` (semua tanggal) |

## 13. Peran dan izin

| Kemampuan | Admin | Super Admin |
|---|:--:|:--:|
| Dashboard | ✔ | ✔ |
| Verifikasi (satuan/massal), isi keterlambatan final | ✔ | ✔ |
| Jadwal (buat, massal, perubahan khusus) | ✔ | ✔ |
| Tandai tidak berangkat | ✔ | ✔ |
| Koreksi manual | ✔ | ✔ |
| Rekap dan ekspor | ✔ | ✔ |
| Data master (toko, shift, karyawan, penempatan) | ✘ | ✔ |
| Cabut/buat ulang link karyawan | ✘ | ✔ |
| Kelola akun admin | ✘ | ✔ |
| Pengaturan sistem | ✘ | ✔ |
| Baca audit log | ✘ | ✔ |
| Ubah data pada periode terekspor | ✘ | ✔ (K-32) |

Izin **wajib diperiksa di server** pada setiap endpoint, bukan hanya disembunyikan di UI.

## 14. Autentikasi admin

- Login username + password; password di-hash (`scrypt` bawaan Node) dengan salt unik.
- **BR-AUTH1** **Id sesi di-hash.** Database menyimpan `hash(id_sesi)`; cookie hanya memuat `id_sesi` mentah. `getSession` menghitung hash dari nilai cookie lalu mencari. Nilai yang tersimpan di database **tidak boleh sama** dengan nilai cookie — kalau sama, kebocoran database berarti pembajakan sesi.
- Sesi disimpan di database, cookie `HttpOnly`, `Secure`, `SameSite=Lax`. **Durasi sesi 12 jam** sejak login berhasil (K-39), disimpan pada `sesi_admin.kedaluwarsa_at`.
- **BR-AUTH2** **Pembatasan percobaan login (K-46):** maksimal **5 percobaan gagal dalam 24 jam**, dihitung **per username DAN per IP** — keduanya harus terpenuhi. Akun terkunci tidak dapat login selama jendela 24 jam. Super Admin dapat membuka kunci secara manual dengan menghapus baris `percobaan_login` gagal untuk username tersebut (tercatat di audit log).
- **BR-AUTH3** **Ganti password (K-47, K-48).** Halaman `/admin/ubah-password`, tersedia untuk kedua peran. Wajib menyertakan password saat ini sebagai verifikasi. Password baru minimal **8 karakter**. Setelah berhasil:
  - **seluruh sesi lain** akun tersebut **dibatalkan** (sesi yang sedang dipakai ikut berakhir, memaksa login ulang);
  - tercatat di `audit_log` dengan nilai sebelum/sesudah **tanpa memuat password**.
- Pesan gagal login generik. Akun nonaktif tidak bisa login dan sesinya dicabut.
- **BR-AUTH4** **Verifikasi `Origin` ketat (K-38).** Header `Origin` harus **ada** dan **sama persis** dengan `APP_ORIGIN`. Perbandingan parsial (`startsWith`) dan mengizinkan header kosong **dilarang** — keduanya bisa dilewati penyerang.
- **BR-AUTH5** Password **tidak boleh di-`trim()`**. Spasi di awal atau akhir adalah bagian dari password dan harus dipertahankan.

## 15. Link karyawan

- **BR-LK1** Token acak kriptografis, minimal 32 byte, dikodekan base64url. URL: `/a/{token}`.
- **BR-LK2** Satu link aktif per karyawan (dijamin index unik parsial). "Cabut" mengisi `dicabut_at`; "Buat ulang" mencabut yang lama dan membuat yang baru dalam satu transaksi.
- **BR-LK3** Token disimpan apa adanya agar Super Admin dapat menyalin ulang link. Token tidak pernah dicatat di log aplikasi.

## 16. Audit log

- **BR-AU1** Dicatat untuk semua aksi admin yang mengubah data: verifikasi, koreksi, jadwal (buat/ubah/hapus/perubahan khusus), penandaan, ekspor, master data, link, akun, pengaturan, login berhasil/gagal.
- **BR-AU2** Isi: waktu, pelaku, aksi, entitas + id, nilai sebelum/sesudah (JSON), catatan.
- **BR-AU3** Append-only: aplikasi tidak pernah UPDATE/DELETE; database dilengkapi trigger penolak.
- **BR-AU4** Dibaca Super Admin lewat UI hanya-baca dengan filter.

## 17. Tabel kasus tepi

| Kasus | Perilaku |
|---|---|
| Double tap tombol kirim | `request_id` sama → satu record |
| Dua perangkat mengirim bersamaan | Transaksi + constraint database; salah satu ditolak dengan pesan kuota/keadaan berubah |
| Check-out setelah lewat tengah malam | Tanggal mengikuti check-in |
| Check-in terbuka sudah lewat 20 jam | Tombol karyawan kembali ke "Check-in"; hanya admin yang dapat menutup lewat koreksi (BR-A10) |
| Karyawan absen pada tanggal bertanda tidak berangkat | Diblokir, pesan mengarahkan menghubungi admin (BR-A9) |
| Check-in ditolak, check-out sudah dikirim | Check-out berdiri sendiri (BR-V5); karyawan boleh check-in baru |
| Karyawan dinonaktifkan | Link tidak bisa dipakai; riwayat tetap ada |
| Link dicabut saat halaman terbuka | Submit ditolak dengan "Link tidak berlaku" |
| Jadwal berubah setelah absen | Selisih dihitung ulang saat tampil; angka final admin tetap |
| Telegram tidak merespons | Absen dibatalkan (BR-A4) |
| Lokasi ditolak | Absen lanjut, `lokasi_status = DITOLAK` |
| Tanpa jadwal | Absen boleh, selisih kosong |
