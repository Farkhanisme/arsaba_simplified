import { describe, it, expect } from 'vitest';
import {
  penerimaAgenda,
  ringkasanPenerima,
  normalisasiPembuatan,
  bolehBatalkan,
  bolehUbahTujuan,
  terlihatUntukAdmin,
  labelStatusAgenda,
  labelStatusLaporan,
  JUDUL_MAKS,
  KETERANGAN_MAKS,
  MAKS_TUJUAN_EKPLISIT,
  type PenempatanTerbuka,
} from '../src/server/aturan/agenda';

/**
 * Aturan murni agenda (rules/02 §18). Tanpa database — itu tujuan thrillnya.
 *
 * Pengingat yang berlaku untuk file ini (lesson M9): sebuah tes baru baru terbukti
 * menangkap bug kalau aturannya DIMATIKAN sementara lalu tes itu gagal. Setiap blok
 * "mutasi" di bawah Modell melakukan hal itu secara eksplisit.
 */

function kry(id: number, nama: string, toko: number | null, aktif = true): PenempatanTerbuka {
  return { karyawan_id: id, nama, aktif, toko_id: toko };
}

describe('BR-G2: penerima agenda dihitung dari penempatan saat ini', () => {
  const penempatan = [
    kry(1, 'Andi', 10),
    kry(2, 'Budi', 10),
    kry(3, 'Citra', 20),
    kry(4, 'Dina', 10, false), // NONAKTIF
    kry(5, 'Eka', null), // belum ditempatkan
  ];

  it('TOKO: hanya karyawan AKTIF di toko itu', () => {
    const hasil = penerimaAgenda({ cakupan: 'TOKO', toko_id: 10, tujuan_karyawan_id: [] }, penempatan);
    expect(hasil).toEqual([1, 2]);
  });

  it('TOKO: karyawan nonaktif DITOLAK meski di toko itu (BR-G2 "aktif = 1")', () => {
    const hasil = penerimaAgenda({ cakupan: 'TOKO', toko_id: 10, tujuan_karyawan_id: [] }, penempatan);
    expect(hasil).not.toContain(4);
  });

  it('SEMUA: seluruh karyawan aktif, termasuk yang belum ditempatkan', () => {
    const hasil = penerimaAgenda({ cakupan: 'SEMUA', toko_id: null, tujuan_karyawan_id: [] }, penempatan);
    expect(hasil).toEqual([1, 2, 3, 5]);
  });

  it('SEMUA: karyawan nonaktif tidak masuk', () => {
    const hasil = penerimaAgenda({ cakupan: 'SEMUA', toko_id: null, tujuan_karyawan_id: [] }, penempatan);
    expect(hasil).not.toContain(4);
  });

  it('KARYAWAN: daftar eksplisit, tidak terpengaruh penempatan', () => {
    // Eka belum ditempatkan, Dina nonaktif — keduanya tetap penerima kalau dipilih.
    const hasil = penerimaAgenda({ cakupan: 'KARYAWAN', toko_id: null, tujuan_karyawan_id: [5, 4] }, penempatan);
    expect(hasil).toEqual([4, 5]);
  });

  it('KARYAWAN: duplikat dirapikan dan diurutkan', () => {
    const hasil = penerimaAgenda({ cakupan: 'KARYAWAN', toko_id: null, tujuan_karyawan_id: [3, 1, 3] }, penempatan);
    expect(hasil).toEqual([1, 3]);
  });

  it('TOKO yang tidak ada karyawannya -> daftar kosong, bukan error', () => {
    const hasil = penerimaAgenda({ cakupan: 'TOKO', toko_id: 99, tujuan_karyawan_id: [] }, penempatan);
    expect(hasil).toEqual([]);
  });

  // ---- BUKTI MUTASI ------------------------------------------------------------------
  // Yang terbukti di sini: aturan "karyawan nonaktif tidak jadi penerima" benar-benar
  // dijalankan, dan itu yang membuat selisih antara kasus aktif dan nonaktif.
  //
  // Bentuknya sengaja memakai kasus batas: kalau satu-satunya karyawan di daftar adalah
  // nonaktif, hasil HARUS kosong. Menjalankan `penerimaAgenda` tanpa penyaringan `aktif`
  // akan mengembalikan [9] dan tes ini langsung gagal — jadi tesnya benar-benar
  // menguji aturan itu, bukan sekadar membandingkan fungsi dengan dirinya sendiri.
  it('MUTASI: penyaringan karyawan nonaktif benar-benar berjalan', () => {
    const hanyaNonaktif = [kry(9, 'Nonaktif', 10, false)];
    const hasil = penerimaAgenda({ cakupan: 'SEMUA', toko_id: null, tujuan_karyawan_id: [] }, hanyaNonaktif);
    expect(hasil).toEqual([]);
    // Dan versi sama tapi aktif -> masuk. Jadi perbedaannya benar-benar `aktif`.
    const aktif = [kry(9, 'Aktif', 10, true)];
    expect(penerimaAgenda({ cakupan: 'SEMUA', toko_id: null, tujuan_karyawan_id: [] }, aktif)).toEqual([9]);
    expect(penerimaAgenda({ cakupan: 'TOKO', toko_id: 10, tujuan_karyawan_id: [] }, hanyaNonaktif)).toEqual([]);
  });
});

