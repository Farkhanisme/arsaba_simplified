/**
 * Repo ketidakhadiran (M6). SQL berparameter, tanpa ORM.
 * Mutasi DI DALAM transaksi pemanggil + catatAudit. Cek BR-X3 di dalam
 * transaksi (bukan hanya sebelumnya). Penolakan sel tidak melempar
 * (klasifikasiPenandaan, pola B-19 opsi A); 403 K-32 FAIL-FAST melempar.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB } from '../waktu';
import { klasifikasiPenandaan, type JenisTidakBerangkat } from '../aturan/ketidakhadiran';
import { tokoPadaTanggal, sudahDiekspor, type PeranAdmin } from '../aturan/absensi';
import { riwayatPenempatanUntukTanggal } from './absensi';
import { GalatAturan } from './penempatan';

export interface Penandaan {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggal: string;
  jenis: JenisTidakBerangkat;
  catatan: string | null;
  dibuat_oleh: number;
  dibuat_at: string;
  diubah_at: string | null;
}

export interface FilterPenandaan {
  tokoId?: number;
  dari?: string;
  sampai?: string;
  karyawanId?: number;
}

const KOLOM =
  't.id, t.karyawan_id, k.nama AS karyawan_nama, t.toko_id, o.nama AS toko_nama, ' +
  't.tanggal, t.jenis, t.catatan, t.dibuat_oleh, t.dibuat_at, t.diubah_at';

export async function daftarPenandaan(filter: FilterPenandaan, ex: Executor): Promise<Penandaan[]> {
  const syarat: string[] = [];
  const args: (string | number)[] = [];
  if (filter.tokoId !== undefined) {
    syarat.push('t.toko_id = ?');
    args.push(filter.tokoId);
  }
  if (filter.dari !== undefined) {
    syarat.push('t.tanggal >= ?');
    args.push(filter.dari);
  }
  if (filter.sampai !== undefined) {
    syarat.push('t.tanggal <= ?');
    args.push(filter.sampai);
  }
  if (filter.karyawanId !== undefined) {
    syarat.push('t.karyawan_id = ?');
    args.push(filter.karyawanId);
  }
  const klausa = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '';
  const res = await ex.execute({
    sql: `SELECT ${KOLOM} FROM ketidakhadiran t JOIN karyawan k ON k.id = t.karyawan_id JOIN toko o ON o.id = t.toko_id ${klausa} ORDER BY t.tanggal ASC, k.nama ASC`,
    args,
  });
  return res.rows as unknown as Penandaan[];
}

export async function penandaanById(id: number, ex: Executor): Promise<Penandaan | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM} FROM ketidakhadiran t JOIN karyawan k ON k.id = t.karyawan_id JOIN toko o ON o.id = t.toko_id WHERE t.id = ?`,
    args: [id],
  });
  const baris = res.rows[0] as unknown as Penandaan | undefined;
  return baris ?? null;
}

/** Status semua event karyawan pada tanggal (bahan BR-X3). */
export async function statusEventPadaTanggal(karyawanId: number, tanggal: string, ex: Executor): Promise<string[]> {
  const res = await ex.execute({
    sql: 'SELECT status FROM absensi WHERE karyawan_id = ? AND tanggal = ?',
    args: [karyawanId, tanggal],
  });
  return res.rows.map((r) => String((r as Record<string, unknown>)['status']));
}

/** K-32 FAIL-FAST: 403 melempar, seluruh operasi gagal (bukan penolakan sel). */
function pastikanBelumDiekspor(peran: PeranAdmin, diekspor: boolean): void {
  if (diekspor && peran !== 'SUPER_ADMIN') {
    throw new GalatAturan(403, 'Periode ini sudah diekspor. Hanya Super Admin yang boleh menandai tidak berangkat.');
  }
}

export interface InputBuat {
  karyawanId: number;
  tokoId: number;
  tanggal: string;
  jenis: JenisTidakBerangkat;
  catatan: string | null;
  dibuatOleh: number;
}

export async function buat(input: InputBuat, ex: Executor): Promise<number> {
  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: 'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, catatan, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [input.karyawanId, input.tokoId, input.tanggal, input.jenis, input.catatan, input.dibuatOleh, sekarang],
  });
  const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: input.dibuatOleh,
      aksi: 'TIDAK_BERANGKAT_TAMBAH',
      entitas: 'ketidakhadiran',
      entitas_id: id,
      sesudah: JSON.stringify({ karyawan_id: input.karyawanId, toko_id: input.tokoId, tanggal: input.tanggal, jenis: input.jenis, catatan: input.catatan }),
      catatan: `Penandaan ${input.jenis} tanggal ${input.tanggal}`,
    },
    ex,
  );
  return id;
}

