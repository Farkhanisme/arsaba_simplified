# 00 — Decision Log (Sumber Kebenaran)

Dokumen ini adalah **sumber kebenaran tertinggi**. Jika ada konflik antar dokumen, urutan prioritas: `00` > `01` > `02` > `03` > `04` > `05` > `06`.

## Legenda status

| Tag | Arti | Boleh diimplementasikan? |
|---|---|---|
| `[KEPUTUSAN]` | Diputuskan eksplisit oleh pemilik | Ya |
| `[USULAN]` | Usulan penyusun dokumen, belum disetujui eksplisit | Ya, tetapi ditandai untuk ditinjau pemilik; jangan diubah tanpa persetujuan |
| `[BELUM DIPUTUSKAN]` | Belum ada keputusan | **Tidak. Berhenti, catat di `OPEN_QUESTIONS.md`, tanyakan ke pemilik** |

Ketika pemilik menyetujui sebuah `[USULAN]`, tag-nya dihapus di semua dokumen dan dicatat di bagian A.

> **Status per 2026-09-30: seluruh `[USULAN]` disetujui (K-40) dan B-01 s.d. B-12 terjawab (K-27 s.d. K-38).**
> Karena itu tag `[USULAN]` dan `[BELUM DIPUTUSKAN]` sudah tidak ada di dokumen `01`–`05`, dan
> **tidak ada lagi aturan yang terlarang diimplementasikan.** Mekanisme di atas tetap dipakai bila
> muncul pertanyaan baru.
>
> **Konfirmasi lisan pemilik (2026-09-30), sudah tercermin di K-27/K-38/K-40:**
> B-01 dibatasi **2 slot per karyawan per tanggal** (bukan per toko) · butir tambahan `[USULAN]`
> (§ B) disetujui eksplisit · domain produksi `arsaba.vercel.app`.
>
> **Status 2026-10-01 — M0 BELUM selesai.** `rules/OPEN_QUESTIONS.md` dibuat berisi B-13 (bug
> timezone di `waktu.ts`, ditemukan lewat `TZ=UTC`), B-14 (Next.js terpasang 16.3.8 vs
> `^16.3.7`), B-15 (`sekarangWIB()` menyesatkan). Keputusan baru: **K-44** (tes wajib dua
> timezone) dan **K-45** (offset `+07:00` eksplisit, metode `get*` lokal dilarang).
>
> **Keputusan 2026-10-01 (audit M1):** **K-46** batas percobaan login · **K-47** halaman
> ganti password · **K-48** password minimal 8 karakter · **K-49** seed dua akun dengan
> password dari env. B-16 ditutup.
>
> **2026-10-03 — M2 selesai.** Keputusan baru: **K-50** password akun admin diinput Super
> Admin (bukan generate), dengan alasan fitur `/admin/ubah-password` tersedia untuk kedua peran.

---

## A. Keputusan pemilik

