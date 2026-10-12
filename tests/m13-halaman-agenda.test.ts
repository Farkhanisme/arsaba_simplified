import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FilterVerifikasiAgenda,
  IsiDialogTolakLaporan,
  LabelStatusLaporan,
  PanelFotoLaporan,
  TabelLaporanAgenda,
  tanggalPendek,
  type BarisLaporanAgenda,
} from '../src/app/admin/verifikasi-agenda/komponen';
import {
  KartuAgenda,
  IsiModalAgendaFoto,
  KeteranganLaporan,
} from '../src/app/a/[token]/AgendaClient';
import { menuUntukPeran } from '../src/app/admin/menu';

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

const TIDAK_ADA = () => undefined;

describe('tanggalPendek', () => {
  it('memformat YYYY-MM-DD menjadi dd/MM/YYYY', () => {
    expect(tanggalPendek('2026-10-08')).toBe('08/10/2026');
  });

  it('null tampil sebagai em-dash', () => {
    expect(tanggalPendek(null)).toBe('—');
  });
});

describe('LabelStatusLaporan', () => {
  it('tiga status punya label berbeda dan kata yang benar', () => {
    expect(render(h(LabelStatusLaporan, { status: 'DISETUJUI' }))).toContain('Disetujui');
    expect(render(h(LabelStatusLaporan, { status: 'DITOLAK' }))).toContain('Ditolak');
    expect(render(h(LabelStatusLaporan, { status: 'MENUNGGU' }))).toContain('Menunggu');
  });

  it('tidak memakai kata "Selesai" untuk MENUNGGU', () => {
    // Kalau label menunggu sudah "Selesai", karyawan menganggap pekerjaannya
    // sudah final padahal masih menunggu keputusan admin.
    expect(render(h(LabelStatusLaporan, { status: 'MENUNGGU' }))).not.toContain('Selesai');
  });
});

describe('PanelFotoLaporan (BR-G10, BR-G13)', () => {
  it('tanpa foto menjelelaskan, bukan sel kosong', () => {
    expect(render(h(PanelFotoLaporan, { id: 1, adaSebelum: false, adaSesudah: false }))).toContain('Tanpa foto');
  });

  it('hanya foto before -> hanya tautan before', () => {
    const html = render(h(PanelFotoLaporan, { id: 7, adaSebelum: true, adaSesudah: false }));
    expect(html).toContain('/api/foto/agenda/7?foto=sebelum');
    expect(html).not.toContain('foto=sesudah');
  });

  it('dua foto -> dua tautan', () => {
    const html = render(h(PanelFotoLaporan, { id: 9, adaSebelum: true, adaSesudah: true }));
    expect(html).toContain('/api/foto/agenda/9?foto=sebelum');
    expect(html).toContain('/api/foto/agenda/9?foto=sesudah');
  });

  it('URL Telegram tidak pernah muncul (token bot, rules/03 §7)', () => {
    const html = render(h(PanelFotoLaporan, { id: 1, adaSebelum: true, adaSesudah: true }));
    expect(html).not.toContain('api.telegram.org');
  });

  it('TIDAK punya kolom menit keterlambatan atau koordinat', () => {
    // BR-G13: agenda tidak punya jadwal yang dibandingkan. Kalau kolom ini
    // ditambahkan, baris akan selalu kosong dan admin akan mengisinya sendiri.
    const html = render(
      h(TabelLaporanAgenda, {
        daftar: [{ id: 1, agenda_id: 1, karyawan_nama: 'A', toko_nama: 'T', tanggal: '2026-10-08', percobaan: 1, status: 'MENUNGGU', keterangan: null, dikirim_at: null, diverifikasi_nama: null, alasan_tolak: null }],
        adaFoto: () => ({ sebelum: false, sesudah: false }),
        onSetujui: TIDAK_ADA,
        onTolak: TIDAK_ADA,
      }),
    );
    expect(html).not.toContain('Keterlambatan');
    expect(html).not.toContain('Latitude');
    expect(html).not.toContain('Selisih');
  });
});

function laporan(sebagian: Partial<BarisLaporanAgenda> = {}): BarisLaporanAgenda {
  return {
    id: 1,
    agenda_id: 1,
    karyawan_nama: 'Andi',
    toko_nama: 'Toko A',
    tanggal: '2026-10-08',
    percobaan: 1,
    status: 'MENUNGGU',
    keterangan: null,
    dikirim_at: null,
    diverifikasi_nama: null,
    alasan_tolak: null,
    ...sebagian,
  };
}

