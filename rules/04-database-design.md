# 04 — Desain Database (Turso / SQLite, tanpa ORM)

Konvensi berikut disetujui pemilik (K-40). Struktur bisnis mengikuti `00` dan `02`.

## 1. Konvensi

| Hal | Aturan |
|---|---|
| Primary key | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| Nama | `snake_case`, Bahasa Indonesia, tabel tunggal |
| Tanggal | `TEXT` format `YYYY-MM-DD` (tanggal WIB) |
| Jam shift | `TEXT` format `HH:MM` |
| Waktu kejadian | `TEXT` ISO 8601 **dengan offset `+07:00`**, mis. `2026-09-30T07:05:12+07:00` |
| Timestamp sistem | `TEXT` ISO 8601 dengan offset `+07:00` |
| Boolean | `INTEGER` 0/1 dengan `CHECK` |
| Hapus | Tidak ada hapus permanen untuk entitas bersejarah (`karyawan`, `toko`, `absensi`, ...); gunakan `aktif`. Pengecualian yang boleh dihapus: `jadwal` (dan slotnya), `ketidakhadiran`, `sesi_admin`; semuanya lewat audit log |
| Foreign key | `PRAGMA foreign_keys = ON` di setiap koneksi (verifikasi lewat tes) |
| Akses | Query berparameter; tanpa ORM |

## 2. DDL

