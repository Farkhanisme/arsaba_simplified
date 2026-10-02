import { getDb } from '../db';
import type { Executor } from '../audit';
import { serialisasiWIB } from '../waktu';

export interface AkunAdmin {
  id: number;
  username: string;
  nama: string;
  peran: 'ADMIN' | 'SUPER_ADMIN';
  aktif: number;
  dibuat_at: string;
  terakhir_login_at: string | null;
}

export async function cariPenggunaByUsername(username: string) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, password_hash, nama, peran, aktif, dibuat_at, terakhir_login_at FROM pengguna_admin WHERE username = ?',
    args: [username],
  });
  return res.rows[0] as Record<string, unknown> | undefined;
}

export async function perbaruiLoginTerakhir(userId: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE pengguna_admin SET terakhir_login_at = ? WHERE id = ?',
    args: [serialisasiWIB(), userId],
  });
}

export async function buatPengguna(
  username: string,
  passwordHash: string,
  nama: string,
  peran: 'ADMIN' | 'SUPER_ADMIN',
  aktif: number = 1
): Promise<number> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO pengguna_admin (username, password_hash, nama, peran, aktif, dibuat_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [username, passwordHash, nama, peran, aktif, serialisasiWIB()],
  });
  const res = await db.execute({ sql: 'SELECT last_insert_rowid() as id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)?.['id'] || 0);
}

export async function nonaktifkanPengguna(userId: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'UPDATE pengguna_admin SET aktif = 0 WHERE id = ?', args: [userId] });
}

// ---------------------------------------------------------------------------
// Perluasan M2 (executor-aware agar bisa dipakai di dalam transaksi + audit).
// Fungsi lama di atas TIDAK diubah.
// ---------------------------------------------------------------------------

const KOLOM_AKUN =
  'id, username, nama, peran, aktif, dibuat_at, terakhir_login_at';

export async function daftarAkun(ex: Executor): Promise<AkunAdmin[]> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_AKUN} FROM pengguna_admin ORDER BY username ASC`,
    args: [],
  });
  return res.rows as unknown as AkunAdmin[];
}

export async function akunById(id: number, ex: Executor): Promise<AkunAdmin | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_AKUN} FROM pengguna_admin WHERE id = ?`,
    args: [id],
  });
  const baris = res.rows[0] as unknown as AkunAdmin | undefined;
  return baris ?? null;
}

export async function buatAkun(
  data: { username: string; passwordHash: string; nama: string; peran: 'ADMIN' | 'SUPER_ADMIN' },
  dibuatAt: string,
  ex: Executor,
): Promise<number> {
  await ex.execute({
    sql: 'INSERT INTO pengguna_admin (username, password_hash, nama, peran, aktif, dibuat_at) VALUES (?, ?, ?, ?, 1, ?)',
    args: [data.username, data.passwordHash, data.nama, data.peran, dibuatAt],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['id']);
}

export async function setAktifAkun(id: number, aktif: number, ex: Executor): Promise<void> {
  await ex.execute({ sql: 'UPDATE pengguna_admin SET aktif = ? WHERE id = ?', args: [aktif, id] });
}

export async function setPasswordHash(id: number, passwordHash: string, ex: Executor): Promise<void> {
  await ex.execute({ sql: 'UPDATE pengguna_admin SET password_hash = ? WHERE id = ?', args: [passwordHash, id] });
}

/**
 * Membatalkan SELURUH sesi akun (dipakai saat reset password).
 * Mengembalikan jumlah sesi yang dibatalkan.
 */
export async function hapusSemuaSesiAkun(penggunaId: number, ex: Executor): Promise<number> {
  const res = await ex.execute({
    sql: 'DELETE FROM sesi_admin WHERE pengguna_id = ?',
    args: [penggunaId],
  });
  return res.rowsAffected;
}
