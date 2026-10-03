/**
 * UI halaman Verifikasi Absensi (rules/05 §5.3).
 *
 * Semua tes di sini ME-RENDER komponen sungguhan lewat
 * `renderToStaticMarkup(createElement(...))` lalu memeriksa HTML hasilnya.
 * Tidak ada yang membaca teks berkas dan tidak ada `expect(true).toBe(true)`.
 *
 * Bukti bahwa tes ini menguji sesuatu: matikan aturannya, lalu lihat gagal
 * (dicatat di rules/NOTES.md §14).
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DaftarKartuVerifikasi,
  IsiDialogKoreksi,
  IsiDialogTolak,
  IsiLightbox,
  KartuVerifikasi,
  LabelStatus,
  PanelAksiMassal,
  PanelFilterVerifikasi,
  PanelGalat,
  PanelMemuat,
  kelompokkan,
  tanggalPendek,
  type Baris,
  type Pilihan,
} from '../src/app/admin/verifikasi/komponen';

const tidakAda = () => {};

function baris(ubah: Partial<Baris> = {}): Baris {
  return {
    id: 101,
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
    keterlambatan_final_menit: null,
    alasan_koreksi: null,
    keterlambatan: { n: 1, slot: { nama: 'pagi', jam_mulai: '07:00', jam_selesai: '15:00' }, selisih: 12, terlambatSistem: true },
    ...ubah,
  };
}

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe('tanggalPendek', () => {
  it('mengubah 2026-10-03 menjadi 03/10/2026', () => {
    expect(tanggalPendek('2026-10-03')).toBe('03/10/2026');
    // Menahan test ini harus gagal kalau orang menukar hari dan bulan
    // (31/12 vs 12/31). Nilai 31 tidak sah sebagai bulan.
    expect(tanggalPendek('2026-12-31')).toBe('31/12/2026');
  });
});

describe('LabelStatus', () => {
  it('Menunggu, Disetujui, dan Ditolak punya teks yang berbeda', () => {
    const menunggu = render(h(LabelStatus, { status: 'MENUNGGU' }));
    const disetujui = render(h(LabelStatus, { status: 'DISETUJUI' }));
    const ditolak = render(h(LabelStatus, { status: 'DITOLAK' }));
    expect(menunggu).toContain('Menunggu');
    expect(disetujui).toContain('Disetujui');
    expect(ditolak).toContain('Ditolak');
    // Badge destructive harus benar-benar dipakai agar warna tidak misleading.
    expect(ditolak).toContain('bg-destructive');
    expect(disetujui).not.toContain('bg-destructive');
  });

  it('status tak dikenal tetap menjadi "Menunggu", bukan string kosong', () => {
    expect(render(h(LabelStatus, { status: 'APA_SAJA' }))).toContain('Menunggu');
  });
});

describe('PanelFilterVerifikasi', () => {
  const pilihan: Pilihan = {
    toko: [
      { id: 1, nama: 'toko melati' },
      { id: 2, nama: 'toko anggrek' },
    ],
    karyawan: [{ id: 7, nama: 'Siti Rahma' }],
  };
  const kosong = {
    status: 'MENUNGGU',
    toko_id: '',
    dari: '',
    sampai: '',
    karyawan_id: '',
    jenis: '',
    belum_checkout: false,
  };

  it('merender empat dropdown dan satu chip, semuanya dari komponen shadcn', () => {
    const html = render(h(PanelFilterVerifikasi, { nilai: kosong, pilihan, onUbah: tidakAda }));
    // data-slot hanya ada di komponen shadcn — tidak mungkin dari <select> polos.
    expect((html.match(/data-slot="native-select"/g) ?? []).length, 'jumlah dropdown').toBe(4);
    expect((html.match(/data-slot="checkbox"/g) ?? []).length).toBe(1);
    expect((html.match(/data-slot="card"/g) ?? []).length).toBeGreaterThan(0);
  });

  it('dropdown menampilkan LABEL Indonesia, bukan kode enum mentah', () => {
    // Ini alasan memilih NativeSelect: Select base-ui menampilkan
    // <span data-slot="select-value">DISETUJUI</span>, bukan "Disetujui".
    const html = render(h(PanelFilterVerifikasi, { nilai: kosong, pilihan, onUbah: tidakAda }));
    expect(html).toContain('>Menunggu<');
    expect(html).toContain('>Check-in<');
    expect(html).toContain('>Check-out<');
    expect(html).toContain('>Semua<');
    // Kode mentah hanya boleh muncul sebagai nilai atribut, bukan teks terlihat.
    const teksTerlihat = html.replace(/value="[^"]*"/g, '').replace(/<[^>]*>/g, '');
    expect(teksTerlihat, 'teks yang dilihat pengguna').not.toMatch(/MENUNGGU|CHECKIN|CHECKOUT|DISETUJUI|DITOLAK/);
  });

  it('dropdown menandai opsi terpilih sehingga filter aktif terlihat', () => {
    const html = render(h(PanelFilterVerifikasi, { nilai: { ...kosong, status: 'DISETUJUI' }, pilihan, onUbah: tidakAda }));
    expect(html).toMatch(/value="DISETUJUI"[^>]*selected|selected[^>]*value="DISETUJUI"/);
  });

  it('nama toko dan karyawan muncul sebagai label, bukan nomor id', () => {
    const html = render(h(PanelFilterVerifikasi, { nilai: { ...kosong, toko_id: '1', karyawan_id: '7' }, pilihan, onUbah: tidakAda }));
    expect(html).toContain('>toko melati<');
    expect(html).toContain('>toko anggrek<');
    expect(html).toContain('>Siti Rahma<');
  });

  it('filter chip "Check-in belum check-out" berbentuk chip, bukan checkbox polos', () => {
    // rules/05 §5.3 menyebut chip. Kotak centang polos juga memenuhi
    // aria-checked, jadi bentuknya harus diperiksa lewat data-slot.
    const html = render(h(PanelFilterVerifikasi, { nilai: { ...kosong, belum_checkout: true }, pilihan, onUbah: tidakAda }));
    expect(html).toContain('Check-in belum check-out');
    const chip = html.match(/<label[^>]*data-slot="chip"[^>]*>/);
    expect(chip, 'label dengan data-slot="chip"').not.toBeNull();
    // Bentuk chip: rounded-full + border, bukan label telanjang.
    expect(chip![0]).toMatch(/\srounded-full\b/);
    expect(chip![0]).toMatch(/class="[^"]*\bborder\b/);
  });

  it('chip menandai keadaan centang ke HTML, bukan hanya ke state React', () => {
    const nyala = render(h(PanelFilterVerifikasi, { nilai: { ...kosong, belum_checkout: true }, pilihan, onUbah: tidakAda }));
    expect(nyala).toContain('aria-checked="true"');
    // Harus data-checked="" (atribut kosong)._classes chip memuat
    // "has-data-checked:" jadi pola tanpa tanda =" akan salah cocok.
    expect(nyala).toMatch(/data-slot="chip"[^>]*\sdata-checked=""/);
    const mati = render(h(PanelFilterVerifikasi, { nilai: kosong, pilihan, onUbah: tidakAda }));
    expect(mati).toContain('aria-checked="false"');
    expect(mati).not.toMatch(/data-slot="chip"[^>]*\sdata-checked=""/);
  });

  it('status bawaan adalah "Menunggu" (rules/05 §5.3: default Menunggu)', () => {
    const html = render(h(PanelFilterVerifikasi, { nilai: kosong, pilihan, onUbah: tidakAda }));
    expect(html).toMatch(/value="MENUNGGU"[^>]*selected|selected[^>]*value="MENUNGGU"/);
  });

  it('input tanggal memakai dua field yang bisa diisi (dari/sampai)', () => {
    const html = render(h(PanelFilterVerifikasi, { nilai: { ...kosong, dari: '2026-10-01', sampai: '2026-10-03' }, pilihan, onUbah: tidakAda }));
    expect(html).toContain('id="f-dari"');
    expect(html).toContain('id="f-sampai"');
    expect(html).toContain('value="2026-10-01"');
    expect(html).toContain('value="2026-10-03"');
    expect((html.match(/type="date"/g) ?? []).length).toBe(2);
  });
});

describe('kelompokkan', () => {
  it('mengelompokkan berdasarkan karyawan + tanggal, bukan id atau urutan', () => {
    const hasil = kelompokkan([
      baris({ id: 1, karyawan_id: 7, tanggal: '2026-10-03' }),
      baris({ id: 2, karyawan_id: 8, tanggal: '2026-10-03' }),
      baris({ id: 3, karyawan_id: 7, tanggal: '2026-10-04' }),
      baris({ id: 4, karyawan_id: 7, tanggal: '2026-10-03', jenis: 'CHECKOUT', checkin_id: 1 }),
    ]);
    const kunci = hasil.map(([k]) => k);
    expect(kunci).toEqual(['7|2026-10-03', '8|2026-10-03', '7|2026-10-04']);
    // Dua event pada 03 belong different employees are NOT merged.
    expect(hasil[0]![1].map((b) => b.id)).toEqual([1, 4]);
    expect(hasil[1]![1].map((b) => b.id)).toEqual([2]);
    expect(hasil[2]![1].map((b) => b.id)).toEqual([3]);
  });

  it('daftar kosong menghasilkan nol kelompok', () => {
    expect(kelompokkan([])).toEqual([]);
  });
});

describe('PanelAksiMassal', () => {
  it('menampilkan jumlah terpilih dan dua tombol', () => {
    const html = render(h(PanelAksiMassal, { jumlah: 4, onSetujui: tidakAda, onTolak: tidakAda }));
    expect(html).toContain('4 dipilih');
    expect(html).toContain('Setujui terpilih');
    expect(html).toContain('Tolak terpilih');
    expect((html.match(/data-slot="button"/g) ?? []).length).toBe(2);
  });

  it('tombol Tolak terpilih memakai variant destructive, Setujui tidak', () => {
    const html = render(h(PanelAksiMassal, { jumlah: 1, onSetujui: tidakAda, onTolak: tidakAda }));
    const tombol = [...html.matchAll(/<button[^>]*data-slot="button"[^>]*>/g)].map((m) => m[0]);
    expect(tombol.length).toBe(2);
    // "Tolak terpilih" adalah yang destructive; "Setujui terpilih" bukan.
    // Catatan: kelas dasar Button memuat `aria-invalid:ring-destructive/40`,
    // jadi yang dicari adalah kelas varian `bg-destructive`, bukan kata saja.
    expect(tombol[1], 'tombol Tolak').toContain('bg-destructive');
    expect(tombol[0], 'tombol Setujui').not.toContain('bg-destructive');
  });
});

describe('PanelGalat', () => {
  it('menampilkan pesan dan tombol Coba lagi (rules/05 §5.3)', () => {
    const onCobaLagi = vi.fn();
    const html = render(h(PanelGalat, { pesan: 'Gagal memuat data.', onCobaLagi }));
    expect(html).toContain('Gagal memuat data.');
    expect(html).toContain('Coba lagi');
    expect(html).toContain('role="alert"');
    expect(onCobaLagi).not.toHaveBeenCalled();
  });
});

describe('PanelMemuat', () => {
  it('loading memakai skeleton baris, bukan teks "Memuat…" (rules/05 §5.3)', () => {
    const html = render(h(PanelMemuat, { jumlahBaris: 4 }));
    expect((html.match(/data-slot="skeleton"/g) ?? []).length).toBe(4);
    expect(html).toContain('aria-label="Memuat"');
    // Teks "Memuat…" adalah wirasa lama yang harus hilang.
    expect(html).not.toContain('Memuat…');
  });
});

describe('KartuVerifikasi', () => {
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

  it('setiap absensi dibungkus Card shadcn, bukan div biasa', () => {
    // Penanya kelas group/card (tanpa akhiran), bukan data-slot — lihat catatan
    // panjang pada tes DaftarKartuVerifikasi di bawah.
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris({ id: 61 }) }));
    expect((html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).length, 'jumlah Card').toBe(1);
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-content"');
    expect(html).toContain('aria-label="Absensi 61"');
  });

  it('konten sesuai rules/05 §5.3 (sama lengkapnya dengan tabel lama)', () => {
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris() }));
    expect(html).toContain('data-slot="kartu-verifikasi"');
    expect(html).toContain('aria-label="Absensi 101"');
    // Waktu
    expect(html).toContain('07:12');
    expect(html).toContain('03/10/2026');
    expect(html).toContain('WIB');
    // Karyawan + toko
    expect(html).toContain('Siti Rahma');
    expect(html).toContain('toko melati');
    // Jenis
    expect(html).toContain('Check-in');
    // Lokasi: koordinat + tautan peta
    expect(html).toContain('Buka peta');
    expect(html).toContain('https://www.google.com/maps?q=-6.2,106.816666');
    // Selisih + badge Terlambat
    expect(html).toContain('+12 mnt');
    expect(html).toContain('Terlambat');
    // Status
    expect(html).toContain('Menunggu');
    // Aksi
    expect(html).toContain('Setujui');
    expect(html).toContain('Tolak');
    expect(html).toContain('Koreksi');
  });

  it('foto mini memakai /api/foto/<id> dan punya label aksesibel', () => {
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris({ id: 555 }) }));
    expect(html).toContain('src="/api/foto/555"');
    expect(html).toContain('aria-label="Lihat foto 555"');
  });

  it('tanpa foto menampilkan "—" bukan elemen gambar rusak', () => {
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris({ foto_file_id: null }) }));
    expect(html).not.toContain('/api/foto/');
    expect(html).toContain('—');
  });

  it('koordinat null menampilkan "Lokasi tidak tersedia" tanpa tautan peta', () => {
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris({ lat: null, lng: null }) }));
    expect(html).toContain('Lokasi tidak tersedia');
    expect(html).not.toContain('google.com/maps');
  });

  it('check-out menampilkan nomor pasangan check-in-nya', () => {
    const html = render(
      h(KartuVerifikasi, {
        ...bersama,
        b: baris({ id: 102, jenis: 'CHECKOUT', checkin_id: 101, keterlambatan: null }),
      }),
    );
    expect(html).toContain('Check-out');
    expect(html).toContain('#101');
  });

  it('check-in punya input menit final 0..1440 (K-54) dan check-out tidak', () => {
    const masuk = render(h(KartuVerifikasi, { ...bersama, b: baris({ id: 1 }) }));
    expect(masuk).toContain('aria-label="Menit terlambat final 1"');
    expect(masuk).toContain('min="0"');
    expect(masuk).toContain('max="1440"');
    expect(masuk).toContain('type="number"');

    const keluar = render(h(KartuVerifikasi, { ...bersama, b: baris({ id: 2, jenis: 'CHECKOUT' }) }));
    expect(keluar).not.toContain('Menit terlambat final 2');
  });

  it('input menit final menampilkan nilai yang dikirimkan (termasuk 0 eksplisit, K-30)', () => {
    // 0 harus tampil sebagai "0", bukan kosong — itu inti K-30.
    expect(render(h(KartuVerifikasi, { ...bersama, b: baris(), nilaiFinal: '12' }))).toContain('value="12"');
    const nol = render(h(KartuVerifikasi, { ...bersama, b: baris(), nilaiFinal: '0' }));
    expect(nol, 'nol eksplisit tidak boleh menjadi string kosong').toContain('value="0"');
    const kosong = render(h(KartuVerifikasi, { ...bersama, b: baris(), nilaiFinal: '' }));
    expect(kosong).toMatch(/aria-label="Menit terlambat final 101"[^>]*value=""|value=""[^>]*aria-label="Menit terlambat final 101"/);
  });

  it('baris dikoreksi diberi badge Dikoreksi dan alasan penolakan ditampilkan', () => {
    const html = render(
      h(KartuVerifikasi, {
        ...bersama,
        b: baris({ status: 'DITOLAK', sumber: 'KOREKSI_ADMIN', alasan_tolak: 'Foto tidak jelas' }),
      }),
    );
    expect(html).toContain('Dikoreksi');
      // Badge memakai ikon Lucide, bukan karakter emoji.
      expect(html, 'tidak ada karakter pensil emoji').not.toContain('✎');
      expect(html, 'tidak ada panah teks untuk pasangan').not.toContain('↳');
      expect(html, 'ikon lucide ter-render sebagai svg').toContain('<svg');
    expect(html).toContain('Ditolak: Foto tidak jelas');
  });

  it('checkbox baris memakai aria-label yang memuat id agar bisa diuji', () => {
    const html = render(h(KartuVerifikasi, { ...bersama, b: baris({ id: 777 }) }));
    expect(html).toContain('aria-label="Pilih absensi 777"');
  });
});

describe('DaftarKartuVerifikasi', () => {
  const bersama = {
    terpilih: [],
    onPilih: tidakAda,
    onLihatFoto: tidakAda,
    finalInput: {},
    onUbahFinal: tidakAda,
    onSetujui: tidakAda,
    onTolak: tidakAda,
    onKoreksi: tidakAda,
  };

  it('mengelompokkan check-in dan check-out yang sama karyawan + tanggal', () => {
    const html = render(
      h(DaftarKartuVerifikasi, {
        ...bersama,
        kelompok: [
          ['7|2026-10-03', [baris({ id: 1 }), baris({ id: 2, jenis: 'CHECKOUT', checkin_id: 1 })]],
          ['8|2026-10-03', [baris({ id: 3, karyawan_id: 8, karyawan_nama: 'Budi' })]],
        ],
      }),
    );
    // Dua kepala kelompok (satu per karyawan+tanggal).
    expect((html.match(/aria-label="Kelompok /g) ?? []).length).toBe(2);
    expect(html).toContain('Siti Rahma · 03/10/2026 · toko melati');
    expect(html).toContain('Budi · 03/10/2026 · toko melati');
    // Tiga kartu data, bukan tiga kelompok.
    expect((html.match(/Pilih absensi/g) ?? []).length).toBe(3);
  });

  it('memakai kartu shadcn, bukan elemen table', () => {
    const html = render(h(DaftarKartuVerifikasi, { ...bersama, kelompok: [['7|2026-10-03', [baris()]]] }));
    expect(html).toContain('data-slot="daftar-kartu-verifikasi"');
    expect(html).toContain('data-slot="kartu-verifikasi"');
    // Card shadcn, bukan <div> biasa.
    //
    // PENTING: tidak bisa memakai data-slot. Komponen shadcn menulis
    // data-slot-nya SEBELUM {...props}, jadi data-slot="kartu-verifikasi"
    // yang kita kirim MENIMPA data-slot="card" milik Card. Penanda yang
    // tidak tertimpa adalah kelas group/card, yang hanya Card yang punya.
    // Versi pertama tes ini memakai data-slot="card" dan karena itu
    // Replacing Card with <div> tetap hijau (mutasi yang lolos, 2026-10-03).
    expect((html.match(/class="[^"]*(?<![-\w])group\/card(?![-\w])/g) ?? []).length, 'jumlah Card').toBe(1);
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-content"');
    expect(html, 'tidak boleh ada elemen table').not.toMatch(/<table[\s>]/);
    expect(html).not.toContain('data-slot="table"');
    expect(html).not.toContain('data-slot="table-head"');
  });

  it('nilai input per baris diambil dari finalInput bila ada', () => {
    const html = render(
      h(DaftarKartuVerifikasi, {
        ...bersama,
        kelompok: [['7|2026-10-03', [baris({ id: 1 }), baris({ id: 2, jenis: 'CHECKIN', keterlambatan: null })]]],
        finalInput: { 2: '45' },
      }),
    );
    expect(html).toContain('value="45"');
  });

  it('keterlambatan_final_menit dari DB jadi teks, dan 0 tidak jadi "null"', () => {
    // Nilai DB adalah number|null. Kalau diteruskan mentah, React menulis
    // value="null" atau memperingatkan; 0 harus tetap tampil sebagai "0" (K-30).
    const html = render(
      h(DaftarKartuVerifikasi, {
        ...bersama,
        kelompok: [
          ['7|2026-10-03', [baris({ id: 1, keterlambatan_final_menit: 12 })]],
          ['8|2026-10-03', [baris({ id: 2, karyawan_id: 8, keterlambatan_final_menit: 0 })]],
          ['9|2026-10-03', [baris({ id: 3, karyawan_id: 9, keterlambatan_final_menit: null })]],
        ],
      }),
    );
    expect(html, 'nilai 12 dari DB').toContain('value="12"');
    expect(html, 'nilai 0 dari DB').toContain('value="0"');
    expect(html, 'tidak boleh ada value="null"').not.toContain('value="null"');
  });
});

describe('IsiDialogTolak', () => {
  const bersama = {
    jumlah: 3,
    alasan: 'Foto tidak jelas',
    onUbahAlasan: tidakAda,
    onBatal: tidakAda,
    onKirim: tidakAda,
  };

  it('menampilkan jumlah, textarea berlabel, dan dua tombol', () => {
    const html = render(h(IsiDialogTolak, bersama));
    expect(html).toContain('Tolak 3 absensi');
    expect(html).toContain('data-slot="textarea"');
    expect(html).toContain('for="alasan-tolak"');
    // React menaruh nilai textarea sebagai isi, bukan atribut value.
    expect(html).toMatch(/<textarea[^>]*>Foto tidak jelas<\/textarea>/);
    expect(html).toContain('Batal');
    expect(html).toContain('Tolak');
  });

  it('tombol Tolak nonaktif saat alasan kosong (wajib diisi)', () => {
    const html = render(h(IsiDialogTolak, { ...bersama, alasan: '   ' }));
    // Atribut disabled harus benar-benar ada di HTML, bukan hanya di logika.
    // Catatan: kelas Button memuat `disabled:` jadi tidak boleh dipakai sebagai penanda.
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('tombol Tolak aktif saat alasan terisi', () => {
    const html = render(h(IsiDialogTolak, bersama));
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });
});

describe('IsiDialogKoreksi', () => {
  const bersama = {
    id: 42,
    operasi: 'ubah_waktu',
    waktu: '2026-10-03T08:00',
    alasan: 'Salah input',
    onUbah: tidakAda,
    onBatal: tidakAda,
    onKirim: tidakAda,
  };

  it('menampilkan tiga operasi dan input waktu + alasan', () => {
    const html = render(h(IsiDialogKoreksi, bersama));
    expect(html).toContain('Koreksi absensi #42');
    // NativeSelect menaruh opsinya di HTML server, jadi ketiga operasi bisa diperiksa.
    expect(html).toContain('>Ubah waktu<');
    expect(html).toContain('>Tambah check-out<');
    expect(html).toContain('>Tambah check-in<');
    expect(html).toMatch(/value="ubah_waktu"[^>]*selected|selected[^>]*value="ubah_waktu"/);
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-10-03T08:00"');
    expect(html).toContain('for="k-alasan"');
  });

  it('Simpan nonaktif bila alasan kosong atau waktu kosong (keduanya wajib)', () => {
    const tanpaAlasan = render(h(IsiDialogKoreksi, { ...bersama, alasan: '' }));
    expect(tanpaAlasan).toMatch(/<button[^>]*\sdisabled=""/);
    const tanpaWaktu = render(h(IsiDialogKoreksi, { ...bersama, waktu: '' }));
    expect(tanpaWaktu).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('Simpan aktif bila alasan dan waktu terisi', () => {
    expect(render(h(IsiDialogKoreksi, bersama))).not.toMatch(/<button[^>]*\sdisabled=""/);
  });
});

describe('IsiLightbox', () => {
  const bersama = {
    baris: baris({ id: 909 }),
    onSetujui: tidakAda,
    onTolak: tidakAda,
    onBerikutnya: tidakAda,
    onTutup: tidakAda,
  };

  it('menampilkan foto besar, detail event, dan empat tombol (rules/05 §5.3)', () => {
    const html = render(h(IsiLightbox, bersama));
    expect(html).toContain('src="/api/foto/909"');
    expect(html).toContain('alt="Foto Siti Rahma"');
    expect(html).toContain('Siti Rahma');
    expect(html).toContain('07:12');
    for (const t of ['Setujui', 'Tolak', 'Berikutnya', 'Tutup']) {
      expect(html, `tombol ${t}`).toContain(t);
    }
    expect((html.match(/data-slot="button"/g) ?? []).length).toBe(4);
  });
});