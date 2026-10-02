import { describe, it, expect } from 'vitest';
import { bolehTandai, bentukRentang, klasifikasiPenandaan } from '../src/server/aturan/ketidakhadiran';

describe('aturan ketidakhadiran — BR-X3 bolehTandai', () => {
  it('MENUNGGU memblokir', () => {
    expect(bolehTandai(['MENUNGGU'])).toBe(false);
  });

  it('DISETUJUI memblokir', () => {
    expect(bolehTandai(['DISETUJUI'])).toBe(false);
  });

  it('DITOLAK tidak memblokir (bukan event aktif)', () => {
    expect(bolehTandai(['DITOLAK'])).toBe(true);
  });

  it('tanpa event boleh', () => {
    expect(bolehTandai([])).toBe(true);
  });

  it('campuran aktif + ditolak tetap memblokir', () => {
    expect(bolehTandai(['DITOLAK', 'MENUNGGU'])).toBe(false);
  });
});

describe('aturan ketidakhadiran — BR-X5 bentukRentang', () => {
  it('satu tanggal tanpa sampai', () => {
    expect(bentukRentang('2026-10-03')).toEqual(['2026-10-03']);
  });

  it('rentang 3 hari inklusif', () => {
    expect(bentukRentang('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('tak valid -> kosong (route menjawab 400)', () => {
    expect(bentukRentang('bukan-tanggal')).toEqual([]);
    expect(bentukRentang('2026-10-03', '2026-10-01')).toEqual([]);
  });
});

describe('aturan ketidakhadiran — klasifikasiPenandaan non-melempar', () => {
  it('sel bersih -> dibuat', () => {
    expect(klasifikasiPenandaan({ adaPenandaan: false, statusEvent: [], tokoId: 1 })).toEqual({
      status: 'dibuat',
      alasan: null,
      http: null,
    });
  });

  it('sudah ada penandaan -> ditolak 409 dengan arahan Ubah', () => {
    const hasil = klasifikasiPenandaan({ adaPenandaan: true, statusEvent: [], tokoId: 1 });
    expect(hasil.status).toBe('ditolak');
    expect(hasil.http).toBe(409);
    expect(hasil.alasan).toMatch(/Ubah/);
  });

  it('event aktif -> ditolak 409 pesan persis §5.5', () => {
    const hasil = klasifikasiPenandaan({ adaPenandaan: false, statusEvent: ['MENUNGGU'], tokoId: 1 });
    expect(hasil.status).toBe('ditolak');
    expect(hasil.alasan).toBe('Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.');
  });

  it('event DITOLAK saja -> dibuat', () => {
    expect(klasifikasiPenandaan({ adaPenandaan: false, statusEvent: ['DITOLAK'], tokoId: 1 }).status).toBe('dibuat');
  });

  it('tanpa penempatan -> ditolak 409 pesan jelas', () => {
    const hasil = klasifikasiPenandaan({ adaPenandaan: false, statusEvent: [], tokoId: null });
    expect(hasil.status).toBe('ditolak');
    expect(hasil.http).toBe(409);
    expect(hasil.alasan).toMatch(/tidak ditempatkan/);
  });
});
