/**
 * Repo laporan agenda (M12/M13). SQL berparameter, tanpa ORM.
 *
 * Berisi sisi karyawan (draft + submit + daftar milik karyawan) DAN sisi admin
 * (antrean verifikasi). Keduanya di satu file karena keduanya berevocer pada
 * `agenda_laporan` dan aturan siklus hidupnya hanya satu.
 *
 * Urutan operasi WAJIB mengikuti BR-A4 persis: validasi aturan -> unggah foto ke
 * Telegram -> simpan ke database. Kalau unggah gagal, TIDAK ada baris yang
 * tersimpan dan karyawan diminta mengulang. Ini bukan pilihan gaya: mengupload
 * duluan lalu gagal menulis akan meninggalkan foto tak bertuan tanpa jejak.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB, tanggalWIB } from '../waktu';
import { penerimaAgenda, type PenempatanTerbuka } from '../aturan/agenda';
import {
  bolehMengerjakan,
  bolehSimpanDraft,
  bolehSubmit,
  laporanMasihAktif,
  bolehTolakLaporan,
  bolehVerifikasiPadaPeriodeTerekspor,
  bolehVerifikasiStatus,
  percobaanBerikutnya,
  type KeadaanAgendaUntukKerja,
} from '../aturan/laporan';
import { tokoPadaTanggal } from '../aturan/absensi';
import { sudahDiekspor, type PeranAdmin } from '../aturan/absensi';
import { daftarAgenda, penempatanTerbuka, tujuanAgenda, type BarisAgenda } from './agenda';
import { riwayatPenempatanUntukTanggal } from './absensi';

export class GalatLaporan extends Error {
  constructor(
    public readonly status: number,
    public readonly kode: string,
    message: string,
  ) {
    super(message);
    this.name = 'GalatLaporan';
  }
}

export interface BarisLaporan {
  id: number;
  agenda_id: number;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number | null;
  toko_nama: string | null;
  tanggal: string;
  percobaan: number;
  status: string;
  keterangan: string | null;
  sebelum_file_id: string | null;
  sesudah_file_id: string | null;
  dikirim_at: string | null;
  diverifikasi_oleh: number | null;
  diverifikasi_nama: string | null;
  diverifikasi_at: string | null;
  alasan_tolak: string | null;
  request_id: string | null;
}

const KOLOM_LAPORAN =
  'l.id, l.agenda_id, l.karyawan_id, k.nama AS karyawan_nama, l.toko_id, o.nama AS toko_nama, ' +
  'l.tanggal, l.percobaan, l.status, l.keterangan, l.sebelum_file_id, l.sesudah_file_id, ' +
  'l.dikirim_at, l.diverifikasi_oleh, u.nama AS diverifikasi_nama, l.diverifikasi_at, l.alasan_tolak, l.request_id';

const DARI_LAPORAN = `FROM agenda_laporan l JOIN karyawan k ON k.id = l.karyawan_id LEFT JOIN toko o ON o.id = l.toko_id LEFT JOIN pengguna_admin u ON u.id = l.diverifikasi_oleh`;

export async function laporanById(id: number, ex: Executor): Promise<BarisLaporan | null> {
  const res = await ex.execute({ sql: `SELECT ${KOLOM_LAPORAN} ${DARI_LAPORAN} WHERE l.id = ?`, args: [id] });
  const baris = res.rows[0] as unknown as BarisLaporan | undefined;
  return baris ?? null;
}

/** Laporan AKTIF (bukan DITOLAK) milik satu karyawan pada satu agenda — BR-G6. */
export async function laporanAktif(
  agendaId: number,
  karyawanId: number,
  ex: Executor,
): Promise<BarisLaporan | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_LAPORAN} ${DARI_LAPORAN} WHERE l.agenda_id = ? AND l.karyawan_id = ? AND l.status <> 'DITOLAK'`,
    args: [agendaId, karyawanId],
  });
  const baris = res.rows[0] as unknown as BarisLaporan | undefined;
  return baris ?? null;
}

/**
 * Laporan TERAKHIR pada (agenda, karyawan) — termasuk yang DITOLAK.
 *
 * Beda dari `laporanAktif()` di atas: yang ini dipakai untuk TAMPILAN dan untuk
 * menentukan tombol aksi. Kalau hanya laporan aktif yang dibaca, setelah
 * ditolak keadaan terlihat sama dengan "belum pernah" — alasan penolakan hilang
 * dari layar dan tombolnya berubah jadi "Mulai", sehingga karyawan mengulang
 * tanpa pernah tahu apa yang salah.
 */
export async function laporanTerakhir(agendaId: number, karyawanId: number, ex: Executor): Promise<BarisLaporan | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_LAPORAN} ${DARI_LAPORAN} WHERE l.agenda_id = ? AND l.karyawan_id = ? ORDER BY l.percobaan DESC, l.id DESC LIMIT 1`,
    args: [agendaId, karyawanId],
  });
  const baris = res.rows[0] as unknown as BarisLaporan | undefined;
  return baris ?? null;
}

