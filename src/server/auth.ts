import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { getDb } from './db';
import { serialisasiWIB } from './waktu';

export const SALT_LENGTH = 32;
export const HASH_LENGTH = 64;
export const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string, salt?: Buffer): { combined: string; salt: string; hash: string } {
  const saltBuf = salt || randomBytes(SALT_LENGTH);
  const hashBuf = scryptSync(password, saltBuf, HASH_LENGTH, SCRYPT_OPTIONS);
  return {
    combined: `${saltBuf.toString('base64')}:${hashBuf.toString('base64')}`,
    salt: saltBuf.toString('base64'),
    hash: hashBuf.toString('base64'),
  };
}

export function verifyPassword(password: string, combined: string): boolean {
  const [saltB64, hashB64] = combined.split(':');
  if (!saltB64 || !hashB64) return false;
  const saltBuf = Buffer.from(saltB64, 'base64');
  const hashBuf = scryptSync(password, saltBuf, HASH_LENGTH, SCRYPT_OPTIONS);
  const storedHashBuf = Buffer.from(hashB64, 'base64');
  if (hashBuf.length !== storedHashBuf.length) return false;
  return timingSafeEqual(hashBuf, storedHashBuf);
}

export function generateSessionId(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('base64url');
  return { raw, hash };
}

export interface SessionData {
  id_hash: string;
  pengguna_id: number;
  dibuat_at: string;
  kedaluwarsa_at: string;
}

export async function createSession(penggunaId: number): Promise<{ raw: string; hash: string; kedaluwarsa_at: string }> {
  const db = getDb();
  const { raw, hash } = generateSessionId();
  const sekarang = new Date();
  const kedaluwarsa = new Date(sekarang.getTime() + 12 * 60 * 60 * 1000);
  const dibuatAt = serialisasiWIB(sekarang);
  const kedaluwarsaAt = serialisasiWIB(kedaluwarsa);
  await db.execute({
    sql: 'INSERT INTO sesi_admin (id_hash, pengguna_id, dibuat_at, kedaluwarsa_at) VALUES (?, ?, ?, ?)',
    args: [hash, penggunaId, dibuatAt, kedaluwarsaAt],
  });
  return { raw, hash, kedaluwarsa_at: kedaluwarsaAt };
}

export async function getSession(rawId: string): Promise<SessionData | null> {
  const db = getDb();
  const hashId = createHash('sha256').update(rawId).digest('base64url');
  const res = await db.execute({
    sql: 'SELECT id_hash, pengguna_id, dibuat_at, kedaluwarsa_at FROM sesi_admin WHERE id_hash = ?',
    args: [hashId],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0] as Record<string, unknown>;
  return {
    id_hash: row['id_hash'] as string,
    pengguna_id: row['pengguna_id'] as number,
    dibuat_at: row['dibuat_at'] as string,
    kedaluwarsa_at: row['kedaluwarsa_at'] as string,
  };
}

export async function destroySession(idHash: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM sesi_admin WHERE id_hash = ?', args: [idHash] });
}

export const MAX_LOGIN_ATTEMPTS = 5;

export async function checkLoginAttempts(username: string, ip: string): Promise<{ blocked: boolean; countUsername: number; countIp: number }> {
  const db = getDb();
  const batasWaktu = serialisasiWIB(new Date(Date.now() - 24 * 60 * 60 * 1000));
  await db.execute({ sql: 'DELETE FROM percobaan_login WHERE waktu < ?', args: [batasWaktu] });
  // Hitung per username
  const resUsername = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM percobaan_login WHERE username = ? AND berhasil = 0 AND waktu >= ?',
    args: [username, batasWaktu],
  });
  const countUsername = Number((resUsername.rows[0] as Record<string, unknown>)['count'] || 0);
  // Hitung per IP
  const resIp = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM percobaan_login WHERE ip = ? AND berhasil = 0 AND waktu >= ?',
    args: [ip || '', batasWaktu],
  });
  const countIp = Number((resIp.rows[0] as Record<string, unknown>)['count'] || 0);
  const blocked = countUsername >= MAX_LOGIN_ATTEMPTS || countIp >= MAX_LOGIN_ATTEMPTS;
  return { blocked, countUsername, countIp };
}

export async function recordLoginAttempt(username: string, ip: string, berhasil: boolean): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO percobaan_login (username, ip, waktu, berhasil) VALUES (?, ?, ?, ?)',
    args: [username, ip || '', serialisasiWIB(), berhasil ? 1 : 0],
  });
}

/**
 * Membuka kunci akun yang terkunci karena melewati batas percobaan (K-46).
 *
 * Menghapus HANYA baris percobaan GAGAL milik username tersebut; percobaan yang berhasil
 * dibiarkan sebagai riwayat. Mengembalikan jumlah baris yang dihapus.
 *
 * Endpoint-nya ada di src/app/api/admin/akun/buka-kunci/route.ts dan hanya untuk SUPER_ADMIN.
 * UI-nya belum dibuat — halaman "Akun Admin" adalah bagian M2 (rules/05 §5.8).
 */
export async function bukaKunciUsername(username: string): Promise<number> {
  const db = getDb();
  const res = await db.execute({
    sql: 'DELETE FROM percobaan_login WHERE username = ? AND berhasil = 0',
    args: [username],
  });
  return res.rowsAffected;
}
