import type { Executor } from '../audit';
import type { TipeHari } from '../aturan/shift';

export interface Shift {
  id: number;
  toko_id: number;
  nama: string;
  tipe_hari: TipeHari;
  jam_mulai: string;
  jam_selesai: string;
  aktif: number;
  dibuat_at: string;
}

export async function daftarShift(tokoId: number | null, ex: Executor): Promise<Shift[]> {
  if (tokoId === null) {
    const res = await ex.execute({
      sql: 'SELECT id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at FROM shift_template ORDER BY toko_id ASC, nama ASC',
      args: [],
    });
    return res.rows as unknown as Shift[];
  }
  const res = await ex.execute({
    sql: 'SELECT id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at FROM shift_template WHERE toko_id = ? ORDER BY nama ASC',
    args: [tokoId],
  });
  return res.rows as unknown as Shift[];
}

export async function shiftById(id: number, ex: Executor): Promise<Shift | null> {
  const res = await ex.execute({
    sql: 'SELECT id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at FROM shift_template WHERE id = ?',
    args: [id],
  });
  const baris = res.rows[0] as unknown as Shift | undefined;
  return baris ?? null;
}

/** Tipe hari yang sudah dipakai nama itu di toko itu (untuk cek BR-J1). */
export async function tipeAdaUntukNama(
  tokoId: number,
  nama: string,
  kecualiId: number | null,
  ex: Executor,
): Promise<TipeHari[]> {
  const res =
    kecualiId === null
      ? await ex.execute({
          sql: 'SELECT tipe_hari FROM shift_template WHERE toko_id = ? AND nama = ?',
          args: [tokoId, nama],
        })
      : await ex.execute({
          sql: 'SELECT tipe_hari FROM shift_template WHERE toko_id = ? AND nama = ? AND id <> ?',
          args: [tokoId, nama, kecualiId],
        });
  return res.rows.map((r) => String((r as Record<string, unknown>)['tipe_hari']) as TipeHari);
}

export async function buatShift(
  data: { toko_id: number; nama: string; tipe_hari: TipeHari; jam_mulai: string; jam_selesai: string },
  dibuatAt: string,
  ex: Executor,
): Promise<number> {
  await ex.execute({
    sql: 'INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    args: [data.toko_id, data.nama, data.tipe_hari, data.jam_mulai, data.jam_selesai, dibuatAt],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['id']);
}

export async function ubahShift(
  id: number,
  ubahan: { nama?: string; tipe_hari?: TipeHari; jam_mulai?: string; jam_selesai?: string; aktif?: number },
  ex: Executor,
): Promise<Shift | null> {
  if (ubahan.nama !== undefined) {
    await ex.execute({ sql: 'UPDATE shift_template SET nama = ? WHERE id = ?', args: [ubahan.nama, id] });
  }
  if (ubahan.tipe_hari !== undefined) {
    await ex.execute({ sql: 'UPDATE shift_template SET tipe_hari = ? WHERE id = ?', args: [ubahan.tipe_hari, id] });
  }
  if (ubahan.jam_mulai !== undefined) {
    await ex.execute({ sql: 'UPDATE shift_template SET jam_mulai = ? WHERE id = ?', args: [ubahan.jam_mulai, id] });
  }
  if (ubahan.jam_selesai !== undefined) {
    await ex.execute({ sql: 'UPDATE shift_template SET jam_selesai = ? WHERE id = ?', args: [ubahan.jam_selesai, id] });
  }
  if (ubahan.aktif !== undefined) {
    await ex.execute({ sql: 'UPDATE shift_template SET aktif = ? WHERE id = ?', args: [ubahan.aktif, id] });
  }
  return shiftById(id, ex);
}