describe('TabelLaporanAgenda', () => {
  it('kosok memberi pesan, bukan tabel kosong', () => {
    const html = render(h(TabelLaporanAgenda, { daftar: [], adaFoto: () => ({ sebelum: false, sesudah: false }), onSetujui: TIDAK_ADA, onTolak: TIDAK_ADA }));
    expect(html).toContain('Tidak ada laporan agenda');
    expect(html).not.toContain('<table');
  });

  it('menampilkan karyawan, toko, percobaan, dan alasan tolak', () => {
    const html = render(
      h(TabelLaporanAgenda, {
        daftar: [laporan({ status: 'DITOLAK', percobaan: 3, alasan_tolak: 'Kurang lengkap', diverifikasi_nama: 'Admin' })],
        adaFoto: () => ({ sebelum: true, sesudah: true }),
        onSetujui: TIDAK_ADA,
        onTolak: TIDAK_ADA,
      }),
    );
    expect(html).toContain('Andi');
    expect(html).toContain('Toko A');
    expect(html).toContain('Kurang lengkap');
    expect(html).toContain('oleh Admin');
    // Nomor percobaan ditampilkan sebagai angka, supaya percobaan berulang terlihat.
    expect(html).toMatch(/>3</);
  });

  it('percobaan ke-1 tidak diberi label EXTRA', () => {
    const html = render(h(TabelLaporanAgenda, { daftar: [laporan()], adaFoto: () => ({ sebelum: false, sesudah: false }), onSetujui: TIDAK_ADA, onTolak: TIDAK_ADA }));
    expect(html).not.toContain('Percobaan ke-');
  });
});

describe('FilterVerifikasiAgenda', () => {
  it('memakai nilai yang diberikan, bukan hardcode', () => {
    const html = render(
      h(FilterVerifikasiAgenda, {
        status: 'DITOLAK',
        tokoId: '3',
        dari: '2026-10-01',
        sampai: '2026-10-08',
        pilihanToko: [{ id: 3, nama: 'Toko Melati' }],
        onUbah: TIDAK_ADA,
      }),
    );
    expect(html).toMatch(/<option[^>]*value="DITOLAK"[^>]*selected/);
    expect(html).toMatch(/<option[^>]*value="3"[^>]*selected/);
    expect(html).toContain('Toko Melati');
  });

  it('input tanggal memakai nilai yang diberikan (controlled)', () => {
    // Input yang `value`nya selalu "" adalah kontrol rusak: admin memilih tanggal,
    // router.replace berjalan, komponen render ulang dengan nilai kosong, lalu
    // tanggal yang baru dipilih hilang. Pola yang sama pernah dipakai FilterAgenda
    // M11 dan sudah diperbaiki di sana.
    const html = render(
      h(FilterVerifikasiAgenda, { status: '', tokoId: '', dari: '2026-10-01', sampai: '2026-10-08', pilihanToko: [], onUbah: TIDAK_ADA }),
    );
    expect(html).toMatch(/<input[^>]*id="va-dari"[^>]*value="2026-10-01"/);
    expect(html).toMatch(/<input[^>]*id="va-sampai"[^>]*value="2026-10-08"/);
  });

  it('input tanggal kosong tampil kosong, bukan "undefined"', () => {
      const html = render(
        h(FilterVerifikasiAgenda, { status: '', tokoId: '', dari: '', sampai: '', pilihanToko: [], onUbah: TIDAK_ADA }),
      );
      expect(html).toMatch(/<input[^>]*id="va-dari"[^>]*value=""/);
      expect(html).not.toContain('value="undefined"');
    });
});

describe('IsiDialogTolakLaporan (BR-G11)', () => {
  it('menjelaskan bahwa percobaan tidak hangus', () => {
    const html = render(h(IsiDialogTolakLaporan, { namaKaryawan: 'Andi', alasan: '', onUbahAlasan: TIDAK_ADA, onBatal: TIDAK_ADA, onSimpan: TIDAK_ADA }));
    expect(html).toContain('Andi');
    expect(html).toContain('percobaan baru');
    expect(html).toContain('Alasan penolakan (wajib)');
  });
});

