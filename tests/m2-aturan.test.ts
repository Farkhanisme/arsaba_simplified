import { describe, it, expect } from 'vitest';
import {
  validasiJamShift,
  bentrokNamaTipe,
  slotTumpangTindih,
  menitDariJam,
} from '../src/server/aturan/shift';
import {
  sehariSebelum,
  tanggalValid,
  rentangTumpangTindih,
  rencanaPindah,
} from '../src/server/aturan/penempatan';

describe('aturan shift — BR-T3 validasi jam', () => {
  it('jam_mulai = jam_selesai DITOLAK', () => {
    expect(validasiJamShift('07:00', '07:00').boleh).toBe(false);
    expect(validasiJamShift('22:00', '22:00').boleh).toBe(false);
  });

  it('jam_selesai < jam_mulai DITERIMA sebagai lintas tengah malam', () => {
    const hasil = validasiJamShift('22:00', '06:00');
    expect(hasil.boleh).toBe(true);
    expect(hasil.lintasMalam).toBe(true);
  });

  it('jam normal diterima bukan lintas malam', () => {
    const hasil = validasiJamShift('07:00', '17:00');
    expect(hasil.boleh).toBe(true);
    expect(hasil.lintasMalam).toBe(false);
  });

  it('format salah atau di luar 00:00–23:59 ditolak', () => {
    expect(validasiJamShift('25:00', '17:00').boleh).toBe(false);
    expect(validasiJamShift('07:00', '24:00').boleh).toBe(false);
    expect(validasiJamShift('7:00', '17:00').boleh).toBe(false);
    expect(validasiJamShift('', '17:00').boleh).toBe(false);
  });

  it('menitDariJam mengurai benar dan menolak pola salah', () => {
    expect(menitDariJam('07:30')).toBe(450);
    expect(menitDariJam('00:00')).toBe(0);
    expect(menitDariJam('23:59')).toBe(1439);
    expect(menitDariJam('24:00')).toBeNull();
  });
});

describe('aturan shift — BR-J1 bentrok nama + tipe hari', () => {
  it('SEMUA + SEMUA (nama sama) ditolak', () => {
    expect(bentrokNamaTipe(['SEMUA'], 'SEMUA')).toBe(true);
  });

  it('SEMUA bersamaan WEEKDAY ditolak dua arah', () => {
    expect(bentrokNamaTipe(['WEEKDAY'], 'SEMUA')).toBe(true);
    expect(bentrokNamaTipe(['SEMUA'], 'WEEKDAY')).toBe(true);
    expect(bentrokNamaTipe(['WEEKEND'], 'SEMUA')).toBe(true);
    expect(bentrokNamaTipe(['SEMUA'], 'WEEKEND')).toBe(true);
  });

  it('WEEKDAY + WEEKEND (kasus valid) diterima', () => {
    expect(bentrokNamaTipe(['WEEKDAY'], 'WEEKEND')).toBe(false);
    expect(bentrokNamaTipe(['WEEKEND'], 'WEEKDAY')).toBe(false);
  });

  it('tipe baru pertama untuk nama itu diterima', () => {
    expect(bentrokNamaTipe([], 'SEMUA')).toBe(false);
    expect(bentrokNamaTipe([], 'WEEKDAY')).toBe(false);
  });
});

describe('aturan shift — BR-J7 overlap slot', () => {
  it('slot beririsan terdeteksi', () => {
    expect(slotTumpangTindih('07:00', '12:00', '11:00', '18:00')).toBe(true);
  });

  it('slot bersebelahan (akhir = awal) tidak tumpang tindih', () => {
    expect(slotTumpangTindih('07:00', '12:00', '12:00', '18:00')).toBe(false);
  });

  it('slot lintas malam yang beririsan terdeteksi', () => {
    expect(slotTumpangTindih('22:00', '06:00', '05:00', '10:00')).toBe(true);
  });

  it('slot lintas malam yang tidak bersinggungan tidak overlap', () => {
    expect(slotTumpangTindih('22:00', '06:00', '07:00', '12:00')).toBe(false);
  });
});

describe('aturan penempatan — tanggal dan rentang', () => {
  it('sehariSebelum melewati batas bulan, tahun, dan kabisat', () => {
    expect(sehariSebelum('2026-10-01')).toBe('2026-09-30');
    expect(sehariSebelum('2026-01-01')).toBe('2025-12-31');
    expect(sehariSebelum('2024-03-01')).toBe('2024-02-29');
    expect(sehariSebelum('2026-03-01')).toBe('2026-02-28');
  });

  it('tanggalValid menolak kalender fiktif', () => {
    expect(tanggalValid('2026-09-30')).toBe(true);
    expect(tanggalValid('2026-02-30')).toBe(false);
    expect(tanggalValid('2026-13-01')).toBe(false);
    expect(tanggalValid('30-09-2026')).toBe(false);
    expect(tanggalValid('2026-9-3')).toBe(false);
  });

  it('rentang tumpang tindih: terbuka vs riwayat tertutup', () => {
    expect(
      rentangTumpangTindih({ mulai: '2026-10-01', sampai: null }, { mulai: '2026-09-01', sampai: '2026-09-30' }),
    ).toBe(false);
    expect(
      rentangTumpangTindih({ mulai: '2026-09-15', sampai: null }, { mulai: '2026-09-01', sampai: '2026-09-30' }),
    ).toBe(true);
    // Batas inklusif: sampai 30 lalu mulai 30 = tumpang tindih.
    expect(
      rentangTumpangTindih({ mulai: '2026-09-30', sampai: null }, { mulai: '2026-09-01', sampai: '2026-09-30' }),
    ).toBe(true);
    expect(
      rentangTumpangTindih({ mulai: '2026-10-01', sampai: null }, { mulai: '2026-09-01', sampai: '2026-09-30' }),
    ).toBe(false);
  });

  it('rencanaPindah: tanpa penempatan terbuka langsung boleh', () => {
    const r = rencanaPindah(null, '2026-09-01');
    expect(r.boleh).toBe(true);
    expect(r.tutupSampai).toBeNull();
  });

  it('rencanaPindah: efektif harus setelah mulai berjalan', () => {
    expect(rencanaPindah('2026-09-01', '2026-09-01').boleh).toBe(false);
    expect(rencanaPindah('2026-09-01', '2026-08-31').boleh).toBe(false);
    const r = rencanaPindah('2026-09-01', '2026-10-01');
    expect(r.boleh).toBe(true);
    expect(r.tutupSampai).toBe('2026-09-30');
  });

  it('rencanaPindah menolak tanggal tidak valid', () => {
    expect(rencanaPindah('2026-09-01', 'bukan-tanggal').boleh).toBe(false);
  });
});