describe('ringkasanPenerima', () => {
  it('mengurutkan nama dengan urutan Bahasa Indonesia', () => {
    const hasil = ringkasanPenerima(
      { cakupan: 'KARYAWAN', toko_id: null, tujuan_karyawan_id: [3, 1, 2] },
      [kry(1, 'sari', 10), kry(2, 'Andi', 10), kry(3, 'Budi', 10)],
    );
    expect(hasil.jumlah).toBe(3);
    expect(hasil.nama).toEqual(['Andi', 'Budi', 'sari']);
  });

  it('karyawan di daftar tujuan tapi tidak ada di penempatan tetap tampil (jangan hilang diam-diam)', () => {
    const hasil = ringkasanPenerima({ cakupan: 'KARYAWAN', toko_id: null, tujuan_karyawan_id: [99] }, []);
    expect(hasil.nama).toEqual(['Karyawan #99']);
  });
});

describe('BR-G1: normalisasi pembuatan agenda', () => {
  const ada = { tokoAda: (id: number) => id === 10, karyawanAktif: (id: number) => id !== 99 };

  it('judul kosong ditolak', () => {
    const h = normalisasiPembuatan({ judul: '   ', wajib_foto: true, cakupan: 'SEMUA' }, ada);
    expect(h.status).toBe('ditolak');
    expect(h.alasan).toBe('Judul agenda wajib diisi.');
  });

  it('judul dipangkas whitespace di tepi', () => {
    const h = normalisasiPembuatan({ judul: '  Bersih rak  ', wajib_foto: true, cakupan: 'SEMUA' }, ada);
    expect(h.status).toBe('boleh');
    expect(h.nilai['judul']).toBe('Bersih rak');
  });

  it('judul melebihi batas ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'x'.repeat(JUDUL_MAKS + 1), wajib_foto: true, cakupan: 'SEMUA' }, ada);
    expect(h.status).toBe('ditolak');
    expect(h.alasan).toContain(String(JUDUL_MAKS));
  });

  it('keterangan kosong jadi null, bukan string kosong', () => {
    const h = normalisasiPembuatan({ judul: 'A', keterangan: '   ', wajib_foto: true, cakupan: 'SEMUA' }, ada);
    expect(h.nilai['keterangan']).toBeNull();
  });

  it('keterangan melebihi batas ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'A', keterangan: 'x'.repeat(KETERANGAN_MAKS + 1), wajib_foto: true, cakupan: 'SEMUA' }, ada);
    expect(h.status).toBe('ditolak');
  });

  it('KARYAWAN tanpa pilihan ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [] }, ada);
    expect(h.status).toBe('ditolak');
    expect(h.alasan).toBe('Pilih minimal satu karyawan.');
  });

  it('KARYAWAN dengan karyawan nonaktif ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [1, 99] }, ada);
    expect(h.status).toBe('ditolak');
  });

  it('KARYAWAN melebihi batas tujuan ditolak', () => {
    const banyak = Array.from({ length: MAKS_TUJUAN_EKPLISIT + 1 }, (_, i) => i + 1);
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: banyak }, ada);
    expect(h.status).toBe('ditolak');
  });

  it('KARYAWAN: id diurutkan dan didedupkan', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'KARYAWAN', karyawan_ids: [3, 1, 3] }, ada);
    expect(h.nilai['karyawan_ids']).toEqual([1, 3]);
  });

  it('TOKO tanpa toko_id ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'TOKO' }, ada);
    expect(h.status).toBe('ditolak');
    expect(h.alasan).toBe('Pilih toko penerima agenda.');
  });

  it('TOKO dengan toko tidak terdaftar ditolak', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'TOKO', toko_id: 77 }, ada);
    expect(h.status).toBe('ditolak');
  });

  it('SEMUA tidak boleh punya toko_id (bisa dikirimi toko dan mengacaukan filter)', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: true, cakupan: 'SEMUA', toko_id: 10 }, ada);
    expect(h.nilai['toko_id']).toBeNull();
  });

  it('target_tanggal kosong menjadi null (opsional, K-57)', () => {
    const h = normalisasiPembuatan({ judul: 'A', wajib_foto: false, cakupan: 'SEMUA' }, ada);
    expect(h.nilai['target_tanggal']).toBeNull();
    expect(h.nilai['wajib_foto']).toBe(0);
  });
});

