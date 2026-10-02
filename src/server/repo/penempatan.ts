import type { Executor } from '../audit';
import { rencanaPindah, rentangTumpangTindih } from '../aturan/penempatan';

export interface Penempatan {
  id: number;
  karyawan_id: number;
  toko_id: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
}

/** Galat aturan bisnis dengan status HTTP yang sesuai. */
export class GalatAturan extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GalatAturan';
  }
}

export async function penempatanTerbuka(karyawanId: number, ex: Executor): Promise<Penempatan | null> {
  const res = await ex.execute({
    sql: 'SELECT id, karyawan_id, toko_id, berlaku_mulai, berlaku_sampai FROM karyawan_penempatan WHERE karyawan_id = ? AND berlaku_sampai IS NULL',
    args: [karyawanId],
  });
  const baris = res.rows[0] as unknown as Penempatan | undefined;
  return baris ?? null;
}

export async function riwayatPenempatan(karyawanId: number, ex: Executor): Promise<Penempatan[]> {
  const res = await ex.execute({
    sql: 'SELECT id, karyawan_id, toko_id, berlaku_mulai, berlaku_sampai FROM karyawan_penempatan WHERE karyawan_id = ? ORDER BY berlaku_mulai ASC',
    args: [karyawanId],
  });
  return res.rows as unknown as Penempatan[];
}

export async function hitungJadwalDiTokoSejak(
  karyawanId: number,
  tokoId: number,
  tanggal: string,
  ex: Executor,
): Promise<number> {
  const res = await ex.execute({
    sql: 'SELECT COUNT(*) AS c FROM jadwal WHERE karyawan_id = ? AND toko_id = ? AND tanggal >= ?',
    args: [karyawanId, tokoId, tanggal],
  });
  return Number((res.rows[0] as Record<string, unknown>)['c']);
}

async function tokoMasihAktif(tokoId: number, ex: Executor): Promise<boolean> {
  const res = await ex.execute({ sql: 'SELECT aktif FROM toko WHERE id = ?', args: [tokoId] });
  const baris = res.rows[0] as Record<string, unknown> | undefined;
  return baris !== undefined && Number(baris['aktif']) === 1;
}

/**
 * Memindahkan karyawan ke toko tujuan mulai tanggal efektif (BR-P1, BR-P2,
 * BR-P3 + K-35). Dijalankan DI DALAM transaksi oleh pemanggil.
 *
 * Menutup penempatan terbuka (bila ada) dan membuka yang baru. Menolak bila:
 * - karyawan/toko tujuan tidak ada atau toko tujuan nonaktif,
 * - tanggal efektif tidak setelah mulai penempatan berjalan,
 * - rentang baru tumpang tindih dengan riwayat,
 * - masih ada jadwal di toko lama pada/setelah tanggal efektif (K-35).
 */
export async function pindahKaryawan(
  karyawanId: number,
  tokoTujuanId: number,
  tanggalEfektif: string,
  ex: Executor,
): Promise<{ lama: Penempatan | null; baru: Penempatan }> {
  const kry = await ex.execute({ sql: 'SELECT id, aktif FROM karyawan WHERE id = ?', args: [karyawanId] });
  if (kry.rows.length === 0) throw new GalatAturan(404, 'Karyawan tidak ditemukan.');
  if (!(await tokoMasihAktif(tokoTujuanId, ex))) {
    throw new GalatAturan(400, 'Toko tujuan tidak ditemukan atau sudah nonaktif.');
  }

  const terbuka = await penempatanTerbuka(karyawanId, ex);
  if (terbuka && terbuka.toko_id === tokoTujuanId) {
    throw new GalatAturan(400, 'Karyawan sudah ditempatkan di toko ini.');
  }

  const rencana = rencanaPindah(terbuka ? terbuka.berlaku_mulai : null, tanggalEfektif);
  if (!rencana.boleh) throw new GalatAturan(400, rencana.alasan);

  // BR-P2: rentang baru [efektif, ∞) tidak boleh tumpang tindih dengan riwayat.
  const riwayat = await riwayatPenempatan(karyawanId, ex);
  const bentrok = riwayat.some(
    (r) =>
      !(terbuka && r.id === terbuka.id) &&
      rentangTumpangTindih({ mulai: tanggalEfektif, sampai: null }, { mulai: r.berlaku_mulai, sampai: r.berlaku_sampai }),
  );
  if (bentrok) throw new GalatAturan(400, 'Rentang penempatan tumpang tindih dengan riwayat.');

  // BR-P3 + K-35: blokir bila masih ada jadwal di toko lama pada/setelah efektif.
  if (terbuka) {
    const jadwal = await hitungJadwalDiTokoSejak(karyawanId, terbuka.toko_id, tanggalEfektif, ex);
    if (jadwal > 0) {
      throw new GalatAturan(
        409,
        'Karyawan masih memiliki jadwal di toko lama pada/setelah tanggal efektif. Hapus jadwal tersebut terlebih dahulu, lalu ulangi pemindahan.',
      );
    }
    await ex.execute({
      sql: 'UPDATE karyawan_penempatan SET berlaku_sampai = ? WHERE id = ?',
      args: [rencana.tutupSampai, terbuka.id],
    });
  }

  await ex.execute({
    sql: 'INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai, berlaku_sampai) VALUES (?, ?, ?, NULL)',
    args: [karyawanId, tokoTujuanId, tanggalEfektif],
  });
  const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const baruId = Number((idRes.rows[0] as Record<string, unknown>)['id']);

  const baruRes = await ex.execute({
    sql: 'SELECT id, karyawan_id, toko_id, berlaku_mulai, berlaku_sampai FROM karyawan_penempatan WHERE id = ?',
    args: [baruId],
  });
  const lama = terbuka
    ? ({ ...terbuka, berlaku_sampai: rencana.tutupSampai } as Penempatan)
    : null;
  return { lama, baru: baruRes.rows[0] as unknown as Penempatan };
}
