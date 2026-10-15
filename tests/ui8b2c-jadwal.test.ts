/**
 * UI-8 B2c — jadwal: kolom weekend berpita latar (`bg-muted/50`).
 *
 * Teks "(Weekend)" tetap ada (§5.4 + kunci tes UI-2); pita adalah pembeda
 * KEDUA, karena §1.3 melarang warna jadi satu-satunya pembawa arti.
 * Header dan sel isi memakai aturan yang sama supaya lajurnya utuh saat
 * grid di-scroll horizontal.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GridJadwal } from '../src/app/admin/jadwal/komponen';

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

function jadwal(tanggal: string) {
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
  };
}

function renderGrid() {
  const semua = [jadwal('2026-10-13'), jadwal('2026-10-18')];
  const peta = new Map(semua.map((j) => [`${j.karyawan_id}|${j.tanggal}`, j]));
  return renderToStaticMarkup(h(GridJadwal, { data: dataGrid, petaJadwal: peta, onPilihSel: tidakAda }));
}

/** Tag pembuka (<th>/<td ...) sel yang memuat penanda — isi sel (kelas Button
 *  seperti dark:hover:bg-muted/50) TIDAK ikut diperiksa. */
function tagPembuka(html: string, tag: 'th' | 'td', penanda: string): string {
  const i = html.indexOf(penanda);
  expect(i, `penanda ${penanda} ada`).toBeGreaterThanOrEqual(0);
  const awal = html.lastIndexOf(`<${tag}`, i);
  const akhir = html.indexOf('>', awal);
  return html.slice(awal, akhir + 1);
}

describe('UI-8 B2c · pita kolom weekend', () => {
  it('header weekend berpita, header weekday tidak', () => {
    const html = renderGrid();
    expect(html).toContain('(Weekend)');
    expect(tagPembuka(html, 'th', '(Weekend)')).toMatch(/\bbg-muted\/50\b/);
    expect(tagPembuka(html, 'th', '13/10/2026')).not.toMatch(/\bbg-muted\/50\b/);
  });

  it('sel isi weekend berpita, sel weekday tidak — teks sel utuh', () => {
    const html = renderGrid();
    expect(html).toContain('aria-label="Jadwal Siti 13/10/2026"');
    expect(html).toContain('aria-label="Jadwal Siti 18/10/2026"');
    expect(tagPembuka(html, 'td', 'Jadwal Siti 18/10/2026')).toMatch(/\bbg-muted\/50\b/);
    expect(tagPembuka(html, 'td', 'Jadwal Siti 13/10/2026')).not.toMatch(/\bbg-muted\/50\b/);
  });
});
