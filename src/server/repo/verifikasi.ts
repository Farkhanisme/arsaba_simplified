/**
 * Repo verifikasi absensi (M4). SQL berparameter, tanpa ORM.
 * Filter dinamis disusun dari FRAGMEN STATIS yang digabung ' AND ' —
 * input pengguna hanya masuk `args`, tidak pernah ke string SQL.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB, menitDalamHari } from '../waktu';
import { pilihSlot, hitungN, hitungSelisih } from '../aturan/keterlambatan';
import { bolehUbahKeputusan, sudahDiekspor, type PeranAdmin } from '../aturan/absensi';
import { bacaAmbang } from './pengaturan';
import { jadwalPadaTanggal, type JadwalHariIni } from './absensi';

export interface FilterEvent {
  status?: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  tokoId?: number;
  dari?: string; // YYYY-MM-DD inklusif
  sampai?: string; // YYYY-MM-DD inklusif
  karyawanId?: number;
  jenis?: 'CHECKIN' | 'CHECKOUT';
  belumCheckout?: boolean; // chip "check-in belum check-out"
}

export interface BarisEvent {
  id: number;
  request_id: string | null;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggal: string;
  jenis: 'CHECKIN' | 'CHECKOUT';
  checkin_id: number | null;
  waktu: string;
  sumber: string;
  foto_file_id: string | null;
  lat: number | null;
  lng: number | null;
  lokasi_status: string;
  status: string;
  alasan_tolak: string | null;
  keterlambatan_final_menit: number | null;
  alasan_koreksi: string | null;
}

const KOLOM_DAFTAR =
  'a.id, a.request_id, a.karyawan_id, k.nama AS karyawan_nama, a.toko_id, t.nama AS toko_nama, ' +
  'a.tanggal, a.jenis, a.checkin_id, a.waktu, a.sumber, a.foto_file_id, a.lat, a.lng, ' +
  'a.lokasi_status, a.status, a.alasan_tolak, a.keterlambatan_final_menit, a.alasan_koreksi';

export async function daftarEvent(filter: FilterEvent, ex: Executor): Promise<BarisEvent[]> {
  const syarat: string[] = [];
  const args: (string | number)[] = [];
  // Default: antrean MENUNGGU (rules/05 §5.3).
  syarat.push('a.status = ?');
  args.push(filter.status ?? 'MENUNGGU');
  if (filter.tokoId !== undefined) {
    syarat.push('a.toko_id = ?');
    args.push(filter.tokoId);
  }
  if (filter.dari !== undefined) {
    syarat.push('a.tanggal >= ?');
    args.push(filter.dari);
  }
  if (filter.sampai !== undefined) {
    syarat.push('a.tanggal <= ?');
    args.push(filter.sampai);
  }
  if (filter.karyawanId !== undefined) {
    syarat.push('a.karyawan_id = ?');
    args.push(filter.karyawanId);
  }
  if (filter.jenis !== undefined) {
    syarat.push('a.jenis = ?');
    args.push(filter.jenis);
  }
  if (filter.belumCheckout === true) {
    syarat.push("a.jenis = 'CHECKIN'");
    syarat.push('NOT EXISTS (SELECT 1 FROM absensi co WHERE co.checkin_id = a.id AND co.jenis = \'CHECKOUT\' AND co.status <> \'DITOLAK\')');
  }
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_DAFTAR} FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id JOIN toko t ON t.id = a.toko_id WHERE ${syarat.join(' AND ')} ORDER BY a.waktu ASC, a.id ASC`,
    args,
  });
  return res.rows as unknown as BarisEvent[];
}

/** Semua CHECKIN pada tanggal (semua status) — bahan hitungN agar BR-L1 terbukti. */
export async function checkinUntukHitungN(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<{ id: number; waktu: string; jenis: string; status: string }[]> {
  const res = await ex.execute({
    sql: "SELECT id, waktu, jenis, status FROM absensi WHERE karyawan_id = ? AND tanggal = ? AND jenis = 'CHECKIN' ORDER BY waktu ASC, id ASC",
    args: [karyawanId, tanggal],
  });
  return res.rows as unknown as { id: number; waktu: string; jenis: string; status: string }[];
}

/** BR-V6: memeriksa ulang satu-check-out-aktif-per-check-in saat mengaktifkan. */
export async function adaCheckoutAktifLain(
  checkinId: number,
  kecualiId: number | null,
  ex: Executor,
): Promise<boolean> {
  const res =
    kecualiId === null
      ? await ex.execute({
          sql: "SELECT 1 FROM absensi WHERE checkin_id = ? AND jenis = 'CHECKOUT' AND status <> 'DITOLAK' LIMIT 1",
          args: [checkinId],
        })
      : await ex.execute({
          sql: "SELECT 1 FROM absensi WHERE checkin_id = ? AND jenis = 'CHECKOUT' AND status <> 'DITOLAK' AND id <> ? LIMIT 1",
          args: [checkinId, kecualiId],
        });
  return res.rows.length > 0;
}

export async function detailEvent(eventId: number, ex: Executor): Promise<BarisEvent | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_DAFTAR} FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id JOIN toko t ON t.id = a.toko_id WHERE a.id = ?`,
    args: [eventId],
  });
  const baris = res.rows[0] as unknown as BarisEvent | undefined;
  return baris ?? null;
}

/** Jadwal + snapshot slot pada tanggal absensi itu (acuan selisih). */
export async function slotUntuk(
  karyawanId: number,
  tanggal: string,
  ex: Executor,
): Promise<JadwalHariIni | null> {
  return jadwalPadaTanggal(karyawanId, tanggal, ex);
}

export interface Pasangan {
  checkin_id: number;
  checkin_status: string;
  checkout_id: number | null;
  checkout_status: string | null;
}

/**
 * Pasangan check-in + check-out aktif pada tanggal — bahan BR-H1/H2.
 * Check-out dari check-in DITOLAK tidak ikut (BR-V5: berdiri sendiri).
 */
export async function daftarPasangan(karyawanId: number, tanggal: string, ex: Executor): Promise<Pasangan[]> {
  const res = await ex.execute({
    sql: `SELECT ci.id AS checkin_id, ci.status AS checkin_status, co.id AS checkout_id, co.status AS checkout_status
      FROM absensi ci LEFT JOIN absensi co ON co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK'
      WHERE ci.karyawan_id = ? AND ci.tanggal = ? AND ci.jenis = 'CHECKIN' AND ci.status <> 'DITOLAK'
      ORDER BY ci.waktu ASC, ci.id ASC`,
    args: [karyawanId, tanggal],
  });
  return res.rows as unknown as Pasangan[];
}

/** BR-H1: pasangan valid = check-in DAN check-out sama-sama DISETUJUI. */
export function adalahPasanganValid(p: Pasangan): boolean {
  return p.checkin_status === 'DISETUJUI' && p.checkout_status === 'DISETUJUI';
}

export class GalatVerifikasi extends Error {
  constructor(
    public readonly status: number,
    public readonly kode: string,
    message: string,
  ) {
    super(message);
    this.name = 'GalatVerifikasi';
  }
}

export interface InputKeputusan {
  keputusan: 'DISETUJUI' | 'DITOLAK';
  alasan_tolak?: string;
  keterlambatan_final_menit?: number;
}

/**
 * Menerapkan satu keputusan verifikasi (BR-V2..V7) DI DALAM transaksi pemanggil.
 * Memeriksa: alasan tolak wajib, K-32/K-36 periode terekspor, BR-V7 final wajib
 * untuk check-in terlambat, K-54 rentang 0–1440, BR-V6 constraint check-out.
 * Mencatat audit dengan SEBELUM dan SESUDAH.
 */
export async function terapkanKeputusan(
  eventId: number,
  input: InputKeputusan,
  pelaku: { id: number; peran: PeranAdmin },
  ex: Executor,
): Promise<BarisEvent> {
  const sebelum = await detailEvent(eventId, ex);
  if (!sebelum) throw new GalatVerifikasi(404, 'TIDAK_DITEMUKAN', 'Absensi tidak ditemukan.');

  if (input.keputusan === 'DITOLAK') {
    if (!input.alasan_tolak || input.alasan_tolak.trim().length === 0) {
      throw new GalatVerifikasi(400, 'ALASAN_WAJIB', 'Alasan penolakan wajib diisi.');
    }
  }

  const diekspor = await sudahDiekspor(sebelum.tanggal, sebelum.toko_id, ex);
  const cek = bolehUbahKeputusan(diekspor, pelaku.peran);
  if (!cek.boleh) throw new GalatVerifikasi(403, 'PERIODE_TEREKSPOR', cek.alasan);

  let final: number | null = sebelum.keterlambatan_final_menit;

  if (input.keputusan === 'DISETUJUI' && sebelum.jenis === 'CHECKIN') {
    // Hitung tanda terlambat sistem dari jadwal snapshot (BR-L1..L4, K-28).
    const ambang = await bacaAmbang(ex);
    const semua = await checkinUntukHitungN(sebelum.karyawan_id, sebelum.tanggal, ex);
    const n = hitungN(semua, sebelum.id);
    const jadwal = await jadwalPadaTanggal(sebelum.karyawan_id, sebelum.tanggal, ex);
    const slot = pilihSlot(jadwal ? jadwal.slot : [], n);
    const { terlambatSistem } = hitungSelisih(menitDalamHari(sebelum.waktu), slot, ambang);
    if (terlambatSistem && input.keterlambatan_final_menit === undefined) {
      throw new GalatVerifikasi(400, 'FINAL_WAJIB', 'Menit terlambat final wajib diisi untuk check-in yang terlambat.');
    }
    if (input.keterlambatan_final_menit !== undefined) {
      final = input.keterlambatan_final_menit;
    }
  }

  if (input.keterlambatan_final_menit !== undefined) {
    const m = input.keterlambatan_final_menit;
    if (!Number.isInteger(m) || m < 0 || m > 1440) {
      throw new GalatVerifikasi(400, 'FINAL_TIDAK_VALID', 'Menit terlambat harus antara 0 dan 1440.');
    }
  }

  if (input.keputusan === 'DISETUJUI' && sebelum.jenis === 'CHECKOUT' && sebelum.checkin_id !== null) {
    // BR-V6: periksa ulang satu check-out aktif per check-in.
    if (await adaCheckoutAktifLain(sebelum.checkin_id, sebelum.id, ex)) {
      throw new GalatVerifikasi(409, 'SUDAH_ADA_CHECKOUT', 'Check-in ini sudah memiliki check-out.');
    }
  }

  const waktu = serialisasiWIB();
  await ex.execute({
    sql: 'UPDATE absensi SET status = ?, alasan_tolak = ?, keterlambatan_final_menit = ?, diverifikasi_oleh = ?, diverifikasi_at = ? WHERE id = ?',
    args: [
      input.keputusan,
      input.keputusan === 'DITOLAK' ? input.alasan_tolak!.trim() : null,
      sebelum.jenis === 'CHECKIN' ? final : null,
      pelaku.id,
      waktu,
      eventId,
    ],
  });
  const sesudah = (await detailEvent(eventId, ex))!;
  await catatAudit(
    {
      waktu,
      pengguna_id: pelaku.id,
      aksi: 'VERIFIKASI',
      entitas: 'absensi',
      entitas_id: eventId,
      sebelum: JSON.stringify({ status: sebelum.status, keterlambatan_final_menit: sebelum.keterlambatan_final_menit }),
      sesudah: JSON.stringify({ status: sesudah.status, keterlambatan_final_menit: sesudah.keterlambatan_final_menit }),
      catatan: `${input.keputusan} oleh ${pelaku.peran}`,
    },
    ex,
  );
  return sesudah;
}
