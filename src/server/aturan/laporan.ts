/**
 * Aturan murni pengerjaan laporan agenda — tanpa akses database (rules/06 §4.2).
 *
 * Memisahkan tiga hal yang mudah tercampur:
 *   1. Alur karyawan: simpan draft (foto before) lalu submit (foto after) — BR-G7/G8.
 *   2. Apa yang boleh diulang setelah DITOLAK — BR-G11 + K-61.
 *   3. Verifikasi admin + penguncian periode terekspor — BR-G12 + K-65.
 *
 * Semua fungsi TIDAK melempar untuk penolakan (pola B-19): bentuknya satu objek
 * `{ boleh, alasan, http }` supaya pratinjau dan apply tidak bisa berbeda jalannya.
 */

export type TahapLaporan = 'DRAFT' | 'MENUNGGU';

export interface HasilCek {
  boleh: boolean;
  alasan: string;
  http: number | null;
}

function boleh(): HasilCek {
  return { boleh: true, alasan: '', http: null };
}

function tolak(alasan: string, http = 409): HasilCek {
  return { boleh: false, alasan, http };
}

export interface KeadaanAgendaUntukKerja {
  /** Status agenda. DIBATALKAN menutup semua pengerjaan (BR-G4). */
  statusAgenda: string;
  /** true bila agenda masuk daftar penerima karyawan ini (hasil resolusi BR-G2). */
  adalahPenerima: boolean;
  /** true bila agenda dibuat oleh karyawan itu sendiri (BR-G3). */
  dibuatSendiri: boolean;
  /** true bila agenda wajib foto before/after (K-57). */
  wajibFoto: boolean;
  /**
   * Laporan TERAKHIR milik karyawan ini pada agenda itu — termasuk yang DITOLAK.
   * Null bila belum pernah mengerjakan.
   *
   * Termasuk DITOLAK itu disengaja: kalau hanya laporan aktif yang dibaca,
   * setelah ditolak keadaan terlihat sama dengan "belum pernah", sehingga
   * alasan penolakan hilang dari layar karyawan dan tombolnya berubah dari
   * "Coba Lagi" menjadi "Mulai" tanpa jejak. Karyawan harus tahu kenapa
   * ditolak sebelum mengulang (BR-G11).
   */
  laporanTerakhir: {
    id: number;
    status: string;
    percobaan: number;
    sebelum_file_id: string | null;
    sesudah_file_id: string | null;
    alasan_tolak: string | null;
  } | null;
}

/**
 * Karyawan boleh mengerjakan agenda bila dia PEMENERIMA resmi atau DIA BUAT
 * sendiri (BR-G3). Aturan "atau" ini sengaja jadi satu fungsi supaya
 * `bolehSimpanDraft` dan `bolehSubmit` tidak bisa berbeda pendapat — dua jalur
 * terpisah untuk satu aturan adalah tempat aturan salah ketik tinggal diam.
 */
export function bolehMengerjakan(keadaan: KeadaanAgendaUntukKerja): boolean {
  return keadaan.adalahPenerima || keadaan.dibuatSendiri;
}

/**
 * Laporan yang masih memegang slot satu-laporan-aktif (BR-G6).
 *
 * BEDA dari `laporanTerakhir`: yang ini tidak melihat DITOLAK, karena DITOLAK
 * sudah melepas slot sehingga percobaan baru boleh dibuat. Yang dipakai untuk
 * menentukan jalur UPDATE atau INSERT.
 */
export function laporanMasihAktif(laporan: KeadaanAgendaUntukKerja['laporanTerakhir']): boolean {
  return laporan !== null && laporan.status !== 'DITOLAK';
}

/**
 * BR-G7: menyimpan DRAFT — foto before wajib kalau agenda wajib foto.
 *
 * Mengizinkan penyimpanan ulang draft: setiap simpan mengunggah foto before baru
 * dan foto sebelumnya menjadi yatim di Telegram (pola yang sama seperti BR-A4).
 * Jadi di sini TIDAK dicek "sudah ada draft sebelumnya" — itu ditangani index
 * unik `uq_laporan_aktif_per_agenda` lewat jalur UPDATE, bukan lewat penolakan.
 */
