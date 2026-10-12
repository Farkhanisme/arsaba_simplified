/**
 * Repo agenda (M11). SQL berparameter, tanpa ORM — filter dinamis disusun dari
 * FRAGMEN STATIS yang digabung ' AND ', input pengguna hanya masuk `args`.
 *
 * Catatan desain yang menentukan bentuk file ini: **penerima agenda tidak disimpan**
 * untuk cakupan TOKO/SEMUA (BR-G2, K-58). Jadi tidak ada query "ambil penerima dari
 * tabel" — yang ada adalah `penempatanTerbuka()`, satu query penempatan yang diteruskan
 * ke fungsi murni `penerimaAgenda()`. Konsekuensinya: memindahkan karyawan (BR-P2)
 * langsung mengubah penerima agenda tanpa ada baris yang perlu ditulis.
 *
 * Semua mutasi DI DALAM transaksi pemanggil + catatAudit (BR-G19).
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB } from '../waktu';
import {
  penerimaAgenda,
  bolehBatalkan,
  bolehUbahTujuan,
  normalisasiPembuatan,
  type Cakupan,
  type PenempatanTerbuka,
  type StatusAgenda,
} from '../aturan/agenda';

export class GalatAgenda extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GalatAgenda';
  }
}

export interface BarisAgenda {
  id: number;
  judul: string;
  keterangan: string | null;
  wajib_foto: 0 | 1;
  cakupan: Cakupan;
  toko_id: number | null;
  toko_nama: string | null;
  target_tanggal: string | null;
  status: StatusAgenda;
  alasan_batal: string | null;
  dibatalkan_at: string | null;
  dibuat_oleh: number | null;
  dibuat_oleh_karyawan: number | null;
  dibuat_oleh_nama: string | null;
  dibuat_at: string;
  diubah_at: string | null;
}

const KOLOM =
  'a.id, a.judul, a.keterangan, a.wajib_foto, a.cakupan, a.toko_id, o.nama AS toko_nama, ' +
  'a.target_tanggal, a.status, a.alasan_batal, a.dibatalkan_at, a.dibuat_oleh, ' +
  'a.dibuat_oleh_karyawan, u.nama AS dibuat_oleh_nama, a.dibuat_at, a.diubah_at';

export async function agendaById(id: number, ex: Executor): Promise<BarisAgenda | null> {
  const res = await ex.execute({
    sql: `SELECT ${KOLOM} FROM agenda a LEFT JOIN toko o ON o.id = a.toko_id LEFT JOIN pengguna_admin u ON u.id = a.dibuat_oleh WHERE a.id = ?`,
    args: [id],
  });
  const baris = res.rows[0] as unknown as BarisAgenda | undefined;
  return baris ?? null;
}

export interface FilterAgenda {
  status?: StatusAgenda;
  cakupan?: Cakupan;
  tokoId?: number;
}

export async function daftarAgenda(filter: FilterAgenda, ex: Executor): Promise<BarisAgenda[]> {
  const syarat: string[] = [];
  const args: (string | number)[] = [];
  if (filter.status !== undefined) {
    syarat.push('a.status = ?');
    args.push(filter.status);
  }
  if (filter.cakupan !== undefined) {
    syarat.push('a.cakupan = ?');
    args.push(filter.cakupan);
  }
  if (filter.tokoId !== undefined) {
    syarat.push('a.toko_id = ?');
    args.push(filter.tokoId);
  }
  const klausa = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '';
  const res = await ex.execute({
    sql: `SELECT ${KOLOM} FROM agenda a LEFT JOIN toko o ON o.id = a.toko_id LEFT JOIN pengguna_admin u ON u.id = a.dibuat_oleh ${klausa} ORDER BY a.dibuat_at DESC, a.id DESC`,
    args,
  });
  return res.rows as unknown as BarisAgenda[];
}

/**
 * Seluruh karyawan — **aktif dan nonaktif** — beserta toko penempatan terbukanya.
 *
 * Nonaktif sengaja ikut diambil: penyaringan "hanya karyawan aktif yang jadi penerima"
 * adalah keputusan bisnis BR-G2 dan ditetapkan di fungsi murni `penerimaAgenda()`, supaya
 * aturan itu bisa diuji tanpa database. Kalau penyaringan dipindah ke sini, fungsi murni
 * tidak akan pernah bisa membuktikan aturannya.
 *
 * Penempatan diambil lewat subquery, bukan join yang bisa menggandakan baris: satu karyawan
 * bisa punya banyak riwayat penempatan dan hanya yang terbuka (`berlaku_sampai IS NULL`)
 * yang dipakai. Kalau karyawan punya lebih dari satu penempatan terbuka, yang terbaru
 * dipakai — BR-P1 sudah menjamin hanya ada satu, jadi ini hanya pengaman.
 */
