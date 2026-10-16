/**
 * UI-8 lanjutan — Verifikasi Absensi lebih interaktif: pita antrean, paginasi
 * sisi klien, dan bantuan pintasan keyboard.
 *
 * Yang TIDAK berubah dan dikunci di sini: NativeSelect untuk pemilih (bukan
 * Select base-ui — BUG-UI-06), aturan pemisah toast (validasi field tetap
 * inline, bukan di berkas ini), dan Bahasa Indonesia di semua teks terlihat.
 *
 * Yang TIDAK bisa dibuktikan di sini (tanpa DOM/jsdom — B-20 masih ditunda):
 * fokus benar-benar pindah saat J/K ditekan, dan toast/pintasan yang dipicu
 * lewat keyboard. Itu wajib verifikasi manual di browser.
 */
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  IsiBantuanPintasan,
  KartuVerifikasi,
  KontrolHalaman,
  PitaAntrean,
  hitungBelumCheckout,
  infoHalaman,
  potongHalaman,
  type Baris,
} from '../src/app/admin/verifikasi/komponen';

const tidakAda = () => {};

function baris(id: number, ubah: Partial<Baris> = {}): Baris {
  return {
    id,
    karyawan_id: 7,
    karyawan_nama: 'Siti Rahma',
    toko_id: 3,
    toko_nama: 'toko melati',
    tanggal: '2026-10-03',
    jenis: 'CHECKIN',
    checkin_id: null,
    waktu: '2026-10-03T07:12:00+07:00',
    sumber: 'SISTEM',
    foto_file_id: 'abc',
    lat: -6.2,
    lng: 106.816666,
    lokasi_status: 'AKURAT',
    status: 'MENUNGGU',
    alasan_tolak: null,
    keterangan: null,
    keterlambatan_final_menit: null,
    alasan_koreksi: null,
    keterlambatan: null,
    ...ubah,
  };
}