```sql
-- 0001_init.sql

CREATE TABLE schema_migrations (
  versi TEXT PRIMARY KEY,
  diterapkan_at TEXT NOT NULL
);

CREATE TABLE pengguna_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  peran TEXT NOT NULL CHECK (peran IN ('SUPER_ADMIN','ADMIN')),
  aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_at TEXT NOT NULL,
  terakhir_login_at TEXT
);

CREATE TABLE sesi_admin (
  id_hash TEXT PRIMARY KEY,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna_admin(id),
  dibuat_at TEXT NOT NULL,
  kedaluwarsa_at TEXT NOT NULL
);
CREATE INDEX idx_sesi_pengguna ON sesi_admin(pengguna_id);

CREATE TABLE percobaan_login (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT,
  waktu TEXT NOT NULL,
  berhasil INTEGER NOT NULL CHECK (berhasil IN (0,1))
);
CREATE INDEX idx_percobaan_username_waktu ON percobaan_login(username, waktu);

CREATE TABLE toko (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE,
  aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_at TEXT NOT NULL
);

CREATE TABLE karyawan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  nik TEXT UNIQUE,                   -- opsional; unik bila diisi (K-34)
  jabatan TEXT,
  alamat TEXT,
  nomor_hp TEXT,
  kontak_darurat TEXT,
  aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_at TEXT NOT NULL
);

CREATE TABLE karyawan_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  token TEXT NOT NULL UNIQUE,
  dibuat_at TEXT NOT NULL,
  dibuat_oleh INTEGER REFERENCES pengguna_admin(id),
  dicabut_at TEXT
);
-- satu link aktif per karyawan
CREATE UNIQUE INDEX uq_link_aktif ON karyawan_link(karyawan_id) WHERE dicabut_at IS NULL;

CREATE TABLE karyawan_penempatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  toko_id INTEGER NOT NULL REFERENCES toko(id),
  berlaku_mulai TEXT NOT NULL,          -- inklusif
  berlaku_sampai TEXT,                  -- inklusif; NULL = masih berlaku
  CHECK (berlaku_sampai IS NULL OR berlaku_sampai >= berlaku_mulai)
);
-- satu penempatan terbuka per karyawan
CREATE UNIQUE INDEX uq_penempatan_terbuka ON karyawan_penempatan(karyawan_id) WHERE berlaku_sampai IS NULL;
CREATE INDEX idx_penempatan_karyawan ON karyawan_penempatan(karyawan_id, berlaku_mulai);
CREATE INDEX idx_penempatan_toko ON karyawan_penempatan(toko_id, berlaku_mulai);
-- Tumpang tindih rentang penempatan satu karyawan dicegah di aplikasi (dalam transaksi).

CREATE TABLE shift_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toko_id INTEGER NOT NULL REFERENCES toko(id),
  nama TEXT NOT NULL,
  tipe_hari TEXT NOT NULL CHECK (tipe_hari IN ('SEMUA','WEEKDAY','WEEKEND')),
  jam_mulai TEXT NOT NULL CHECK (jam_mulai GLOB '[0-2][0-9]:[0-5][0-9]'),
  jam_selesai TEXT NOT NULL CHECK (jam_selesai GLOB '[0-2][0-9]:[0-5][0-9]'),
  aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
  dibuat_at TEXT NOT NULL,
  CHECK (jam_mulai <> jam_selesai),
  UNIQUE (toko_id, nama, tipe_hari)
);
-- Aplikasi: validasi jam <= 23:59; tolak 'SEMUA' bersamaan dengan 'WEEKDAY'/'WEEKEND' pada nama yang sama.

CREATE TABLE jadwal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  toko_id INTEGER NOT NULL REFERENCES toko(id),
  tanggal TEXT NOT NULL CHECK (tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  shift_template_id INTEGER REFERENCES shift_template(id),
  is_override INTEGER NOT NULL DEFAULT 0 CHECK (is_override IN (0,1)),
  catatan TEXT,
  dibuat_oleh INTEGER NOT NULL REFERENCES pengguna_admin(id),
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT,
  UNIQUE (karyawan_id, tanggal),
  CHECK ((is_override = 1 AND shift_template_id IS NULL)
      OR (is_override = 0 AND shift_template_id IS NOT NULL))
);
CREATE INDEX idx_jadwal_toko_tanggal ON jadwal(toko_id, tanggal);

CREATE TABLE jadwal_slot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jadwal_id INTEGER NOT NULL REFERENCES jadwal(id) ON DELETE CASCADE,
  urutan INTEGER NOT NULL CHECK (urutan >= 1),
  nama TEXT NOT NULL,
  jam_mulai TEXT NOT NULL CHECK (jam_mulai GLOB '[0-2][0-9]:[0-5][0-9]'),
  jam_selesai TEXT NOT NULL CHECK (jam_selesai GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK (jam_mulai <> jam_selesai),
  UNIQUE (jadwal_id, urutan)
);
-- Jadwal berbasis template: 1 slot hasil salinan (snapshot) template.
-- Perubahan khusus (is_override=1): n slot, n dibatasi aplikasi pada maksimal 2 (K-27).

CREATE TABLE absensi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT UNIQUE,                       -- idempotensi; NULL untuk koreksi admin
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  toko_id INTEGER NOT NULL REFERENCES toko(id), -- snapshot penempatan pada tanggal
  tanggal TEXT NOT NULL CHECK (tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  jenis TEXT NOT NULL CHECK (jenis IN ('CHECKIN','CHECKOUT')),
  checkin_id INTEGER REFERENCES absensi(id),    -- hanya untuk CHECKOUT
  waktu TEXT NOT NULL,
  sumber TEXT NOT NULL CHECK (sumber IN ('KARYAWAN','KOREKSI_ADMIN')),
  foto_file_id TEXT,
  foto_chat_id TEXT,
  foto_message_id INTEGER,
  lat REAL,
  lng REAL,
  lokasi_status TEXT NOT NULL CHECK (lokasi_status IN ('TERSEDIA','DITOLAK','GAGAL','TIDAK_ADA')),
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU','DISETUJUI','DITOLAK')),
  alasan_tolak TEXT,
  diverifikasi_oleh INTEGER REFERENCES pengguna_admin(id),
  diverifikasi_at TEXT,
  keterlambatan_final_menit INTEGER CHECK (keterlambatan_final_menit IS NULL OR keterlambatan_final_menit >= 0),
  alasan_koreksi TEXT,
  dikoreksi_oleh INTEGER REFERENCES pengguna_admin(id),
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT,
  CHECK ((jenis = 'CHECKOUT' AND checkin_id IS NOT NULL) OR (jenis = 'CHECKIN' AND checkin_id IS NULL)),
  CHECK (sumber <> 'KARYAWAN' OR (foto_file_id IS NOT NULL AND foto_chat_id IS NOT NULL AND foto_message_id IS NOT NULL)),
  CHECK (sumber <> 'KOREKSI_ADMIN' OR (alasan_koreksi IS NOT NULL AND length(trim(alasan_koreksi)) > 0 AND dikoreksi_oleh IS NOT NULL)),
  CHECK (status <> 'DITOLAK' OR (alasan_tolak IS NOT NULL AND length(trim(alasan_tolak)) > 0)),
  CHECK (jenis = 'CHECKIN' OR keterlambatan_final_menit IS NULL),
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK (lokasi_status <> 'TERSEDIA' OR lat IS NOT NULL)
);
CREATE INDEX idx_absensi_karyawan_tanggal ON absensi(karyawan_id, tanggal);
CREATE INDEX idx_absensi_toko_tanggal ON absensi(toko_id, tanggal);
CREATE INDEX idx_absensi_status_waktu ON absensi(status, waktu);
CREATE INDEX idx_absensi_checkin ON absensi(checkin_id);
-- maksimal satu CHECKOUT aktif per CHECKIN
CREATE UNIQUE INDEX uq_checkout_aktif_per_checkin
  ON absensi(checkin_id) WHERE jenis = 'CHECKOUT' AND status <> 'DITOLAK';

CREATE TABLE ketidakhadiran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  karyawan_id INTEGER NOT NULL REFERENCES karyawan(id),
  toko_id INTEGER NOT NULL REFERENCES toko(id),   -- snapshot
  tanggal TEXT NOT NULL CHECK (tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  jenis TEXT NOT NULL CHECK (jenis IN ('IZIN','TANPA_KETERANGAN')),
  catatan TEXT,
  dibuat_oleh INTEGER NOT NULL REFERENCES pengguna_admin(id),
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT,
  UNIQUE (karyawan_id, tanggal)
);
CREATE INDEX idx_ketidakhadiran_toko_tanggal ON ketidakhadiran(toko_id, tanggal);

CREATE TABLE log_ekspor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna_admin(id),
  waktu TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  toko_id INTEGER REFERENCES toko(id)            -- NULL = semua toko
);

CREATE TABLE pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL,
  diubah_at TEXT NOT NULL,
  diubah_oleh INTEGER REFERENCES pengguna_admin(id)
);
INSERT INTO pengaturan (kunci, nilai, diubah_at) VALUES ('ambang_terlambat_menit','5', '<waktu-seed>');

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT NOT NULL,
  pengguna_id INTEGER REFERENCES pengguna_admin(id),
  aksi TEXT NOT NULL,
  entitas TEXT NOT NULL,
  entitas_id INTEGER,
  sebelum TEXT,        -- JSON
  sesudah TEXT,        -- JSON
  catatan TEXT
);
CREATE INDEX idx_audit_waktu ON audit_log(waktu);
CREATE INDEX idx_audit_entitas ON audit_log(entitas, entitas_id);
CREATE INDEX idx_audit_pengguna ON audit_log(pengguna_id, waktu);

CREATE TRIGGER audit_log_tolak_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log bersifat append-only'); END;
CREATE TRIGGER audit_log_tolak_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log bersifat append-only'); END;
```