export async function penempatanTerbuka(ex: Executor): Promise<PenempatanTerbuka[]> {
  const res = await ex.execute({
    sql: `SELECT k.id AS karyawan_id, k.nama, k.aktif,
      (SELECT p.toko_id FROM karyawan_penempatan p WHERE p.karyawan_id = k.id AND p.berlaku_sampai IS NULL ORDER BY p.berlaku_mulai DESC LIMIT 1) AS toko_id
      FROM karyawan k ORDER BY k.nama ASC`,
    args: [],
  });
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const toko = row['toko_id'];
    return {
      karyawan_id: Number(row['karyawan_id']),
      nama: String(row['nama']),
      aktif: Number(row['aktif']) === 1,
      toko_id: toko === null || toko === undefined ? null : Number(toko),
    };
  });
}

/** Tujuan eksplisit (hanya cakupan KARYAWAN). */
export async function tujuanAgenda(agendaId: number, ex: Executor): Promise<number[]> {
  const res = await ex.execute({
    sql: 'SELECT karyawan_id FROM agenda_tujuan WHERE agenda_id = ? ORDER BY karyawan_id ASC',
    args: [agendaId],
  });
  return res.rows.map((r) => Number((r as Record<string, unknown>)['karyawan_id']));
}

/** Satu agenda + penerima yang dihitung dari penempatan saat ini (BR-G2). */
export interface AgendaLengkap {
  agenda: BarisAgenda;
  penerimaIds: number[];
  namaPenerima: string[];
}

/** Satu agenda + penerima yang dihitung dari penempatan saat ini (BR-G2). */
export async function agendaDenganPenerima(
  agendaId: number,
  ex: Executor,
): Promise<AgendaLengkap | null> {
  const agenda = await agendaById(agendaId, ex);
  if (!agenda) return null;
  const penempatan = await penempatanTerbuka(ex);
  const tujuan = agenda.cakupan === 'KARYAWAN' ? await tujuanAgenda(agendaId, ex) : [];
  const penerimaIds = penerimaAgenda(
    { cakupan: agenda.cakupan, toko_id: agenda.toko_id, tujuan_karyawan_id: tujuan },
    penempatan,
  );
  const peta = new Map(penempatan.map((p) => [p.karyawan_id, p.nama]));
  const namaPenerima = penerimaIds
    .map((id) => peta.get(id) ?? `Karyawan #${id}`)
    .sort((a, b) => a.localeCompare(b, 'id'));
  return { agenda, penerimaIds, namaPenerima };
}

async function tokoAktifTerdaftar(id: number, ex: Executor): Promise<Set<number>> {
  const res = await ex.execute({ sql: 'SELECT id FROM toko WHERE id = ? AND aktif = 1', args: [id] });
  return new Set(res.rows.map((r) => Number((r as Record<string, unknown>)['id'])));
}

async function karyawanAktifTerdaftar(ids: number[], ex: Executor): Promise<Set<number>> {
  if (ids.length === 0) return new Set<number>();
  // Placeholder dinamis dibangun dari JUMLAH id, bukan dari nilai id — nilai id hanya
  // masuk lewat args, tidak pernah menyatu ke string SQL.
  const tempat = ids.map(() => '?').join(', ');
  const res = await ex.execute({
    sql: `SELECT id FROM karyawan WHERE aktif = 1 AND id IN (${tempat})`,
    args: ids,
  });
  return new Set(res.rows.map((r) => Number((r as Record<string, unknown>)['id'])));
}

