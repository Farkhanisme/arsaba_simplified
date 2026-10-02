import { describe, it, expect } from 'vitest';
import { sekarangWIB, tanggalWIB, menitDalamHari, jenisHari, serialisasiWIB } from '../src/server/waktu';

describe('waktu', () => {
  it('sekarangWIB mengembalikan Date', () => {
    const d = sekarangWIB();
    expect(d instanceof Date).toBe(true);
  });

  it('tanggalWIB mengambil tanggal dari instant', () => {
    const d = new Date('2026-09-30T07:30:00+07:00');
    expect(tanggalWIB(d)).toBe('2026-09-30');
  });

  it('tanggalWIB tanpa argumen memakai sekarang', () => {
    const tgl = tanggalWIB();
    expect(typeof tgl).toBe('string');
    expect(tgl).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('menitDalamHari mengabaikan detik', () => {
    const d1 = new Date('2026-09-30T07:05:59+07:00');
    const d2 = new Date('2026-09-30T07:06:00+07:00');
    expect(menitDalamHari(d1)).toBe(7 * 60 + 5); // 425
    expect(menitDalamHari(d2)).toBe(7 * 60 + 6); // 426
  });

  it('menitDalamHari pada midnight', () => {
    const d = new Date('2026-09-30T00:00:00+07:00');
    expect(menitDalamHari(d)).toBe(0);
  });

  it('menitDalamHari pada 23:59:59', () => {
    const d = new Date('2026-09-30T23:59:59+07:00');
    expect(menitDalamHari(d)).toBe(23 * 60 + 59); // 1439
  });

  it('jenisHari: Sabtu dan Minggu = WEEKEND', () => {
    // 2026-09-26 = Sabtu, 2026-09-27 = Minggu
    expect(jenisHari('2026-09-26')).toBe('WEEKEND');
    expect(jenisHari('2026-09-27')).toBe('WEEKEND');
  });

  it('jenisHari: Senin sampai Jumat = WEEKDAY', () => {
    // 2026-09-28 = Senin
    expect(jenisHari('2026-09-28')).toBe('WEEKDAY');
  });

  it('serialisasiWIB menghasilkan format +07:00', () => {
    const d = new Date('2026-09-30T07:15:30+07:00');
    expect(serialisasiWIB(d)).toBe('2026-09-30T07:15:30+07:00');
  });

  it('lintas hari WIB dari instant UTC', () => {
    // 2026-10-01 20:30 UTC = 2026-10-02 03:30 WIB (lintas tengah malam)
    const utcInstant = new Date('2026-10-01T20:30:00Z');
    expect(tanggalWIB(utcInstant)).toBe('2026-10-02');
    expect(menitDalamHari(utcInstant)).toBe(3 * 60 + 30); // 210
    expect(serialisasiWIB(utcInstant)).toBe('2026-10-02T03:30:00+07:00');
  });
});
