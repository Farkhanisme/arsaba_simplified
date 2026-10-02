import type { Executor } from '../audit';

export interface Toko {
  id: number;
  nama: string;
  aktif: number;
  dibuat_at: string;
}

export async function daftarToko(ex: Executor): Promise<Toko[]> {
  const res = await ex.execute({
    sql: 'SELECT id, nama, aktif, dibuat_at FROM toko ORDER BY nama ASC',
    args: [],
  });
  return res.rows as unknown as Toko[];
}

export async function tokoById(id: number, ex: Executor): Promise<Toko | null> {
  const res = await ex.execute({
    sql: 'SELECT id, nama, aktif, dibuat_at FROM toko WHERE id = ?',
    args: [id],
  });
  const baris = res.rows[0] as unknown as Toko | undefined;
  return baris ?? null;
}

export async function buatToko(nama: string, dibuatAt: string, ex: Executor): Promise<number> {
  await ex.execute({ sql: 'INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', args: [nama, dibuatAt] });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['id']);
}

export async function ubahToko(
  id: number,
  ubahan: { nama?: string; aktif?: number },
  ex: Executor,
): Promise<Toko | null> {
  if (ubahan.nama !== undefined) {
    await ex.execute({ sql: 'UPDATE toko SET nama = ? WHERE id = ?', args: [ubahan.nama, id] });
  }
  if (ubahan.aktif !== undefined) {
    await ex.execute({ sql: 'UPDATE toko SET aktif = ? WHERE id = ?', args: [ubahan.aktif, id] });
  }
  return tokoById(id, ex);
}
