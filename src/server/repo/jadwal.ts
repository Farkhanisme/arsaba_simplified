/**
 * Repo jadwal (M5). SQL berparameter, tanpa ORM.
 * Seluruh tulis dijalankan DI DALAM transaksi oleh pemanggil + catatAudit.
 * Memakai ulang slotMemenuhiTipeHari/urutkanSlot/cekBatasSlot (aturan/jadwal),
 * tokoPadaTanggal + sudahDiekspor (aturan/absensi), dan snapshot BR-J3.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB, jenisHari } from '../waktu';
import {
  urutkanSlot,
  cekBatasSlot,
  adaSlotTakValid,
  slotMemenuhiTipeHari,
  peringatanTumpangTindih,
  type SlotInput,
} from '../aturan/jadwal';
import { tokoPadaTanggal, sudahDiekspor, type PeranAdmin } from '../aturan/absensi';
import { riwayatPenempatanUntukTanggal } from './absensi';
import { GalatAturan } from './penempatan';
import type { Shift } from './shift';

export interface KaryawanToko {
  id: number;
  nama: string;
}

export interface SlotJadwal extends SlotInput {
  urutan: number;
}

export interface BarisJadwal {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  tanggal: string;
  shift_template_id: number | null;
  template_nama: string | null;
  is_override: number;
  catatan: string | null;
  slot: SlotJadwal[];
  peringatan: { a: number; b: number }[];
}

/** BR-J4: karyawan di toko itu pada rentang tampil (gabungan per tanggal). */
export async function daftarKaryawanDiToko(tokoId: number, dari: string, sampai: string, ex: Executor): Promise<KaryawanToko[]> {
  const res = await ex.execute({
    sql: 'SELECT DISTINCT k.id, k.nama FROM karyawan k JOIN karyawan_penempatan p ON p.karyawan_id = k.id WHERE k.aktif = 1 AND p.toko_id = ? AND p.berlaku_mulai <= ? AND (p.berlaku_sampai IS NULL OR p.berlaku_sampai >= ?) ORDER BY k.nama ASC',
    args: [tokoId, sampai, dari],
  });
  return res.rows as unknown as KaryawanToko[];
}

/** Rentang penempatan di toko itu (untuk menggelapkan sel di luar penempatan). */
export async function penempatanRentang(
  tokoId: number,
  dari: string,
  sampai: string,
  ex: Executor,
): Promise<{ karyawan_id: number; mulai: string; sampai: string | null }[]> {
  const res = await ex.execute({
    sql: 'SELECT karyawan_id, berlaku_mulai AS mulai, berlaku_sampai AS sampai FROM karyawan_penempatan WHERE toko_id = ? AND berlaku_mulai <= ? AND (berlaku_sampai IS NULL OR berlaku_sampai >= ?)',
    args: [tokoId, sampai, dari],
  });
  return res.rows as unknown as { karyawan_id: number; mulai: string; sampai: string | null }[];
}

async function slotUntukJadwal(jadwalId: number, ex: Executor): Promise<SlotJadwal[]> {
  const res = await ex.execute({
    sql: 'SELECT urutan, nama, jam_mulai, jam_selesai FROM jadwal_slot WHERE jadwal_id = ? ORDER BY urutan ASC',
    args: [jadwalId],
  });
  return res.rows as unknown as SlotJadwal[];
}

/** Data grid: jadwal + snapshot slot + nama template + peringatan overlap. */
export async function daftarJadwal(tokoId: number, dari: string, sampai: string, ex: Executor): Promise<BarisJadwal[]> {
  const res = await ex.execute({
    sql: 'SELECT j.id, j.karyawan_id, k.nama AS karyawan_nama, j.tanggal, j.shift_template_id, s.nama AS template_nama, j.is_override, j.catatan FROM jadwal j JOIN karyawan k ON k.id = j.karyawan_id LEFT JOIN shift_template s ON s.id = j.shift_template_id WHERE j.toko_id = ? AND j.tanggal BETWEEN ? AND ? ORDER BY k.nama ASC, j.tanggal ASC',
    args: [tokoId, dari, sampai],
  });
  const keluar: BarisJadwal[] = [];
  for (const baris of res.rows as unknown as Omit<BarisJadwal, 'slot' | 'peringatan'>[]) {
    const slot = await slotUntukJadwal(baris.id, ex);
    keluar.push({ ...baris, slot, peringatan: peringatanTumpangTindih(slot) });
  }
  return keluar;
}