/** Percobaan terakhir yang PERNAH dibuat pada (agenda, karyawan), termasuk yang DITOLAK. */
export async function percobaanTerakhir(agendaId: number, karyawanId: number, ex: Executor): Promise<number> {
  const res = await ex.execute({
    sql: 'SELECT MAX(percobaan) AS m FROM agenda_laporan WHERE agenda_id = ? AND karyawan_id = ?',
    args: [agendaId, karyawanId],
  });
  const m = (res.rows[0] as Record<string, unknown>)['m'];
  return m === null || m === undefined ? 0 : Number(m);
}

async function tujuanUntukResolusi(agenda: BarisAgenda, ex: Executor): Promise<number[]> {
  return agenda.cakupan === 'KARYAWAN' ? tujuanAgenda(agenda.id, ex) : [];
}

/**
 * Daftar agenda yang DILEWATI seluruh riwayat, dipakai `keadaanUntuk()`.
 *
 * Agenda pribadi tidak ada di `agenda_tujuan` (trigger melarangnya), jadi
 * harus digabung eksplisit di `agendaUntukKaryawan()` dan di `keadaanUntuk()`.
 * Kalau tidak, `penerimaAgenda()` akan mengembalikan daftar kosong untuk agenda
 * pribadi dan pekerjaan yang sudah berjalan akan terdiagnosa "tidak diberikan
 * kepada Anda" (403) — bug yang hanya muncul pada agenda buatan sendiri.
 */
async function cariAgenda(id: number, ex: Executor): Promise<BarisAgenda | null> {
  const res = await ex.execute({
    sql: `SELECT a.id, a.judul, a.keterangan, a.wajib_foto, a.cakupan, a.toko_id, o.nama AS toko_nama,
      a.target_tanggal, a.status, a.alasan_batal, a.dibatalkan_at, a.dibuat_oleh,
      a.dibuat_oleh_karyawan, u.nama AS dibuat_oleh_nama, a.dibuat_at, a.diubah_at
      FROM agenda a LEFT JOIN toko o ON o.id = a.toko_id LEFT JOIN pengguna_admin u ON u.id = a.dibuat_oleh
      WHERE a.id = ?`,
    args: [id],
  });
  return (res.rows[0] as unknown as BarisAgenda | undefined) ?? null;
}

/**
 * Daftar agenda yang boleh dikerjakan satu karyawan + laporan aktifnya.
 *
 * penerimaAgenda() dijalankan terhadap penempatan SAAT INI (BR-G2), lalu agenda
 * yang dibuat karyawan itu sendiri ditambahkan — agenda pribadi tidak ada di
 * `agenda_tujuan` sama sekali (trigger juga melarangnya), jadi kalau tidak
 * digabung di sini agenda pribadi tidak akan pernah muncul.
 */