/**
 * Menyusun pemeriksa SINKRON untuk `normalisasiPembuatan()`.
 *
 * Fungsi murni itu sengaja sinkron supaya bisa diuji tanpa database dan tanpa await; jadi
 * repo menanyakan keberadaan toko/karyawan lebih dulu lalu menyerahkan `Set` hasilnya.
 * Pemeriksa berbasis Set sekaligus menghapus satu kelas bug: kalau pemeriksaanya query
 * satu per satu, tidak aktif dan "tidak ditemukan" jadi dua kondisi yang berbeda.
 */
async function pemeriksaUntuk(
  input: { toko_id?: number; karyawan_ids?: number[] },
  ex: Executor,
): Promise<{ tokoAda: (id: number) => boolean; karyawanAktif: (id: number) => boolean }> {
  const toko = input.toko_id === undefined ? new Set<number>() : await tokoAktifTerdaftar(input.toko_id, ex);
  const karyawan = await karyawanAktifTerdaftar(input.karyawan_ids ?? [], ex);
  return {
    tokoAda: (id) => toko.has(id),
    karyawanAktif: (id) => karyawan.has(id),
  };
}

export interface InputBuatAgenda {
  judul: string;
  keterangan?: string;
  wajib_foto: boolean;
  cakupan: Cakupan;
  toko_id?: number;
  target_tanggal?: string;
  karyawan_ids?: number[];
  dibuatOleh: number;
}

/**
 * Membuat agenda (BR-G1..G3) DI DALAM transaksi pemanggil.
 *
 * Validasi memakai `normalisasiPembuatan()` supaya aturan yang sama bisa diuji tanpa DB.
 * Penolakan melempar `GalatAgenda` — berbeda dari penandaan ketidakhadiran yang melompati sel,
 * karena satu agenda gagal menyimpan tidak ada setengah-tersimpan yang perlu dilaporkan.
 */
