/**
 * Repo absensi karyawan (M3). SQL berparameter, tanpa ORM.
 * Executor-aware agar dipakai di dalam transaksi (validasi ulang + INSERT).
 */
import type { Executor } from '../audit';

export interface EventAbsensi {
  id: number;
  request_id: string | null;
  karyawan_id: number;
  toko_id: number;
  tanggal: string;
  jenis: 'CHECKIN' | 'CHECKOUT';
  checkin_id: number | null;
  waktu: string;
  sumber: string;
  foto_file_id: string | null;
  foto_chat_id: string | null;
  foto_message_id: number | null;
  lat: number | null;
  lng: number | null;
  lokasi_status: string;
  status: string;
  alasan_tolak: string | null;
  dibuat_at: string;
}

const KOLOM_EVENT =
  'id, request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, ' +
  'foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status, status, alasan_tolak, dibuat_at';

/**
 * BR-A1. Resolve token link aktif milik karyawan berstatus aktif.
 * Mengembalikan null untuk SEMUA penyebab gagal (token salah, dicabut,
 * karyawan nonaktif) — pemanggil wajib memakai pesan generik yang sama.
 */
export async function resolveLinkAktif(
  token: string,
  ex: Executor,
): Promise<{ karyawan_id: number; nama: string } | null> {
  const res = await ex.execute({
    sql: 'SELECT k.id AS karyawan_id, k.nama AS nama FROM karyawan_link l JOIN karyawan k ON k.id = l.karyawan_id WHERE l.token = ? AND l.dicabut_at IS NULL AND k.aktif = 1',
    args: [token],
  });
  const baris = res.rows[0] as unknown as { karyawan_id: number; nama: string } | undefined;
  return baris ?? null;
}

/**
 * Check-in terbuka yang masih dalam batas 20 jam (BR-A5a, BR-A6).
 * `waktuTertuaISO` = waktu check-in tertua yang masih berlaku, dihitung
 * pemanggil lewat geserJamISO(sekarang, -20). Perbandingan string ISO sah
 * karena offset seragam (rules/04 §5). Urut terbaru dulu.
 */
export async function checkInTerbuka(
  karyawanId: number,
  waktuTertuaISO: string,
  ex: Executor,
): Promise<EventAbsensi[]> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_EVENT} FROM absensi ci WHERE ci.karyawan_id = ? AND ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK' AND ci.waktu >= ? AND NOT EXISTS (SELECT 1 FROM absensi co WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK') ORDER BY ci.waktu DESC`,
    args: [karyawanId, waktuTertuaISO],
  });
  return res.rows as unknown as EventAbsensi[];
}

/** Varian tanpa batas 20 jam — untuk admin dan untuk pesan yang tepat (BR-A10). */
export async function checkInTerbukaTanpaBatas(karyawanId: number, ex: Executor): Promise<EventAbsensi[]> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_EVENT} FROM absensi ci WHERE ci.karyawan_id = ? AND ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK' AND NOT EXISTS (SELECT 1 FROM absensi co WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK') ORDER BY ci.waktu DESC`,
    args: [karyawanId],
  });
  return res.rows as unknown as EventAbsensi[];
}

