import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FormulirBuatAgenda,
  FilterAgenda,
  IsiDialogBatalkan,
  IsiDialogGantiPenerima,
  LabelCakupan,
  LabelStatusAgenda,
  PanelGalat,
  PanelMemuat,
  TabelAgenda,
  TeksPenerima,
  tanggalPendek,
  FORMULIR_KOSONG,
  LABEL_CAKUPAN,
  type AgendaLengkap,
  type BarisAgenda,
} from '../src/app/admin/agenda/komponen';
import { menuUntukPeran } from '../src/app/admin/menu';

/**
 * Komponen halaman Agenda (M11).
 *
 * Semua diuji lewat `renderToStaticMarkup` — bukan `existsSync` dan bukan `toContain` atas
 * teks source. Pelajaran M9: `existsSync('page.tsx')` tetap lulus untuk file yang isinya
 * rusak; dua mutasi halaman yang dirender sudah terbukti lolos hanya karena tesnya
 * membaca teks. renderToStaticMarkup gagal pada keduanya.
 */

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

const AGENDA_A: BarisAgenda = {
  id: 1,
  judul: 'Ganti lampu emergency',
  keterangan: 'Rak 3 sisi kanan',
  wajib_foto: 1,
  cakupan: 'TOKO',
  toko_id: 1,
  toko_nama: 'Toko A',
  target_tanggal: '2026-10-10',
  status: 'AKTIF',
  alasan_batal: null,
  dibuat_oleh_nama: 'Admin',
  dibuat_oleh_karyawan: null,
};

const AGENDA_B: BarisAgenda = {
  id: 2,
  judul: 'Cek generator',
  keterangan: null,
  wajib_foto: 0,
  cakupan: 'SEMUA',
  toko_id: null,
  toko_nama: null,
  target_tanggal: null,
  status: 'DIBATALKAN',
  alasan_batal: 'Sudah selesai oleh teknisi luar',
  dibuat_oleh_nama: null,
  dibuat_oleh_karyawan: 5,
};

function lengkap(agenda: BarisAgenda, namaPenerima: string[]): AgendaLengkap {
  return { agenda, penerimaIds: [], namaPenerima };
}

describe('tanggalPendek', () => {
  it('memformat YYYY-MM-DD menjadi dd/MM/YYYY', () => {
    expect(tanggalPendek('2026-10-10')).toBe('10/10/2026');
  });

  it('tanggal kosong (opsional) tampil sebagai em-dash', () => {
    expect(tanggalPendek(null)).toBe('—');
  });
});

describe('label status & cakupan', () => {
  it('Aktif / Dibatalkan', () => {
    expect(render(createElement(LabelStatusAgenda, { status: 'AKTIF' }))).toContain('Aktif');
    expect(render(createElement(LabelStatusAgenda, { status: 'DIBATALKAN' }))).toContain('Dibatalkan');
  });

  it('tiga cakupan punya label Bahasa Indonesia', () => {
    expect(LABEL_CAKUPAN['KARYAWAN']).toBe('Karyawan tertentu');
    expect(LABEL_CAKUPAN['TOKO']).toBe('Satu toko');
    expect(LABEL_CAKUPAN['SEMUA']).toBe('Seluruh karyawan');
    expect(render(createElement(LabelCakupan, { cakupan: 'TOKO' }))).toContain('Satu toko');
  });
});

describe('TeksPenerima', () => {
  it('rincian sedikit ditampilkan semua', () => {
    expect(render(createElement(TeksPenerima, { namaPenerima: ['Andi', 'Budi'] }))).toContain('Andi, Budi');
  });

  it('lebih dari lima diringkas dengan hitungan sisa', () => {
    const banyak = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    const html = render(createElement(TeksPenerima, { namaPenerima: banyak }));
    expect(html).toContain('+2 lainnya');
    expect(html).not.toContain('a6');
  });

  it('tanpa penerima memberi penjelasan, bukan sel kosong', () => {
    expect(render(createElement(TeksPenerima, { namaPenerima: [] }))).toContain('Tidak ada penerima aktif');
  });
});