export async function buatAgenda(input: InputBuatAgenda, ex: Executor): Promise<number> {
  const hasil = normalisasiPembuatan(input, await pemeriksaUntuk(input, ex));
  if (hasil.status === 'ditolak') {
    throw new GalatAgenda(400, hasil.alasan ?? 'Input tidak valid.');
  }
  const n = hasil.nilai as {
    judul: string;
    keterangan: string | null;
    wajib_foto: number;
    cakupan: Cakupan;
    toko_id: number | null;
    target_tanggal: string | null;
    karyawan_ids: number[];
  };

  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: `INSERT INTO agenda (judul, keterangan, wajib_foto, cakupan, toko_id, target_tanggal, dibuat_oleh, dibuat_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [n.judul, n.keterangan, n.wajib_foto, n.cakupan, n.toko_id, n.target_tanggal, input.dibuatOleh, sekarang],
  });
  const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);

  for (const karyawanId of n.karyawan_ids) {
    await ex.execute({
      sql: 'INSERT INTO agenda_tujuan (agenda_id, karyawan_id, dibuat_at) VALUES (?, ?, ?)',
      args: [id, karyawanId, sekarang],
    });
  }

  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: input.dibuatOleh,
      aksi: 'AGENDA_TAMBAH',
      entitas: 'agenda',
      entitas_id: id,
      sesudah: JSON.stringify({
        judul: n.judul,
        wajib_foto: n.wajib_foto,
        cakupan: n.cakupan,
        toko_id: n.toko_id,
        target_tanggal: n.target_tanggal,
        karyawan_ids: n.karyawan_ids,
      }),
      catatan: `Agenda "${n.judul}" dibuat`,
    },
    ex,
  );
  return id;
}

/**
 * K-62/BR-G4: batalkan agenda. Wajib alasan. `DIBATALKAN` terminal — tidak ada
 * `aktifkan ulang`, karena tidak ada keputusan pemilik yang memperbolehkannya.
 *
 * Tidak ada hapus permanen (K-62): laporan yang sudah ada tetap menunjuk agenda ini.
 */
export async function batalkanAgenda(
  id: number,
  alasan: string,
  pelaku: { id: number; peran: string },
  ex: Executor,
): Promise<BarisAgenda> {
  const sebelum = await agendaById(id, ex);
  if (!sebelum) throw new GalatAgenda(404, 'Agenda tidak ditemukan.');
  const cek = bolehBatalkan(sebelum.status);
  if (cek.status === 'ditolak') throw new GalatAgenda(409, cek.alasan ?? 'Tidak bisa dibatalkan.');

  const alasanBersih = alasan.trim();
  if (alasanBersih.length === 0) {
    throw new GalatAgenda(400, 'Alasan pembatalan wajib diisi.');
  }
  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: 'UPDATE agenda SET status = ?, alasan_batal = ?, dibatalkan_at = ?, dibatalkan_oleh = ?, diubah_at = ? WHERE id = ?',
    args: ['DIBATALKAN', alasanBersih, sekarang, pelaku.id, sekarang, id],
  });
  const sesudah = (await agendaById(id, ex))!;
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: pelaku.id,
      aksi: 'AGENDA_BATALKAN',
      entitas: 'agenda',
      entitas_id: id,
      sebelum: JSON.stringify({ status: sebelum.status }),
      sesudah: JSON.stringify({ status: sesudah.status, alasan_batal: sesudah.alasan_batal }),
      catatan: `Agenda "${sebelum.judul}" dibatalkan`,
    },
    ex,
  );
  return sesudah;
}

/**
 * K-62/BR-G5: ganti daftar tujuan eksplisit, hanya untuk cakupan KARYAWAN.
 *
 * Untuk TOKO/SEMUA "mengubah penerima" berarti menukar `toko_id`, jadi bentuk inputnya
 * `gantiTujuanAgenda` (lihat di bawah) yang menangani keduanya.
 *
 * Baris lama dibuang dan diisi ulang dalam satu transaksi. Laporan yang sudah ada **tidak**
 * ikut tersentuh (BR-G5) — membatalkan tujuan bukan berarti membatalkan pengerjaan.
 */
export async function gantiTujuanAgenda(
  id: number,
  tujuan: { cakupan: Cakupan; toko_id?: number; karyawan_ids?: number[] },
  pelaku: { id: number; peran: string },
  ex: Executor,
): Promise<BarisAgenda> {
  const sebelum = await agendaById(id, ex);
  if (!sebelum) throw new GalatAgenda(404, 'Agenda tidak ditemukan.');
  const cek = bolehUbahTujuan(sebelum.status, sebelum.dibuat_oleh_karyawan);
  if (cek.status === 'ditolak') throw new GalatAgenda(409, cek.alasan ?? 'Tidak bisa diubah.');

  const hasil = normalisasiPembuatan(
    {
      judul: sebelum.judul,
      keterangan: sebelum.keterangan ?? undefined,
      wajib_foto: sebelum.wajib_foto === 1,
      cakupan: tujuan.cakupan,
      toko_id: tujuan.toko_id,
      target_tanggal: sebelum.target_tanggal ?? undefined,
      karyawan_ids: tujuan.karyawan_ids,
    },
    await pemeriksaUntuk(tujuan, ex),
  );
  if (hasil.status === 'ditolak') {
    throw new GalatAgenda(400, hasil.alasan ?? 'Input tidak valid.');
  }
  const n = hasil.nilai as {
    cakupan: Cakupan;
    toko_id: number | null;
    karyawan_ids: number[];
  };

  const tujuanSebelum = sebelum.cakupan === 'KARYAWAN' ? await tujuanAgenda(id, ex) : [];
  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: 'UPDATE agenda SET cakupan = ?, toko_id = ?, diubah_at = ? WHERE id = ?',
    args: [n.cakupan, n.toko_id, sekarang, id],
  });
  await ex.execute({ sql: 'DELETE FROM agenda_tujuan WHERE agenda_id = ?', args: [id] });
  for (const karyawanId of n.karyawan_ids) {
    await ex.execute({
      sql: 'INSERT INTO agenda_tujuan (agenda_id, karyawan_id, dibuat_at) VALUES (?, ?, ?)',
      args: [id, karyawanId, sekarang],
    });
  }

  const sesudah = (await agendaById(id, ex))!;
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: pelaku.id,
      aksi: 'AGENDA_GANTI_TUJUAN',
      entitas: 'agenda',
      entitas_id: id,
      sebelum: JSON.stringify({ cakupan: sebelum.cakupan, toko_id: sebelum.toko_id, karyawan_ids: tujuanSebelum }),
      sesudah: JSON.stringify({ cakupan: sesudah.cakupan, toko_id: sesudah.toko_id, karyawan_ids: n.karyawan_ids }),
      catatan: `Penerima agenda "${sebelum.judul}" diubah`,
    },
    ex,
  );
  return sesudah;
}