/** Jumlah check-in aktif pada tanggal — kuota BR-A5b. */
export async function jumlahCheckInAktifPadaTanggal(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<number> {
  const res = await ex.execute({
    sql: "SELECT COUNT(*) AS c FROM absensi WHERE karyawan_id = ? AND tanggal = ? AND jenis = 'CHECKIN' AND status <> 'DITOLAK'",
    args: [karyawanId, tanggal],
  });
  return Number((res.rows[0] as Record<string, unknown>)['c']);
}

/** Nomor urut N sebuah check-in — acuan slot K-28 (query rules/04 §5). */
export async function hitungN(checkinId: number, ex: Executor): Promise<number> {
  const res = await ex.execute({
    sql: "SELECT COUNT(*) AS n FROM absensi x, absensi c WHERE c.id = ? AND x.karyawan_id = c.karyawan_id AND x.tanggal = c.tanggal AND x.jenis = 'CHECKIN' AND x.status <> 'DITOLAK' AND (x.waktu < c.waktu OR (x.waktu = c.waktu AND x.id <= c.id))",
    args: [checkinId],
  });
  return Number((res.rows[0] as Record<string, unknown>)['n']);
}

/** BR-A11: kembalikan event bila request_id sudah pernah dipakai. */
export async function eventDariRequestId(requestId: string, ex: Executor): Promise<EventAbsensi | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_EVENT} FROM absensi WHERE request_id = ?`,
    args: [requestId],
  });
  const baris = res.rows[0] as unknown as EventAbsensi | undefined;
  return baris ?? null;
}

export interface DataEventBaru {
  request_id: string;
  karyawan_id: number;
  toko_id: number;
  tanggal: string;
  jenis: 'CHECKIN' | 'CHECKOUT';
  checkin_id: number | null;
  waktu: string;
  foto_file_id: string;
  foto_chat_id: string;
  foto_message_id: number;
  lat: number | null;
  lng: number | null;
  lokasi_status: string;
}

export async function insertEvent(data: DataEventBaru, dibuatAt: string, ex: Executor): Promise<number> {
  await ex.execute({
    sql: "INSERT INTO absensi (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status, status, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'KARYAWAN', ?, ?, ?, ?, ?, ?, 'MENUNGGU', ?)",
    args: [
      data.request_id,
      data.karyawan_id,
      data.toko_id,
      data.tanggal,
      data.jenis,
      data.checkin_id,
      data.waktu,
      data.foto_file_id,
      data.foto_chat_id,
      data.foto_message_id,
      data.lat,
      data.lng,
      data.lokasi_status,
      dibuatAt,
    ],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['id']);
}

/** BR-A9: penandaan tidak berangkat pada tanggal itu, bila ada. */
export async function penandaanPadaTanggal(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<{ id: number; jenis: string } | null> {
  const res = await ex.execute({
    sql: 'SELECT id, jenis FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?',
    args: [karyawanId, tanggal],
  });
  const baris = res.rows[0] as unknown as { id: number; jenis: string } | undefined;
  return baris ?? null;
}

/** BR-A12: toko penempatan pada tanggal (semua rentang untuk snapshot). */
export async function riwayatPenempatanUntukTanggal(
  karyawanId: number,
  ex: Executor,
): Promise<{ toko_id: number; mulai: string; sampai: string | null }[]> {
  const res = await ex.execute({
    sql: 'SELECT toko_id, berlaku_mulai AS mulai, berlaku_sampai AS sampai FROM karyawan_penempatan WHERE karyawan_id = ? ORDER BY berlaku_mulai ASC',
    args: [karyawanId],
  });
  return res.rows as unknown as { toko_id: number; mulai: string; sampai: string | null }[];
}

/** Satu event berdasar id — untuk proxy foto admin. */
export async function absensiById(id: number, ex: Executor): Promise<EventAbsensi | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_EVENT} FROM absensi WHERE id = ?`,
    args: [id],
  });
  const baris = res.rows[0] as unknown as EventAbsensi | undefined;
  return baris ?? null;
}

/** Riwayat event karyawan pada satu tanggal — untuk halaman dan info. */
export async function eventPadaTanggal(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<EventAbsensi[]> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_EVENT} FROM absensi WHERE karyawan_id = ? AND tanggal = ? ORDER BY waktu ASC, id ASC`,
    args: [karyawanId, tanggal],
  });
  return res.rows as unknown as EventAbsensi[];
}

export interface JadwalHariIni {
  is_override: number;
  slot: { nama: string; jam_mulai: string; jam_selesai: string }[];
}

/** Jadwal karyawan pada tanggal + slotnya — hanya-baca untuk halaman absen. */
export async function jadwalPadaTanggal(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<JadwalHariIni | null> {
  const res = await ex.execute({
    sql: 'SELECT id, is_override FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
    args: [karyawanId, tanggal],
  });
  const jadwal = res.rows[0] as unknown as { id: number; is_override: number } | undefined;
  if (!jadwal) return null;
  const slot = await ex.execute({
    sql: 'SELECT nama, jam_mulai, jam_selesai FROM jadwal_slot WHERE jadwal_id = ? ORDER BY urutan ASC',
    args: [jadwal.id],
  });
  return {
    is_override: jadwal.is_override,
    slot: slot.rows as unknown as { nama: string; jam_mulai: string; jam_selesai: string }[],
  };
}
