import { describe, it, expect } from 'vitest';
import {
  bolehMengerjakan,
  bolehSimpanDraft,
  bolehSubmit,
  percobaanBerikutnya,
  labelTahap,
  aksiYangTersedia,
  bolehVerifikasiPadaPeriodeTerekspor,
  bolehVerifikasiStatus,
  bolehTolakLaporan,
  laporanMemblokirEkspor,
  hitungMetrikAgenda,
  type KeadaanAgendaUntukKerja,
} from '../src/server/aturan/laporan';

/**
 * Aturan murni laporan agenda (rules/02 §18.3–§18.5). Tanpa database.
 *
 * Yang paling sering salah di file ini: lupa bahwa `DRAFT` masih punya foto before.
 * Karena itu setiap kasus batas draft punya tes sendiri, bukan cuma satu tes umum.
 */

function keadaan(sebagian: Partial<KeadaanAgendaUntukKerja> = {}): KeadaanAgendaUntukKerja {
  return {
    statusAgenda: 'AKTIF',
    adalahPenerima: true,
    dibuatSendiri: false,
    wajibFoto: true,
    laporanTerakhir: null,
    ...sebagian,
  };
}

describe('bolehMengerjakan (BR-G3)', () => {
  it('penerima resmi boleh', () => {
    expect(bolehMengerjakan(keadaan({ adalahPenerima: true }))).toBe(true);
  });

  it('pembuat agenda sendiri boleh, walau bukan penerima resmi', () => {
    // Agenda pribadi tidak punya baris agenda_tujuan sama sekali, jadi kalau aturan
    // ini tidak ada, agenda buatan sendiri akan selalu 403.
    expect(bolehMengerjakan(keadaan({ adalahPenerima: false, dibuatSendiri: true }))).toBe(true);
  });

  it('bukan penerima dan bukan pembuat sendiri -> tidak boleh', () => {
    expect(bolehMengerjakan(keadaan({ adalahPenerima: false, dibuatSendiri: false }))).toBe(false);
  });
});

describe('bolehSimpanDraft (BR-G7)', () => {
  it('foto before ada -> boleh', () => {
    expect(bolehSimpanDraft(keadaan(), true).boleh).toBe(true);
  });

  it('agenda wajib foto tanpa foto -> ditolak 400', () => {
    const h = bolehSimpanDraft(keadaan(), false);
    expect(h.boleh).toBe(false);
    expect(h.http).toBe(400);
  });

  it('agenda TANPA wajib foto tetap boleh tanpa foto', () => {
    expect(bolehSimpanDraft(keadaan({ wajibFoto: false }), false).boleh).toBe(true);
  });

  it('agenda dibatalkan menutup pengerjaan', () => {
    const h = bolehSimpanDraft(keadaan({ statusAgenda: 'DIBATALKAN' }), true);
    expect(h.boleh).toBe(false);
    expect(h.http).toBe(409);
    expect(h.alasan).toBe('Agenda ini sudah dibatalkan.');
  });

  it('bukan penerima -> 403, bukan 409', () => {
    // 403 supaya bedanya jelas: ini bukan "sudah beres", ini "bukan hakmu".
    expect(bolehSimpanDraft(keadaan({ adalahPenerima: false }), true).http).toBe(403);
  });

  it('MENYIMPAN ULANG draft diizinkan (foto lama jadi yatim, bukan ditolak)', () => {
    const denganDraft = keadaan({
      laporanTerakhir: { id: 1, percobaan: 1, status: 'DRAFT', sebelum_file_id: 'lama', sesudah_file_id: null, alasan_tolak: null },
    });
    expect(bolehSimpanDraft(denganDraft, true).boleh).toBe(true);
  });
});