| ID | Keputusan |
|---|---|
| K-01 | Karyawan absen lewat **satu link unik per karyawan**, tanpa login. Link berlaku selamanya sampai dicabut. |
| K-02 | Foto diambil **langsung dari kamera** HP masing-masing karyawan. Bukan unggah dari galeri/file. |
| K-03 | Lokasi hanya **koordinat** (tanpa data lain). **Foto wajib.** Jika izin lokasi ditolak/gagal, absen **tetap boleh**. |
| K-04 | Semua waktu memakai **WIB** (UTC+7), dari waktu server. |
| K-05 | Foto disimpan di **Telegram** (bot + grup), **permanen**. Jika upload ke Telegram gagal, **absen dibatalkan** (tidak ada record). |
| K-06 | Admin login dengan **username + password**. Ada **dua akun**: Admin dan Super Admin. Admin melihat **semua toko**. |
| K-07 | Karyawan bisa check-in/check-out 1 atau 2 pasang per hari. Aplikasi tidak menentukan siapa yang berhak 2 kali. Batas: **maksimal 2 pasang aktif (bukan DITOLAK) per karyawan per tanggal**, berlaku untuk semua karyawan. |
| K-08 | **Hadir** pada satu tanggal = ada minimal **satu pasang** check-in + check-out yang **sama-sama DISETUJUI**. |
| K-09 | Jam mulai shift tidak pernah melewati tengah malam; jam selesai boleh. **Tanggal kehadiran = tanggal check-in.** Check-out setelah tengah malam tetap milik tanggal check-in. |
| K-10 | Lupa check-out / check-in tanpa pasangan diselesaikan oleh admin (koreksi manual). |
| K-11 | Absen di luar jadwal atau pada hari tanpa jadwal **diperbolehkan**. |
| K-12 | Status verifikasi: `MENUNGGU`, `DISETUJUI`, `DITOLAK`. Tolak **wajib alasan**. Karyawan **boleh absen ulang** di hari yang sama setelah ditolak; record ditolak **tidak** menghabiskan jatah. Verifikasi massal **boleh**. **Semua** check-in dan check-out harus diverifikasi. |
| K-13 | Rekap/ekspor hanya boleh setelah verifikasi selesai. Cakupan: di periode + filter toko terpilih **tidak ada** record `MENUNGGU` dan **tidak ada** check-in tanpa check-out. |
| K-14 | Jadwal: hanya karyawan yang terdaftar di toko tersebut yang bisa dijadwalkan (tanpa kuota per shift). Dibuat **per hari, per minggu, atau per bulan**. Bentrok hanya **diperingatkan**, tidak dilarang. |
| K-15 | Ada **10 toko** dan **26 karyawan**. Weekend = **Sabtu dan Minggu**. Definisi shift per toko: ada toko dengan jam sama tiap hari, ada toko dengan jam berbeda weekday vs weekend. Tidak ada hari libur nasional. |
| K-16 | Satu karyawan terikat satu toko pada satu waktu; boleh **dipindah** ke toko lain. Riwayat penempatan dengan tanggal berlaku disimpan agar rekap lama tidak berubah. |
| K-17 | **Perubahan jadwal khusus satu hari.** Admin dapat mengubah jadwal karyawan tertentu untuk **satu tanggal saja** (waktu dan jumlah shift), mis. dari 1 shift 07:00–17:00 menjadi 2 shift 07:00–12:00 dan 18:00–23:00. Slot hasil perubahan menjadi acuan check-in/check-out pertama dan kedua. |
| K-18 | Keterlambatan: sistem menghitung selisih **tiap check-in** terhadap jadwal, **detik diabaikan**. Terlambat jika selisih **> 5 menit** (07:05 masih toleransi, 07:06 terlambat, untuk shift 07:00). Angka **final** diisi **manual oleh admin**. Check-in kedua dibandingkan dengan shift yang ada walau di luar jam shift. Tanpa jadwal: selisih kosong. |
| K-19 | Ketidakhadiran ditandai admin: `IZIN` atau `TANPA_KETERANGAN`, dengan **kolom catatan**. Boleh diubah kembali. Penandaan **diblokir** jika di tanggal itu masih ada absen aktif (`MENUNGGU`/`DISETUJUI`); admin harus menolaknya lebih dulu. |
| K-20 | Audit log dicatat dan **dibaca Super Admin lewat UI**. |
| K-21 | Dashboard: per toko hari ini: hadir / terlambat / belum absen, plus antrean verifikasi. |
| K-22 | Peran. **Super Admin:** kelola akun admin, data master (toko, shift, karyawan, penempatan), cabut/buat ulang link karyawan, pengaturan sistem (ambang terlambat, konfigurasi bot Telegram), audit log. **Admin:** dashboard, verifikasi, jadwal, tandai tidak berangkat, koreksi manual, rekap/ekspor. |
| K-23 | Masuk cakupan: manajemen data master, laporan/rekap + ekspor Excel, koreksi manual admin. |
| K-24 | Stack: **Next.js di Vercel**, **Turso (SQLite/libSQL)**, **tanpa ORM**. Antarmuka **Bahasa Indonesia saja**. Aplikasi internal; isu lisensi komersial diabaikan. |
| K-25 | Koreksi manual: admin menambah/mengubah check-in/check-out dengan **alasan wajib**; ditandai "dikoreksi admin"; tanpa foto; **tanpa hapus permanen**; tercatat di audit log. |
| K-26 | Rekap Excel: per karyawan per periode berisi hari hadir, izin, tanpa keterangan, total menit terlambat final; detail per hari di sheet kedua; filter per toko dan rentang tanggal. Perhitungan gaji **di luar cakupan**. |
| K-27 | Perubahan jadwal khusus satu hari: **maksimal 2 slot** per karyawan per tanggal, konsisten dengan batas 2 pasang pada K-07. |
| K-28 | Pemetaan check-in ke slot: check-in ke-N dibandingkan dengan **slot ke-N**; jika N melebihi jumlah slot, dipakai **slot terakhir**. |
| K-29 | Check-in terbuka dari tanggal sebelumnya: karyawan boleh check-out sendiri **sampai 20 jam** dari waktu check-in. Setelah lewat batas, hanya admin yang memperbaiki dan tombol karyawan kembali ke **Check-in**. |
| K-30 | Menyetujui check-in yang ditandai terlambat sistem **wajib** mengisi menit terlambat final; `0` tetap harus diisi eksplisit. |
| K-31 | Absen pada tanggal yang sudah ditandai tidak berangkat **diblokir**; admin harus menghapus penandaan lebih dulu. |
| K-32 | Perubahan data (verifikasi, koreksi, penandaan) pada periode yang **sudah diekspor**: **hanya Super Admin**, tercatat di audit log. Menghapus tumpang tindih dengan K-25 dan K-22. |
| K-33 | Karyawan terjadwal tetapi tidak absen dan tidak ditandai admin saat ekspor: **hanya peringatan**, tidak memblokir. |
| K-34 | Data karyawan memuat `nik`, `jabatan`, `alamat`, `nomor_hp`, dan `kontak_darurat` selain nama. Data **toko** tetap hanya nama. |
| K-35 | Memindahkan karyawan yang masih punya jadwal di toko lama pada/setelah tanggal efektif **diblokir** sampai jadwal di toko lama dibersihkan admin. |
| K-36 | Keputusan verifikasi boleh diubah (`DISETUJUI` ↔ `DITOLAK`) selama periode **belum diekspor**; tercatat di audit log. |
| K-37 | Catatan/alasan pada perubahan jadwal khusus satu hari bersifat **opsional**. |
| K-38 | Nama aplikasi: **Arsaba Management Center**. Domain produksi: **`arsaba.vercel.app`** (nilai `APP_ORIGIN`). |
| K-39 | Durasi sesi admin **12 jam** sejak login berhasil. |
| K-40 | **Seluruh `[USULAN]` teknis disetujui** pemilik (lihat bagian B). Tag `[USULAN]` dihapus di semua dokumen. |
| K-41 | Versi runtime dipatok: **Next.js `^16.3.7`** dan **Node.js `24.x`**, sama untuk lokal dan Vercel. Node 26 **tidak dipakai** karena tidak tersedia untuk builds/functions di Vercel. `package.json` memuat `"engines": { "node": "24.x" }`. |
| K-42 | Database uji memakai **SQLite file lokal** di `data/uji.db` pada M0–M2; Turso remote diisi setelah itu. Tes memakai **file sementara per run, bukan `:memory:`**. Verifikasi constraint di file lokal **bukan bukti** untuk Turso dan wajib diulang setelah remote aktif. |
| K-43 | Node.js lokal **wajib `24.x`, sama dengan produksi**. `.nvmrc` berisi `24`; `package.json` memuat `"engines": { "node": "24.x" }` (tegas, bukan `">=24"`). Node 26 **dilarang** di repo ini walau terpasang di mesin. |
| K-44 | **Tes wajib dijalankan di TIGA timezone** — `TZ=UTC` (lingkungan produksi Vercel), `TZ=Asia/Jakarta` (mesin devs), dan **`TZ=America/New_York` (offset negatif -04:00)** — dan harus lulus di ketiganya. Jalankan `npm run test:tz`. Ditetapkan setelah bug timezone di `waktu.ts` lolos karena tes hanya dijalankan pada satu timezone (lihat `OPEN_QUESTIONS.md` B-13), lalu diperluas 2026-10-03 karena **dua timezone offset non-negatif tidak dapat menangkap kelas bug B-13 sama sekali** (B-18). Offset negatif wajib karena hanya itu yang membuktikan kode bebas timezone mesin: `new Date('2026-10-04').getDay()` benar di UTC, Jakarta, *dan* Kiritimati (UTC+14), tetapi salah di New York. |
| K-45 | Seluruh operasi waktu harus dilakukan dalam **offset tetap `+07:00`**, tanpa bergantung pada timezone mesin. Metode `getHours()`/`getDate()`/`getFullYear()` **dilarang** di seluruh kode — hanya boleh lewat fungsi turunan `server/waktu.ts`. Berlaku juga untuk `sekarangWIB()`, yang apesar namanya mengembalikan `Date` absolut UTC sehingga pemanggil tidak boleh memakai metode `get*` lokal pada hasilnya. |
| K-46 | Pembatasan login: **maksimal 5 percobaan gagal dalam 24 jam**, dihitung **per username DAN per IP**. Akun terkunci tidak dapat login selama jendela 24 jam; **Super Admin dapat membuka kunci secara manual**. Ini menggantikan bagian `rules/02` §14 yang sebelumnya menyebut "pembatasan" tanpa angka. |
| K-47 | Ganti password memakai **halaman `/admin/ubah-password`**, tersedia untuk Admin dan Super Admin. Wajib menyertakan **password saat ini** sebagai verifikasi. **Tidak ada** kewajiban ganti password saat login pertama. **Ganti password membatalkan seluruh sesi lain** akun tersebut. |
| K-48 | Password baru minimal **8 karakter**. |
| K-49 | Seed membuat **dua akun**: Super Admin dan Admin, dengan password awal `test1234` untuk keduanya. Password seed **dibaca dari env** (`SEED_PASSWORD`), tidak ditulis di source dan tidak dicetak ke log. |
| K-50 | Password akun admin **diinput Super Admin**, bukan dihasilkan otomatis oleh sistem. Minimal 8 karakter (K-48), ditampilkan sekali di layar, tidak bisa dibaca lagi. Alasan pemilik: setiap akun admin bisa menggantinya sendiri lewat `/admin/ubah-password` (§5.11, untuk kedua peran), jadi password awal yang lemah hanya sementara. |
| K-51 | **Seluruh karyawan berada di zona waktu WIB.** Aplikasi TIDAK mendukung zona waktu lain dan tidak menyediakan konversi. Semua waktu disimpan sebagai ISO 8601 dengan offset tetap `+07:00`. |
| K-52 | Alur absen karyawan: link → halaman dengan **pratinjau kamera langsung** → tombol **"Foto"** dan **"Ganti Kamera"** (depan ↔ belakang) → setelah foto diambil, tombol "Foto" berubah jadi **"Foto Ulang"** dan muncul **tombol "Absen"**. Tekan "Absen" untuk mengirim. |
| K-53 | Kompresi foto dilakukan **otomatis di browser**, tanpa langkah manual karyawan. Keluaran JPEG, sisi terpanjang **1600 px**, kualitas awal **0,75**, diturunkan bertahap bila perlu. **Wajib** hasil akhir di bawah 4,5 MB (batas Vercel, `rules/NOTES.md` §6). |
| K-54 | `keterlambatan_final_menit` dibatasi **0 s.d. 1440 menit** (24 jam). Di luar itu ditolak di server dengan pesan jelas. Pemeriksaan WAJIB di server, bukan hanya di UI. |
| K-55 | Batas **100 karyawan per operasi isi massal** jadwal. Dengan 26 karyawan dan 10 toko, batas ini hanya perlindungan beban (satu operasi penuh 26 karyawan × 31 hari = 806 sel dalam satu transaksi), bukan fitur. |
| K-56 | Batas **100 karyawan per operasi tandai tidak berangkat**. Sama seperti K-55: dengan 26 karyawan, batas ini hanya perlindungan beban transaksi, bukan fitur. Rentang tanggal tidak dibatasi (satu tanggal atau rentang bebas, BR-X5). |
| K-57 | **Fitur Agenda** masuk cakupan. Admin **dan** Super Admin boleh membuat agenda serta meng-assign. Pembuat memilih **wajib foto before–after** atau tidak. **Tanggal target opsional** (boleh kosong). |
| K-58 | Tiga cakupan penerima: **satu karyawan**, **satu toko**, atau **seluruh karyawan**. Penerima **dihitung ulang dari penempatan saat ini** (bukan snapshot) — aturan lengkap di `rules/02` BR-G2. |
| K-59 | Alur karyawan. Agenda wajib foto → foto before → kerjakan → foto after. Agenda tanpa foto → keterangan opsional saja. Agenda **yang dibuat karyawan sendiri selalu wajib foto** (tidak ada sakelar). |
| K-60 | Status laporan agenda: `DRAFT` → `MENUNGGU` → `DISETUJUI` \| `DITOLAK`. Draft menyimpan foto before dan **tidak pernah terlihat oleh admin**. |
| K-61 | **Semua** laporan agenda — termasuk agenda buatan karyawan sendiri — masuk antrean verifikasi admin. `DITOLAK` **wajib alasan** dan **boleh diulang** sebagai percobaan baru (percobaan pertama tidak hangus). |
| K-62 | Admin boleh **membatalkan** agenda (`DIBATALKAN`) dan **mengubah daftar penerima** selagi agenda masih `AKTIF`. **Tidak ada hapus permanen** dan **judul/keterangan tidak bisa diedit** setelah pembuatan. Daftar penerima agenda buatan karyawan sendiri **tidak boleh** diubah. |
| K-63 | Laporan agenda masuk periode = **tanggal submit (foto after)**. **Hanya laporan `MENUNGGU`** yang memblokir ekspor. Ini **mengubah K-13**: syarat ekspor jadi tiga. |
| K-64 | Agenda masuk rekap Excel: sheet baru **`Detail Agenda`** + kolom aggregate di sheet `Ringkasan`. Dashboard menampilkan metrik agenda per toko. |
| K-65 | **K-32 berlaku untuk agenda**: verifikasi laporan agenda pada periode yang sudah diekspor hanya Super Admin. Sebaliknya, **BR-A9 (tidak berangkat) TIDAK memblokir** pengerjaan agenda — pemilik memutuskan ini. |
| K-66 | **Keterangan absensi.** Karyawan boleh menulis **teks bebas opsional** (maks **500 karakter**) di modal hasil foto, untuk check-in maupun check-out. Absen **tidak pernah** terblokir atau berubah status karena keterangan. Keterangan **tidak bisa diubah** setelah terkirim. Admin membacanya di kartu Verifikasi dan di sheet `Detail Harian` (kolom baru → BR-R5 jadi **13 kolom**). Keterangan **tidak masuk** caption Telegram. Aturan lengkap: `rules/02` BR-A13. |
| K-67 | **Navigasi bawah untuk halaman karyawan `/a/[token]`**, menggantikan tab yang tadinya berada di atas. Tepat **DUA item**: **"Absen"** dan **"Agenda"**. Tidak ada item ketiga, tidak ada tombol tengah besar. Alasannya sama seperti alasan tab sejak M12: **satu permukaan link saja** (K-01), dan link yang bocor berarti absen atas nama orang (risiko **D-1**). Navigasi bawah **TIDAK memakai URL** — status tab tetap state lokal di sisi klien seperti sekarang; memindahkannya ke URL adalah fitur baru dan di luar milestone ini. **Halaman admin tidak ikut berubah** — `rules/05` §1.2 (desktop-first) tidak diubah. Aturan rinci ada di `rules/05` §3b. |
| K-68 | **Sheet kalender per karyawan di ekspor Excel (BR-R9).** Setelah tiga sheet tetap, workbook mendapat **satu sheet per karyawan** yang sudah ada di `Ringkasan`, bernama nama karyawan. Isinya **grid mingguan** (baris = pekan, kolom **Senin–Minggu**) dengan **seluruh hari rentang filter**, dan tiap sel memuat tanggal + **jam check-in/check-out** — jadi kehadiran terbaca seperti kalender, bukan daftar baris. Keputusan yang mengunci bentuknya: 2 pasangan sehari **keduanya tampil** · event `DITOLAK` **disembunyikan** dari kalender · pasangan setengah (check-in `DISETUJUI`, check-out tidak) tetap **tampil jamnya** dengan sel putih · hari izin/tanpa keterangan tampil sebagai teks + warna · **warna terlambat ditentukan `keterlambatan_final_menit > 0` (angka FINAL BR-L3), bukan selisih sistem M7** · check-out lewat tengah malam ditulis **apa adanya** · karyawan yang dapat sheet **ikut cakupan `Ringkasan`**, bukan semua karyawan aktif. Ini murni tambahan tampilan: tidak menambah kolom sheet yang ada (`Detail Harian` tetap **13 kolom**), tidak menambah syarat ekspor (BR-R2 tetap tiga), dan tidak mengubah endpoint mana pun. |
| K-69 | **Palet B "Biru Operasional" + tipografi Opsi 1 (tetap `system-ui`).** Dipilih pemilik 2026-10-15 dari 4 opsi UI-8 Fase A. Primer biru (hue 255, jauh dari badge merah 25 / amber 70-90 / hijau 155); `--secondary`/`--muted`/`--accent` yang tadinya kembar identik dipecah jadi tiga lightness berbeda; `--card` dipisah dari `--background`. `--destructive` dan seluruh `--badge-*` **tidak berubah**. Tanpa webfont: hierarki judul dibangun lewat skala (ukuran/berat), bukan family — `--font-heading` didefinisikan eksplisit sebagai stack sistem yang sama dengan body, dan tiga komponen judul bersama (`CardTitle`, judul Dialog, judul Sheet) plus `JudulHalaman` dinaikkan satu tingkat. Ini fondasi (Fase B1): token + komponen bersama saja, tanpa mengubah tata letak halaman mana pun. |