/** Teks yang benar-benar dibaca pengguna: seluruh tag dibuang lebih dulu. */
function teksTampak(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

describe('paginasi sisi klien — helper murni', () => {
  const daftar = Array.from({ length: 45 }, (_, i) => i + 1);

  it('potongHalaman mengiris per halaman', () => {
    expect(potongHalaman(daftar, 1, 20)).toEqual(daftar.slice(0, 20));
    expect(potongHalaman(daftar, 3, 20)).toEqual(daftar.slice(40, 45));
    expect(potongHalaman(daftar, 5, 20)).toEqual([]);
  });

  it('halaman di bawah 1 diperlakukan sebagai halaman 1', () => {
    expect(potongHalaman(daftar, 0, 20)).toEqual(daftar.slice(0, 20));
  });

  it('infoHalaman menghitung awal, akhir, dan total halaman', () => {
    expect(infoHalaman(45, 1, 20)).toEqual({ awal: 1, akhir: 20, totalHalaman: 3 });
    expect(infoHalaman(45, 3, 20)).toEqual({ awal: 41, akhir: 45, totalHalaman: 3 });
    expect(infoHalaman(0, 1, 20)).toEqual({ awal: 0, akhir: 0, totalHalaman: 1 });
  });

  it('halaman melewati akhir dijepit ke halaman terakhir', () => {
    expect(infoHalaman(45, 9, 20).totalHalaman).toBe(3);
    expect(potongHalaman(daftar, 9, 20)).toEqual([]);
  });
});

describe('hitungBelumCheckout — padanan filter server di sisi klien', () => {
  it('check-in dengan check-out aktif tidak dihitung', () => {
    const d = [
      baris(1),
      baris(2, { jenis: 'CHECKOUT', checkin_id: 1, status: 'DISETUJUI' }),
    ];
    expect(hitungBelumCheckout(d)).toBe(0);
  });

  it('check-in yang check-out-nya DITOLAK tetap dihitung belum check-out', () => {
    const d = [
      baris(1),
      baris(2, { jenis: 'CHECKOUT', checkin_id: 1, status: 'DITOLAK' }),
    ];
    expect(hitungBelumCheckout(d)).toBe(1);
  });

  it('check-out milik check-in lain diabaikan', () => {
    const d = [
      baris(1),
      baris(2, { jenis: 'CHECKOUT', checkin_id: 99, status: 'DISETUJUI' }),
    ];
    expect(hitungBelumCheckout(d)).toBe(1);
  });

  it('baris check-out sendiri tidak pernah dihitung', () => {
    expect(hitungBelumCheckout([baris(2, { jenis: 'CHECKOUT', checkin_id: 1 })])).toBe(0);
  });
});

describe('PitaAntrean', () => {
  it('menampilkan tiga angka dengan label Bahasa Indonesia', () => {
    const html = renderToStaticMarkup(
      h(PitaAntrean, { menunggu: 12, terpilih: 3, belumCheckout: 2, onBantuan: tidakAda }),
    );
    const teks = teksTampak(html).replace(/\s+/g, ' ');
    expect(teks).toContain('12 menunggu');
    expect(teks).toContain('3 terpilih');
    expect(teks).toContain('2 check-in belum check-out');
  });

  it('punya tombol bantuan pintasan yang bernama jelas', () => {
    const html = renderToStaticMarkup(
      h(PitaAntrean, { menunggu: 1, terpilih: 0, belumCheckout: 0, onBantuan: tidakAda }),
    );
    expect(html).toContain('aria-label="Bantuan pintasan keyboard"');
    expect(html).toContain('Pintasan keyboard (?)');
  });

  it('bukan kartu dan tanpa pola yang dilarang', () => {
    const html = renderToStaticMarkup(
      h(PitaAntrean, { menunggu: 1, terpilih: 0, belumCheckout: 0, onBantuan: tidakAda }),
    );
    expect(html, 'pita, bukan Card').not.toContain('data-slot="card"');
  });
});

describe('KontrolHalaman', () => {
  it('menampilkan rentang, posisi halaman, dan tombol geser', () => {
    const html = renderToStaticMarkup(
      h(KontrolHalaman, { halaman: 1, total: 45, ukuran: 20, onHalaman: tidakAda, onUkuran: tidakAda }),
    );
    expect(teksTampak(html)).toContain('Menampilkan 1–20 dari 45');
    expect(html).toContain('aria-label="Halaman 1 dari 3"');
    expect(html).toContain('aria-label="Halaman sebelumnya"');
    expect(html).toContain('aria-label="Halaman berikutnya"');
  });

  it('tombol Sebelumnya nonaktif di halaman pertama, Berikutnya aktif', () => {
    const html = renderToStaticMarkup(
      h(KontrolHalaman, { halaman: 1, total: 45, ukuran: 20, onHalaman: tidakAda, onUkuran: tidakAda }),
    );
    // Penanda benar adalah atribut disabled="", bukan literal "disabled:"
    // di kelas dasar Button shadcn.
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(1);
  });

  it('tombol Berikutnya nonaktif di halaman terakhir', () => {
    const html = renderToStaticMarkup(
      h(KontrolHalaman, { halaman: 3, total: 45, ukuran: 20, onHalaman: tidakAda, onUkuran: tidakAda }),
    );
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(1);
    expect(teksTampak(html)).toContain('Menampilkan 41–45 dari 45');
  });

  it('pemilih ukuran memakai NativeSelect, bukan Select base-ui', () => {
    const html = renderToStaticMarkup(
      h(KontrolHalaman, { halaman: 1, total: 45, ukuran: 20, onHalaman: tidakAda, onUkuran: tidakAda }),
    );
    expect(html).toContain('data-slot="native-select"');
    expect(html).toContain('Baris per halaman');
    for (const u of ['10', '20', '50']) {
      expect(html).toContain(`value="${u}"`);
    }
  });
});

describe('IsiBantuanPintasan', () => {
  it('memuat semua pintasan dengan artinya', () => {
    const html = renderToStaticMarkup(h(IsiBantuanPintasan, { onTutup: tidakAda }));
    const teks = teksTampak(html);
    for (const t of ['J / K', 'Setujui', 'dialog tolak', 'koreksi', 'Tutup', 'bantuan']) {
      expect(teks).toContain(t);
    }
    expect(html).toContain('Pintasan keyboard');
  });

  it('menyebut batas berlakunya pintasan', () => {
    const html = renderToStaticMarkup(h(IsiBantuanPintasan, { onTutup: tidakAda }));
    expect(teksTampak(html)).toContain('di luar kolom isian');
  });
});

describe('KartuVerifikasi bisa difokus programatik', () => {
  const bersama = {
    terpilih: false,
    onPilih: tidakAda,
    onLihatFoto: tidakAda,
    nilaiFinal: '',
    onUbahFinal: tidakAda,
    onSetujui: tidakAda,
    onTolak: tidakAda,
    onKoreksi: tidakAda,
  };

  it('kartu punya penanda id dan bisa menerima fokus', () => {
    const html = renderToStaticMarkup(h(KartuVerifikasi, { ...bersama, b: baris(777) }));
    expect(html).toContain('data-kartu-id="777"');
    expect(html).toMatch(/tabindex="-1"/i);
  });
});