/** BR-J2: template aktif bernama itu yang cocok untuk tanggal (atau null). */
export async function templateUntukTanggal(tokoId: number, nama: string, tanggal: string, ex: Executor): Promise<Shift | null> {
  const res = await ex.execute({
    sql: 'SELECT id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at FROM shift_template WHERE toko_id = ? AND nama = ? AND aktif = 1',
    args: [tokoId, nama],
  });
  const semua = res.rows as unknown as Shift[];
  return slotMemenuhiTipeHari(semua, nama, tanggal);
}

export function pesanTanpaPadanan(nama: string, tanggal: string): string {
  const hari = jenisHari(tanggal) === 'WEEKDAY' ? 'weekday' : 'weekend';
  return `Shift '${nama}' tidak memiliki jam untuk hari ${hari}.`;
}

async function pastikanKaryawanAktif(karyawanId: number, ex: Executor): Promise<void> {
  const res = await ex.execute({ sql: 'SELECT id FROM karyawan WHERE id = ? AND aktif = 1', args: [karyawanId] });
  if (res.rows.length === 0) throw new GalatAturan(404, 'Karyawan tidak ditemukan atau nonaktif.');
}

function pastikanBelumDiekspor(peran: PeranAdmin, diekspor: boolean): void {
  if (diekspor && peran !== 'SUPER_ADMIN') {
    throw new GalatAturan(403, 'Periode ini sudah diekspor. Hanya Super Admin yang boleh mengubah jadwal.');
  }
}

export interface HasilSel {
  status: 'dibuat' | 'ditimpa' | 'dilewati';
  id: number;
}

export type StatusSel = 'dibuat' | 'dilewati' | 'ditimpa' | 'ditolak';

export interface KlasifikasiSel {
  status: StatusSel;
  /** Alasan penolakan (hanya bila ditolak); null bila lolos. */
  alasan: string | null;
  /** Status HTTP padanan (hanya bila ditolak); null bila lolos. */
  http: number | null;
}

export interface InputSel {
  tokoId: number;
  karyawanId: number;
  tanggal: string;
  namaTemplate: string;
  mode: 'lewati' | 'timpa';
  peran: PeranAdmin;
}

/**
 * SATU classifier untuk pratinjau dan apply (B-19). Murni membaca — tidak
 * menulis dan TIDAK MELEMPAR untuk penolakan tingkat sel; mengembalikan
 * status + alasan agar kedua jalur selalu sejalan.
 */
export async function klasifikasiSel(input: InputSel, ex: Executor): Promise<KlasifikasiSel> {
  const kry = await ex.execute({ sql: 'SELECT id FROM karyawan WHERE id = ? AND aktif = 1', args: [input.karyawanId] });
  if (kry.rows.length === 0) {
    return { status: 'ditolak', alasan: 'Karyawan tidak ditemukan atau nonaktif.', http: 404 };
  }
  const riwayat = await riwayatPenempatanUntukTanggal(input.karyawanId, ex);
  if (tokoPadaTanggal(riwayat, input.tanggal) !== input.tokoId) {
    return { status: 'ditolak', alasan: 'Karyawan tidak ditempatkan di toko ini pada tanggal tersebut.', http: 409 };
  }
  const tpl = await templateUntukTanggal(input.tokoId, input.namaTemplate, input.tanggal, ex);
  if (!tpl) {
    return { status: 'ditolak', alasan: pesanTanpaPadanan(input.namaTemplate, input.tanggal), http: 409 };
  }
  if ((await sudahDiekspor(input.tanggal, input.tokoId, ex)) && input.peran !== 'SUPER_ADMIN') {
    return {
      status: 'ditolak',
      alasan: 'Periode ini sudah diekspor. Hanya Super Admin yang boleh mengubah jadwal.',
      http: 403,
    };
  }
  const ada = await ex.execute({
    sql: 'SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
    args: [input.karyawanId, input.tanggal],
  });
  if (ada.rows.length > 0) {
    return input.mode === 'lewati'
      ? { status: 'dilewati', alasan: null, http: null }
      : { status: 'ditimpa', alasan: null, http: null };
  }
  return { status: 'dibuat', alasan: null, http: null };
}

/**
 * BR-J5 (+J2/J3/J4/J9): buat satu sel, atau timpa bila mode timpa eksplisit.
 * Default DILEWATI bila sel sudah ada (BR-J5) — mode wajib diisi pemanggil.
 * Jalur satu-sel: penolakan MELEMPAR (memang benar untuk satu sel).
 */
