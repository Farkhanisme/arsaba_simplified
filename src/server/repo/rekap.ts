/**
 * Repo rekap & ekspor (M8). SQL berparameter, tanpa ORM. Read-only kecuali
 * catatEkspor. Satu jalur perhitungan dipakai pratinjau DAN ekspor
 * (anti-B-19): susunRekap() menghasilkan ringkasan + detail + pemeriksaan.
 * Tidak ada date('now')/datetime('now') — tanggal selalu parameter.
 */
import type { Executor } from '../audit';
import { catatAudit } from '../audit';
import { serialisasiWIB } from '../waktu';
import { menitDalamHari } from '../waktu';
import { pilihSlot, hitungN, hitungSelisih } from '../aturan/keterlambatan';
import { hitungHariHadir, rekapKaryawan, hitungPeringatan, type KartuRingkasan } from '../aturan/rekap';
import { bacaAmbang } from './pengaturan';
import { jadwalPadaTanggal } from './absensi';
import { checkinUntukHitungN } from './verifikasi';
import { GalatAturan } from './penempatan';

export interface FilterRekap {
  dari: string;
  sampai: string;
  tokoId: number | null;
}

export interface HasilPeriksa {
  boleh: boolean;
  jumlahMenunggu: number;
  jumlahCheckinTerbuka: number;
  peringatan: number;
}

function syaringToko(kolom: string, tokoId: number | null, syarat: string[], args: (string | number | null)[]): void {
  if (tokoId === null) return;
  syarat.push(`${kolom} = ?`);
  args.push(tokoId);
}

/**
 * BR-R2: (a) event MENUNGGU dalam filter harus 0, (b) check-in terbuka
 * dalam filter harus 0. Definisi terbuka = CHECKIN aktif tanpa CHECKOUT
 * aktif (varian tanpa batas 20 jam — admin). Satu query rentang, bukan 26.
 */
export async function periksaSyaratEkspor(filter: FilterRekap, ex: Executor): Promise<HasilPeriksa> {
  const sA: string[] = ["status = 'MENUNGGU'", 'tanggal BETWEEN ? AND ?'];
  const aA: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sA, aA);
  const menunggu = await ex.execute({ sql: `SELECT COUNT(*) AS c FROM absensi WHERE ${sA.join(' AND ')}`, args: aA });

  const sB: string[] = [
    "ci.jenis = 'CHECKIN'",
    "ci.status <> 'DITOLAK'",
    'ci.tanggal BETWEEN ? AND ?',
    "NOT EXISTS (SELECT 1 FROM absensi co WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK')",
  ];
  const aB: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('ci.toko_id', filter.tokoId, sB, aB);
  const terbuka = await ex.execute({ sql: `SELECT COUNT(*) AS c FROM absensi ci WHERE ${sB.join(' AND ')}`, args: aB });

  const jumlahMenunggu = Number((menunggu.rows[0] as Record<string, unknown>)['c']);
  const jumlahCheckinTerbuka = Number((terbuka.rows[0] as Record<string, unknown>)['c']);

  // BR-R3: terjadwal tanpa event apa pun dan tanpa penandaan (peringatan saja).
  const sJ: string[] = ['tanggal BETWEEN ? AND ?'];
  const aJ: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sJ, aJ);
  const jd = await ex.execute({ sql: `SELECT DISTINCT karyawan_id FROM jadwal WHERE ${sJ.join(' AND ')}`, args: aJ });
  const sE: string[] = ['tanggal BETWEEN ? AND ?'];
  const aE: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sE, aE);
  const ev = await ex.execute({ sql: `SELECT DISTINCT karyawan_id FROM absensi WHERE ${sE.join(' AND ')}`, args: aE });
  const sT: string[] = ['tanggal BETWEEN ? AND ?'];
  const aT: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sT, aT);
  const td = await ex.execute({ sql: `SELECT DISTINCT karyawan_id FROM ketidakhadiran WHERE ${sT.join(' AND ')}`, args: aT });
  const peringatan = hitungPeringatan(
    new Set((jd.rows as unknown as { karyawan_id: number }[]).map((r) => r.karyawan_id)),
    new Set((ev.rows as unknown as { karyawan_id: number }[]).map((r) => r.karyawan_id)),
    new Set((td.rows as unknown as { karyawan_id: number }[]).map((r) => r.karyawan_id)),
  );

  return { boleh: jumlahMenunggu === 0 && jumlahCheckinTerbuka === 0, jumlahMenunggu, jumlahCheckinTerbuka, peringatan };
}