export async function agendaUntukKaryawan(
  karyawanId: number,
  ex: Executor,
): Promise<{ agenda: BarisAgenda; laporanAktif: BarisLaporan | null }[]> {
  const penempatan = await penempatanTerbuka(ex);
  const semua = await daftarAgenda({ status: 'AKTIF' }, ex);
  const hasil: { agenda: BarisAgenda; laporanAktif: BarisLaporan | null }[] = [];
  for (const agenda of semua) {
    const tujuan = await tujuanUntukResolusi(agenda, ex);
    const penerima = penerimaAgenda(
      { cakupan: agenda.cakupan, toko_id: agenda.toko_id, tujuan_karyawan_id: tujuan },
      penempatan,
    );
    const dibuatSendiri = agenda.dibuat_oleh_karyawan === karyawanId;
    if (!penerima.includes(karyawanId) && !dibuatSendiri) continue;
    // Yang dikirim ke layar adalah laporan TERAKHIR (bisa DITOLAK), bukan yang
    // aktif — supaya alasan penolakan tidak hilang dari tampilan karyawan.
    hasil.push({ agenda, laporanAktif: await laporanTerakhir(agenda.id, karyawanId, ex) });
  }
  return hasil;
}

/** Susun keadaan untuk fungsi murni `aturan/laporan.ts`. */
async function keadaanUntuk(
  agendaId: number,
  karyawanId: number,
  ex: Executor,
): Promise<KeadaanAgendaUntukKerja> {
  const res = await ex.execute({
    sql: 'SELECT id, status, wajib_foto, dibuat_oleh_karyawan FROM agenda WHERE id = ?',
    args: [agendaId],
  });
  const baris = res.rows[0] as unknown as
    | { id: number; status: string; wajib_foto: 0 | 1; dibuat_oleh_karyawan: number | null }
    | undefined;
  if (!baris) throw new GalatLaporan(404, 'AGENDA_TIDAK_DITEMUKAN', 'Agenda tidak ditemukan.');

  const agenda = await cariAgenda(agendaId, ex);
  if (!agenda) throw new GalatLaporan(404, 'AGENDA_TIDAK_DITEMUKAN', 'Agenda tidak ditemukan.');

  // Resolusi penerima memakai agenda yang SUDAH dibaca (bukan daftar seluruh
  // agenda) — termasuk untuk agenda pribadi, yang tidak punya baris tujuan.
  const tujuan = await tujuanUntukResolusi(agenda, ex);
  const penempatan = await penempatanTerbuka(ex);
  const penerima = penerimaAgenda(
    { cakupan: agenda.cakupan, toko_id: agenda.toko_id, tujuan_karyawan_id: tujuan },
    penempatan,
  );
  const terakhir = await laporanTerakhir(agendaId, karyawanId, ex);
  return {
    statusAgenda: baris.status,
    adalahPenerima: penerima.includes(karyawanId),
    dibuatSendiri: baris.dibuat_oleh_karyawan === karyawanId,
    wajibFoto: baris.wajib_foto === 1,
    laporanTerakhir: terakhir
      ? {
          id: terakhir.id,
          percobaan: terakhir.percobaan,
          status: terakhir.status,
          sebelum_file_id: terakhir.sebelum_file_id,
          sesudah_file_id: terakhir.sesudah_file_id,
          alasan_tolak: terakhir.alasan_tolak,
        }
      : null,
  };
}

/**
 * Langkah (1) alur karyawan: periksa aturan TANPA menulis apa pun.
 *
 * Ada supaya route bisa menolak sebelum mengunggah foto ke Telegram. Kalau
 * pemeriksaan baru dilakukan di dalam transaksi penulisan, setiap permintaan
 * yang ditolak tetap meninggalkan foto yatim di grup Telegram (BR-A4).
 *
 * Memakai fungsi murni yang PERSIS sama dengan yang dipakai `simpanDraft`/
 * `submitLaporan` di dalam transaksi — jadi pratinjau dan penulisan tidak bisa
 * berbeda pendapat (pola anti-B-19 yang dipakai M6).
 */