describe('bolehSubmit (BR-G7/G8)', () => {
  const draft = keadaan({
    laporanTerakhir: { id: 1, percobaan: 1, status: 'DRAFT', sebelum_file_id: 'f1', sesudah_file_id: null, alasan_tolak: null },
  });

  it('draft + foto after -> boleh', () => {
    expect(bolehSubmit(draft, true).boleh).toBe(true);
  });

  it('agenda wajib foto tanpa foto after -> ditolak', () => {
    expect(bolehSubmit(draft, false).http).toBe(400);
  });

  it('belum ada draft sama sekali -> harus simpan foto before dulu', () => {
    const h = bolehSubmit(keadaan(), true);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('foto before');
  });

  it('draft tanpa foto before (hanya keterangan) -> ditolak', () => {
    // Foto before WAJIB ada di draft walau agenda sedang dikirim ulang. Ini yang
    // mencegah laporan "after saja" masuk tanpa bukti kondisi awal.
    const rusak = keadaan({
      laporanTerakhir: { id: 1, percobaan: 1, status: 'DRAFT', sebelum_file_id: null, sesudah_file_id: null, alasan_tolak: null },
    });
    expect(bolehSubmit(rusak, true).boleh).toBe(false);
  });

  it('laporan sudah MENUNGGU tidak boleh dikirim ulang', () => {
    const menunggu = keadaan({
      laporanTerakhir: { id: 1, percobaan: 1, status: 'MENUNGGU', sebelum_file_id: 'f1', sesudah_file_id: 'f2', alasan_tolak: null },
    });
    const h = bolehSubmit(menunggu, true);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Menunggu verifikasi');
  });

  it('agenda tanpa wajib foto: keterangan saja cukup, foto after tidak diminta', () => {
    const tanpaFoto = keadaan({
      wajibFoto: false,
      laporanTerakhir: { id: 1, percobaan: 1, status: 'DRAFT', sebelum_file_id: null, sesudah_file_id: null, alasan_tolak: null },
    });
    expect(bolehSubmit(tanpaFoto, false).boleh).toBe(true);
  });
});

describe('percobaan ulang setelah DITOLAK (BR-G11, K-61)', () => {
  it('percobaan berikutnya = terakhir + 1, mulai dari 1 saat belum pernah', () => {
    expect(percobaanBerikutnya(0)).toBe(1);
    expect(percobaanBerikutnya(1)).toBe(2);
    expect(percobaanBerikutnya(7)).toBe(8);
  });

  it('DITOLAK membuka aksi ULANG', () => {
    const ditolak = keadaan({
      laporanTerakhir: { id: 1, percobaan: 1, status: 'DITOLAK', sebelum_file_id: null, sesudah_file_id: null, alasan_tolak: null },
    });
    expect(aksiYangTersedia(ditolak)).toBe('ULANG');
    // Dan boleh mengulang: bolehSubmit menolak karena belum ada draft BARU.
    expect(bolehSubmit(ditolak, true).alasan).toContain('foto before');
  });
});

describe('aksiYangTersedia (menentukan tombol mana yang muncul)', () => {
  it('belum mulai -> SIMPAN_DRAFT', () => {
    expect(aksiYangTersedia(keadaan())).toBe('SIMPAN_DRAFT');
  });

  it('draft -> SUBMIT', () => {
    expect(
      aksiYangTersedia(keadaan({ laporanTerakhir: { id: 1, percobaan: 1, status: 'DRAFT', sebelum_file_id: 'f', sesudah_file_id: null, alasan_tolak: null } })),
    ).toBe('SUBMIT');
  });

  it('MENUNGGU -> tidak ada aksi (tunggu admin)', () => {
    expect(
      aksiYangTersedia(keadaan({ laporanTerakhir: { id: 1, percobaan: 1, status: 'MENUNGGU', sebelum_file_id: 'f', sesudah_file_id: 'g', alasan_tolak: null } })),
    ).toBe('TUNDAK_BISA');
  });

  it('DISETUJUI -> tidak ada aksi, bukan "coba lagi"', () => {
    // Ini yang membedakan selesai dari belum: menampilkan tombol "Coba Lagi" pada
    // laporan yang sudah disetujui akan menyuruh karyawan mengulang pekerjaan sah.
    expect(
      aksiYangTersedia(keadaan({ laporanTerakhir: { id: 1, percobaan: 1, status: 'DISETUJUI', sebelum_file_id: 'f', sesudah_file_id: 'g', alasan_tolak: null } })),
    ).toBe('TUNDAK_BISA');
  });

  it('DIBATALKAN -> tidak ada aksi', () => {
    expect(aksiYangTersedia(keadaan({ statusAgenda: 'DIBATALKAN' }))).toBe('TUNDAK_BISA');
  });
});