> Dukungan trigger, partial index, dan `PRAGMA foreign_keys` pada Turso/libSQL harus diverifikasi saat menjalankan migrasi pertama (lihat `03` §15).

## 3. Diagram relasi (ringkas)

```
toko 1─* shift_template
toko 1─* karyawan_penempatan *─1 karyawan 1─* karyawan_link
karyawan 1─* jadwal 1─* jadwal_slot        (jadwal *─1 toko, jadwal *─0..1 shift_template)
karyawan 1─* absensi *─1 toko              (CHECKOUT.checkin_id → absensi.id)
karyawan 1─* ketidakhadiran
pengguna_admin 1─* sesi_admin / audit_log / log_ekspor
```

## 4. Invarian dan siapa yang menegakkan

| Invarian | Database | Aplikasi |
|---|---|---|
| Satu link aktif per karyawan | `uq_link_aktif` | Transaksi cabut+buat |
| Satu penempatan terbuka per karyawan | `uq_penempatan_terbuka` | Tidak tumpang tindih rentang |
| Satu jadwal per karyawan per tanggal | `UNIQUE(karyawan_id, tanggal)` | Laporan lewati/timpa |
| Satu penandaan per karyawan per tanggal | `UNIQUE` | Blokir jika ada event aktif (BR-X3) |
| Satu check-out aktif per check-in | `uq_checkout_aktif_per_checkin` | Validasi ulang saat ubah status |
| Check-out wajib punya `checkin_id` | `CHECK` | Check-out mewarisi `tanggal` & `toko_id` check-in |
| Tolak wajib alasan | `CHECK` | Pesan validasi |
| Koreksi wajib alasan + pelaku | `CHECK` | Pesan validasi |
| Foto & id Telegram wajib untuk sumber karyawan | `CHECK` | Urutan operasi BR-A4 |
| Maks 2 check-in aktif per karyawan per tanggal | (tidak bisa dengan constraint sederhana) | **Wajib di transaksi** |
| Absen diblokir pada tanggal bertanda tidak berangkat | (tidak bisa dengan constraint sederhana) | **Wajib di transaksi** (BR-A9) |
| Maksimal 2 slot pada perubahan khusus | (tidak bisa dengan constraint sederhana) | Validasi saat simpan (BR-J6) |
| Check-out mandiri hanya dalam 20 jam | (tidak bisa dengan constraint sederhana) | Perhitungan di `server/waktu.ts` (BR-A10) |
| Tidak ada check-in terbuka saat check-in baru | (aplikasi) | **Wajib di transaksi** |
| Karyawan hanya dijadwalkan di toko penempatannya | (aplikasi) | Validasi saat simpan |
| Audit log append-only | Trigger | Tidak ada UPDATE/DELETE di kode |