export async function periksaDraft(
  ex: Executor,
  agendaId: number,
  karyawanId: number,
  adaFotoBefore: boolean,
): Promise<void> {
  const keadaan = await keadaanUntuk(agendaId, karyawanId, ex);
  const hasil = bolehSimpanDraft(keadaan, adaFotoBefore);
  if (!hasil.boleh) throw new GalatLaporan(hasil.http ?? 409, 'LAPORAN_DITOLAK', hasil.alasan);
}

/** Langkah (1) untuk tahap MENUNGGU — foto after. */
export async function periksaSubmit(
  ex: Executor,
  agendaId: number,
  karyawanId: number,
  adaFotoAfter: boolean,
): Promise<void> {
  const keadaan = await keadaanUntuk(agendaId, karyawanId, ex);
  const hasil = bolehSubmit(keadaan, adaFotoAfter);
  if (!hasil.boleh) throw new GalatLaporan(hasil.http ?? 409, 'LAPORAN_DITOLAK', hasil.alasan);
}

/** Bentuk row laporan yang di-CREATE (DRAFT). */
export interface InputDraft {
  agendaId: number;
  karyawanId: number;
  keterangan?: string;
  requestId: string;
  foto: { fileId: string; chatId: string; messageId: number } | null;
}

/**
 * BR-G7: simpan draft (foto before). Kalau sudah ada draft aktif, foto before
 * DIGANTI dan waktu dibuat diperbarui — itu yang membuat foto lama yatim di
 * Telegram, seperti catatan pada `rules/03` §6.
 *
 * Memakai INSERT ... ON CONFLICT agar balapan dua perangkat tidak melempar
 * error tak terduga; `uq_laporan_aktif_per_agenda` yang jadi penagih.
 */