/** BR-X4: ubah jenis/catatan. */
export async function ubah(
  id: number,
  ubahan: { jenis?: JenisTidakBerangkat; catatan?: string | null },
  pelaku: { id: number; peran: PeranAdmin },
  ex: Executor,
): Promise<Penandaan> {
  const sebelum = await penandaanById(id, ex);
  if (!sebelum) throw new GalatAturan(404, 'Penandaan tidak ditemukan.');
  pastikanBelumDiekspor(pelaku.peran, await sudahDiekspor(sebelum.tanggal, sebelum.toko_id, ex));
  const sekarang = serialisasiWIB();
  const jenis = ubahan.jenis ?? sebelum.jenis;
  const catatan = ubahan.catatan !== undefined ? ubahan.catatan : sebelum.catatan;
  await ex.execute({
    sql: 'UPDATE ketidakhadiran SET jenis = ?, catatan = ?, diubah_at = ? WHERE id = ?',
    args: [jenis, catatan, sekarang, id],
  });
  const sesudah = (await penandaanById(id, ex))!;
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: pelaku.id,
      aksi: 'TIDAK_BERANGKAT_UBAH',
      entitas: 'ketidakhadiran',
      entitas_id: id,
      sebelum: JSON.stringify({ jenis: sebelum.jenis, catatan: sebelum.catatan }),
      sesudah: JSON.stringify({ jenis: sesudah.jenis, catatan: sesudah.catatan }),
      catatan: `Penandaan ${sebelum.tanggal} diubah`,
    },
    ex,
  );
  return sesudah;
}

/** BR-X4: hapus kembali (inilah cara blokir K-31 dibuka). Tanpa cascade. */
export async function hapus(id: number, pelaku: { id: number; peran: PeranAdmin }, ex: Executor): Promise<void> {
  const sebelum = await penandaanById(id, ex);
  if (!sebelum) throw new GalatAturan(404, 'Penandaan tidak ditemukan.');
  pastikanBelumDiekspor(pelaku.peran, await sudahDiekspor(sebelum.tanggal, sebelum.toko_id, ex));
  const sekarang = serialisasiWIB();
  await ex.execute({ sql: 'DELETE FROM ketidakhadiran WHERE id = ?', args: [id] });
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: pelaku.id,
      aksi: 'TIDAK_BERANGKAT_HAPUS',
      entitas: 'ketidakhadiran',
      entitas_id: id,
      sebelum: JSON.stringify({ karyawan_id: sebelum.karyawan_id, tanggal: sebelum.tanggal, jenis: sebelum.jenis, catatan: sebelum.catatan }),
      catatan: `Penandaan ${sebelum.tanggal} dihapus`,
    },
    ex,
  );
}

export interface HasilTandai {
  dibuat: { karyawan_id: number; tanggal: string }[];
  ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
}

/**
 * Keputusan batch bagian 2: sel terblokir DILEWATI + DILAPORKAN, sel lain
 * tersimpan. 403 K-32 FAIL-FAST (melempar, seluruh rollback). Error lain
 * dilempar lagi (fail-safe). Sel ditolak tanpa audit.
 */
export async function terapkanMassal(
  input: { karyawanIds: number[]; jenis: JenisTidakBerangkat; catatan: string | null; pelaku: { id: number; peran: PeranAdmin } },
  tanggalan: string[],
  ex: Executor,
): Promise<HasilTandai> {
  const hasil: HasilTandai = { dibuat: [], ditolak: [] };
  for (const karyawanId of input.karyawanIds) {
    const kry = await ex.execute({ sql: 'SELECT id FROM karyawan WHERE id = ? AND aktif = 1', args: [karyawanId] });
    for (const tanggal of tanggalan) {
      const entri = { karyawan_id: karyawanId, tanggal };
      if (kry.rows.length === 0) {
        hasil.ditolak.push({ ...entri, alasan: 'Karyawan tidak ditemukan atau nonaktif.' });
        continue;
      }
      // Toko snapshot penempatan pada tanggal itu (BR-P4/BR-A12).
      const riwayat = await riwayatPenempatanUntukTanggal(karyawanId, ex);
      const tokoId = tokoPadaTanggal(riwayat, tanggal);
      if (tokoId === null) {
        hasil.ditolak.push({ ...entri, alasan: 'Karyawan tidak ditempatkan di toko mana pun pada tanggal ini.' });
        continue;
      }
      // K-32 FAIL-FAST: bukan penolakan sel.
      pastikanBelumDiekspor(input.pelaku.peran, await sudahDiekspor(tanggal, tokoId, ex));
      try {
        const ada = await ex.execute({
          sql: 'SELECT id FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?',
          args: [karyawanId, tanggal],
        });
        const statusEvent = await statusEventPadaTanggal(karyawanId, tanggal, ex);
        const klas = klasifikasiPenandaan({
          adaPenandaan: ada.rows.length > 0,
          statusEvent,
          tokoId,
        });
        if (klas.status === 'ditolak') {
          hasil.ditolak.push({ ...entri, alasan: klas.alasan ?? 'Sel ditolak.' });
          continue;
        }
        await buat(
          { karyawanId, tokoId, tanggal, jenis: input.jenis, catatan: input.catatan, dibuatOleh: input.pelaku.id },
          ex,
        );
        hasil.dibuat.push(entri);
      } catch (e) {
        if (e instanceof GalatAturan) {
          // Pengaman ganda: UNIQUE DB menahan balapan yang lolos cek aplikasi.
          hasil.ditolak.push({ ...entri, alasan: e.message });
          continue;
        }
        throw e;
      }
    }
  }
  return hasil;
}
