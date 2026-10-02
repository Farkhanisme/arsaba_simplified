import { describe, it, expect } from 'vitest';
import { pasanganValid, hitungHariHadir, rekapKaryawan, hitungPeringatan } from '../src/server/aturan/rekap';

describe('aturan rekap — pasanganValid (BR-V4/V5)', () => {
  it('DISETUJUI + DISETUJUI -> sah', () => {
    expect(pasanganValid('DISETUJUI', 'DISETUJUI')).toBe(true);
  });

  it('setengah disetujui -> bukan pasangan', () => {
    expect(pasanganValid('DISETUJUI', 'MENUNGGU')).toBe(false);
    expect(pasanganValid('DISETUJUI', null)).toBe(false);
    expect(pasanganValid('MENUNGGU', 'DISETUJUI')).toBe(false);
  });

  it('check-out dari check-in DITOLAK berdiri sendiri -> bukan pasangan', () => {
    expect(pasanganValid('DITOLAK', 'DISETUJUI')).toBe(false);
  });
});

describe('aturan rekap — hitungHariHadir (BR-H1/H2)', () => {
  it('satu pasangan sah -> 1 hari', () => {
    expect(hitungHariHadir([{ tanggal: '2026-10-01', checkinStatus: 'DISETUJUI', checkoutStatus: 'DISETUJUI' }])).toEqual(
      new Set(['2026-10-01']),
    );
  });

  it('dua pasangan sah tanggal sama -> TETAP 1 hari', () => {
    const s = hitungHariHadir([
      { tanggal: '2026-10-01', checkinStatus: 'DISETUJUI', checkoutStatus: 'DISETUJUI' },
      { tanggal: '2026-10-01', checkinStatus: 'DISETUJUI', checkoutStatus: 'DISETUJUI' },
    ]);
    expect(s.size).toBe(1);
  });

  it('tanggal berbeda -> dihitung masing-masing', () => {
    const s = hitungHariHadir([
      { tanggal: '2026-10-01', checkinStatus: 'DISETUJUI', checkoutStatus: 'DISETUJUI' },
      { tanggal: '2026-10-02', checkinStatus: 'DISETUJUI', checkoutStatus: 'DISETUJUI' },
    ]);
    expect(s.size).toBe(2);
  });
});

describe('aturan rekap — rekapKaryawan memakai FINAL (BR-L3/BR-R4)', () => {
  it('total = angka final apa adanya; hadir dari himpunan tanggal', () => {
    expect(
      rekapKaryawan({
        karyawan_id: 1,
        karyawan_nama: 'A',
        toko_id: 2,
        toko_nama: 'T',
        tanggalHadir: new Set(['2026-10-01', '2026-10-02']),
        hariIzin: 1,
        hariTanpaKeterangan: 0,
        totalFinal: 45,
      }),
    ).toEqual({
      karyawan_id: 1,
      karyawan_nama: 'A',
      toko_id: 2,
      toko_nama: 'T',
      hari_hadir: 2,
      hari_izin: 1,
      hari_tanpa_keterangan: 0,
      total_terlambat_final: 45,
    });
  });
});

describe('aturan rekap — hitungPeringatan (BR-R3)', () => {
  it('terjadwal tanpa event dan tanpa tanda -> peringatan', () => {
    expect(hitungPeringatan(new Set([1, 2, 3]), new Set([1]), new Set([2]))).toBe(1);
  });

  it('ada event (walau DITOLAK) bukan peringatan; bertanda bukan peringatan', () => {
    expect(hitungPeringatan(new Set([1, 2]), new Set([1]), new Set([2]))).toBe(0);
    expect(hitungPeringatan(new Set<number>(), new Set<number>(), new Set<number>())).toBe(0);
  });
});