export function bolehSimpanDraft(keadaan: KeadaanAgendaUntukKerja, adaFotoBefore: boolean): HasilCek {
  if (keadaan.statusAgenda !== 'AKTIF') {
    return tolak('Agenda ini sudah dibatalkan.', 409);
  }
  if (!bolehMengerjakan(keadaan)) {
    return tolak('Agenda ini tidak diberikan kepada Anda.', 403);
  }
  if (keadaan.wajibFoto && !adaFotoBefore) {
    return tolak('Foto wajib diambil dari kamera.', 400);
  }
  return boleh();
}

/** BR-G7: submit dari DRAFT ke MENUNGGU — butuh foto before DAN after bila wajib foto. */
export function bolehSubmit(keadaan: KeadaanAgendaUntukKerja, adaFotoAfter: boolean): HasilCek {
  if (keadaan.statusAgenda !== 'AKTIF') {
    return tolak('Agenda ini sudah dibatalkan.', 409);
  }
  if (!bolehMengerjakan(keadaan)) {
    return tolak('Agenda ini tidak diberikan kepada Anda.', 403);
  }
  // Tiga keadaan laporan terakhir, masing-masing dengan jalur berbeda — dan
  // semuanya harus ditangani. Lupa satu berarti laporan hilang atau terkunci.
  const terakhir = keadaan.laporanTerakhir;
  const masihAktif = laporanMasihAktif(terakhir);

  if (terakhir !== null && masihAktif) {
    // (1) Sudah dikirim dan menunggu / sudah disetujui: tidak boleh lagi.
    if (terakhir.status !== 'DRAFT') {
      return tolak('Laporan ini sudah dikirim. Menunggu verifikasi admin.', 409);
    }
    // (2) Draft: lanjut ke submit dari draft.
    if (keadaan.wajibFoto) {
      if (terakhir.sebelum_file_id === null) {
        return tolak('Foto before belum tersimpan.', 409);
      }
      if (!adaFotoAfter) {
        return tolak('Foto wajib diambil dari kamera.', 400);
      }
    }
    return boleh();
  }

  // (3) Belum pernah, atau semua percobaan lalu DITOLAK.
  //
  // BR-G8: agenda TANPA wajib foto tidak punya tahap draft — satu kiriman sudah
  // cukup, jadi di sini langsung boleh tanpa foto sama sekali.
  if (!keadaan.wajibFoto) return boleh();

  // Agenda wajib foto: baik belum mulai maupun mengulang, foto BEFORE harus
  // tersimpan lebih dulu. `adaFotoAfter` tidak relevan di cabang ini — foto after
  // yang ikut pada request bukan pengganti foto before. Ditolak tidak menghanguskan
  // percobaan (K-61), tapi mengulang tetap dimulai dari foto before lagi.
  return tolak('Simpan foto before terlebih dahulu.', 409);
}

/**
 * BR-G11 + K-61: setelah DITOLAK, karyawan boleh mengulang sebagai percobaan baru.
 * Laporan yang ditolak TIDAK ikut diblokir (tidak hangus).
 *
 * Mengembalikan nomor percobaan berikutnya, bukan boolean, karena pemanggil butuh
 * nomor itu untuk menyimpan kolom `percobaan` dan tidak boleh mengarang angka 1.
 */
export function percobaanBerikutnya(percobaanTerakhir: number): number {
  return percobaanTerakhir + 1;
}

/**
 * Label untuk tampilan karyawan.
 *
 * `DRAFT` dan `MENUNGGU` tidak pernah memakai kata "selesai": karyawan harus tahu
 * pekerjaannya belum resmi selesai sampai admin menyetujuinya (K-60).
 */
export function labelTahap(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'MENUNGGU':
      return 'Menunggu verifikasi';
    case 'DISETUJUI':
      return 'Selesai';
    case 'DITOLAK':
      return 'Ditolak';
    default:
      return status;
  }
}

/**
 * Apa yang boleh diklik karyawan untuk laporan tertentu — dipakai UI supaya
 * tombol yang salah tidak pernah muncul (bukan sekadar menolak saat diklik).
 */