interface KaryawanToko {
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
}

async function karyawanDalamCakupan(filter: FilterRekap, ex: Executor): Promise<KaryawanToko[]> {
  // Union karyawan yang punya event, penandaan, atau jadwal dalam cakupan.
  const sE: string[] = ['tanggal BETWEEN ? AND ?'];
  const aE: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sE, aE);
  const sT: string[] = ['tanggal BETWEEN ? AND ?'];
  const aT: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sT, aT);
  const sJ: string[] = ['tanggal BETWEEN ? AND ?'];
  const aJ: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sJ, aJ);
  const res = await ex.execute({
    sql: `SELECT k.id AS karyawan_id, k.nama AS karyawan_nama, o.id AS toko_id, o.nama AS toko_nama FROM (
      SELECT karyawan_id, toko_id FROM absensi WHERE ${sE.join(' AND ')}
      UNION SELECT karyawan_id, toko_id FROM ketidakhadiran WHERE ${sT.join(' AND ')}
      UNION SELECT karyawan_id, toko_id FROM jadwal WHERE ${sJ.join(' AND ')}
    ) u JOIN karyawan k ON k.id = u.karyawan_id JOIN toko o ON o.id = u.toko_id
    ORDER BY k.nama ASC, o.nama ASC`,
    args: [...aE, ...aT, ...aJ],
  });
  return res.rows as unknown as KaryawanToko[];
}