export async function simpanDraft(input: InputDraft, ex: Executor): Promise<BarisLaporan> {
  const keadaan = await keadaanUntuk(input.agendaId, input.karyawanId, ex);
  const cek = bolehSimpanDraft(keadaan, input.foto !== null);
  if (!cek.boleh) throw new GalatLaporan(cek.http ?? 409, 'LAPORAN_DITOLAK', cek.alasan);

  const sekarang = serialisasiWIB();
  const keterangan = input.keterangan?.trim() ? input.keterangan.trim() : null;
  // Penentuan jalur memakai laporan AKTIF (DITOLAK tidak memegang slot), bukan
  // laporan terakhir: kalau memakai yang terakhir, menyimpan draft setelah
  // ditolak akan UPDATE baris yang sudah ditolak dan ia berstatus MENUNGGU lagi.
  const ada = laporanMasihAktif(keadaan.laporanTerakhir)
    ? await laporanAktif(input.agendaId, input.karyawanId, ex)
    : null;

  if (ada) {
    await ex.execute({
      sql: 'UPDATE agenda_laporan SET keterangan = ?, sebelum_file_id = ?, sebelum_chat_id = ?, sebelum_message_id = ?, diubah_at = ? WHERE id = ?',
      args: [keterangan, input.foto?.fileId ?? null, input.foto?.chatId ?? null, input.foto?.messageId ?? null, sekarang, ada.id],
    });
    return (await laporanById(ada.id, ex))!;
  }

  await ex.execute({
    sql: `INSERT INTO agenda_laporan (agenda_id, karyawan_id, percobaan, status, keterangan,
      sebelum_file_id, sebelum_chat_id, sebelum_message_id, request_id, dibuat_at)
      VALUES (?, ?, 1, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
    args: [
      input.agendaId,
      input.karyawanId,
      keterangan,
      input.foto?.fileId ?? null,
      input.foto?.chatId ?? null,
      input.foto?.messageId ?? null,
      input.requestId,
      sekarang,
    ],
  });
  const id = Number(((await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
  return (await laporanById(id, ex))!;
}

/** Hasil submit: `baru` = laporan percobaan baru dibuat (setelah DITOLAK). */
export interface HasilSubmit {
  laporan: BarisLaporan;
  baru: boolean;
}

/**
 * BR-G7/G8: kirim laporan jadi MENUNGGU (foto after).
 *
 * Dua jalur yang memang berbeda dan keduanya sah:
 *   1. Draft yang sudah ada -> UPDATE menjadi MENUNGGU (percobaan tetap).
 *   2. Semua laporan lama DITOLAK -> INSERT percobaan baru (BR-G11, K-61).
 *
 * Menentukan jalur lewat `laporanAktif()`; tidak ditebak dari parameter route,
 * jadi karyawan tidak bisa memaksa "percobaan baru" untuk Reporter bypass.
 */
export async function submitLaporan(
  input: { agendaId: number; karyawanId: number; requestId: string; keterangan?: string; foto: { fileId: string; chatId: string; messageId: number } | null },
  ex: Executor,
): Promise<HasilSubmit> {
  const keadaan = await keadaanUntuk(input.agendaId, input.karyawanId, ex);
  const cek = bolehSubmit(keadaan, input.foto !== null);
  if (!cek.boleh) throw new GalatLaporan(cek.http ?? 409, 'LAPORAN_DITOLAK', cek.alasan);

  const sekarang = serialisasiWIB();
  const tanggal = tanggalWIB(sekarang);
  // BR-G14: toko di SNAPSHOT saat submit, walaupun penerima agenda dinamis (BR-G2).
  const riwayat = await riwayatPenempatanUntukTanggal(input.karyawanId, ex);
  const tokoId = tokoPadaTanggal(riwayat, tanggal);
  if (tokoId === null) {
    throw new GalatLaporan(
      409,
      'TANPA_PENEMPATAN',
      'Anda belum ditempatkan di toko mana pun. Hubungi admin sebelum mengirim laporan.',
    );
  }

  const keterangan = input.keterangan?.trim() ? input.keterangan.trim() : null;
  const draft = laporanMasihAktif(keadaan.laporanTerakhir) ? keadaan.laporanTerakhir : null;

  if (draft && draft.status === 'DRAFT') {
    await ex.execute({
      sql: `UPDATE agenda_laporan SET status = 'MENUNGGU', toko_id = ?, tanggal = ?, dikirim_at = ?,
        keterangan = COALESCE(?, keterangan),
        sesudah_file_id = ?, sesudah_chat_id = ?, sesudah_message_id = ?, request_id = ?, diubah_at = ?
        WHERE id = ?`,
      args: [
        tokoId,
        tanggal,
        sekarang,
        keterangan,
        input.foto?.fileId ?? null,
        input.foto?.chatId ?? null,
        input.foto?.messageId ?? null,
        input.requestId,
        sekarang,
        draft.id,
      ],
    });
    return { laporan: (await laporanById(draft.id, ex))!, baru: false };
  }

  // Percobaan baru setelah DITOLAK.
  const percobaan = percobaanBerikutnya(await percobaanTerakhir(input.agendaId, input.karyawanId, ex));
  await ex.execute({
    sql: `INSERT INTO agenda_laporan (agenda_id, karyawan_id, toko_id, tanggal, percobaan, status, keterangan,
      sebelum_file_id, sesudah_file_id, sesudah_chat_id, sesudah_message_id, dikirim_at, request_id, dibuat_at)
      VALUES (?, ?, ?, ?, ?, 'MENUNGGU', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.agendaId,
      input.karyawanId,
      tokoId,
      tanggal,
      percobaan,
      keterangan,
      keadaan.laporanTerakhir?.sebelum_file_id ?? null,
      input.foto?.fileId ?? null,
      input.foto?.chatId ?? null,
      input.foto?.messageId ?? null,
      sekarang,
      input.requestId,
      sekarang,
    ],
  });
  const id = Number(((await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] })).rows[0] as Record<string, unknown>)['id']);
  return { laporan: (await laporanById(id, ex))!, baru: true };
}

export interface FilterVerifikasiAgenda {
  status?: string;
  tokoId?: number;
  dari?: string;
  sampai?: string;
  karyawanId?: number;
  agendaId?: number;
}