export async function buatAtauTimpa(
  input: { tokoId: number; karyawanId: number; tanggal: string; namaTemplate: string; mode: 'lewati' | 'timpa'; pelaku: { id: number; peran: PeranAdmin } },
  ex: Executor,
): Promise<HasilSel> {
  const klas = await klasifikasiSel(
    { tokoId: input.tokoId, karyawanId: input.karyawanId, tanggal: input.tanggal, namaTemplate: input.namaTemplate, mode: input.mode, peran: input.pelaku.peran },
    ex,
  );
  if (klas.status === 'ditolak') throw new GalatAturan(klas.http ?? 409, klas.alasan ?? 'Sel ditolak.');
  if (klas.status === 'dilewati') {
    const ada = await ex.execute({
      sql: 'SELECT id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
      args: [input.karyawanId, input.tanggal],
    });
    return { status: 'dilewati', id: Number((ada.rows[0] as Record<string, unknown>)!['id']) };
  }

  const tpl = await templateUntukTanggal(input.tokoId, input.namaTemplate, input.tanggal, ex);
  if (!tpl) throw new GalatAturan(409, pesanTanpaPadanan(input.namaTemplate, input.tanggal));
  const sekarang = serialisasiWIB();
  const adaLama = await ex.execute({
    sql: 'SELECT id, is_override, catatan FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
    args: [input.karyawanId, input.tanggal],
  });
  const lama = adaLama.rows[0] as unknown as { id: number; is_override: number; catatan: string | null } | undefined;

  const slotSnapshot = [{ urutan: 1, nama: tpl.nama, jam_mulai: tpl.jam_mulai, jam_selesai: tpl.jam_selesai }];
  if (lama) {
    const sebelum = JSON.stringify({ ...(await slotUntukJadwal(lama.id, ex)), template: lama });
    await ex.execute({
      sql: 'UPDATE jadwal SET shift_template_id = ?, is_override = 0, catatan = NULL, diubah_at = ? WHERE id = ?',
      args: [tpl.id, sekarang, lama.id],
    });
    await ex.execute({ sql: 'DELETE FROM jadwal_slot WHERE jadwal_id = ?', args: [lama.id] });
    await ex.execute({
      sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, ?, ?, ?)',
      args: [lama.id, tpl.nama, tpl.jam_mulai, tpl.jam_selesai],
    });
    await catatAudit(
      {
        waktu: sekarang,
        pengguna_id: input.pelaku.id,
        aksi: 'JADWAL_TIMPA',
        entitas: 'jadwal',
        entitas_id: lama.id,
        sebelum,
        sesudah: JSON.stringify({ shift_template_id: tpl.id, slot: slotSnapshot }),
        catatan: `Jadwal ditimpa dengan ${tpl.nama}`,
      },
      ex,
    );
    return { status: 'ditimpa', id: lama.id };
  }

  await ex.execute({
    sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    args: [input.karyawanId, input.tokoId, input.tanggal, tpl.id, input.pelaku.id, sekarang],
  });
  const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
  await ex.execute({
    sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, ?, ?, ?)',
    args: [id, tpl.nama, tpl.jam_mulai, tpl.jam_selesai],
  });
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: input.pelaku.id,
      aksi: 'JADWAL_BUAT',
      entitas: 'jadwal',
      entitas_id: id,
      sesudah: JSON.stringify({ karyawan_id: input.karyawanId, tanggal: input.tanggal, shift_template_id: tpl.id, slot: slotSnapshot }),
      catatan: `Jadwal dibuat dengan ${tpl.nama}`,
    },
    ex,
  );
  return { status: 'dibuat', id };
}

/**
 * BR-J6: perubahan khusus satu hari — mengganti SELURUH slot tanggal itu
 * (maks 2, urut naik, is_override=1). Tanggal tanpa jadwal -> jadwal baru.
 * Overlap hanya peringatan (BR-J7): dikembalikan, tidak memblokir.
 */