describe('labelTahap (K-60: draft dan menunggu tidak boleh memakai kata "selesai")', () => {
  it('DRAFT dan MENUNGGU tidak memakai kata "Selesai"', () => {
    expect(labelTahap('DRAFT')).toBe('Draft');
    expect(labelTahap('MENUNGGU')).toBe('Menunggu verifikasi');
    expect(labelTahap('DRAFT')).not.toContain('Selesai');
    expect(labelTahap('MENUNGGU')).not.toContain('Selesai');
  });

  it('DISETUJUI = Selesai, DITOLAK = Ditolak', () => {
    expect(labelTahap('DISETUJUI')).toBe('Selesai');
    expect(labelTahap('DITOLAK')).toBe('Ditolak');
  });
});

describe('verifikasi admin (BR-G12, K-65)', () => {
  it('DRAFT tidak bisa diverifikasi', () => {
    const h = bolehVerifikasiStatus('DRAFT');
    expect(h.boleh).toBe(false);
    expect(h.http).toBe(400);
  });

  it('status lain boleh diverifikasi', () => {
    for (const s of ['MENUNGGU', 'DISETUJUI', 'DITOLAK']) {
      expect(bolehVerifikasiStatus(s).boleh).toBe(true);
    }
  });

  it('periode belum terekspor: dua peran boleh', () => {
    expect(bolehVerifikasiPadaPeriodeTerekspor(false, 'ADMIN').boleh).toBe(true);
    expect(bolehVerifikasiPadaPeriodeTerekspor(false, 'SUPER_ADMIN').boleh).toBe(true);
  });

  it('periode SUDAH terekspor: hanya Super Admin (K-32/K-65)', () => {
    expect(bolehVerifikasiPadaPeriodeTerekspor(true, 'ADMIN').boleh).toBe(false);
    expect(bolehVerifikasiPadaPeriodeTerekspor(true, 'SUPER_ADMIN').boleh).toBe(true);
  });

  it('alasan tolak wajib (BR-G11)', () => {
    expect(bolehTolakLaporan('').http).toBe(400);
    expect(bolehTolakLaporan('   ').http).toBe(400);
    expect(bolehTolakLaporan(null).http).toBe(400);
    expect(bolehTolakLaporan('Tidak sesuai').boleh).toBe(true);
  });

  it('alasan terlalu panjang ditolak', () => {
    expect(bolehTolakLaporan('x'.repeat(501)).http).toBe(400);
  });
});

describe('BR-G15: hanya MENUNGGU yang memblokir ekspor (K-63)', () => {
  it('DRAFT TIDAK memblokir — inilah alasan K-63 memilihnya', () => {
    // Kalau draft ikut memblokir, satu karyawan yang abandon draft bisa menahan
    // seluruh ekspor toko.
    expect(laporanMemblokirEkspor('DRAFT')).toBe(false);
  });

  it('MENUNGGU memblokir', () => {
    expect(laporanMemblokirEkspor('MENUNGGU')).toBe(true);
  });

  it('DISETUJUI dan DITOLAK tidak memblokir', () => {
    expect(laporanMemblokirEkspor('DISETUJUI')).toBe(false);
    expect(laporanMemblokirEkspor('DITOLAK')).toBe(false);
  });
});

describe('BR-G17: metrik agenda dashboard', () => {
  it('menghitung laporan per status', () => {
    const m = hitungMetrikAgenda(['MENUNGGU', 'MENUNGGU', 'DISETUJUI', 'DITOLAK']);
    expect(m).toEqual({ menunggu: 2, selesai: 1, ditolak: 1 });
  });

  it('DRAFT diabaikan sepenuhnya (BR-G9)', () => {
    expect(hitungMetrikAgenda(['DRAFT', 'DRAFT'])).toEqual({ menunggu: 0, selesai: 0, ditolak: 0 });
  });

  it('daftar kosong -> semua nol', () => {
    expect(hitungMetrikAgenda([])).toEqual({ menunggu: 0, selesai: 0, ditolak: 0 });
  });
});