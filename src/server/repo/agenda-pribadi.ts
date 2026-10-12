/**
 * Repo agenda buatan karyawan sendiri (M12), rules/02 BR-G3.
 *
 * Sengaja FILE TERPISA dari `repo/agenda.ts` (admin). Alasannya bukan sekadar
 * keterbatasan waktu: agenda pribadi punya bentuk yang berbeda dan tidak boleh
 * bisa disamarkan sebagai agenda admin.
 *
 *   - Tidak ada `dibuat_oleh` (admin), hanya `dibuat_oleh_karyawan`.
 *   - Tidak ada pilihan `wajib_foto`: agenda pribadi SELALU wajib foto (K-59).
 *   - Tidak ada `cakupan`/`toko_id` yang dipilih: penerima adalah dirinya.
 *   - Tidak ada `target_tanggal`: tidak ada keputusan pemilik yang memberi
 *     karyawan kolom ini, jadi tidak dikarang.
 *   - Tidak ada baris `agenda_tujuan` — trigger database juga melarangnya.
 *
 * Fungsi `denganTransaksiBuatAgenda` dibungkus supaya pemanggil tidak bisa
 * mengaudit SEBELUM insert — yang akan menghasilkan entitas_id yang belum ada.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB } from '../waktu';
import { JUDUL_MAKS, KETERANGAN_MAKS } from '../aturan/agenda';

export interface InputBuatPribadi {
  judul: string;
  keterangan?: string;
  karyawanId: number;
}

/**
 * BR-G3 + K-59: agenda untuk diri sendiri, selalu wajib foto, cakupan KARYAWAN
 * tanpa baris tujuan. Melempar `GalatAgenda` agar pesan seragam dengan repo admin.
 */
export async function buatAgendaPribadi(input: InputBuatPribadi, ex: Executor): Promise<number> {
  const judul = input.judul.trim();
  const keterangan = input.keterangan?.trim() ? input.keterangan.trim() : null;

  if (judul.length === 0) {
    throw new GalatAgendaPribadi(400, 'Judul agenda wajib diisi.');
  }
  if (judul.length > JUDUL_MAKS) {
    throw new GalatAgendaPribadi(400, `Judul maksimal ${JUDUL_MAKS} karakter.`);
  }
  if (keterangan !== null && keterangan.length > KETERANGAN_MAKS) {
    throw new GalatAgendaPribadi(400, `Keterangan maksimal ${KETERANGAN_MAKS} karakter.`);
  }
  const karyawan = await ex.execute({
    sql: 'SELECT id FROM karyawan WHERE id = ? AND aktif = 1',
    args: [input.karyawanId],
  });
  if (karyawan.rows.length === 0) {
    throw new GalatAgendaPribadi(404, 'Karyawan tidak ditemukan atau nonaktif.');
  }

  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: `INSERT INTO agenda (judul, keterangan, wajib_foto, cakupan, dibuat_oleh_karyawan, dibuat_at)
      VALUES (?, ?, 1, 'KARYAWAN', ?, ?)`,
    args: [judul, keterangan, input.karyawanId, sekarang],
  });
  const id = Number(
    ((await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id'],
  );

  // BR-G19: mutasi oleh karyawan ikut tercatat, `pengguna_id` NULL karena ini
  // bukan admin. Entitas tetap 'agenda' supaya bisa dicari di audit log.
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: null,
      aksi: 'AGENDA_PRIBADI_TAMBAH',
      entitas: 'agenda',
      entitas_id: id,
      sesudah: JSON.stringify({ judul, wajib_foto: 1, cakupan: 'KARYAWAN', dibuat_oleh_karyawan: input.karyawanId }),
      catatan: `Agenda pribadi "${judul}" dibuat karyawan`,
    },
    ex,
  );
  return id;
}

/**
 * Alias yang menjelaskan urutan di route: validasi -> INSERT -> audit.
 * Sengaja dibungkus supaya pemanggil tidak bisa mengaudit SEBELUM insert
 * (yang akan menghasilkan entitas_id yang belum ada).
 */
export async function denganTransaksiBuatAgenda(input: InputBuatPribadi, ex: Executor): Promise<number> {
  return buatAgendaPribadi(input, ex);
}

export class GalatAgendaPribadi extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GalatAgendaPribadi';
  }
}