export async function simpanOverride(
  input: { karyawanId: number; tanggal: string; slots: SlotInput[]; catatan: string | null; pelaku: { id: number; peran: PeranAdmin } },
  ex: Executor,
): Promise<{ id: number; peringatan: { a: number; b: number }[] }> {
  if (input.slots.length < 1) throw new GalatAturan(400, 'Minimal 1 slot.');
  const takValid = adaSlotTakValid(input.slots);
  if (takValid.length > 0) throw new GalatAturan(400, takValid[0] ?? 'Slot tidak valid.');
  const batas = cekBatasSlot(input.slots.length);
  if (!batas.boleh) throw new GalatAturan(400, batas.alasan);
  await pastikanKaryawanAktif(input.karyawanId, ex);

  const ada = await ex.execute({
    sql: 'SELECT id, toko_id, is_override, catatan FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
    args: [input.karyawanId, input.tanggal],
  });
  const lama = ada.rows[0] as unknown as { id: number; toko_id: number; is_override: number; catatan: string | null } | undefined;

  let tokoId: number;
  if (lama) {
    tokoId = lama.toko_id;
  } else {
    const riwayat = await riwayatPenempatanUntukTanggal(input.karyawanId, ex);
    const toko = tokoPadaTanggal(riwayat, input.tanggal);
    if (toko === null) {
      throw new GalatAturan(409, 'Karyawan tidak ditempatkan di toko pada tanggal tersebut.');
    }
    tokoId = toko;
  }
  pastikanBelumDiekspor(input.pelaku.peran, await sudahDiekspor(input.tanggal, tokoId, ex));

  const urut = urutkanSlot(input.slots);
  const sebelum = lama ? JSON.stringify({ ...(await slotUntukJadwal(lama.id, ex)), is_override: lama.is_override, catatan: lama.catatan }) : null;
  const sekarang = serialisasiWIB();
  const catatan = input.catatan && input.catatan.trim().length > 0 ? input.catatan.trim() : null;

  let id: number;
  if (lama) {
    id = lama.id;
    await ex.execute({
      sql: 'UPDATE jadwal SET shift_template_id = NULL, is_override = 1, catatan = ?, diubah_at = ? WHERE id = ?',
      args: [catatan, sekarang, id],
    });
    await ex.execute({ sql: 'DELETE FROM jadwal_slot WHERE jadwal_id = ?', args: [id] });
  } else {
    await ex.execute({
      sql: 'INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, catatan, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, NULL, 1, ?, ?, ?)',
      args: [input.karyawanId, tokoId, input.tanggal, catatan, input.pelaku.id, sekarang],
    });
    const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
    id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
  }
  for (let i = 0; i < urut.length; i++) {
    const s = urut[i]!;
    await ex.execute({
      sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, ?, ?, ?, ?)',
      args: [id, i + 1, s.nama.trim(), s.jam_mulai, s.jam_selesai],
    });
  }
  const peringatan = peringatanTumpangTindih(urut);
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: input.pelaku.id,
      aksi: 'JADWAL_OVERRIDE',
      entitas: 'jadwal',
      entitas_id: id,
      sebelum: sebelum ?? undefined,
      sesudah: JSON.stringify({ is_override: 1, slot: urut, catatan }),
      catatan: 'Perubahan khusus satu hari',
    },
    ex,
  );
  return { id, peringatan };
}

/**
 * BR-J6: "Kembalikan ke shift standar" — hapus is_override, simpan snapshot
 * template yang dipilih lagi.
 */
export async function kembalikanStandar(
  input: { karyawanId: number; tanggal: string; namaTemplate: string; pelaku: { id: number; peran: PeranAdmin } },
  ex: Executor,
): Promise<{ id: number }> {
  await pastikanKaryawanAktif(input.karyawanId, ex);
  const ada = await ex.execute({
    sql: 'SELECT id, toko_id FROM jadwal WHERE karyawan_id = ? AND tanggal = ?',
    args: [input.karyawanId, input.tanggal],
  });
  const lama = ada.rows[0] as unknown as { id: number; toko_id: number } | undefined;
  if (!lama) throw new GalatAturan(404, 'Jadwal tidak ditemukan.');
  const tpl = await templateUntukTanggal(lama.toko_id, input.namaTemplate, input.tanggal, ex);
  if (!tpl) throw new GalatAturan(409, pesanTanpaPadanan(input.namaTemplate, input.tanggal));
  pastikanBelumDiekspor(input.pelaku.peran, await sudahDiekspor(input.tanggal, lama.toko_id, ex));

  const sebelum = JSON.stringify(await slotUntukJadwal(lama.id, ex));
  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: 'UPDATE jadwal SET shift_template_id = ?, is_override = 0, catatan = NULL, diubah_at = ? WHERE id = ?',
    args: [tpl.id, sekarang, lama.id],
  });
  await ex.execute({ sql: 'DELETE FROM jadwal_slot WHERE jadwal_id = ?', args: [lama.id] });
  await ex.execute({
    sql: 'INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, ?, ?, ?)',
    args: [lama.id, tpl.nama, tpl.jam_mulai, tpl.jam_selesai],
  });
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: input.pelaku.id,
      aksi: 'JADWAL_STANDAR',
      entitas: 'jadwal',
      entitas_id: lama.id,
      sebelum,
      sesudah: JSON.stringify({ shift_template_id: tpl.id, is_override: 0 }),
      catatan: `Kembali ke shift standar ${tpl.nama}`,
    },
    ex,
  );
  return { id: lama.id };
}

