/**
 * Aturan murni untuk penempatan karyawan — tanpa akses database (rules/06 §4.2).
 *
 * BR-P2: menutup penempatan lama (berlaku_sampai = sehari sebelum tanggal
 * efektif) dan membuka yang baru mulai tanggal efektif. Rentang satu karyawan
 * tidak boleh tumpang tindih.
 *
 * Catatan K-45: aritmetika tanggal kalender (YYYY-MM-DD) di sini memakai
 * Date.UTC/getUTC* sehingga tidak bergantung pada timezone mesin. Tidak ada
 * getHours/getDate/getFullYear/getDay lokal di file ini.
 */

export interface Rentang {
  mulai: string; // YYYY-MM-DD inklusif
  sampai: string | null; // YYYY-MM-DD inklusif; null = masih berlaku
}

/** Sehari sebelum tanggal YYYY-MM-DD. */
export function sehariSebelum(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) - 24 * 3600 * 1000;
  const w = new Date(t);
  const yy = String(w.getUTCFullYear()).padStart(4, '0');
  const mm = String(w.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(w.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Format tanggal YYYY-MM-DD valid (kalender nyata, bukan sekadar pola). */
export function tanggalValid(tanggal: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const [y, m, d] = tanggal.split('-').map(Number);
  if (m! < 1 || m! > 12 || d! < 1 || d! > 31) return false;
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d;
}

/**
 * Dua rentang tumpang tindih bila beririsan (inklusif di kedua ujung).
 * sampai=null dianggap tak berhingga (masih berlaku).
 */
export function rentangTumpangTindih(a: Rentang, b: Rentang): boolean {
  const akhirA = a.sampai ?? '9999-12-31';
  const akhirB = b.sampai ?? '9999-12-31';
  return a.mulai <= akhirB && b.mulai <= akhirA;
}

/**
 * Hitung penempatan lama yang ditutup + penempatan baru untuk pemindahan.
 * Mengembalikan { tutupSampai, baruMulai } atau alasan penolakan.
 */
export function rencanaPindah(
  terbukaMulai: string | null,
  tanggalEfektif: string,
): { boleh: boolean; alasan: string; tutupSampai: string | null } {
  if (!tanggalValid(tanggalEfektif)) {
    return { boleh: false, alasan: 'Tanggal efektif tidak valid (YYYY-MM-DD).', tutupSampai: null };
  }
  if (terbukaMulai === null) {
    return { boleh: true, alasan: '', tutupSampai: null };
  }
  if (tanggalEfektif <= terbukaMulai) {
    return {
      boleh: false,
      alasan: 'Tanggal efektif harus setelah tanggal mulai penempatan berjalan.',
      tutupSampai: null,
    };
  }
  return { boleh: true, alasan: '', tutupSampai: sehariSebelum(tanggalEfektif) };
}
