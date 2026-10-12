-- 0002_agenda.sql — Fitur Agenda (K-57 s.d. K-65, rules/02 §18).
--
-- File ini MAJU SAJA. 0001_init.sql tidak diubah sama sekali (md5 466a7b1a…).
--
-- Tiga keputusan skema yang disengaja dan tidak boleh "diperbaiki" tanpa keputusan baru:
--   1. Penerima agenda TIDAK dibekukan untuk cakupan TOKO/SEMUA. Hanya KARYAWAN memakai
--      agenda_tujuan. Resolusi penerima = fungsi murni penerimaAgenda() terhadap penempatan
--      SAAT INI (BR-G2, K-58). Karena itu tabel agenda sengaja tidak punya kolom snapshot.
--   2. toko_id snapshot ada di agenda_laporan (toko karyawan saat submit), bukan di agenda.
--   3. Dua foto per laporan (before + after), masing-masing tripel Telegram seperti absensi.

CREATE TABLE agenda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judul TEXT NOT NULL CHECK (length(trim(judul)) > 0),
  keterangan TEXT,
  wajib_foto INTEGER NOT NULL DEFAULT 1 CHECK (wajib_foto IN (0,1)),
  cakupan TEXT NOT NULL CHECK (cakupan IN ('KARYAWAN','TOKO','SEMUA')),
  toko_id INTEGER REFERENCES toko(id),
  target_tanggal TEXT CHECK (target_tanggal IS NULL OR target_tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','DIBATALKAN')),
  alasan_batal TEXT,
  dibatalkan_at TEXT,
  dibatalkan_oleh INTEGER REFERENCES pengguna_admin(id),
  dibuat_oleh INTEGER REFERENCES pengguna_admin(id),
  dibuat_oleh_karyawan INTEGER REFERENCES karyawan(id),
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT,
  -- Tepat satu pembuat: admin ATAU karyawan (BR-G3). Tanpa ini, agenda tanpa pemilik bisa
  -- dibuat dan tidak pernah bisa diaudit.
  CHECK ((dibuat_oleh IS NOT NULL) <> (dibuat_oleh_karyawan IS NOT NULL)),
  CHECK (cakupan <> 'TOKO' OR toko_id IS NOT NULL),
  CHECK (status <> 'DIBATALKAN' OR (
    alasan_batal IS NOT NULL AND length(trim(alasan_batal)) > 0
    AND dibatalkan_at IS NOT NULL AND dibatalkan_oleh IS NOT NULL))
);
CREATE INDEX idx_agenda_status ON agenda(status, dibuat_at);
CREATE INDEX idx_agenda_toko ON agenda(toko_id);
CREATE INDEX idx_agenda_dibuat_karyawan ON agenda(dibuat_oleh_karyawan);

-- Hanya dipakai untuk cakupan KARYAWAN. Cakupan TOKO/SEMUA sengaja TIDAK punya baris:
-- penerima keduanya berasal dari penempatan saat ini (BR-G2).
CREATE TABLE agenda_tujuan (
  agenda_id INTEGER NOT NULL REFERENCES agenda(id),
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  dibuat_at TEXT NOT NULL,
  PRIMARY KEY (agenda_id, karyawan_id)
);
CREATE INDEX idx_agenda_tujuan_karyawan ON agenda_tujuan(karyawan_id);