export interface HasilPratinjau {
  baru: { karyawan_id: number; tanggal: string }[];
  dilewati: { karyawan_id: number; tanggal: string }[];
  ditimpa: { karyawan_id: number; tanggal: string }[];
  ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
}

export interface HasilMassal extends HasilPratinjau {}

/**
 * BR-J5: pratinjau isi massal TANPA menulis — memakai klasifikasiSel yang
 * SAMA dengan apply, sehingga hitungannya selalu sejalan (invarian B-19).
 */
export async function pratinjauMassal(
  input: { tokoId: number; karyawanIds: number[]; dari: string; sampai: string; namaTemplate: string; mode: 'lewati' | 'timpa'; peran: PeranAdmin },
  tanggalan: string[],
  ex: Executor,
): Promise<HasilPratinjau> {
  const hasil: HasilPratinjau = { baru: [], dilewati: [], ditimpa: [], ditolak: [] };
  for (const karyawanId of input.karyawanIds) {
    for (const tanggal of tanggalan) {
      const klas = await klasifikasiSel(
        { tokoId: input.tokoId, karyawanId, tanggal, namaTemplate: input.namaTemplate, mode: input.mode, peran: input.peran },
        ex,
      );
      const entri = { karyawan_id: karyawanId, tanggal };
      if (klas.status === 'ditolak') hasil.ditolak.push({ ...entri, alasan: klas.alasan ?? 'Sel ditolak.' });
      else if (klas.status === 'dilewati') hasil.dilewati.push(entri);
      else if (klas.status === 'ditimpa') hasil.ditimpa.push(entri);
      else hasil.baru.push(entri);
    }
  }
  return hasil;
}

/**
 * B-19 (opsi A): apply isi massal. Penolakan tingkat sel (GalatAturan
 * 404/409/403: BR-J4, BR-J2, BR-J9) MASUK array ditolak — bukan rollback.
 * Error lain (galat database, bug) dilempar lagi agar SELURUH transaksi
 * rollback (fail-safe). Sel ditolak tidak menulis audit (tanpa mutasi).
 */
export async function terapkanMassal(
  input: { tokoId: number; karyawanIds: number[]; namaTemplate: string; mode: 'lewati' | 'timpa'; pelaku: { id: number; peran: PeranAdmin } },
  tanggalan: string[],
  ex: Executor,
): Promise<HasilMassal> {
  const hasil: HasilMassal = { baru: [], dilewati: [], ditimpa: [], ditolak: [] };
  for (const karyawanId of input.karyawanIds) {
    for (const tanggal of tanggalan) {
      const entri = { karyawan_id: karyawanId, tanggal };
      try {
        const sel = await buatAtauTimpa(
          { tokoId: input.tokoId, karyawanId, tanggal, namaTemplate: input.namaTemplate, mode: input.mode, pelaku: input.pelaku },
          ex,
        );
        if (sel.status === 'dibuat') hasil.baru.push(entri);
        else if (sel.status === 'ditimpa') hasil.ditimpa.push(entri);
        else hasil.dilewati.push(entri);
      } catch (e) {
        if (e instanceof GalatAturan && (e.status === 404 || e.status === 409 || e.status === 403)) {
          hasil.ditolak.push({ ...entri, alasan: e.message });
          continue;
        }
        throw e;
      }
    }
  }
  return hasil;
}

/** Toko aktif untuk filter halaman (ADMIN tak bisa baca master). */
export async function daftarTokoAktif(ex: Executor): Promise<{ id: number; nama: string }[]> {
  const res = await ex.execute({ sql: 'SELECT id, nama FROM toko WHERE aktif = 1 ORDER BY nama ASC', args: [] });
  return res.rows as unknown as { id: number; nama: string }[];
}

/** Template shift aktif satu toko untuk panel sel + isi massal. */
export async function daftarTemplateAktif(tokoId: number, ex: Executor): Promise<Shift[]> {
  const res = await ex.execute({
    sql: 'SELECT id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at FROM shift_template WHERE toko_id = ? AND aktif = 1 ORDER BY nama ASC',
    args: [tokoId],
  });
  return res.rows as unknown as Shift[];
}

/**
 * Nama template yang cocok per tanggal (BR-J2) — untuk panel sel:
 * hanya template yang sesuai tipe hari tanggal itu yang ditawarkan.
 */
export async function namaTemplateCocok(tokoId: number, tanggal: string, ex: Executor): Promise<string[]> {
  const semua = await daftarTemplateAktif(tokoId, ex);
  const nama = [...new Set(semua.map((t) => t.nama))].sort();
  return nama.filter((n) => slotMemenuhiTipeHari(semua, n, tanggal) !== null);
}