> **Catatan K-67 (apa yang TIDAK diputuskan).** Tiga hal sengaja dibiarkan terbuka dan
> **tidak boleh diisi sendiri oleh agen**:
>
> 1. **Jumlah item navigasi bawah tidak boleh bertambah** tanpa keputusan baru. K-67 mengunci
>    dua item, bukan "sedikit item".
> 2. **Status tab di URL** (deep linking) tidak diputuskan. Sekarang state lokal, sama seperti
>    sebelum K-67.
> 3. **Navigasi bawah di halaman admin** tidak diputuskan. Admin tetap desktop-first; yang punya
>    navigasi di layar sempit hari ini adalah drawer sidebar yang sudah ada.
>
> Batas yang bisa dibuktikan tes untuk navigasi bawah ada di `rules/OPEN_QUESTIONS.md` **B-23**:
> `renderToStaticMarkup` tidak punya CSS, viewport, maupun keyboard virtual, jadi posisi
> melekat, perilaku keyboard, dan safe-area **hanya bisa dicek manual di browser**.

> **Catatan K-68 (apa yang TIDAK diputuskan).** Empat hal sengaja dibiarkan terbuka dan
> **tidak boleh diisi sendiri oleh agen**:
>
> 1. **Slot jadwal tidak ditampilkan** di sel kalender — hanya jam check-in/check-out. Menambahnya
>    berarti keputusan baru.
> 2. **Catatan penandaan** (`ketidakhadiran.catatan`) tidak ikut di sel; yang tampil hanya teks
>    "Izin" / "Tanpa Keterangan". Detail lengkapnya tetap ada di `Detail Harian`.
> 3. **Nama toko** tidak ditampilkan di dalam sel. Nama toko hanya muncul di baris judul sheet. Kalau
>    karyawan berpindah toko di tengah periode, sel kalender **tidak** memberi tahu hari mana yang
>    di toko mana.
> 4. **Halaman kalender di UI** tidak ada. K-68 hanya mengubah isi file yang diunduh, bukan
>    pratinjau di `/admin/rekap` (pratinjau tetap tabel `Ringkasan`).