export type AksiLaporan = 'SIMPAN_DRAFT' | 'SUBMIT' | 'ULANG' | 'TUNDAK_BISA';

export function aksiYangTersedia(keadaan: KeadaanAgendaUntukKerja): AksiLaporan {
  if (keadaan.statusAgenda !== 'AKTIF') return 'TUNDAK_BISA';
  if (!bolehMengerjakan(keadaan)) return 'TUNDAK_BISA';
  if (keadaan.laporanTerakhir === null) return 'SIMPAN_DRAFT';
  if (keadaan.laporanTerakhir.status === 'DRAFT') return 'SUBMIT';
  // DITOLAK boleh diulang, dan mengulang berarti memulai percobaan baru dari
  // foto before — bukan melanjutkan laporan yang sudah ditolak.
  if (keadaan.laporanTerakhir.status === 'DITOLAK') return 'ULANG';
  // MENUNGGU atau DISETUJUI: tidak ada aksi, tunggu admin.
  return 'TUNDAK_BISA';
}

/**
 * BR-G12 + K-65: verifikasi laporan agenda pada periode yang SUDAH diekspor hanya
 * Super Admin. Pesan menyebut dasarnya supaya admin tahu kenapa ditolak.
 */
export function bolehVerifikasiPadaPeriodeTerekspor(
  sudahDiekspor: boolean,
  peran: 'ADMIN' | 'SUPER_ADMIN',
): HasilCek {
  if (!sudahDiekspor) return boleh();
  if (peran === 'SUPER_ADMIN') return boleh();
  return tolak('Periode ini sudah diekspor. Hanya Super Admin yang boleh memverifikasi agenda.', 403);
}

/** BR-G9: draft tidak pernah bisa diverifikasi — statusnya belum final. */
export function bolehVerifikasiStatus(status: string): HasilCek {
  if (status === 'DRAFT') {
    return tolak('Laporan masih draft dan belum dikirim.', 400);
  }
  return boleh();
}

/** BR-G11: alasan tolak wajib, sama seperti BR-V2. */
export function bolehTolakLaporan(alasan: string | undefined | null): HasilCek {
  if (!alasan || alasan.trim().length === 0) {
    return tolak('Alasan penolakan wajib diisi.', 400);
  }
  if (alasan.trim().length > 500) {
    return tolak('Alasan maksimal 500 karakter.', 400);
  }
  return boleh();
}

/**
 * BR-G15 (K-63): hanya laporan MENUNGGU yang memblokir ekspor.
 *
 * Draf TIDAK memblokir — ini yang membedakan agenda dari absensi, dan alasannya
 * tercatat di K-63: agenda tanpa tanggal target bisa menggantung ekspor selamanya.
 * Satu-satunya penentu; dipakai pratinjau DAN ekspor (anti-B-19).
 */
export function laporanMemblokirEkspor(status: string): boolean {
  return status === 'MENUNGGU';
}

/**
 * BR-G17: metrik agenda per toko untuk hari ini.
 *
 * Ketiganya menghitung LAPORAN (bukan agenda): satu karyawan bisa punya beberapa
 * laporan pada hari yang sama karena percobaan berulang. Semua memakai tanggal
 * submit, sama seperti BR-G14.
 */
export interface MetrikAgendaToko {
  /** Laporan berstatus MENUNGGU pada tanggal itu. */
  menunggu: number;
  /** Laporan berstatus DISETUJUI pada tanggal itu. */
  selesai: number;
  /** Laporan berstatus DITOLAK pada tanggal itu. */
  ditolak: number;
}

export function hitungMetrikAgenda(statuses: string[]): MetrikAgendaToko {
  let menunggu = 0;
  let selesai = 0;
  let ditolak = 0;
  for (const s of statuses) {
    if (s === 'MENUNGGU') menunggu++;
    else if (s === 'DISETUJUI') selesai++;
    else if (s === 'DITOLAK') ditolak++;
  }
  // DRAFT sengaja diabaikan: BR-G9 bilang draft tidak terlihat dan tidak memblokir.
  return { menunggu, selesai, ditolak };
}