/**
 * BR-G9: daftar untuk admin. DRAFT TIDAK PERNAH dikembalikan — penyaringan ini
 * memakai fungsi murni `terlihatUntukAdmin()` yang sama dipakai di UI, supaya
 * "apa yang terlihat" hanya punya satu definisi.
 */
export async function daftarLaporanUntukAdmin(
  filter: FilterVerifikasiAgenda,
  ex: Executor,
): Promise<BarisLaporan[]> {
  const syarat: string[] = ['l.status <> ?'];
  const args: (string | number)[] = ['DRAFT'];
  if (filter.status !== undefined) {
    syarat.push('l.status = ?');
    args.push(filter.status);
  }
  if (filter.tokoId !== undefined) {
    syarat.push('l.toko_id = ?');
    args.push(filter.tokoId);
  }
  if (filter.dari !== undefined) {
    syarat.push('l.tanggal >= ?');
    args.push(filter.dari);
  }
  if (filter.sampai !== undefined) {
    syarat.push('l.tanggal <= ?');
    args.push(filter.sampai);
  }
  if (filter.karyawanId !== undefined) {
    syarat.push('l.karyawan_id = ?');
    args.push(filter.karyawanId);
  }
  if (filter.agendaId !== undefined) {
    syarat.push('l.agenda_id = ?');
    args.push(filter.agendaId);
  }
  const res = await ex.execute({
    sql: `SELECT ${KOLOM_LAPORAN} ${DARI_LAPORAN} WHERE ${syarat.join(' AND ')} ORDER BY l.dikirim_at DESC, l.id DESC`,
    args,
  });
  return res.rows as unknown as BarisLaporan[];
}

/**
 * BR-G12 + K-65: terapkan keputusan verifikasi admin.
 *
 * Berbeda dari `repo/verifikasi.ts` (absensi), fungsi ini SENGAJA tidak punya
 * parameter menit keterlambatan sama sekali — agenda tidak punya jadwal yang
 * dibandingkan (BR-G13), jadi jalur itu tidak mungkin dipakai secara struktural,
 * bukan hanya dijaga lewat validasi.
 */
export async function terapkanVerifikasi(
  laporanId: number,
  input: { keputusan: 'DISETUJUI' | 'DITOLAK'; alasan_tolak?: string },
  pelaku: { id: number; peran: PeranAdmin },
  ex: Executor,
): Promise<BarisLaporan> {
  const sebelum = await laporanById(laporanId, ex);
  if (!sebelum) throw new GalatLaporan(404, 'TIDAK_DITEMUKAN', 'Laporan agenda tidak ditemukan.');

  const cekStatus = bolehVerifikasiStatus(sebelum.status);
  if (!cekStatus.boleh) throw new GalatLaporan(cekStatus.http ?? 400, 'LAPORAN_DITOLAK', cekStatus.alasan);

  if (input.keputusan === 'DITOLAK') {
    const cekAlasan = bolehTolakLaporan(input.alasan_tolak);
    if (!cekAlasan.boleh) throw new GalatLaporan(cekAlasan.http ?? 400, 'ALASAN_WAJIB', cekAlasan.alasan);
  }

  // K-32/K-65. toko_id laporan sudah snapshot, jadi satu pemeriksaan cukup.
  if (sebelum.toko_id !== null) {
    const diekspor = await sudahDiekspor(sebelum.tanggal, sebelum.toko_id, ex);
    const cekPeriode = bolehVerifikasiPadaPeriodeTerekspor(diekspor, pelaku.peran);
    if (!cekPeriode.boleh) throw new GalatLaporan(cekPeriode.http ?? 403, 'PERIODE_TEREKSPOR', cekPeriode.alasan);
  }

  const waktu = serialisasiWIB();
  await ex.execute({
    sql: 'UPDATE agenda_laporan SET status = ?, alasan_tolak = ?, diverifikasi_oleh = ?, diverifikasi_at = ?, diubah_at = ? WHERE id = ?',
    args: [
      input.keputusan,
      input.keputusan === 'DITOLAK' ? input.alasan_tolak!.trim() : null,
      pelaku.id,
      waktu,
      waktu,
      laporanId,
    ],
  });
  const sesudah = (await laporanById(laporanId, ex))!;
  await catatAudit(
    {
      waktu,
      pengguna_id: pelaku.id,
      aksi: 'AGENDA_LAPORAN_VERIFIKASI',
      entitas: 'agenda_laporan',
      entitas_id: laporanId,
      sebelum: JSON.stringify({ status: sebelum.status }),
      sesudah: JSON.stringify({ status: sesudah.status, alasan_tolak: sesudah.alasan_tolak }),
      catatan: `${input.keputusan} oleh ${pelaku.peran}`,
    },
    ex,
  );
  return sesudah;
}

