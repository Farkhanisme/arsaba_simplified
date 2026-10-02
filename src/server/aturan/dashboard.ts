/**
 * Aturan murni dashboard — tanpa akses database (rules/06 §4.2).
 * Definisi metrik mengikuti rules/02 §12 persis. Jebakan yang dihindari:
 * - Terlambat memakai nilai SISTEM (hitung ulang), BUKAN angka final admin.
 * - Belum absen = terjadwal - sudah_absen - bertanda (bertanda dikecualikan).
 * - Hitung ORANG (Set karyawan_id), bukan event.
 */
import { hitungN, pilihSlot, hitungSelisih, type SlotAcuan, type ItemHitungN } from './keterlambatan';
import { menitDalamHari } from '../waktu';

export interface CheckinDashboard {
  id: number;
  waktu: string;
}

/**
 * True bila check-in ini terlambat menurut SISTEM (rules/02 §6 + §12).
 * items = seluruh CHECKIN karyawan itu pada tanggal itu (untuk N, BR-L1);
 * slots = snapshot jadwal_slot pada tanggal itu (BR-J3, boleh null);
 * ambang dari tabel pengaturan (BR-L4). Angka final admin TIDAK dipakai.
 */
export function terlambatSistem(
  checkin: CheckinDashboard,
  items: ItemHitungN[],
  slots: SlotAcuan[] | null,
  ambang: number,
): boolean {
  const n = hitungN(items, checkin.id);
  const slot = pilihSlot(slots ?? [], n);
  return hitungSelisih(menitDalamHari(checkin.waktu), slot, ambang).terlambatSistem;
}

/**
 * Belum absen = terjadwal - sudah_absen - bertanda, minimal 0.
 * Empat angka per toko TIDAK WAJIB berjumlah (karyawan bertanda tidak
 * muncul di kolom mana pun).
 */
export function hitungBelumAbsen(terjadwal: number, sudahAbsen: number, bertanda: number): number {
  return Math.max(0, terjadwal - sudahAbsen - bertanda);
}

export interface KartuToko {
  toko_id: number;
  toko_nama: string;
  terjadwal: number;
  sudah_absen: number;
  terlambat: number;
  belum_absen: number;
}

/**
 * Merakit satu kartu toko dari himpunan karyawan_id (hitung ORANG).
 * terlambat harus ⊆ sudah_absen; belum_absen dihitung via hitungBelumAbsen.
 */
export function kartuToko(
  toko_id: number,
  toko_nama: string,
  terjadwal: Set<number>,
  sudahAbsen: Set<number>,
  terlambat: Set<number>,
  bertanda: Set<number>,
): KartuToko {
  return {
    toko_id,
    toko_nama,
    terjadwal: terjadwal.size,
    sudah_absen: sudahAbsen.size,
    terlambat: terlambat.size,
    belum_absen: hitungBelumAbsen(terjadwal.size, sudahAbsen.size, bertanda.size),
  };
}