/** BR-R4: satu baris per karyawan per toko. Total = angka FINAL (BR-L3). */
export async function barisRingkasan(filter: FilterRekap, ex: Executor): Promise<KartuRingkasan[]> {
  const daftar = await karyawanDalamCakupan(filter, ex);
  const keluar: KartuRingkasan[] = [];
  for (const k of daftar) {
    const sCi: string[] = ['karyawan_id = ?', "jenis = 'CHECKIN'", 'tanggal BETWEEN ? AND ?'];
    const aCi: (string | number | null)[] = [k.karyawan_id, filter.dari, filter.sampai];
    syaringToko('toko_id', filter.tokoId, sCi, aCi);
    const ci = await ex.execute({
      sql: `SELECT id, tanggal, waktu, status, keterlambatan_final_menit FROM absensi WHERE ${sCi.join(' AND ')} ORDER BY waktu ASC, id ASC`,
      args: aCi,
    });
    const checkins = ci.rows as unknown as { id: number; tanggal: string; waktu: string; status: string; keterlambatan_final_menit: number | null }[];
    const totalFinal = checkins.reduce((s, c) => s + (c.keterlambatan_final_menit ?? 0), 0);

    const sCo: string[] = ['ci.karyawan_id = ?', "ci.jenis = 'CHECKIN'", 'ci.tanggal BETWEEN ? AND ?'];
    const aCo: (string | number | null)[] = [k.karyawan_id, filter.dari, filter.sampai];
    syaringToko('ci.toko_id', filter.tokoId, sCo, aCo);
    const ps = await ex.execute({
      sql: `SELECT ci.tanggal AS tanggal, ci.status AS checkinStatus, co.status AS checkoutStatus FROM absensi ci
        LEFT JOIN absensi co ON co.checkin_id = ci.id AND co.jenis = 'CHECKOUT'
        WHERE ${sCo.join(' AND ')}`,
      args: aCo,
    });
    // Satu check-in bisa punya >1 check-out DITOLAK; pasangan sah bila ADA yang DISETUJUI.
    // Baris DISETUJUI/DISETUJUI-lah yang menandai tanggal hadirnya.
    const tanggalHadir = hitungHariHadir(
      (ps.rows as unknown as { tanggal: string; checkinStatus: string; checkoutStatus: string | null }[]).map((r) => ({
        tanggal: r.tanggal,
        checkinStatus: r.checkinStatus,
        checkoutStatus: r.checkoutStatus,
      })),
    );
    // Koreksi: satu check-in dengan beberapa check-out DITOLAK + satu DISETUJUI
    // tetap 1 pasangan sah — hitungHariHadir per baris sudah benar karena
    // baris DISETUJUI/DISETUJUI-lah yang menandai tanggalnya.

    const sTd: string[] = ['karyawan_id = ?', 'tanggal BETWEEN ? AND ?'];
    const aTd: (string | number | null)[] = [k.karyawan_id, filter.dari, filter.sampai];
    syaringToko('toko_id', filter.tokoId, sTd, aTd);
    const td = await ex.execute({
      sql: `SELECT tanggal, jenis FROM ketidakhadiran WHERE ${sTd.join(' AND ')}`,
      args: aTd,
    });
    const jenisUnik = new Map<string, string>();
    for (const r of td.rows as unknown as { tanggal: string; jenis: string }[]) {
      if (!jenisUnik.has(r.tanggal)) jenisUnik.set(r.tanggal, r.jenis);
    }
    let hariIzin = 0;
    let hariTanpa = 0;
    for (const j of jenisUnik.values()) {
      if (j === 'IZIN') hariIzin++;
      else hariTanpa++;
    }

    keluar.push(
      rekapKaryawan({
        karyawan_id: k.karyawan_id,
        karyawan_nama: k.karyawan_nama,
        toko_id: k.toko_id,
        toko_nama: k.toko_nama,
        tanggalHadir,
        hariIzin,
        hariTanpaKeterangan: hariTanpa,
        totalFinal,
      }),
    );
  }
  return keluar;
}

export interface BarisDetail {
  tanggal: string;
  karyawan_nama: string;
  toko_nama: string;
  slot: string | null;
  waktu_checkin: string;
  waktu_checkout: string | null;
  status_checkin: string;
  status_checkout: string | null;
  selisih_sistem: number | null;
  final_menit: number | null;
  penandaan: string | null;
  catatan_koreksi: string | null;
}

function formatTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split('-');
  return `${d}/${m}/${y}`;
}

function formatJam(waktuISO: string): string {
  return waktuISO.slice(11, 16);
}

/**
 * BR-R5: satu baris per check-in per tanggal — selisih SISTEM (hitung ulang
 * seperti M7) DAN final (kolom), tidak tertukar. Check-out tampil = yang
 * aktif bila ada, else DITOLAK terakhir, else null.
 */
