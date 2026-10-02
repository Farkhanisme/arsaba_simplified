import { describe, it, expect } from 'vitest';
import { terlambatSistem, hitungBelumAbsen, kartuToko } from '../src/server/aturan/dashboard';
import type { ItemHitungN } from '../src/server/aturan/keterlambatan';

const SLOT_PAGI = [{ nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '17:00' }];
const T = '2026-10-03';

function items(...ids: { id: number; waktu: string; status?: string }[]): ItemHitungN[] {
  return ids.map((c) => ({ id: c.id, waktu: c.waktu, jenis: 'CHECKIN', status: c.status ?? 'MENUNGGU' }));
}

describe('aturan dashboard — terlambat memakai SISTEM, bukan final', () => {
  it('kasus 1: tidak terlambat sistem TAPI final = 30 -> tetap TIDAK terlambat', () => {
    // 07:03 vs shift 07:00: selisih 3, toleransi. Angka final 30 diabaikan
    // (fungsi ini bahkan tidak menerima final sebagai parameter).
    const ci = { id: 1, waktu: `${T}T07:03:00+07:00` };
    expect(terlambatSistem(ci, items(ci), SLOT_PAGI, 5)).toBe(false);
  });

  it('kasus 2: terlambat sistem TAPI final = 0 -> tetap TERLAMBAT', () => {
    // 07:20 vs shift 07:00: selisih 20 > 5. Final 0 dari admin diabaikan.
    const ci = { id: 2, waktu: `${T}T07:20:00+07:00` };
    expect(terlambatSistem(ci, items(ci), SLOT_PAGI, 5)).toBe(true);
  });

  it('tanpa jadwal (slot null) -> TIDAK terlambat, selisih kosong', () => {
    const ci = { id: 3, waktu: `${T}T09:00:00+07:00` };
    expect(terlambatSistem(ci, items(ci), null, 5)).toBe(false);
  });
});

describe('aturan dashboard — slot lewat fungsi M4', () => {
  const DUA = [
    { nama: 'S1', jam_mulai: '07:00', jam_selesai: '12:00' },
    { nama: 'S2', jam_mulai: '18:00', jam_selesai: '23:00' },
  ];

  it('N=1 ke slot 1, N=2 ke slot 2', () => {
    const a = { id: 11, waktu: `${T}T07:30:00+07:00` };
    const b = { id: 12, waktu: `${T}T18:30:00+07:00` };
    const semua = items(a, b);
    // 07:30 vs 07:00 = 30 > 5 -> terlambat; 18:30 vs 18:00 = 30 -> terlambat.
    expect(terlambatSistem(a, semua, DUA, 5)).toBe(true);
    expect(terlambatSistem(b, semua, DUA, 5)).toBe(true);
    // Check-in pertama 06:50 (lebih awal) tidak terlambat walau slot 2 ada.
    const pagi = { id: 13, waktu: `${T}T06:50:00+07:00` };
    expect(terlambatSistem(pagi, items(pagi), DUA, 5)).toBe(false);
  });

  it('N melebihi jumlah slot -> slot TERAKHIR', () => {
    const a = { id: 21, waktu: `${T}T07:00:00+07:00` };
    const b = { id: 22, waktu: `${T}T20:00:00+07:00` };
    // Satu slot 07:00; check-in kedua (N=2) dibandingkan ke slot yang sama:
    // 20:00 vs 07:00 -> selisih besar -> terlambat.
    expect(terlambatSistem(b, items(a, b), SLOT_PAGI, 5)).toBe(true);
  });

  it('DITOLAK di antara dua check-in menggeser N (BR-L1)', () => {
    // ci1 DITOLAK: ci2 yang aktif menjadi N=1 -> dibanding slot 1, bukan slot 2.
    const ci1 = { id: 31, waktu: `${T}T07:00:00+07:00`, status: 'DITOLAK' };
    const ci2 = { id: 32, waktu: `${T}T18:05:00+07:00` };
    const semua = items(ci1, ci2);
    // N=1 -> slot 1 (07:00): 18:05 vs 07:00 -> terlambat.
    expect(terlambatSistem(ci2, semua, DUA, 5)).toBe(true);
    // Bandingkan: tanpa penolakan, ci2 jadi N=2 -> slot 2 (18:00): selisih 5 -> tidak terlambat.
    const tanpaTolak = items({ ...ci1, status: 'MENUNGGU' }, ci2);
    expect(terlambatSistem(ci2, tanpaTolak, DUA, 5)).toBe(false);
  });
});

describe('aturan dashboard — hitungBelumAbsen dan kartuToko', () => {
  it('terjadwal 5, absen 3, bertanda 1 -> belum_absen 1 (bukan 2)', () => {
    expect(hitungBelumAbsen(5, 3, 1)).toBe(1);
  });

  it('tidak pernah negatif', () => {
    expect(hitungBelumAbsen(2, 3, 1)).toBe(0);
    expect(hitungBelumAbsen(0, 0, 0)).toBe(0);
  });

  it('kartuToko menghitung orang dari Set', () => {
    const kartu = kartuToko(7, 'Toko X', new Set([1, 2, 3, 4, 5]), new Set([1, 2, 3]), new Set([3]), new Set([4]));
    expect(kartu).toEqual({ toko_id: 7, toko_nama: 'Toko X', terjadwal: 5, sudah_absen: 3, terlambat: 1, belum_absen: 1 });
  });
});