describe('K-62: pembatalan dan perubahan penerima', () => {
  it('AKTIF boleh dibatalkan', () => {
    expect(bolehBatalkan('AKTIF').status).toBe('boleh');
  });

  it('DIBATALKAN tidak bisa dibatalkan lagi (status terminal)', () => {
    expect(bolehBatalkan('DIBATALKAN').status).toBe('ditolak');
  });

  it('status tak dikenal ditolak, bukan dianggap boleh', () => {
    expect(bolehBatalkan('APA_SAJA').status).toBe('ditolak');
  });

  it('penerima agenda buatan admin boleh diubah', () => {
    expect(bolehUbahTujuan('AKTIF', null).status).toBe('boleh');
  });

  it('penerima agenda buatan karyawan sendiri DITOLAK', () => {
    const h = bolehUbahTujuan('AKTIF', 7);
    expect(h.status).toBe('ditolak');
    expect(h.alasan).toContain('karyawan sendiri');
  });

  it('agenda dibatalkan tidak bisa ganti penerima', () => {
    expect(bolehUbahTujuan('DIBATALKAN', null).status).toBe('ditolak');
  });
});

describe('BR-G9: draft tidak terlihat admin', () => {
  it('DRAFT tidak terlihat', () => {
    expect(terlihatUntukAdmin('DRAFT')).toBe(false);
  });

  it('tiga status lainnya terlihat', () => {
    for (const s of ['MENUNGGU', 'DISETUJUI', 'DITOLAK']) {
      expect(terlihatUntukAdmin(s)).toBe(true);
    }
  });
});

describe('label Bahasa Indonesia', () => {
  it('status agenda', () => {
    expect(labelStatusAgenda('AKTIF')).toBe('Aktif');
    expect(labelStatusAgenda('DIBATALKAN')).toBe('Dibatalkan');
  });

  it('status laporan', () => {
    expect(labelStatusLaporan('DRAFT')).toBe('Draft');
    expect(labelStatusLaporan('MENUNGGU')).toBe('Menunggu');
    expect(labelStatusLaporan('DISETUJUI')).toBe('Disetujui');
    expect(labelStatusLaporan('DITOLAK')).toBe('Ditolak');
  });
});