export async function barisDetail(filter: FilterRekap, ex: Executor): Promise<BarisDetail[]> {
  const ambang = await bacaAmbang(ex);
  const sCi: string[] = ["a.jenis = 'CHECKIN'", 'a.tanggal BETWEEN ? AND ?'];
  const aCi: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('a.toko_id', filter.tokoId, sCi, aCi);
  const ci = await ex.execute({
    sql: `SELECT a.id, a.karyawan_id, k.nama AS karyawan_nama, a.toko_id, o.nama AS toko_nama, a.tanggal,
      a.waktu, a.status, a.keterlambatan_final_menit, a.alasan_koreksi
      FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id JOIN toko o ON o.id = a.toko_id
      WHERE ${sCi.join(' AND ')} ORDER BY a.tanggal ASC, a.waktu ASC, a.id ASC`,
    args: aCi,
  });
  type BarisCi = {
    id: number; karyawan_id: number; karyawan_nama: string; toko_id: number; toko_nama: string;
    tanggal: string; waktu: string; status: string; keterlambatan_final_menit: number | null; alasan_koreksi: string | null;
  };
  const keluar: BarisDetail[] = [];
  for (const c of ci.rows as unknown as BarisCi[]) {
    const co = await ex.execute({
      sql: `SELECT waktu, status, alasan_koreksi FROM absensi WHERE checkin_id = ? AND jenis = 'CHECKOUT' ORDER BY CASE WHEN status <> 'DITOLAK' THEN 0 ELSE 1 END, id DESC LIMIT 1`,
      args: [c.id],
    });
    const coRow = co.rows[0] as unknown as { waktu: string; status: string; alasan_koreksi: string | null } | undefined;

    const semua = await checkinUntukHitungN(c.karyawan_id, c.tanggal, ex);
    const n = hitungN(semua, c.id);
    const jadwal = await jadwalPadaTanggal(c.karyawan_id, c.tanggal, ex);
    const slot = pilihSlot(jadwal ? jadwal.slot : [], n);
    const { selisih } = hitungSelisih(menitDalamHari(c.waktu), slot, ambang);

    const td = await ex.execute({
      sql: 'SELECT jenis, catatan FROM ketidakhadiran WHERE karyawan_id = ? AND tanggal = ?',
      args: [c.karyawan_id, c.tanggal],
    });
    const tdRow = td.rows[0] as unknown as { jenis: string; catatan: string | null } | undefined;

    keluar.push({
      tanggal: formatTanggal(c.tanggal),
      karyawan_nama: c.karyawan_nama,
      toko_nama: c.toko_nama,
      slot: slot ? `${slot.nama} ${slot.jam_mulai}–${slot.jam_selesai}` : null,
      waktu_checkin: formatJam(c.waktu),
      waktu_checkout: coRow ? formatJam(coRow.waktu) : null,
      status_checkin: c.status,
      status_checkout: coRow ? coRow.status : null,
      selisih_sistem: selisih,
      final_menit: c.keterlambatan_final_menit,
      penandaan: tdRow ? `${tdRow.jenis === 'IZIN' ? 'Izin' : 'Tanpa Keterangan'}${tdRow.catatan ? `: ${tdRow.catatan}` : ''}` : null,
      catatan_koreksi: c.alasan_koreksi ?? coRow?.alasan_koreksi ?? null,
    });
  }
  return keluar;
}

/** BR-R6: tulis log_ekspor + audit. Dipanggil DI DALAM transaksi route. */
export async function catatEkspor(
  filter: FilterRekap,
  pelakuId: number,
  ex: Executor,
): Promise<number> {
  const sekarang = serialisasiWIB();
  await ex.execute({
    sql: 'INSERT INTO log_ekspor (pengguna_id, waktu, tanggal_mulai, tanggal_selesai, toko_id) VALUES (?, ?, ?, ?, ?)',
    args: [pelakuId, sekarang, filter.dari, filter.sampai, filter.tokoId],
  });
  const idRes = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
  await catatAudit(
    {
      waktu: sekarang,
      pengguna_id: pelakuId,
      aksi: 'EKSPOR',
      entitas: 'log_ekspor',
      entitas_id: id,
      sesudah: JSON.stringify({ tanggal_mulai: filter.dari, tanggal_selesai: filter.sampai, toko_id: filter.tokoId }),
      catatan: 'Rekap diekspor ke Excel',
    },
    ex,
  );
  return id;
}

/**
 * SATU jalur perhitungan untuk pratinjau DAN ekspor (anti-B-19):
 * pemeriksaan + ringkasan + detail dari filter yang sama.
 */
export async function susunRekap(filter: FilterRekap, ex: Executor) {
  const pemeriksaan = await periksaSyaratEkspor(filter, ex);
  const ringkasan = await barisRingkasan(filter, ex);
  const detail = await barisDetail(filter, ex);
  return { pemeriksaan, ringkasan, detail };
}
