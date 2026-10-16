/**
 * UI-8 lanjutan — Verifikasi Agenda interaktif: kartu per laporan, lightbox
 * banding before/after, pita antrean, paginasi, dan bantuan pintasan.
 *
 * Tabel lama (`TabelLaporanAgenda`) dan `PanelFotoLaporan` diganti kartu;
 * tesnya dimigrasi di `tests/m13-halaman-agenda.test.ts` dengan alasan
 * tertulis (preseden B2f). Berkas ini hanya mengunci yang BARU.
 *
 * Yang TIDAK bisa dibuktikan di sini (tanpa DOM/jsdom — B-20 masih ditunda):
 * fokus benar-benar pindah saat J/K ditekan dan pintasan yang dipicu lewat
 * keyboard. Itu wajib verifikasi manual di browser.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DaftarKartuLaporan,
  IsiBantuanPintasanAgenda,
  IsiLightboxBanding,
  KartuLaporanAgenda,
  PitaAntreanAgenda,
  type BarisLaporanAgenda,
} from '../src/app/admin/verifikasi-agenda/komponen';

const TIDAK_ADA = () => undefined;

function laporan(id = 1, ubah: Partial<BarisLaporanAgenda> = {}): BarisLaporanAgenda {
  return {
    id,
    agenda_id: 1,
    karyawan_nama: 'Andi',
    toko_nama: 'Toko A',
    tanggal: '2026-10-08',
    percobaan: 2,
    status: 'MENUNGGU',
    keterangan: 'Lampu sudah diganti.',
    dikirim_at: null,
    diverifikasi_nama: null,
    alasan_tolak: null,
    ...ubah,
  };
}

function kartu(id = 1, foto = { sebelum: true, sesudah: true }, ubah: Partial<BarisLaporanAgenda> = {}) {
  return h(KartuLaporanAgenda, {
    r: laporan(id, ubah),
    adaFoto: () => foto,
    onLihatFoto: TIDAK_ADA,
    onSetujui: TIDAK_ADA,
    onTolak: TIDAK_ADA,
  });
}

/** Teks yang benar-benar dibaca pengguna: seluruh tag dibuang lebih dulu. */
function teksTampak(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

describe('PitaAntreanAgenda', () => {
  it('menampilkan jumlah menunggu dan total dengan label Indonesia', () => {
    const html = renderToStaticMarkup(
      h(PitaAntreanAgenda, { menunggu: 7, total: 9, onBantuan: TIDAK_ADA }),
    );
    const teks = teksTampak(html).replace(/\s+/g, ' ');
    expect(teks).toContain('7 menunggu verifikasi');
    expect(teks).toContain('9 laporan pada filter ini');
    expect(html).toContain('aria-label="Bantuan pintasan keyboard"');
  });

  it('bukan kartu', () => {
    const html = renderToStaticMarkup(
      h(PitaAntreanAgenda, { menunggu: 0, total: 0, onBantuan: TIDAK_ADA }),
    );
    expect(html).not.toContain('data-slot="card"');
  });
});

describe('KartuLaporanAgenda', () => {
  it('bisa difokus programatik untuk navigasi J/K', () => {
    const html = renderToStaticMarkup(kartu());
    expect(html).toContain('data-laporan-id="1"');
    expect(html).toMatch(/tabindex="-1"/i);
    expect(html).toContain('aria-label="Laporan agenda 1"');
  });

  it('tombol foto punya nama aksesibel, bukan ikon saja', () => {
    const html = renderToStaticMarkup(kartu());
    expect(html).toContain('aria-label="Lihat foto before 1"');
    expect(html).toContain('aria-label="Lihat foto after 1"');
  });

  it('keterangan tampil apa adanya; kosong berarti tidak ada barisnya', () => {
    expect(renderToStaticMarkup(kartu())).toContain('Keterangan: Lampu sudah diganti.');
    expect(renderToStaticMarkup(kartu(2, { sebelum: false, sesudah: false }, { keterangan: null }))).not.toContain(
      'Keterangan:',
    );
  });

  it('tidak ada kata Inggris yang terlihat di kartu', () => {
    const html = renderToStaticMarkup(kartu());
    const kataInggris = ['Before', 'After', 'Compare', 'Approve', 'Reject', 'Close', 'Submit'];
    const ketemu = kataInggris.filter((k) => new RegExp(`\\b${k}\\b`).test(teksTampak(html)));
    expect(ketemu, `kata Inggris: ${ketemu.join(', ')}`).toEqual([]);
  });
});

describe('DaftarKartuLaporan', () => {
  it('melewatkan id yang benar ke tiap handler', () => {
    const html = renderToStaticMarkup(
      h(DaftarKartuLaporan, {
        daftar: [laporan(11), laporan(22)],
        adaFoto: () => ({ sebelum: true, sesudah: true }),
        onLihatFoto: TIDAK_ADA,
        onSetujui: TIDAK_ADA,
        onTolak: TIDAK_ADA,
      }),
    );
    expect(html).toContain('data-laporan-id="11"');
    expect(html).toContain('data-laporan-id="22"');
    expect((html.match(/data-slot="kartu-laporan-agenda"/g) ?? []).length).toBe(2);
  });
});

describe('IsiBantuanPintasanAgenda', () => {
  it('memuat pintasan halaman ini — tanpa koreksi yang tidak ada', () => {
    const html = renderToStaticMarkup(h(IsiBantuanPintasanAgenda, { onTutup: TIDAK_ADA }));
    const teks = teksTampak(html);
    for (const t of ['J / K', 'Setujui', 'dialog tolak', 'Tutup', 'bantuan']) {
      expect(teks).toContain(t);
    }
    // Agenda tidak punya koreksi (tidak seperti absensi): daftar yang salah
    // lebih buruk daripada duplikasi kecil, jadi komponennya ditulis sendiri.
    expect(teks).not.toContain('Koreksi');
    expect(teks).not.toContain('koreksi');
  });
});

describe('IsiLightboxBanding — status dan konteks keputusan', () => {
  it('keterangan ikut tampil sebagai konteks (dibaca, bukan dipakai memutuskan)', () => {
    const html = renderToStaticMarkup(
      h(IsiLightboxBanding, {
        r: laporan(),
        adaFoto: { sebelum: true, sesudah: true },
        onSetujui: TIDAK_ADA,
        onTolak: TIDAK_ADA,
        onBerikutnya: TIDAK_ADA,
        onTutup: TIDAK_ADA,
      }),
    );
    expect(html).toContain('Keterangan: Lampu sudah diganti.');
    expect(html).toContain('Percobaan 2');
  });
});