## 5. Query acuan

Semua berparameter. `?` adalah placeholder.

**Check-in terbuka karyawan — masih dapat di-check-out sendiri (dalam batas 20 jam, BR-A10):**

`batas` = waktu server sekarang dalam ISO `+07:00`. Karena semua waktu memakai offset yang sama,
perbandingan string ISO sama dengan perbandingan kronologis.

```sql
SELECT ci.*
FROM absensi ci
WHERE ci.karyawan_id = ?
  AND ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK'
  AND datetime(ci.waktu, '+20 hours') >= ?     -- parameter: batas
  AND NOT EXISTS (
    SELECT 1 FROM absensi co
    WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK'
  )
ORDER BY ci.waktu DESC;
```

**Check-in terbuka tanpa batas 20 jam — untuk admin (koreksi, rekap, ekspor).** Vari ini hanya
menghapus batas 20 jam; ia tetap menyertakan check-in yang sudah lewat batas agar admin bisa
menutupnya lewat koreksi dan agar ekspor tetap terblokir (BR-R2):

```sql
SELECT ci.*
FROM absensi ci
WHERE ci.karyawan_id = ?
  AND ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK'
  AND NOT EXISTS (
    SELECT 1 FROM absensi co
    WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK'
  )
ORDER BY ci.waktu DESC;
```

**Jumlah check-in aktif pada tanggal (kuota BR-A5):**

```sql
SELECT COUNT(*) FROM absensi
WHERE karyawan_id = ? AND tanggal = ? AND jenis = 'CHECKIN' AND status <> 'DITOLAK';
```

**Hari hadir per karyawan dalam periode (BR-H1, unik per tanggal):**

```sql
SELECT ci.karyawan_id, ci.toko_id, COUNT(DISTINCT ci.tanggal) AS hari_hadir
FROM absensi ci
JOIN absensi co ON co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status = 'DISETUJUI'
WHERE ci.jenis = 'CHECKIN' AND ci.status = 'DISETUJUI'
  AND ci.tanggal BETWEEN ? AND ?
GROUP BY ci.karyawan_id, ci.toko_id;
```

**Pra-syarat ekspor (BR-R2). Keduanya harus bernilai 0:**

```sql
-- (a) event menunggu dalam filter
SELECT COUNT(*) FROM absensi
WHERE status = 'MENUNGGU' AND tanggal BETWEEN ? AND ? AND (? IS NULL OR toko_id = ?);

-- (b) check-in terbuka dalam filter
SELECT COUNT(*) FROM absensi ci
WHERE ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK'
  AND ci.tanggal BETWEEN ? AND ? AND (? IS NULL OR ci.toko_id = ?)
  AND NOT EXISTS (
    SELECT 1 FROM absensi co
    WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK');
```

**Nomor urut N sebuah check-in (untuk memilih slot acuan; string ISO seragam offset):**

```sql
SELECT COUNT(*) FROM absensi x, absensi c
WHERE c.id = ?
  AND x.karyawan_id = c.karyawan_id AND x.tanggal = c.tanggal
  AND x.jenis = 'CHECKIN' AND x.status <> 'DITOLAK'
  AND (x.waktu < c.waktu OR (x.waktu = c.waktu AND x.id <= c.id));
```

Selisih menit dan penentuan slot dihitung di aplikasi (`server/aturan`), bukan di SQL, agar mudah diuji.

## 6. Migrasi

- File `migrations/NNNN_nama.sql`, urut naik, berjalan sekali; versi dicatat di `schema_migrations`.
- Migrasi bersifat maju saja; perubahan skema baru = file baru.
- Isi seed: pengaturan ambang, satu akun Super Admin. Data toko, karyawan, dan shift dimasukkan lewat UI master.

## 7. Catatan volume

26 karyawan × maksimal 2 pasang per hari → kurang dari ~110 event/hari. Indeks di atas sudah memadai; tidak perlu partisi/optimasi tambahan.
