import { describe, it, expect } from 'vitest';
import { menitDalamHari } from '../src/server/waktu';
import { pilihSlot, hitungN, hitungSelisih, selisihCheckIn } from '../src/server/aturan/keterlambatan';

const SLOT_PAGI = { nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '17:00' };
const SLOT_SIANG = { nama: 'Siang', jam_mulai: '13:00', jam_selesai: '21:00' };
const ISO = (jam: string) => `2026-10-03T${jam}+07:00`;

describe('keterlambatan — boundaries persis (rules/02 §6)', () => {
  it('06:50:10 vs shift 07:00 -> selisih -10, TIDAK terlambat', () => {
    const hasil = selisihCheckIn(ISO('06:50:10'), SLOT_PAGI, 5);
    expect(hasil.selisih).toBe(-10);
    expect(hasil.terlambatSistem).toBe(false);
  });

  it('07:05:59 vs shift 07:00 -> selisih 5, TIDAK terlambat (toleransi, KETAT)', () => {
    const hasil = selisihCheckIn(ISO('07:05:59'), SLOT_PAGI, 5);
    expect(hasil.selisih).toBe(5);
    expect(hasil.terlambatSistem).toBe(false);
  });

  it('07:06:00 vs shift 07:00 -> selisih 6, TERLAMBAT', () => {
    const hasil = selisihCheckIn(ISO('07:06:00'), SLOT_PAGI, 5);
    expect(hasil.selisih).toBe(6);
    expect(hasil.terlambatSistem).toBe(true);
  });

  it('detik diabaikan: 07:00:59 dan 07:00:01 menitnya sama', () => {
    expect(menitDalamHari(ISO('07:00:59'))).toBe(menitDalamHari(ISO('07:00:01')));
    expect(selisihCheckIn(ISO('07:00:59'), SLOT_PAGI, 5).selisih).toBe(0);
  });

  it('tanpa jadwal -> selisih null dan TIDAK terlambat', () => {
    const hasil = selisihCheckIn(ISO('09:30:00'), null, 5);
    expect(hasil.selisih).toBeNull();
    expect(hasil.terlambatSistem).toBe(false);
  });
});

describe('keterlambatan — penomoran slot (K-28)', () => {
  it('dua slot: N=1 -> slot 1, N=2 -> slot 2', () => {
    expect(pilihSlot([SLOT_PAGI, SLOT_SIANG], 1)).toEqual(SLOT_PAGI);
    expect(pilihSlot([SLOT_PAGI, SLOT_SIANG], 2)).toEqual(SLOT_SIANG);
  });

  it('N melebihi jumlah slot -> slot TERAKHIR', () => {
    expect(pilihSlot([SLOT_PAGI, SLOT_SIANG], 3)).toEqual(SLOT_SIANG);
    expect(pilihSlot([SLOT_PAGI], 2)).toEqual(SLOT_PAGI);
  });

  it('tanpa slot -> null', () => {
    expect(pilihSlot([], 1)).toBeNull();
  });
});

describe('keterlambatan — hitungN dan BR-L1', () => {
  const hari = [
    { id: 11, waktu: ISO('07:00:00'), jenis: 'CHECKIN', status: 'DISETUJUI' },
    { id: 12, waktu: ISO('13:00:00'), jenis: 'CHECKIN', status: 'DITOLAK' },
    { id: 13, waktu: ISO('18:00:00'), jenis: 'CHECKIN', status: 'MENUNGGU' },
  ];

  it('DITOLAK tidak dihitung: check-in aktif berikutnya jadi N=1 (bukan N=2)', () => {
    expect(hitungN(hari, 11)).toBe(1);
    expect(hitungN(hari, 13)).toBe(2);
  });

  it('dua check-in waktu SAMA diurutkan dengan id', () => {
    const kembar = [
      { id: 21, waktu: ISO('07:00:00'), jenis: 'CHECKIN', status: 'MENUNGGU' },
      { id: 22, waktu: ISO('07:00:00'), jenis: 'CHECKIN', status: 'MENUNGGU' },
    ];
    expect(hitungN(kembar, 21)).toBe(1);
    expect(hitungN(kembar, 22)).toBe(2);
  });

  it('CHECKOUT tidak ikut dihitung dalam N', () => {
    const campur = [
      ...hari,
      { id: 14, waktu: ISO('12:00:00'), jenis: 'CHECKOUT', status: 'DISETUJUI' },
    ];
    expect(hitungN(campur, 13)).toBe(2);
  });
});

describe('keterlambatan — ambang dari pengaturan (BR-L4)', () => {
  it('selisih 6: terlambat pada ambang 5, tidak pada ambang 30', () => {
    expect(hitungSelisih(426, SLOT_PAGI, 5).terlambatSistem).toBe(true);
    expect(hitungSelisih(426, SLOT_PAGI, 30).terlambatSistem).toBe(false);
  });

  it('batas KETAT: selisih == ambang berarti TIDAK terlambat', () => {
    expect(hitungSelisih(425, SLOT_PAGI, 5)).toEqual({ selisih: 5, terlambatSistem: false });
  });
});