describe('FormulirBuatAgenda', () => {
  it('menampilkan kedua pilihan wajib foto', () => {
    const html = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, wajib_foto: true },
        pilihanToko: [],
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(html).toContain('foto before dan foto after');
  });

  it('menampilkan versi teks saat tidak wajib foto', () => {
    const html = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, wajib_foto: false },
        pilihanToko: [],
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(html).toContain('keterangan opsional');
    expect(html).not.toContain('foto before dan foto after');
  });

  it('pilihan toko hanya muncul saat cakupan TOKO', () => {
    const toko = [{ id: 1, nama: 'Toko A' }];
    const tanpa = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, cakupan: 'SEMUA' },
        pilihanToko: toko,
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(tanpa).not.toContain('Toko A');

    const dengan = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, cakupan: 'TOKO', tokoId: '1' },
        pilihanToko: toko,
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(dengan).toContain('Toko A');
  });

  it('daftar karyawan hanya muncul saat cakupan KARYAWAN', () => {
    const kryawan = [{ id: 3, nama: 'Andi' }];
    const tanpa = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, cakupan: 'SEMUA' },
        pilihanToko: [],
        pilihanKaryawan: kryawan,
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(tanpa).not.toContain('Andi');
    const dengan = render(
      createElement(FormulirBuatAgenda, {
        form: { ...FORMULIR_KOSONG, cakupan: 'KARYAWAN', karyawan: [3] },
        pilihanToko: [],
        pilihanKaryawan: kryawan,
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(dengan).toContain('Andi');
  });

  it('target tanggal ditandai opsional', () => {
    const html = render(
      createElement(FormulirBuatAgenda, {
        form: FORMULIR_KOSONG,
        pilihanToko: [],
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: false,
      }),
    );
    expect(html).toContain('Tanggal target (opsional)');
  });

  it('tombol simpan punya atribut disabled="" saat sedang menyimpan', () => {
    // Penanda yang benar adalah ATRIBUT disabled, bukan kata "disabled" di kelas CSS:
    // kelas dasar shadcn Button memuat literal `disabled:` (lesson UI-2), jadi
    // pola /disabled/ akan salah cocok.
    const html = render(
      createElement(FormulirBuatAgenda, {
        form: FORMULIR_KOSONG,
        pilihanToko: [],
        pilihanKaryawan: [],
        onUbah: () => {},
        onKirim: () => {},
        sedangSimpan: true,
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('Menyimpan…');
  });
});

describe('FilterAgenda', () => {
  it('memakai nilai yang diberikan untuk status dan toko (bukan hardcode)', () => {
    const html = render(
      createElement(FilterAgenda, {
        status: 'DIBATALKAN',
        tokoId: '1',
        pilihanToko: [{ id: 1, nama: 'Toko A' }],
        onUbah: () => {},
      }),
    );
    expect(html).toMatch(/<option[^>]*value="DIBATALKAN"[^>]*selected/);
    expect(html).toMatch(/<option[^>]*value="1"[^>]*selected/);
  });
});

describe('TabelAgenda', () => {
  it('kosong memberi pesan, bukan tabel kosong', () => {
    const html = render(
      createElement(TabelAgenda, { daftar: [], onBatalkan: () => {}, onGantiPenerima: () => {} }),
    );
    expect(html).toContain('Belum ada agenda.');
    expect(html).not.toContain('<table');
  });

  it('menampilkan judul, penerima, dan kebutuhan foto', () => {
    const html = render(
      createElement(TabelAgenda, {
        daftar: [lengkap(AGENDA_A, ['Andi', 'Budi'])],
        onBatalkan: () => {},
        onGantiPenerima: () => {},
      }),
    );
    expect(html).toContain('Ganti lampu emergency');
    expect(html).toContain('Andi, Budi');
    expect(html).toContain('Before + After');
    expect(html).toContain('10/10/2026');
  });

  it('menandai agenda tanpa foto sebagai "Tanpa foto"', () => {
    const html = render(
      createElement(TabelAgenda, {
        daftar: [lengkap(AGENDA_B, [])],
        onBatalkan: () => {},
        onGantiPenerima: () => {},
      }),
    );
    expect(html).toContain('Tanpa foto');
  });

  it('agenda AKTIF punya tombol Batalkan dan Ubah Penerima', () => {
    const html = render(
      createElement(TabelAgenda, {
        daftar: [lengkap(AGENDA_A, ['Andi'])],
        onBatalkan: () => {},
        onGantiPenerima: () => {},
      }),
    );
    expect(html).toContain('Batalkan');
    expect(html).toContain('Ubah Penerima');
  });

  it('agenda buatan karyawan sendiri TIDAK punya tombol Ubah Penerima (BR-G5)', () => {
    const html = render(
      createElement(TabelAgenda, {
        daftar: [lengkap({ ...AGENDA_A, dibuat_oleh_karyawan: 7, dibuat_oleh_nama: null }, ['Andi'])],
        onBatalkan: () => {},
        onGantiPenerima: () => {},
      }),
    );
    expect(html).toContain('Batalkan');
    expect(html).not.toContain('Ubah Penerima');
  });

  it('agenda DIBATALKAN tidak punya aksi dan menampilkan alasannya', () => {
    const html = render(
      createElement(TabelAgenda, {
        daftar: [lengkap(AGENDA_B, [])],
        onBatalkan: () => {},
        onGantiPenerima: () => {},
      }),
    );
    expect(html).toContain('Dibatalkan');
    expect(html).toContain('Sudah selesai oleh teknisi luar');
    expect(html).not.toContain('Batalkan</button>');
    expect(html).toContain('Dibuat oleh karyawan sendiri');
  });
});

describe('dialog pembatalan', () => {
  it('menyatakan pembatalan tidak menghapus laporan', () => {
    const html = render(
      createElement(IsiDialogBatalkan, {
        judulAgenda: 'Ganti lampu',
        alasan: '',
        onUbahAlasan: () => {},
        onBatal: () => {},
        onSimpan: () => {},
      }),
    );
    expect(html).toContain('tidak menghapus laporan');
    expect(html).toContain('Alasan pembatalan (wajib)');
  });

  it('alasan pembatalan wajib diisi (K-62), jadi dialog menjelaskan', () => {
    const html = render(
      createElement(IsiDialogBatalkan, {
        judulAgenda: 'X',
        alasan: '',
        onUbahAlasan: () => {},
        onBatal: () => {},
        onSimpan: () => {},
      }),
    );
    expect(html).toContain('wajib');
  });
});

describe('dialog ganti penerima', () => {
  it('menjelaskan bahwa penerima mengikuti penempatan saat ini (K-58)', () => {
    const html = render(
      createElement(IsiDialogGantiPenerima, {
        form: { cakupan: 'SEMUA', tokoId: '', karyawan: [] },
        pilihanToko: [],
        pilihanKaryawan: [],
        onUbah: () => {},
        onBatal: () => {},
        onSimpan: () => {},
      }),
    );
    expect(html).toContain('penempatan karyawan saat ini');
  });

  it('daftar karyawan hanya saat cakupan KARYAWAN', () => {
    const kryawan = [{ id: 1, nama: 'Andi' }];
    const tanpa = render(
      createElement(IsiDialogGantiPenerima, {
        form: { cakupan: 'SEMUA', tokoId: '', karyawan: [] },
        pilihanToko: [],
        pilihanKaryawan: kryawan,
        onUbah: () => {},
        onBatal: () => {},
        onSimpan: () => {},
      }),
    );
    expect(tanpa).not.toContain('Andi');
  });
});

describe('menu admin', () => {
  it('ADMIN dan Super Admin sama-sama punya menu Agenda (BR-G20)', () => {
    for (const peran of ['ADMIN', 'SUPER_ADMIN'] as const) {
      const kerja = menuUntukPeran(peran).find((k) => k.judul === 'Kerja Harian')!;
      expect(kerja.item.some((i) => i.href === '/admin/agenda'), `${peran} menu Agenda`).toBe(true);
    }
  });
});

describe('PanelGalat / PanelMemuat', () => {
  it('keduanya benar-benar merender', () => {
    expect(render(createElement(PanelMemuat))).toContain('animate-pulse');
    const galat = render(createElement(PanelGalat, { pesan: 'Gagal memuat data.', onCobaLagi: () => {} }));
    expect(galat).toContain('Gagal memuat data.');
    expect(galat).toContain('Coba lagi');
  });
});