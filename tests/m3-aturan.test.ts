import { describe, it, expect } from 'vitest';
import {
  eventAktif,
  dalamBatas20Jam,
  bolehCheckIn,
  bolehCheckOut,
  tokoPadaTanggal,
  tentukanStatusLokasi,
  BATAS_CHECKOUT_JAM,
} from '../src/server/aturan/absensi';
import { geserJamISO, serialisasiWIB } from '../src/server/waktu';

describe('aturan absensi — BR-A7 event aktif', () => {
  it('MENUNGGU dan DISETUJUI aktif, DITOLAK tidak', () => {
    expect(eventAktif('MENUNGGU')).toBe(true);
    expect(eventAktif('DISETUJUI')).toBe(true);
    expect(eventAktif('DITOLAK')).toBe(false);
  });
});

describe('aturan absensi — BR-A10 batas 20 jam', () => {
  const sekarang = '2026-10-03T10:00:00+07:00';

  it('batas tepat 20 jam masih boleh', () => {
    expect(BATAS_CHECKOUT_JAM).toBe(20);
    expect(dalamBatas20Jam(geserJamISO(sekarang, -20), sekarang)).toBe(true);
  });

  it('lewat 20 jam satu detik tidak boleh', () => {
    const dasar = new Date('2026-10-03T10:00:00+07:00').getTime();
    const iso = serialisasiWIB(new Date(dasar - (20 * 3600 + 1) * 1000));
    expect(dalamBatas20Jam(iso, sekarang)).toBe(false);
    const pas = serialisasiWIB(new Date(dasar - 20 * 3600 * 1000));
    expect(dalamBatas20Jam(pas, sekarang)).toBe(true);
  });

  it('check-in kemarin 21 jam lalu tidak dianggap terbuka', () => {
    expect(dalamBatas20Jam(geserJamISO(sekarang, -21), sekarang)).toBe(false);
    expect(dalamBatas20Jam(geserJamISO(sekarang, -19), sekarang)).toBe(true);
  });

  it('check-in bertanggal masa depan tidak dianggap terbuka (C-1)', () => {
    expect(dalamBatas20Jam('2026-10-04T18:00:00+07:00', '2026-10-03T12:00:00+07:00')).toBe(false);
  });
});

describe('aturan absensi — BR-A5/A6 kuota dan pasangan', () => {
  it('check-in pertama boleh', () => {
    expect(bolehCheckIn({ terbukaDalamBatas: false, jumlahAktifHariIni: 0 }).boleh).toBe(true);
  });

  it('ada terbuka dalam batas -> check-in ditolak', () => {
    const hasil = bolehCheckIn({ terbukaDalamBatas: true, jumlahAktifHariIni: 0 });
    expect(hasil.boleh).toBe(false);
  });

  it('2 aktif -> check-in ketiga ditolak dengan pesan kuota', () => {
    const hasil = bolehCheckIn({ terbukaDalamBatas: false, jumlahAktifHariIni: 2 });
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toBe('Batas absen hari ini sudah tercapai.');
  });

  it('check-out boleh bila ada terbuka dalam batas', () => {
    expect(bolehCheckOut({ dalamBatas: true, adaTerbuka: true }).boleh).toBe(true);
  });

  it('terbuka tapi lewat 20 jam -> pesan hubungi admin', () => {
    const hasil = bolehCheckOut({ dalamBatas: false, adaTerbuka: true });
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toMatch(/Hubungi admin/);
  });

  it('tidak ada terbuka sama sekali -> pesan keadaan berubah', () => {
    const hasil = bolehCheckOut({ dalamBatas: false, adaTerbuka: false });
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toMatch(/muat ulang/);
  });
});

describe('aturan absensi — BR-A12 snapshot toko', () => {
  const riwayat = [
    { toko_id: 1, mulai: '2026-09-01', sampai: '2026-09-30' },
    { toko_id: 2, mulai: '2026-10-01', sampai: null },
  ];

  it('memakai toko pada tanggal absensi', () => {
    expect(tokoPadaTanggal(riwayat, '2026-09-15')).toBe(1);
    expect(tokoPadaTanggal(riwayat, '2026-10-03')).toBe(2);
  });

  it('tanggal tanpa penempatan -> null', () => {
    expect(tokoPadaTanggal(riwayat, '2026-08-01')).toBeNull();
  });
});

describe('aturan absensi — BR-A3 lokasi', () => {
  it('koordinat valid -> TERSEDIA walau klien mengklaim ditolak', () => {
    expect(tentukanStatusLokasi(-6.2, 106.8, 'DITOLAK')).toBe('TERSEDIA');
  });

  it('tanpa koordinat -> ikuti klaim klien', () => {
    expect(tentukanStatusLokasi(undefined, undefined, 'DITOLAK')).toBe('DITOLAK');
    expect(tentukanStatusLokasi(null, null, 'GAGAL')).toBe('GAGAL');
  });

  it('tanpa koordinat dan tanpa klaim -> GAGAL', () => {
    expect(tentukanStatusLokasi(undefined, undefined, undefined)).toBe('GAGAL');
  });

  it('koordinat di luar rentang -> bukan TERSEDIA', () => {
    expect(tentukanStatusLokasi(91, 0, 'GAGAL')).toBe('GAGAL');
    expect(tentukanStatusLokasi(0, 181, 'DITOLAK')).toBe('DITOLAK');
    expect(tentukanStatusLokasi(NaN, NaN, 'GAGAL')).toBe('GAGAL');
  });
});
