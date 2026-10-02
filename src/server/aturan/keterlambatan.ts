/**
 * Aturan murni keterlambatan — tanpa akses database (rules/06 §4.2).
 * Algoritma mengikuti rules/02 §6 persis: dihitung saat ditampilkan,
 * detik diabaikan (via menitDalamHari), terlambat bila selisih > ambang
 * (KETAT, bukan >=). Tanpa jadwal -> selisih null.
 */
import { menitDalamHari } from '../waktu';
import { menitDariJam } from './shift';

export interface SlotAcuan {
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
}

/**
 * K-28: check-in ke-N dibandingkan dengan slot ke-N; bila N melebihi
 * jumlah slot, dipakai slot TERAKHIR. Tanpa slot -> null.
 */
export function pilihSlot(slots: SlotAcuan[], n: number): SlotAcuan | null {
  if (slots.length === 0) return null;
  const ordinal = n < 1 ? 1 : n;
  return slots[Math.min(ordinal, slots.length) - 1]!;
}

export interface ItemHitungN {
  id: number;
  waktu: string;
  jenis: string;
  status: string;
}

/**
 * BR-L1: N = jumlah CHECKIN aktif (status <> 'DITOLAK') dengan
 * (waktu, id) <= (target.waktu, target.id). DITOLAK tidak dihitung
 * sehingga penomoran bergeser otomatis. Urut waktu dulu baru id
 * (dua check-in bisa berbagi jam yang sama).
 */
export function hitungN(items: ItemHitungN[], targetId: number): number {
  const target = items.find((i) => i.id === targetId);
  if (!target) throw new Error('Check-in acuan tidak ditemukan.');
  return items.filter(
    (i) =>
      i.jenis === 'CHECKIN' &&
      i.status !== 'DITOLAK' &&
      (i.waktu < target.waktu || (i.waktu === target.waktu && i.id <= target.id)),
  ).length;
}

export interface HasilSelisih {
  selisih: number | null;
  terlambatSistem: boolean;
}

/**
 * Selisih menit check-in terhadap slot acuan. `menitCheckIn` WAJIB berasal
 * dari menitDalamHari() agar detik diabaikan dengan benar.
 */
export function hitungSelisih(menitCheckIn: number, slot: SlotAcuan | null, ambangMenit: number): HasilSelisih {
  if (!slot) return { selisih: null, terlambatSistem: false };
  const mulai = menitDariJam(slot.jam_mulai);
  if (mulai === null) return { selisih: null, terlambatSistem: false };
  const selisih = menitCheckIn - mulai;
  return { selisih, terlambatSistem: selisih > ambangMenit };
}

/** Jalan pintas teruji: ISO waktu check-in -> HasilSelisih. */
export function selisihCheckIn(waktuISO: string, slot: SlotAcuan | null, ambangMenit: number): HasilSelisih {
  return hitungSelisih(menitDalamHari(waktuISO), slot, ambangMenit);
}