describe('KartuAgenda sisi karyawan', () => {
  const dasar = {
    judul: 'Ganti lampu',
    keterangan: null,
    wajibFoto: true,
    dibuatSendiri: false,
    aksi: 'TUNDAK_BISA' as const,
    statusLaporan: null,
    alasanTolak: null,
    percobaan: null,
    onMulai: TIDAK_ADA,
  };

  it('SIMPAN_DRAFT menampilkan tombol Mulai', () => {
    const html = render(h(KartuAgenda, { ...dasar, aksi: 'SIMPAN_DRAFT', onBuatDraft: TIDAK_ADA }));
    expect(html).toContain('Mulai');
  });

  it('SUBMIT menampilkan tombol Ambil Foto After', () => {
    const html = render(h(KartuAgenda, { ...dasar, aksi: 'SUBMIT', statusLaporan: 'DRAFT', onLanjut: TIDAK_ADA }));
    expect(html).toContain('Ambil Foto After');
  });

  it('ULANG menampilkan Coba Lagi beserta alasannya', () => {
    const html = render(h(KartuAgenda, { ...dasar, aksi: 'ULANG', statusLaporan: 'DITOLAK', alasanTolak: 'Kurang lengkap', percobaan: 2 }));
    expect(html).toContain('Coba Lagi');
    // Alasan WAJIB tampil: tanpa itu karyawan mengulang tanpa tahu apa yang salah.
    expect(html).toContain('Kurang lengkap');
    expect(html).toContain('Percobaan ke-2');
  });

  it('TUNDAK_BISA tanpa alasan TIDAK menampilkan tombol apa pun', () => {
    const html = render(h(KartuAgenda, { ...dasar, aksi: 'TUNDAK_BISA' }));
    expect(html).not.toContain('Coba Lagi');
    expect(html).not.toContain('Mulai');
  });

  it('agenda wajib foto menyatakan begitu; tanpa foto menyatakan opsional', () => {
    expect(render(h(KartuAgenda, { ...dasar }))).toContain('Wajib foto before dan after');
    expect(render(h(KartuAgenda, { ...dasar, wajibFoto: false }))).toContain('Tidak wajib foto');
    expect(render(h(KartuAgenda, { ...dasar, wajibFoto: false }))).toContain('Keterangan opsional');
  });

  it('percobaan ke-1 tidak menampilkan label percobaan', () => {
    expect(render(h(KartuAgenda, { ...dasar, percobaan: 1 }))).not.toContain('Percobaan ke-');
  });

  it('agenda milik karyawan ditandai', () => {
    expect(render(h(KartuAgenda, { ...dasar, dibuatSendiri: true }))).toContain('Milik saya');
  });
});

describe('IsiModalAgendaFoto', () => {
  it('teks tombol mengikuti tahap (draft vs kirim)', () => {
    const draft = render(h(IsiModalAgendaFoto, { pratinjau: 'x', label: 'before', mengirim: false, onFotoUlang: TIDAK_ADA, onSimpan: TIDAK_ADA, teksSimpan: 'Simpan Draft' }));
    expect(draft).toContain('Simpan Draft');
    expect(draft).toContain('Foto Ulang');

    const kirim = render(h(IsiModalAgendaFoto, { pratinjau: 'x', label: 'after', mengirim: false, onFotoUlang: TIDAK_ADA, onSimpan: TIDAK_ADA, teksSimpan: 'Kirim Laporan' }));
    expect(kirim).toContain('Kirim Laporan');
  });

  it('saat mengirim tombol punya atribut disabled=""', () => {
    // Penanda yang benar adalah ATRIBUT disabled, bukan kata "disabled" di kelas
    // CSS — kelas dasar shadcn Button memuat literal `disabled:` (lesson UI-2).
    const html = render(h(IsiModalAgendaFoto, { pratinjau: 'x', label: 'before', mengirim: true, onFotoUlang: TIDAK_ADA, onSimpan: TIDAK_ADA, teksSimpan: 'Simpan Draft' }));
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('Menyimpan…');
  });

  it('alt foto menyebut tahap, bukan "Hasil foto absen"', () => {
    const html = render(h(IsiModalAgendaFoto, { pratinjau: 'x', label: 'Hasil foto before agenda', mengirim: false, onFotoUlang: TIDAK_ADA, onSimpan: TIDAK_ADA, teksSimpan: 'Simpan Draft' }));
    expect(html).toContain('Hasil foto before agenda');
    expect(html).not.toContain('Hasil foto absen');
  });
});

describe('KeteranganLaporan', () => {
  it('agenda wajib foto punya tombol Ambil Foto After', () => {
    const html = render(h(KeteranganLaporan, { keterangan: '', wajibFoto: true, mengirim: false, onUbah: TIDAK_ADA, onKirim: TIDAK_ADA, onFotoAfter: TIDAK_ADA, onBatal: TIDAK_ADA }));
    expect(html).toContain('Ambil Foto After');
    expect(html).toContain('Kirim Laporan');
    expect(html).toContain('Keterangan (opsional)');
  });

  it('agenda tanpa foto TIDAK punya tombol Ambil Foto After', () => {
    const html = render(h(KeteranganLaporan, { keterangan: '', wajibFoto: false, mengirim: false, onUbah: TIDAK_ADA, onKirim: TIDAK_ADA, onFotoAfter: TIDAK_ADA, onBatal: TIDAK_ADA }));
    expect(html).not.toContain('Ambil Foto After');
    expect(html).toContain('Kirim Laporan');
  });
});

describe('menu admin memuat halaman baru', () => {
  it('Agenda dan Verifikasi Agenda tampil untuk kedua peran (BR-G20)', () => {
    for (const peran of ['ADMIN', 'SUPER_ADMIN'] as const) {
      const kerja = menuUntukPeran(peran).find((k) => k.judul === 'Kerja Harian')!;
      expect(kerja.item.some((i) => i.href === '/admin/agenda'), `${peran}: Agenda`).toBe(true);
      expect(kerja.item.some((i) => i.href === '/admin/verifikasi-agenda'), `${peran}: Verifikasi Agenda`).toBe(true);
    }
  });
});