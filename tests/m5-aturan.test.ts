import { describe, it, expect } from 'vitest';
import { namaHariWIB, jenisHari } from '../src/server/waktu';
import {
  urutkanSlot,
  cekBatasSlot,
  slotMemenuhiTipeHari,
  adaSlotTakValid,
  peringatanTumpangTindih,
  rentangTanggal,
  rentangMode,
  awalMinggu,
} from '../src/server/aturan/jadwal';

describe('waktu — namaHariWIB (K-45, pola Date.UTC + getUTCDay)', () => {
  it("2026-10-04 = 'Minggu', 2026-10-03 = 'Sabtu' (berturut, beda jenis)", () => {
    expect(namaHariWIB('2026-10-04')).toBe('Minggu');
    expect(namaHariWIB('2026-10-03')).toBe('Sabtu');
  });

  it('konsisten dengan jenisHari (weekday vs weekend)', () => {
    expect(jenisHari('2026-10-04')).toBe('WEEKEND');
    expect(jenisHari('2026-10-05')).toBe('WEEKDAY');
    expect(namaHariWIB('2026-10-05')).toBe('Senin');
    expect(namaHariWIB('2026-10-01')).toBe('Kamis');
  });

  it('format salah melempar', () => {
    expect(() => namaHariWIB('bukan-tanggal')).toThrow();
  });
});

describe('aturan jadwal — urutan dan batas slot (BR-J6, K-27)', () => {
  it('slot tersimpan urut jam_mulai naik walau diinput terbalik', () => {
    const hasil = urutkanSlot([
      { nama: 'Malam', jam_mulai: '18:00', jam_selesai: '23:00' },
      { nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '12:00' },
    ]);
    expect(hasil.map((s) => s.nama)).toEqual(['Pagi', 'Malam']);
  });

  it('1 dan 2 slot boleh, 3 slot ditolak', () => {
    expect(cekBatasSlot(1).boleh).toBe(true);
    expect(cekBatasSlot(2).boleh).toBe(true);
    expect(cekBatasSlot(3).boleh).toBe(false);
  });
});

describe('aturan jadwal — pilih template per nama + tipe hari (BR-J2)', () => {
  const templates = [
    { nama: 'Pagi', tipe_hari: 'WEEKDAY' as const },
    { nama: 'Pagi', tipe_hari: 'WEEKEND' as const },
    { nama: 'Siang', tipe_hari: 'SEMUA' as const },
  ];

  it('Sabtu + template hanya WEEKDAY -> pasangan WEEKEND-nya yang dipilih', () => {
    // 2026-10-03 = Sabtu.
    expect(slotMemenuhiTipeHari(templates, 'Pagi', '2026-10-03')).toEqual({ nama: 'Pagi', tipe_hari: 'WEEKEND' });
  });

  it('Senin memakai WEEKDAY', () => {
    expect(slotMemenuhiTipeHari(templates, 'Pagi', '2026-10-05')).toEqual({ nama: 'Pagi', tipe_hari: 'WEEKDAY' });
  });

  it('SEMUA cocok untuk tanggal kapan pun', () => {
    expect(slotMemenuhiTipeHari(templates, 'Siang', '2026-10-03')).toEqual({ nama: 'Siang', tipe_hari: 'SEMUA' });
    expect(slotMemenuhiTipeHari(templates, 'Siang', '2026-10-05')).toEqual({ nama: 'Siang', tipe_hari: 'SEMUA' });
  });

  it('Sabtu + template HANYA WEEKDAY -> null (sel ditolak pemanggil)', () => {
    const hanyaWeekday = [{ nama: 'Sore', tipe_hari: 'WEEKDAY' as const }];
    expect(slotMemenuhiTipeHari(hanyaWeekday, 'Sore', '2026-10-03')).toBeNull();
    expect(slotMemenuhiTipeHari(hanyaWeekday, 'Sore', '2026-10-05')).not.toBeNull();
  });

  it('nama tak dikenal -> null', () => {
    expect(slotMemenuhiTipeHari(templates, 'Tidak Ada', '2026-10-05')).toBeNull();
  });
});

