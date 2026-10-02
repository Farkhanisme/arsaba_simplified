/**
 * Aturan murni untuk shift template — tanpa akses database (rules/06 §4.2).
 *
 * BR-T3: jam disimpan HH:MM. jam_mulai = jam_selesai DITOLAK.
 * jam_selesai <= jam_mulai berarti lintas tengah malam (DITERIMA).
 * BR-J1: aplikasi menolak nama yang sama dengan tipe SEMUA sekaligus WEEKDAY/WEEKEND.
 * Template antar shift dalam satu toko BOLEH overlap (tidak dicek di sini).
 */

export type TipeHari = 'SEMUA' | 'WEEKDAY' | 'WEEKEND';

const POLA_JAM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function menitDariJam(jam: string): number | null {
  if (!POLA_JAM.test(jam)) return null;
  const [j, m] = jam.split(':');
  return Number(j) * 60 + Number(m);
}

export interface HasilValidasiJam {
  boleh: boolean;
  alasan: string;
  lintasMalam: boolean;
}

/**
 * BR-T3. Mengembalikan boleh=false bila format salah, jam di luar 00:00–23:59,
 * atau jam_mulai = jam_selesai. jam_selesai <= jam_mulai diterima sebagai
 * lintas tengah malam (lintasMalam=true).
 */
export function validasiJamShift(jamMulai: string, jamSelesai: string): HasilValidasiJam {
  const mulai = menitDariJam(jamMulai);
  const selesai = menitDariJam(jamSelesai);
  if (mulai === null || selesai === null) {
    return { boleh: false, alasan: 'Jam harus format HH:MM antara 00:00 dan 23:59.', lintasMalam: false };
  }
  if (mulai === selesai) {
    return { boleh: false, alasan: 'Jam mulai dan jam selesai tidak boleh sama.', lintasMalam: false };
  }
  return { boleh: true, alasan: '', lintasMalam: selesai < mulai };
}

/**
 * BR-J1. Menolak bila tipe baru berbenturan dengan tipe yang sudah ada untuk
 * nama yang sama di toko yang sama: SEMUA tidak boleh berdampingan dengan
 * WEEKDAY maupun WEEKEND. WEEKDAY + WEEKEND (tanpa SEMUA) diterima.
 */
export function bentrokNamaTipe(tipeAda: TipeHari[], tipeBaru: TipeHari): boolean {
  if (tipeAda.includes(tipeBaru)) return true;
  if (tipeBaru === 'SEMUA') return tipeAda.length > 0;
  return tipeAda.includes('SEMUA');
}

/**
 * BR-J7 (peringatan, bukan larangan — dipakai penuh di M5).
 * Dua slot beririsan bila rentang [jam_mulai, jam_selesai) bersinggungan,
 * dengan jam_selesai <= jam_mulai dihitung berakhir keesokan hari (BR-T3).
 */
export function slotTumpangTindih(
  aMulai: string,
  aSelesai: string,
  bMulai: string,
  bSelesai: string,
): boolean {
  const am = menitDariJam(aMulai);
  const as = menitDariJam(aSelesai);
  const bm = menitDariJam(bMulai);
  const bs = menitDariJam(bSelesai);
  if (am === null || as === null || bm === null || bs === null) return false;
  const akhirA = as <= am ? as + 1440 : as;
  const akhirB = bs <= bm ? bs + 1440 : bs;
  // Geser B sejajar A bila perlu (kasus lintas malam disisipkan hari berikutnya).
  const semuaB = [bm, bm + 1440, bm - 1440];
  return semuaB.some((geser) => {
    const akhirGeser = geser + (akhirB - bm);
    return am < akhirGeser && geser < akhirA;
  });
}