/** Rekap aggregate per karyawan untuk sheet Ringkasan (BR-G16). */
export async function hitungAgendaPerKaryawan(
  karyawanId: number,
  dari: string,
  sampai: string,
  tokoId: number | null,
  ex: Executor,
): Promise<{ selesai: number; ditolak: number }> {
  const syarat = ['karyawan_id = ?', 'tanggal BETWEEN ? AND ?', "status <> 'DRAFT'"];
  const args: (string | number)[] = [karyawanId, dari, sampai];
  if (tokoId !== null) {
    syarat.push('toko_id = ?');
    args.push(tokoId);
  }
  const res = await ex.execute({
    sql: `SELECT status, COUNT(*) AS c FROM agenda_laporan WHERE ${syarat.join(' AND ')} GROUP BY status`,
    args,
  });
  let selesai = 0;
  let ditolak = 0;
  for (const r of res.rows as unknown as { status: string; c: number }[]) {
    if (r.status === 'DISETUJUI') selesai += r.c;
    else if (r.status === 'DITOLAK') ditolak += r.c;
  }
  return { selesai, ditolak };
}

/** Detail Agenda untuk sheet Excel (BR-G16). */
export interface BarisDetailAgenda {
  tanggal: string;
  karyawan_nama: string;
  toko_nama: string;
  judul_agenda: string;
  wajib_foto: string;
  percobaan: number;
  status: string;
  keterangan: string | null;
  alasan_tolak: string | null;
  diverifikasi_nama: string | null;
}

export async function barisDetailAgenda(dari: string, sampai: string, tokoId: number | null, ex: Executor): Promise<BarisDetailAgenda[]> {
  const syarat = ["l.status <> 'DRAFT'", 'l.tanggal BETWEEN ? AND ?'];
  const args: (string | number | null)[] = [dari, sampai];
  if (tokoId !== null) {
    syarat.push('l.toko_id = ?');
    args.push(tokoId);
  }
  const res = await ex.execute({
    sql: `SELECT l.tanggal, k.nama AS karyawan_nama, o.nama AS toko_nama, a.judul AS judul_agenda,
      a.wajib_foto, l.percobaan, l.status, l.keterangan, l.alasan_tolak, u.nama AS diverifikasi_nama
      FROM agenda_laporan l JOIN karyawan k ON k.id = l.karyawan_id
      LEFT JOIN toko o ON o.id = l.toko_id JOIN agenda a ON a.id = l.agenda_id
      LEFT JOIN pengguna_admin u ON u.id = l.diverifikasi_oleh
      WHERE ${syarat.join(' AND ')} ORDER BY l.tanggal ASC, k.nama ASC, l.id ASC`,
    args,
  });
  return (res.rows as unknown as (Omit<BarisDetailAgenda, 'tanggal' | 'wajib_foto'> & {
    tanggal: string;
    wajib_foto: number;
  })[]).map((r) => ({
    ...r,
    tanggal: formatPendek(r.tanggal),
    wajib_foto: Number(r.wajib_foto) === 1 ? 'Before + After' : 'Tanpa foto',
  }));
}

function formatPendek(tanggal: string): string {
  const bagian = tanggal.split('-');
  if (bagian.length !== 3) return tanggal;
  return `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
}