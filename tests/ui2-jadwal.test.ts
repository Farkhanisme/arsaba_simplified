/**
 * UI-2 Jadwal (§5.4: grid + panel sel + khusus maks 2 + isi massal).
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FilterJadwal,
  GridJadwal,
  PanelHasilMassal,
  PanelIsiMassal,
  PanelSel,
  ditempatkanPada,
  tanggalPendek,
} from '../src/app/admin/jadwal/komponen';

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

const dataGrid = {
  rentang: [
    { tanggal: '2026-10-13', hari: 'Senin', weekend: false },
    { tanggal: '2026-10-18', hari: 'Minggu', weekend: true },
  ],
  karyawan: [{ id: 1, nama: 'Siti' }],
  penempatan: [{ karyawan_id: 1, mulai: '2026-01-01', sampai: null as string | null }],
  jadwal: [
    {
      id: 1,
      karyawan_id: 1,
      karyawan_nama: 'Siti',
      tanggal: '2026-10-13',
      shift_template_id: 1,
      template_nama: 'Pagi',
      is_override: 1,
      catatan: 'Khusus',
      slot: [{ nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' }],
      peringatan: [],
    },
  ],
  templateCocok: { '2026-10-13': ['Pagi'] } as Record<string, string[]>,
};

describe('fungsi murni jadwal', () => {
  it('tanggalPendek 2026-10-13 menjadi 13/10/2026', () => {
    expect(tanggalPendek('2026-10-13')).toBe('13/10/2026');
  });

  it('ditempatkanPada menghormati rentang sampai null', () => {
    expect(ditempatkanPada(dataGrid.penempatan, 1, '2026-10-13')).toBe(true);
    expect(ditempatkanPada(dataGrid.penempatan, 2, '2026-10-13')).toBe(false);
    expect(
      ditempatkanPada([{ karyawan_id: 1, mulai: '2026-01-01', sampai: '2026-10-12' }], 1, '2026-10-13'),
    ).toBe(false);
  });
});

describe('FilterJadwal (§5.4: toko + Hari/Minggu/Bulan + tanggal acuan)', () => {
  it('toko NativeSelect + mode Tabs + tanggal acuan', () => {
    const html = render(
      h(FilterJadwal, {
        tokoId: '',
        tokoList: [{ id: 1, nama: 'Toko Melati' }],
        mode: 'minggu',
        tanggal: '',
        onUbah: tidakAda,
      }),
    );
    expect(html).toContain('for="j-toko"');
    expect(html).toContain('— Pilih toko —');
    expect(html).toContain('data-slot="native-select"');
    for (const mode of ['Hari', 'Minggu', 'Bulan']) expect(html, mode).toContain(mode);
    expect(html).toContain('data-slot="tabs"');
    expect(html).toContain('Tanggal acuan');
    expect(html).toContain('type="date"');
  });

  it('dropdown menampilkan label Indonesia, bukan id mentah', () => {
    const html = render(
      h(FilterJadwal, {
        tokoId: '1',
        tokoList: [{ id: 1, nama: 'Toko Melati' }],
        mode: 'hari',
        tanggal: '2026-10-13',
        onUbah: tidakAda,
      }),
    );
    expect(html).toContain('>Toko Melati<');
    expect(html).toMatch(/value="1"[^>]*selected|selected[^>]*value="1"/);
  });
});

describe('GridJadwal (baris karyawan, kolom tanggal, Weekend)', () => {
  it('header Karyawan + tanggal pendek + penanda Weekend', () => {
    const peta = new Map(dataGrid.jadwal.map((j) => [`${j.karyawan_id}|${j.tanggal}`, j]));
    const html = render(h(GridJadwal, { data: dataGrid, petaJadwal: peta, onPilihSel: tidakAda }));
    expect(html).toContain('Karyawan');
    expect(html).toContain('13/10/2026');
    expect(html).toContain('(Weekend)');
    expect(html).toContain('Siti');
    expect(html).toContain('Pagi 07:00–15:00');
    // Badge khusus memakai ikon Lucide, bukan karakter ★ (emoji tampil beda
    // di tiap HP dan tidak ikut mode gelap).
    expect(html).toContain('Khusus');
    expect(html, 'tidak ada karakter bintang emoji').not.toContain('★');
    expect(html, 'ikon lucide ter-render sebagai svg').toContain('<svg');
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('data-slot="table-head"');
    expect(html).toContain('data-slot="button"');
  });

  it('sel memakai aria-label karyawan + tanggal', () => {
    const peta = new Map(dataGrid.jadwal.map((j) => [`${j.karyawan_id}|${j.tanggal}`, j]));
    const html = render(h(GridJadwal, { data: dataGrid, petaJadwal: peta, onPilihSel: tidakAda }));
    expect(html).toContain('aria-label="Jadwal Siti 13/10/2026"');
  });

  it('kosong persis "Belum ada karyawan di toko ini."', () => {
    const html = render(h(GridJadwal, { data: { ...dataGrid, karyawan: [] }, petaJadwal: new Map(), onPilihSel: tidakAda }));
    expect(html).toContain('Belum ada karyawan di toko ini.');
  });

  it('tidak ada elemen polos', () => {
    const peta = new Map(dataGrid.jadwal.map((j) => [`${j.karyawan_id}|${j.tanggal}`, j]));
    const html = render(h(GridJadwal, { data: dataGrid, petaJadwal: peta, onPilihSel: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});

describe('PanelSel (pilih shift + khusus hari ini maks 2)', () => {
  const dasar = {
    tanggal: '2026-10-13',
    jadwalSel: dataGrid.jadwal[0]!,
    templateCocok: ['Pagi'],
    panelTemplate: '',
    panelMode: 'lewati' as const,
    ovBaru: false,
    ovSlots: [{ nama: '', jam_mulai: '', jam_selesai: '' }],
    ovCatatan: '',
    ovPeringatan: [],
    onUbahTemplate: tidakAda,
    onUbahMode: tidakAda,
    onSimpan: tidakAda,
    onMintaUbahKhusus: tidakAda,
    onKembaliStandar: tidakAda,
    onTutup: tidakAda,
    onUbahOvSlots: tidakAda,
    onUbahOvCatatan: tidakAda,
    onTambahSlot: tidakAda,
    onHapusSlot: tidakAda,
    onSimpanOverride: tidakAda,
    onBatalOverride: tidakAda,
  };

  it('menampilkan isi sel + shift cocok + Lewati/Timpa + Simpan terkunci', () => {
    const html = render(h(PanelSel, dasar));
    expect(html).toContain('Jadwal 13/10/2026');
    expect(html).toContain('Pagi · 07:00–15:00');
    expect(html).toContain('Shift (hanya yang sesuai hari itu)');
    expect(html).toContain('— Pilih shift —');
    expect(html).toContain('Lewati bila sudah ada');
    expect(html).toContain('Timpa');
    expect(html).toContain('Ubah khusus hari ini');
    expect(html).toContain('Kembali ke shift standar');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('editor khusus: Nama/Mulai/Selesai + Tambah slot maks 2 + catatan', () => {
    const html = render(h(PanelSel, { ...dasar, ovBaru: true }));
    expect(html).toContain('Tambah slot (maks 2)');
    expect(html).toContain('Catatan (opsional)');
    expect((html.match(/type="time"/g) ?? []).length).toBe(2);
    const dua = render(
      h(PanelSel, {
        ...dasar,
        ovBaru: true,
        ovSlots: [
          { nama: 'A', jam_mulai: '07:00', jam_selesai: '12:00' },
          { nama: 'B', jam_mulai: '13:00', jam_selesai: '18:00' },
        ],
      }),
    );
    expect(dua).not.toContain('Tambah slot (maks 2)');
  });

  it('peringatan tumpang tindih kuning tidak memblokir', () => {
    const html = render(h(PanelSel, { ...dasar, ovBaru: true, ovPeringatan: [{ a: 0, b: 1 }] }));
    expect(html).toContain('Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.');
  });
});

describe('PanelIsiMassal + PanelHasilMassal (B-19)', () => {
  it('pratinjau terkunci tanpa karyawan/tanggal/shift; teks Lewati/Timpa ada', () => {
    const html = render(
      h(PanelIsiMassal, {
        karyawanList: [{ id: 1, nama: 'Siti' }],
        adaData: true,
        massal: { karyawan: [], dari: '', sampai: '', template: '', mode: 'lewati' },
        templateNama: ['Pagi'],
        pra: null,
        hasilMassal: null,
        onUbah: tidakAda,
        onPratinjau: tidakAda,
        onTerapkan: tidakAda,
      }),
    );
    expect(html).toContain('Isi massal');
    expect(html).toContain('>Lewati<');
    expect(html).toContain('>Timpa<');
    expect(html).toContain('>Pratinjau<');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('tanpa toko: "Pilih toko dulu."', () => {
    const html = render(
      h(PanelIsiMassal, {
        karyawanList: [],
        adaData: false,
        massal: { karyawan: [], dari: '', sampai: '', template: '', mode: 'lewati' },
        templateNama: [],
        pra: null,
        hasilMassal: null,
        onUbah: tidakAda,
        onPratinjau: tidakAda,
        onTerapkan: tidakAda,
      }),
    );
    expect(html).toContain('Pilih toko dulu.');
  });

  it('hasil massal: kalimat + daftar ditimpa/dilewati/ditolak (B-19)', () => {
    const html = render(
      h(PanelHasilMassal, {
        hasil: {
          baru: [{ karyawan_id: 1, tanggal: '2026-10-13' }],
          dilewati: [{ karyawan_id: 2, tanggal: '2026-10-13' }],
          ditimpa: [{ karyawan_id: 3, tanggal: '2026-10-14' }],
          ditolak: [{ karyawan_id: 4, tanggal: '2026-10-15', alasan: 'Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.' }],
        },
      }),
    );
    expect(html).toContain('1 dibuat, 1 ditimpa, 1 dilewati, 1 ditolak.');
    expect(html).toContain('(ditimpa)');
    expect(html).toContain('Karyawan #3');
    expect(html).toContain('Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.');
  });

  it('tidak ada elemen polos pada filter + grid', () => {
    const html = render(
      h(FilterJadwal, { tokoId: '', tokoList: [], mode: 'minggu', tanggal: '', onUbah: tidakAda }),
    );
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});
