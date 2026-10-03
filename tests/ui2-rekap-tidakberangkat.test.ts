/**
 * UI-2 Rekap (§5.6) + Tidak Berangkat (§5.5).
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { FilterRekap, PanelRekap } from '../src/app/admin/rekap/komponen';
import {
  FilterTidakBerangkat,
  FormulirTandai,
  IsiDialogUbah,
  LabelJenis,
  PanelHasilTandai,
  TabelPenandaan,
  tanggalPendek,
} from '../src/app/admin/tidak-berangkat/komponen';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

/**
 * Elemen polos = tag table/select/input/textarea/button TANPA data-slot.
 * Komponen shadcn me-render tag asli DENGAN data-slot — itu yang benar dan
 * harus lolos. Pola lama `not.toMatch(/<(table|...)`) salah menolak shadcn.
 */
function tagTanpaSlot(html: string): string[] {
  const semua = [...html.matchAll(/<(table|select|input|textarea|button)[^>]*>/g)].map((m) => m[0]);
  return semua.filter((t) => !t.includes('data-slot'));
}

describe('tanggalPendek tidak berangkat', () => {
  it('2026-10-03 menjadi 03/10/2026', () => {
    expect(tanggalPendek('2026-10-03')).toBe('03/10/2026');
  });
});

