/**
 * Repo baca audit_log (M9). Hanya SELECT — audit_log tidak boleh pernah
 * di-UPDATE atau di-DELETE (larangan keras AGENTS.md; dijaga trigger
 * audit_log_tolak_update / audit_log_tolak_delete di migrasi).
 *
 * SQL berparameter saja. Klausa WHERE dibangun dinamis, nilainya tetap lewat
 * placeholder `?`. Pagination wajib: default 50 baris, total dihitung supaya
 * UI bisa menulis "Menampilkan X dari Y". Urutan `waktu DESC, id DESC` agar
 * stabil antar halaman.
 */
import type { Executor } from '../audit';

export interface FilterAuditLog {
  dari?: string;
  sampai?: string;
  penggunaId?: number;
  aksi?: string;
  entitas?: string;
  limit?: number;
  offset?: number;
}

export interface BarisAuditLog {
  id: number;
  waktu: string;
  pengguna_id: number | null;
  pengguna_nama: string | null;
  aksi: string;
  entitas: string;
  entitas_id: number | null;
  sebelum: string | null;
  sesudah: string | null;
  catatan: string | null;
}

export const BATAS_BAWAN = 50;
export const BATAS_MAKS = 200;

/** Batas halaman yang dipakai bila input di luar rentang. */
export function normalisasiBatas(limit?: number, offset?: number): { limit: number; offset: number } {
  const l = limit === undefined ? BATAS_BAWAN : Math.floor(limit);
  const o = offset === undefined ? 0 : Math.floor(offset);
  return {
    limit: Number.isFinite(l) && l > 0 ? Math.min(l, BATAS_MAKS) : BATAS_BAWAN,
    offset: Number.isFinite(o) && o >= 0 ? o : 0,
  };
}

/**
 * Syarat WHERE + args untuk filter. Diekspor supaya tes bisa memeriksa bahwa
 * setiap filter diteruskan sebagai placeholder, bukan ditempel ke string SQL.
 */
export function syaratAuditLog(f: FilterAuditLog): { klausa: string[]; args: (string | number)[] } {
  const klausa: string[] = [];
  const args: (string | number)[] = [];
  // `waktu` selalu ISO `YYYY-MM-DDTHH:mm:ss+07:00`, jadi 10 karakter pertama
  // adalah tanggalnya. substr dipakai supaya benar apa pun offsetnya.
  if (f.dari !== undefined && f.dari !== '') {
    klausa.push('substr(a.waktu, 1, 10) >= ?');
    args.push(f.dari);
  }
  if (f.sampai !== undefined && f.sampai !== '') {
    klausa.push('substr(a.waktu, 1, 10) <= ?');
    args.push(f.sampai);
  }
  if (f.penggunaId !== undefined) {
    klausa.push('a.pengguna_id = ?');
    args.push(f.penggunaId);
  }
  if (f.aksi !== undefined && f.aksi !== '') {
    klausa.push('a.aksi = ?');
    args.push(f.aksi);
  }
  if (f.entitas !== undefined && f.entitas !== '') {
    klausa.push('a.entitas = ?');
    args.push(f.entitas);
  }
  return { klausa, args };
}

const KOLOM = `a.id, a.waktu, a.pengguna_id, p.nama AS pengguna_nama, a.aksi, a.entitas,
  a.entitas_id, a.sebelum, a.sesudah, a.catatan`;

function dariSertaJoin(klausa: string[]): string {
  const where = klausa.length > 0 ? `WHERE ${klausa.join(' AND ')}` : '';
  return `FROM audit_log a LEFT JOIN pengguna_admin p ON p.id = a.pengguna_id ${where}`;
}

export async function hitungAuditLog(f: FilterAuditLog, ex: Executor): Promise<number> {
  const { klausa, args } = syaratAuditLog(f);
  const res = await ex.execute({ sql: `SELECT COUNT(*) AS total ${dariSertaJoin(klausa)}`, args });
  return Number((res.rows[0] as Record<string, unknown>)['total'] ?? 0);
}

export async function daftarAuditLog(
  f: FilterAuditLog,
  ex: Executor,
): Promise<{ baris: BarisAuditLog[]; total: number }> {
  const { limit, offset } = normalisasiBatas(f.limit, f.offset);
  const { klausa, args } = syaratAuditLog(f);
  const total = await hitungAuditLog(f, ex);
  const res = await ex.execute({
    sql: `SELECT ${KOLOM} ${dariSertaJoin(klausa)} ORDER BY a.waktu DESC, a.id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  return { baris: res.rows as unknown as BarisAuditLog[], total };
}

/** Nilai aksi/entitas/pelaku diambil dari isi tabel — tidak dikarang di klien. */
export async function daftarAksiAuditLog(ex: Executor): Promise<string[]> {
  const res = await ex.execute({ sql: 'SELECT DISTINCT aksi FROM audit_log ORDER BY aksi ASC', args: [] });
  return (res.rows as unknown as { aksi: string }[]).map((r) => r.aksi);
}

export async function daftarEntitasAuditLog(ex: Executor): Promise<string[]> {
  const res = await ex.execute({ sql: 'SELECT DISTINCT entitas FROM audit_log ORDER BY entitas ASC', args: [] });
  return (res.rows as unknown as { entitas: string }[]).map((r) => r.entitas);
}

export async function daftarPelakuAuditLog(ex: Executor): Promise<{ id: number; nama: string }[]> {
  const res = await ex.execute({
    sql: `SELECT DISTINCT a.pengguna_id AS id, p.nama AS nama FROM audit_log a
      JOIN pengguna_admin p ON p.id = a.pengguna_id WHERE a.pengguna_id IS NOT NULL ORDER BY p.nama ASC`,
    args: [],
  });
  return res.rows as unknown as { id: number; nama: string }[];
}