> **Catatan K-58 (konsekuensi yang sudah disadari pemilik).** Karena penerima dihitung ulang,
> memindahkan karyawan (BR-P2) setelah agenda dibuat **berpengaruh pada agenda**: karyawan yang
> dipindah ke toko lain **lepas** dari agenda toko itu, dan karyawan yang baru masuk ke toko itu
> **langsung mendapat** agenda yang belum dikerjakan. Ini berbeda dari snapshot BR-A12/BR-P4 yang
> dipakai absensi, dan disengaja. Konsekuensi kedua: rekap agenda pada periode yang sama bisa
> berisi penerima berbeda tergantung kapan file dibuat. Keduanya disengaja — jangan
> "diperbaiki" menjadi snapshot tanpa keputusan baru.

> **Catatan K-63 (K-13 berubah).** K-13 semula hanya menyebut event `MENUNGGU` dan check-in
> terbuka. K-63 menambah syarat ketiga: laporan agenda `MENUNGGU` pada rentang+toko yang sama.
> Keputusan "agenda ditugaskan tapi belum dikerjakan" **sengaja tidak** memblokir ekspor,
> diperlakukan seperti K-33 (peringatan saja) — alasannya, agenda tanpa tanggal target bisa
> menggantung ekspor selamanya.

> **Catatan K-66 (tiga konsekuensi yang sudah disadari pemilik).**
> 1. **Keterangan tidak pernah jadi syarat.** Kosong, hanya spasi, atau tidak diisi sama sekali
>    semuanya diterima. Aturan yang memblokir absen (BR-A9, BR-A5, BR-A10, foto, kuota) **tidak
>    pernah** membaca kolom ini. Keterangan juga **tidak boleh** dipakai admin sebagai alasan
>    menyetujui/menolak — keputusan verifikasi tetap murni dari aturan.
> 2. **Ditempatkan di modal hasil foto** (bukan di halaman utama), jadi teksnya terikat pada
>    foto yang sedang dikirim. Konsekuensi yang disadari: isi modal harus muat di HP kecil —
>    karena itu foto dibatasi tinggi dan modal diberi batas tinggi + scroll. Selain itu, saat
>    kirim **gagal** teks **tidak ikut terhapus** (alasan tidak berubah antarpercobaan), tapi
>    setelah kirim **berhasil** teks **wajib** dibersihkan supaya tidak diam-diam ikut ke
>    absen berikutnya.
> 3. **Tidak bisa diubah setelah terkirim.** Satu jalur ubah saja: koreksi admin, dan itu lewat
>    `alasan_koreksi` yang terpisah — bukan dengan menulis ulang `keterangan`.

