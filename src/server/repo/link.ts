import { randomBytes } from 'node:crypto';
import type { Executor } from '../audit';

export interface Link {
  id: number;
  karyawan_id: number;
  token: string;
  dibuat_at: string;
  dibuat_oleh: number | null;
  dicabut_at: string | null;
}

/** BR-LK1: token acak kriptografis, minimal 32 byte, base64url. */
export function buatTokenLink(): string {
  return randomBytes(32).toString('base64url');
}

/** URL absen lengkap untuk token. Hanya dipakai di server/halaman Karyawan. */
export function urlUntukToken(token: string): string {
  const origin = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';
  return `${origin}/a/${token}`;
}

export async function linkAktif(karyawanId: number, ex: Executor): Promise<Link | null> {
  const res = await ex.execute({
    sql: 'SELECT id, karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at FROM karyawan_link WHERE karyawan_id = ? AND dicabut_at IS NULL',
    args: [karyawanId],
  });
  const baris = res.rows[0] as unknown as Link | undefined;
  return baris ?? null;
}

/** Membuat link baru. Menolak bila masih ada link aktif (BR-LK2). */
export async function buatLink(
  karyawanId: number,
  token: string,
  dibuatOleh: number,
  dibuatAt: string,
  ex: Executor,
): Promise<Link> {
  const kry = await ex.execute({ sql: 'SELECT id FROM karyawan WHERE id = ?', args: [karyawanId] });
  if (kry.rows.length === 0) throw new Error('Karyawan tidak ditemukan.');
  const ada = await linkAktif(karyawanId, ex);
  if (ada) throw new Error('Karyawan masih memiliki link aktif.');
  await ex.execute({
    sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at) VALUES (?, ?, ?, ?, NULL)',
    args: [karyawanId, token, dibuatAt, dibuatOleh],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((res.rows[0] as Record<string, unknown>)['id']);
  const baca = await ex.execute({
    sql: 'SELECT id, karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at FROM karyawan_link WHERE id = ?',
    args: [id],
  });
  return baca.rows[0] as unknown as Link;
}

/**
 * Mencabut link aktif. Mengembalikan true bila ada yang dicabut.
 * Token TIDAK pernah ditulis ke log/audit oleh fungsi ini (BR-LK3) —
 * pemanggil wajib memastikan nilai sebelum/sesudah audit tidak memuat token.
 */
export async function cabutLink(karyawanId: number, waktu: string, ex: Executor): Promise<boolean> {
  const res = await ex.execute({
    sql: 'UPDATE karyawan_link SET dicabut_at = ? WHERE karyawan_id = ? AND dicabut_at IS NULL',
    args: [waktu, karyawanId],
  });
  return res.rowsAffected > 0;
}

/**
 * "Buat ulang": mencabut yang lama DAN membuat yang baru.
 * WAJIB dipanggil di dalam SATU transaksi (denganTransaksi) bersama pemanggil —
 * bila INSERT baru gagal, UPDATE cabut ikut rollback sehingga link lama
 * tidak ikut tercabut (BR-LK2).
 */
export async function buatUlangLink(
  karyawanId: number,
  tokenBaru: string,
  dibuatOleh: number,
  waktu: string,
  ex: Executor,
): Promise<{ lamaId: number; baru: Link }> {
  const lama = await linkAktif(karyawanId, ex);
  if (!lama) throw new Error('Karyawan tidak memiliki link aktif.');
  await ex.execute({
    sql: 'UPDATE karyawan_link SET dicabut_at = ? WHERE id = ?',
    args: [waktu, lama.id],
  });
  await ex.execute({
    sql: 'INSERT INTO karyawan_link (karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at) VALUES (?, ?, ?, ?, NULL)',
    args: [karyawanId, tokenBaru, waktu, dibuatOleh],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((res.rows[0] as Record<string, unknown>)['id']);
  const baca = await ex.execute({
    sql: 'SELECT id, karyawan_id, token, dibuat_at, dibuat_oleh, dicabut_at FROM karyawan_link WHERE id = ?',
    args: [id],
  });
  return { lamaId: lama.id, baru: baca.rows[0] as unknown as Link };
}