describe('aturan jadwal — validasi slot gabungan (BR-T3)', () => {
  it('jam sama ditolak, format salah ditolak, nama kosong ditolak', () => {
    expect(adaSlotTakValid([{ nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '07:00' }]).length).toBeGreaterThan(0);
    expect(adaSlotTakValid([{ nama: 'Pagi', jam_mulai: '25:00', jam_selesai: '17:00' }]).length).toBeGreaterThan(0);
    expect(adaSlotTakValid([{ nama: '  ', jam_mulai: '07:00', jam_selesai: '17:00' }]).length).toBeGreaterThan(0);
    expect(adaSlotTakValid([{ nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '17:00' }])).toEqual([]);
  });

  it('lintas malam diterima sebagai valid', () => {
    expect(adaSlotTakValid([{ nama: 'Malam', jam_mulai: '22:00', jam_selesai: '06:00' }])).toEqual([]);
  });
});

describe('aturan jadwal — tumpang tindih = peringatan (BR-J7)', () => {
  it('dua slot tumpang tindih terdeteksi pasangannya', () => {
    expect(
      peringatanTumpangTindih([
        { nama: 'A', jam_mulai: '07:00', jam_selesai: '12:00' },
        { nama: 'B', jam_mulai: '11:00', jam_selesai: '18:00' },
      ]),
    ).toEqual([{ a: 0, b: 1 }]);
  });

  it('lintas malam: 23:00-02:00 vs 01:00-04:00 = tumpang tindih', () => {
    expect(
      peringatanTumpangTindih([
        { nama: 'A', jam_mulai: '23:00', jam_selesai: '02:00' },
        { nama: 'B', jam_mulai: '01:00', jam_selesai: '04:00' },
      ]),
    ).toEqual([{ a: 0, b: 1 }]);
  });

  it('07:00-12:00 vs 18:00-23:00 = tidak tumpang tindih', () => {
    expect(
      peringatanTumpangTindih([
        { nama: 'A', jam_mulai: '07:00', jam_selesai: '12:00' },
        { nama: 'B', jam_mulai: '18:00', jam_selesai: '23:00' },
      ]),
    ).toEqual([]);
  });
});

describe('aturan jadwal — rentang tanggal', () => {
  it('dari..sampai inklusif, melewati batas bulan', () => {
    expect(rentangTanggal('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('dari > sampai atau tak valid -> kosong', () => {
    expect(rentangTanggal('2026-10-02', '2026-09-30')).toEqual([]);
    expect(rentangTanggal('bukan', '2026-10-02')).toEqual([]);
  });

  it('mode hari = satu tanggal acuan', () => {
    expect(rentangMode('hari', '2026-10-03')).toEqual(['2026-10-03']);
  });

  it('mode minggu = Senin..Minggu memuat acuan (Senin kolom pertama)', () => {
    // 2026-10-03 = Sabtu -> pekan 28 Sep..4 Okt.
    expect(rentangMode('minggu', '2026-10-03')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(awalMinggu('2026-10-03')).toBe('2026-09-28');
    expect(awalMinggu('2026-10-05')).toBe('2026-10-05');
  });

  it('mode bulan = sebulan kalender (31 hari untuk Oktober)', () => {
    const hasil = rentangMode('bulan', '2026-10-15');
    expect(hasil.length).toBe(31);
    expect(hasil[0]).toBe('2026-10-01');
    expect(hasil[30]).toBe('2026-10-31');
  });

  it('mode bulan Februari tahun kabisat = 29 hari', () => {
    expect(rentangMode('bulan', '2024-02-10').length).toBe(29);
    expect(rentangMode('bulan', '2026-02-10').length).toBe(28);
  });
});