describe('Rekap (§5.6: periksa + pratinjau + unduh)', () => {
  const dataLolos = {
    filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: null as number | null },
    pemeriksaan: { boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 0 },
    ringkasan: [],
  };

  it('filter: Dari/Sampai/Toko + Semua toko + Periksa dari shadcn', () => {
    const html = render(
      h(FilterRekap, {
        dari: '',
        sampai: '',
        tokoId: '',
        tokoList: [{ id: 1, nama: 'Toko Melati' }],
        memuat: false,
        onUbah: tidakAda,
        onPeriksa: tidakAda,
      }),
    );
    for (const id of ['r-dari', 'r-sampai', 'r-toko']) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain('Semua toko');
    expect(html).toContain('Periksa &amp; Buat Rekap');
    expect(html).toContain('data-slot="native-select"');
    expect((html.match(/type="date"/g) ?? []).length).toBe(2);
  });

  it('lolos hijau persis + tabel enam kolom + unduh aktif', () => {
    const html = render(h(PanelRekap, { data: dataLolos, mengunduh: false, onUnduh: tidakAda }));
    expect(html).toContain('Semua absensi pada periode ini sudah diverifikasi.');
    for (const kolom of ['Nama', 'Toko', 'Hari Hadir', 'Izin', 'Tanpa Keterangan', 'Total Menit Terlambat Final']) {
      expect(html, kolom).toContain(kolom);
    }
    expect(html).toContain('Unduh Excel (.xlsx)');
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain('data-slot="table"');
  });

  it('gagal merah: jumlah + tautan verifikasi terfilter + unduh mati', () => {
    const html = render(
      h(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: 2 },
          pemeriksaan: { boleh: false, jumlahMenunggu: 3, jumlahCheckinTerbuka: 2, peringatan: 0 },
          ringkasan: [],
        },
        mengunduh: false,
        onUnduh: tidakAda,
      }),
    );
    expect(html).toContain('masih ada 3 absensi menunggu verifikasi');
    expect(html).toContain('2 check-in tanpa check-out');
    expect(html).toContain('href="/admin/verifikasi?status=MENUNGGU&amp;dari=2026-10-01&amp;sampai=2026-10-03&amp;toko_id=2"');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('peringatan kuning tidak memblokir unduh', () => {
    const html = render(
      h(PanelRekap, {
        data: {
          filter: { dari: '2026-10-01', sampai: '2026-10-03', tokoId: null },
          pemeriksaan: { boleh: true, jumlahMenunggu: 0, jumlahCheckinTerbuka: 0, peringatan: 1 },
          ringkasan: [],
        },
        mengunduh: false,
        onUnduh: tidakAda,
      }),
    );
    expect(html).toContain('1 karyawan terjadwal tanpa absen dan tanpa penandaan');
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('mengunduh menampilkan Mengunduh… dan mengunci tombol', () => {
    const html = render(h(PanelRekap, { data: dataLolos, mengunduh: true, onUnduh: tidakAda }));
    expect(html).toContain('Mengunduh…');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('tidak ada elemen polos', () => {
    const html = render(h(PanelRekap, { data: dataLolos, mengunduh: false, onUnduh: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});

describe('Tidak Berangkat (§5.5: formulir + blokir X3 + ubah/hapus)', () => {
  it('jenis berlabel Indonesia lewat Badge', () => {
    expect(render(h(LabelJenis, { jenis: 'IZIN' }))).toContain('>Izin<');
    expect(render(h(LabelJenis, { jenis: 'TANPA_KETERANGAN' }))).toContain('Tanpa Keterangan');
  });

  it('hasil tandai: jumlah + pesan blokir persis + tautan verifikasi', () => {
    const html = render(
      h(PanelHasilTandai, {
        hasil: {
          dibuat: [{ karyawan_id: 2, tanggal: '2026-10-10' }],
          ditolak: [
            {
              karyawan_id: 1,
              tanggal: '2026-10-10',
              alasan: 'Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.',
            },
          ],
        },
      }),
    );
    expect(html).toContain('1 tersimpan, 1 ditolak.');
    expect(html).toContain('Ada absen aktif pada tanggal ini. Tolak absen tersebut terlebih dahulu.');
    expect(html).toContain('href="/admin/verifikasi"');
    // Alasan lain tidak ikut diberi tautan.
    const htmlLain = render(
      h(PanelHasilTandai, {
        hasil: { dibuat: [], ditolak: [{ karyawan_id: 1, tanggal: '2026-10-10', alasan: 'Alasan lain.' }] },
      }),
    );
    expect(htmlLain).not.toContain('href="/admin/verifikasi"');
  });

  it('formulir: Tanggal/Jenis/Catatan + Simpan terkunci tanpa karyawan/tanggal', () => {
    const kosong = render(
      h(FormulirTandai, {
        pilihanKaryawan: [{ id: 1, nama: 'Siti' }],
        form: { karyawan: [], dari: '', sampai: '', jenis: 'IZIN', catatan: '' },
        onUbah: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(kosong).toContain('Tandai tidak berangkat');
    expect(kosong).toContain('>Izin<');
    expect(kosong).toContain('>Tanpa Keterangan<');
    expect(kosong).toContain('data-slot="checkbox"');
    expect(kosong).toMatch(/<button[^>]*\sdisabled=""/);
    const isi = render(
      h(FormulirTandai, {
        pilihanKaryawan: [{ id: 1, nama: 'Siti' }],
        form: { karyawan: [1], dari: '2026-10-10', sampai: '', jenis: 'IZIN', catatan: '' },
        onUbah: tidakAda,
        onKirim: tidakAda,
      }),
    );
    expect(isi).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('filter: Toko/Dari/Sampai + Semua', () => {
    const html = render(
      h(FilterTidakBerangkat, {
        tokoId: '',
        dari: '',
        sampai: '',
        pilihanToko: [{ id: 1, nama: 'Toko Melati' }],
        onUbah: tidakAda,
      }),
    );
    expect(html).toContain('>Semua<');
    expect(html).toContain('>Toko Melati<');
    expect(html).toContain('data-slot="native-select"');
  });

  it('tabel: enam kolom + Badge jenis + Ubah/Hapus; kosong persis', () => {
    const html = render(
      h(TabelPenandaan, {
        daftar: [
          {
            id: 1,
            karyawan_id: 1,
            karyawan_nama: 'Siti',
            toko_id: 1,
            toko_nama: 'Toko Melati',
            tanggal: '2026-10-10',
            jenis: 'IZIN',
            catatan: null,
          },
        ],
        onMintaUbah: tidakAda,
        onHapus: tidakAda,
      }),
    );
    for (const kolom of ['Tanggal', 'Karyawan', 'Toko', 'Jenis', 'Catatan', 'Aksi']) {
      expect(html, kolom).toContain(kolom);
    }
    expect(html).toContain('10/10/2026');
    expect(html).toContain('>Ubah<');
    expect(html).toContain('>Hapus<');
    expect(
      render(h(TabelPenandaan, { daftar: [], onMintaUbah: tidakAda, onHapus: tidakAda })),
    ).toContain('Belum ada penandaan ketidakhadiran.');
  });

  it('isi dialog ubah: Jenis + Catatan textarea + Simpan/Batal', () => {
    const html = render(
      h(IsiDialogUbah, {
        ubah: { id: 1, jenis: 'IZIN', catatan: '' },
        onUbah: tidakAda,
        onBatal: tidakAda,
        onSimpan: tidakAda,
      }),
    );
    expect(html).toContain('Ubah penandaan');
    expect(html).toContain('data-slot="textarea"');
    expect(html).toContain('>Simpan<');
    expect(html).toContain('>Batal<');
  });

  it('tidak ada elemen polos', () => {
    const html = render(
      h(TabelPenandaan, {
        daftar: [
          {
            id: 1,
            karyawan_id: 1,
            karyawan_nama: 'Siti',
            toko_id: 1,
            toko_nama: 'Toko Melati',
            tanggal: '2026-10-10',
            jenis: 'TANPA_KETERANGAN',
            catatan: 'x',
          },
        ],
        onMintaUbah: tidakAda,
        onHapus: tidakAda,
      }),
    );
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});
