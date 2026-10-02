import type { InStatement, ResultSet } from '@libsql/core/api';
import { getDb } from './db';

export interface AuditEntry {
  waktu: string;
  pengguna_id?: number | null;
  aksi: string;
  entitas: string;
  entitas_id?: number;
  sebelum?: string; // JSON
  sesudah?: string; // JSON
  catatan?: string;
}

/**
 * Receiver query SQL. `Client` dan `Transaction` sama-sama memenuhi bentuk ini
 * (lihat node_modules/@libsql/core/lib-esm/api.d.ts: interface Client baris 55,
 * interface Transaction baris 261 — keduanya `execute(stmt: InStatement): Promise<ResultSet>`).
 *
 * Dipakai agar catatAudit bisa menulis DI DALAM transaksi yang sama dengan mutasinya,
 * sebagaimana diwajibkan rules/06 §4.6. Tanpa ini, audit ditulis lewat koneksi terpisah
 * dan tetap ada walau transaksi sudah di-rollback.
 */
export type Executor = { execute(stmt: InStatement): Promise<ResultSet> };

/**
 * Catat aksi ke audit_log.
 *
 * Untuk aksi yang mengubah data, WAJIB teruskan `tx` dari `denganTransaksi()` supaya audit
 * ikut commit/rollback bersama mutasinya (BR-AU1, rules/06 §4.6).
 *
 * `executor` bersifat opsional agar pemanggilan lama yang tidak memakai transaksi
 * (mis. percobaan login) tetap berfungsi. Kalau `executor` diberikan, `getDb()` sama sekali
 * tidak dipanggil supaya tidak membuka koneksi yang tidak terpakai.
 */
export async function catatAudit(entry: AuditEntry, executor?: Executor): Promise<void> {
  const db = executor ?? getDb();
  await db.execute({
    sql: `INSERT INTO audit_log
      (waktu, pengguna_id, aksi, entitas, entitas_id, sebelum, sesudah, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.waktu,
      entry.pengguna_id ?? null,
      entry.aksi,
      entry.entitas,
      entry.entitas_id ?? null,
      entry.sebelum ?? null,
      entry.sesudah ?? null,
      entry.catatan ?? null,
    ],
  });
}