## B. Usulan teknis (disetujui — K-40)

Seluruh butir berikut **disetujui eksplisit** oleh pemilik. Status `[USULAN]` dihapus di dokumen
`01`–`05`; butir ini kini setara keputusan dan boleh diimplementasikan.

- TypeScript strict, `zod` untuk validasi, migrasi berupa file `.sql` bernomor + skrip runner.
- Primary key `INTEGER AUTOINCREMENT`; tanggal `TEXT YYYY-MM-DD` (WIB); waktu `TEXT` ISO 8601 dengan offset `+07:00`.
- Sesi admin di database (bisa dicabut), password di-hash dengan `scrypt` bawaan Node, pembatasan percobaan login via tabel `percobaan_login`.
- Idempotensi absen dengan `request_id`; foto dikompres di sisi klien; foto ditampilkan ke admin lewat proxy server.
- Tabel `log_ekspor` untuk penguncian periode; ekspor Excel dengan `exceljs`.
- Struktur `src/` di `03` §4; route Node.js runtime (bukan Edge) untuk route yang memakai `crypto`, Telegram, dan Excel.
- Konvensi UI di `05-ui-ux-rules.md`.

## C. Belum diputuskan

**Tidak ada.** B-01 s.d. B-12 sudah dijawab pemilik dan tercatat di bagian A sebagai K-27 s.d. K-38.
Saat ini `B-13` (timezone), `B-14` (Next.js versi), dan `B-15` (`sekarangWIB()`) sudah ditangani bersamaan
perbaikan M0 dan tercatat di bagian A sebagai `K-44` dan `K-45`. Bila muncul pertanyaan baru (mis. sebelum M3),
buat di `rules/OPEN_QUESTIONS.md` dengan ID `B-18` seterusnya — B-01 s.d. B-17 sudah tertutup.

