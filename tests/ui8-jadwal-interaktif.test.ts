/**
 * UI-8 lanjutan — halaman Jadwal: pita ringkasan, penanda hari-ini, status
 * sel, keyboard grid, panel menempel, dan langkah isi massal.
 *
 * Yang TIDAK berubah dan tetap dikunci di berkas lama (ui2/b2c/m5): isi sel,
 * aria-label sel, pita weekend, teks panel, dan alur pratinjau→terapkan.
 *
 * Yang TIDAK bisa dibuktikan di sini (tanpa DOM/jsdom — B-20 masih ditunda):
 * panah benar-benar memindah fokus, panel sticky saat scroll, dan
 * scrollIntoView. Itu wajib verifikasi manual di browser.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GridJadwal,
  PanelIsiMassal,
  PanelSel,
  PitaRingkasanJadwal,
  ringkasanGrid,
  tanggalHariIniWIB,
} from '../src/app/admin/jadwal/komponen';

const tidakAda = () => {};

const dataGrid = {
  rentang: [
    { tanggal: '2026-10-13', hari: 'Senin', weekend: false },
    { tanggal: '2026-10-18', hari: 'Minggu', weekend: true },
  ],
  karyawan: [{ id: 1, nama: 'Siti' }],
  penempatan: [{ karyawan_id: 1, mulai: '2026-01-01', sampai: null as string | null }],
  jadwal: [],
  templateCocok: {},
};

function barisJadwal(tanggal: string, ubah = {}) {
  return {
    id: 1,
    karyawan_id: 1,
    karyawan_nama: 'Siti',
    tanggal,
    shift_template_id: 1,
    template_nama: 'Pagi',
    is_override: 0,
    catatan: null,
    slot: [{ nama: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' }],
    peringatan: [],
    ...ubah,
  };
}

function renderGrid(jadwal: ReturnType<typeof barisJadwal>[] = [], props = {}) {
  const peta = new Map(jadwal.map((j) => [`${j.karyawan_id}|${j.tanggal}`, j]));
  return renderToStaticMarkup(
    h(GridJadwal, {
      data: { ...dataGrid, jadwal },
      petaJadwal: peta,
      onPilihSel: tidakAda,
      onFokusSel: tidakAda,
      hariIni: '2026-10-18',
      ...props,
    }),
  );
}

/** Teks yang benar-benar dibaca pengguna: seluruh tag dibuang lebih dulu. */
function teksTampak(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

describe('ringkasanGrid — helper murni', () => {
  it('menghitung total, terisi, khusus, dan peringatan', () => {
    const r = ringkasanGrid({
      ...dataGrid,
      jadwal: [
        barisJadwal('2026-10-13'),
        barisJadwal('2026-10-18', { is_override: 1, peringatan: [{ a: 0, b: 1 }] }),
      ],
    });
    // 1 karyawan x 2 tanggal = 2 sel; keduanya terisi; 1 khusus; 1 peringatan.
    expect(r).toEqual({ totalSel: 2, terisi: 2, khusus: 1, peringatan: 1 });
  });

  it('kosong berarti nol di mana-mana', () => {
    expect(ringkasanGrid(dataGrid)).toEqual({ totalSel: 2, terisi: 0, khusus: 0, peringatan: 0 });
  });
});

describe('tanggalHariIniWIB — penanda visual saja', () => {
  it('keluar YYYY-MM-DD', () => {
    expect(tanggalHariIniWIB(new Date(Date.UTC(2026, 9, 15, 0, 0, 0)))).toBe('2026-10-15');
  });

  it('tengah malam WIB ikut tanggal yang benar, bukan tanggal UTC', () => {
    // 2026-10-14 17:00 UTC = 2026-10-15 00:00 WIB. Pola getDate() mesin
    // akan menjawab 14 di TZ=UTC — persis bug B-13.
    expect(tanggalHariIniWIB(new Date(Date.UTC(2026, 9, 14, 17, 0, 0)))).toBe('2026-10-15');
  });
});

describe('PitaRingkasanJadwal', () => {
  it('menampilkan empat angka dengan label Indonesia', () => {
    const html = renderToStaticMarkup(
      h(PitaRingkasanJadwal, { terisi: 5, totalSel: 8, khusus: 1, peringatan: 2 }),
    );
    const teks = teksTampak(html).replace(/\s+/g, ' ');
    expect(teks).toContain('5 dari 8 sel terisi');
    expect(teks).toContain('1 khusus');
    expect(teks).toContain('2 peringatan tumpang tindih');
  });

  it('bukan kartu', () => {
    const html = renderToStaticMarkup(
      h(PitaRingkasanJadwal, { terisi: 0, totalSel: 0, khusus: 0, peringatan: 0 }),
    );
    expect(html).not.toContain('data-slot="card"');
  });
});

describe('GridJadwal — penanda hari-ini', () => {
  it('header hari-ini punya badge teks, header lain tidak', () => {
    const html = renderGrid();
    expect((html.match(/>Hari ini</g) ?? []).length).toBe(1);
    expect(html).toContain('18/10/2026');
  });

  it('badge hari-ini tidak menambah pita weekend ke weekday', () => {
    // B2c mengunci: header weekday TIDAK boleh bg-muted/50. Penanda hari-ini
    // memakai tokennya sendiri supaya tidak mencampuri kunci itu. Diperiksa
    // pada TAG PEMBUKA th-nya (pola B2c) — bukan seluruh HTML, karena kolom
    // weekend yang sah ikut ter-render di halaman yang sama.
    const html = renderToStaticMarkup(
      h(GridJadwal, {
        data: { ...dataGrid, jadwal: [] },
        petaJadwal: new Map(),
        onPilihSel: tidakAda,
        onFokusSel: tidakAda,
        hariIni: '2026-10-13',
      }),
    );
    expect((html.match(/>Hari ini</g) ?? []).length).toBe(1);
    const i = html.indexOf('13/10/2026');
    expect(i).toBeGreaterThanOrEqual(0);
    const awal = html.lastIndexOf('<th', i);
    const tag = html.slice(awal, html.indexOf('>', awal) + 1);
    expect(tag).not.toMatch(/\bbg-muted\/50\b/);
    expect(tag).toMatch(/\bbg-primary\/10\b/);
  });
});

describe('GridJadwal — status sel berbentuk, bukan cuma warna', () => {
  it('sel terisi punya garis tepi kiri; sel kosong tidak', () => {
    const html = renderGrid([barisJadwal('2026-10-13')]);
    expect((html.match(/border-l-2/g) ?? []).length).toBe(1);
  });

  it('peringatan punya teks, bukan cuma ikon', () => {
    const html = renderGrid([barisJadwal('2026-10-13', { peringatan: [{ a: 0, b: 1 }] })]);
    expect(html).toContain('Tumpang tindih');
  });

  it('isi sel yang dikunci tetap utuh', () => {
    const html = renderGrid([barisJadwal('2026-10-13')]);
    expect(html).toContain('Pagi 07:00–15:00');
    expect(html).toContain('aria-label="Jadwal Siti 13/10/2026"');
  });
});

describe('GridJadwal — roving tabindex', () => {
  function tabIndexUntuk(html: string, sel: string): string | null {
    // `|` HARUS di-escape: tanpa itu ia menjadi alternasi regex dan cocok
    // dengan tombol pertama di dokumen — bukan sel yang dimaksud.
    const aman = sel.replace('|', '\\|');
    const tombol = html.match(new RegExp(`<button[^>]*data-sel="${aman}"[^>]*>`, 'g')) ?? [];
    if (tombol.length === 0) return null;
    return tombol[0]!.match(/tabindex="(-?\d)"/i)?.[1] ?? null;
  }

  it('tanpa fokus: hanya sel pertama yang tabIndex 0', () => {
    const html = renderGrid([barisJadwal('2026-10-13')], { fokusSel: null });
    expect(tabIndexUntuk(html, '1|2026-10-13')).toBe('0');
    expect(tabIndexUntuk(html, '1|2026-10-18')).toBe('-1');
  });

  it('sel fokus berpindah mengikuti fokusSel', () => {
    const html = renderGrid([barisJadwal('2026-10-13')], {
      fokusSel: { karyawan_id: 1, tanggal: '2026-10-18' },
    });
    expect(tabIndexUntuk(html, '1|2026-10-13')).toBe('-1');
    expect(tabIndexUntuk(html, '1|2026-10-18')).toBe('0');
  });

  it('setiap sel tetap punya data-sel untuk kembalian fokus', () => {
    const html = renderGrid();
    expect((html.match(/data-sel="1\|2026-10-13"/g) ?? []).length).toBe(1);
    expect((html.match(/data-sel="1\|2026-10-18"/g) ?? []).length).toBe(1);
  });
});

describe('PanelSel di dalam modal (bukan lagi panel inline)', () => {
  // Keputusan pemilik: klik sel membuka Dialog berisi PanelSel, jadi sticky
  // bottom-3 tidak lagi dipakai — sticky di dalam kontainer scroll dialog
  // justru menempel aneh. Tes lama yang mengunci sticky DIHAPUS dan diganti
  // yang ini (preseden B2f). Kontrak isi panel tetap dikunci ui2.
  it('kartu panel tidak sticky lagi; label dan judul tetap', () => {
    const html = renderToStaticMarkup(
      h(PanelSel, {
        tanggal: '2026-10-13',
        jadwalSel: barisJadwal('2026-10-13'),
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
      }),
    );
    expect(html, 'tidak lagi sticky (isi modal, bukan panel halaman)').not.toMatch(/\bsticky\b/);
    expect(html, 'tidak lagi bottom-3').not.toMatch(/\bbottom-3\b/);
    expect(html).toContain('aria-label="Panel sel"');
    expect(html).toContain('Jadwal 13/10/2026');
  });
});

describe('PanelIsiMassal bertahap 1-2-3', () => {
  function renderMassal(pra: null | object = null, hasil: null | object = null) {
    return renderToStaticMarkup(
      h(PanelIsiMassal, {
        karyawanList: [{ id: 1, nama: 'Siti' }],
        adaData: true,
        massal: { karyawan: [], dari: '', sampai: '', template: '', mode: 'lewati' },
        templateNama: ['Pagi'],
        pra: pra as never,
        hasilMassal: hasil as never,
        onUbah: tidakAda,
        onPratinjau: tidakAda,
        onTerapkan: tidakAda,
      }),
    );
  }

  it('langkah 1 selalu ada; langkah 2 dan 3 ikut isinya', () => {
    expect(renderMassal()).toContain('1. Pilih');
    expect(renderMassal()).not.toContain('2. Pratinjau');
    const pra = { baru: [], dilewati: [], ditimpa: [], ditolak: [] };
    const htmlPra = renderMassal(pra);
    expect(htmlPra).toContain('1. Pilih');
    expect(htmlPra).toContain('2. Pratinjau');
    expect(htmlPra).not.toContain('3. Hasil');
    const hasil = { baru: [], dilewati: [], ditimpa: [], ditolak: [] };
    const htmlHasil = renderMassal(null, hasil);
    expect(htmlHasil).toContain('3. Hasil');
  });

  it('teks lama tidak hilang', () => {
    const html = renderMassal();
    for (const t of ['Isi massal', 'Pratinjau', 'Lewati', 'Timpa']) {
      expect(html).toContain(t);
    }
  });
});