CREATE TABLE agenda_laporan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agenda_id INTEGER NOT NULL REFERENCES agenda(id),
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  toko_id INTEGER REFERENCES toko(id),     -- snapshot saat submit (BR-G14/BR-A12)
  -- Periode laporan = tanggal submit (BR-G14), jadi DRAFT belum mempunyainya:
  -- kolom ini NULL-able dan CHECK di bawah menjaga isinya. Menfilled tanggal saat
  -- draft akan membuat laporan tampil di periode saat draft dibuat, bukan saat
  -- pekerjaan selesai — dan itu bukan yang K-63 tetapkan.
  tanggal TEXT CHECK (tanggal IS NULL OR tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  percobaan INTEGER NOT NULL DEFAULT 1 CHECK (percobaan >= 1),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','MENUNGGU','DISETUJUI','DITOLAK')),
  keterangan TEXT,
  -- Foto BEFORE (draft menyimpannya, BR-G7)
  sebelum_file_id TEXT,
  sebelum_chat_id TEXT,
  sebelum_message_id INTEGER,
  -- Foto AFTER (hanya setelah submit)
  sesudah_file_id TEXT,
  sesudah_chat_id TEXT,
  sesudah_message_id INTEGER,
  dikirim_at TEXT,
  diverifikasi_oleh INTEGER REFERENCES pengguna_admin(id),
  diverifikasi_at TEXT,
  alasan_tolak TEXT,
  request_id TEXT UNIQUE,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT,
  -- CATATAN: "status selain DRAFT wajib punya foto after" TIDAK bisa jadi CHECK di sini,
  -- karena agenda `wajib_foto = 0` (BR-G8) memang tidak punya foto sama sekali.
  -- Aturan itu hanya berlaku untuk agenda wajib foto, dan itu sudah ditegakkan
  -- trigger agenda_laporan_foto_wajib_* di bawah.
  --
  -- Draft belum dikirim: tanggal submit, toko, dan waktu kirim belum diketahui.
  -- Status selain draft wajib punya ketiganya (BR-G14).
  CHECK (status = 'DRAFT' OR (toko_id IS NOT NULL AND tanggal IS NOT NULL AND dikirim_at IS NOT NULL)),
  -- Kebalikan dari CHECK di atas: DRAFT tidak boleh punya tanggal submit, kalau
  -- tidak ia akan ikut masuk rekap/ekspor pada periode saat draft dibuat.
  CHECK (status <> 'DRAFT' OR (tanggal IS NULL AND toko_id IS NULL AND dikirim_at IS NULL)),
  -- Menolak wajib alasan (BR-G11), persis seperti BR-V2 pada absensi.
  CHECK (status <> 'DITOLAK' OR (alasan_tolak IS NOT NULL AND length(trim(alasan_tolak)) > 0)),
  CHECK (diverifikasi_oleh IS NULL = (diverifikasi_at IS NULL))
);
CREATE INDEX idx_laporan_agenda ON agenda_laporan(agenda_id);
CREATE INDEX idx_laporan_karyawan ON agenda_laporan(karyawan_id);
CREATE INDEX idx_laporan_status_tanggal ON agenda_laporan(status, tanggal);
CREATE INDEX idx_laporan_toko_tanggal ON agenda_laporan(toko_id, tanggal);
-- BR-G6: satu karyawan hanya boleh punya SATU laporan aktif per agenda.
-- DITOLAK melepas jatah sehingga percobaan berikutnya boleh dibuat (K-61) — pola yang sama
-- dengan uq_checkout_aktif_per_checkin.
CREATE UNIQUE INDEX uq_laporan_aktif_per_agenda
  ON agenda_laporan(agenda_id, karyawan_id) WHERE status <> 'DITOLAK';

-- ---------------------------------------------------------------------------------------
-- Syarat lintas tabel. CHECK SQLite hanya boleh merujuk satu tabel, jadi tiga syarat berikut
-- WAJIB lewat trigger. Tabel di atas sengaja TIDAK mengulang aturan ini sebagai CHECK.
--
-- JEBakan JANGAN diformat ulang: scripts/migrate.ts memecah file SQL dengan
-- `split(/;\s*$/m)` — satu titik koma di akhir baris = satu statement. Trigger multi-baris
-- karena itu pecah jadi potongan tidak lengkap dan migrasi gagal dengan
-- "SQLITE_ERROR: incomplete input". Trigger di 0001_init.sql karena itu juga satu baris.
-- Setiap trigger di bawah WAJIB tetap satu baris.
-- ---------------------------------------------------------------------------------------

-- Agenda wajib_foto = 1:
--   status DRAFT  -> foto before wajib ada (foto after belum ada, itu wajar)
--   status lain   -> foto before DAN after wajib ada
CREATE TRIGGER agenda_laporan_foto_wajib_insert BEFORE INSERT ON agenda_laporan WHEN (SELECT wajib_foto FROM agenda WHERE id = NEW.agenda_id) = 1 BEGIN SELECT RAISE(ABORT, 'Agenda wajib foto: foto before dan after wajib diisi') WHERE (NEW.status = 'DRAFT' AND NEW.sebelum_file_id IS NULL) OR (NEW.status <> 'DRAFT' AND (NEW.sebelum_file_id IS NULL OR NEW.sesudah_file_id IS NULL)); END;

CREATE TRIGGER agenda_laporan_foto_wajib_update BEFORE UPDATE ON agenda_laporan WHEN (SELECT wajib_foto FROM agenda WHERE id = NEW.agenda_id) = 1 BEGIN SELECT RAISE(ABORT, 'Agenda wajib foto: foto before dan after wajib diisi') WHERE (NEW.status = 'DRAFT' AND NEW.sebelum_file_id IS NULL) OR (NEW.status <> 'DRAFT' AND (NEW.sebelum_file_id IS NULL OR NEW.sesudah_file_id IS NULL)); END;

-- BR-G3: agenda milik karyawan sendiri tidak boleh punya daftar tujuan eksplisit.
-- Di aplikasi hal ini dicegah juga (ubahTujuan menolak), jadi trigger ini pengaman kedua
-- untuk balapan / jalur sisipan lain.
CREATE TRIGGER agenda_tujuan_tolak_agenda_karyawan BEFORE INSERT ON agenda_tujuan WHEN (SELECT dibuat_oleh_karyawan FROM agenda WHERE id = NEW.agenda_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Agenda milik karyawan sendiri tidak boleh punya daftar tujuan'); END;