## D. Risiko yang diketahui (untuk diketahui pemilik, bukan keputusan)

1. **Link bocor = absen atas nama karyawan.** Mitigasi yang ada: foto + koordinat sebagai bukti, verifikasi admin, link bisa dicabut.
2. **Foto "kamera langsung" tidak bisa dijamin 100%** di web. Desain memakai `getUserMedia` (tanpa input file), tetapi tidak ada jaminan absolut terhadap manipulasi perangkat.
3. **Telegram menjadi titik gagal tunggal** dan penyimpanan permanen bergantung pada grup + bot. Jika grup dihapus atau bot dicabut, foto tidak dapat diakses. Kepemilikan grup dan bot sebaiknya dipegang akun yang stabil.
4. **Detail API Telegram dan batas ukuran request Vercel belum diverifikasi** di dokumen ini. Verifikasi ke dokumentasi resmi sebelum implementasi (lihat `03-system-design.md`).
5. **Foto wajah adalah data pribadi** yang disimpan permanen. Disarankan karyawan diberi tahu.
6. Mengubah ambang terlambat memengaruhi tanda "terlambat (sistem)" pada data lama karena dihitung ulang saat ditampilkan. Angka final admin tidak berubah.
7. **Zona waktu tunggal (K-51).** Aplikasi hanya mendukung WIB dan tidak
   menyediakan konversi. Jika suatu saat ada karyawan di luar WIB (WITA/WIT), seluruh asumsi
   di `rules/02` §2 dan `rules/04` §1 harus ditinjau ulang — ini perubahan besar, bukan
   penyesuaian kecil.
