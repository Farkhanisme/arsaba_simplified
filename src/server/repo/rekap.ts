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
import {
  susunKalenderKaryawan,
  type KalenderKaryawan,
  type PasanganKalender,
} from '../aturan/kalender';
import type { JenisTidakBerangkat } from '../aturan/ketidakhadiran';
import { bacaAmbang } from './pengaturan';
import { jadwalPadaTanggal } from './absensi';
import { checkinUntukHitungN } from './verifikasi';
import { barisDetailAgenda, hitungAgendaPerKaryawan, type BarisDetailAgenda } from './agenda-laporan';
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
  /** BR-G15 (K-63): laporan agenda MENUNGGU yang memblokir ekspor. */
  jumlahAgendaMenunggu: number;
  peringatan: number;
}

function syaringToko(kolom: string, tokoId: number | null, syarat: string[], args: (string | number | null)[]): void {
  if (tokoId === null) return;
  syarat.push(`${kolom} = ?`);
  args.push(tokoId);
}

/**
 * BR-R2 disempurna K-63 + BR-G15: TIGA syarat harus 0.
 *   (a) event absensi MENUNGGU dalam filter,
 *   (b) check-in terbuka dalam filter (varian tanpa batas 20 jam — admin),
 *   (c) laporan agenda MENUNGGU dalam filter.
 *
 * Yang SENGAJA TIDAK memblokir: agenda yang ditugaskan tapi belum dikerjakan, dan
 * laporan DRAFT. Alasannya tercatat di K-63 — agenda tanpa tanggal target bisa
 * menggantung ekspor selamanya. Fungsi murni `laporanMemblokirEkspor()` yang
 * menetapkan itu, dipakai di sini dan di eksekusi ekspor lewat jalur yang sama.
 *
 * Satu query rentang per syarat, bukan per karyawan.
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

  // (c) laporan agenda menunggu verifikasi.
  const sG: string[] = ['status = ?', 'tanggal BETWEEN ? AND ?'];
  const aG: (string | number | null)[] = ['MENUNGGU', filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sG, aG);
  const agendaMenunggu = await ex.execute({
    sql: `SELECT COUNT(*) AS c FROM agenda_laporan WHERE ${sG.join(' AND ')}`,
    args: aG,
  });

  const jumlahMenunggu = Number((menunggu.rows[0] as Record<string, unknown>)['c']);
  const jumlahCheckinTerbuka = Number((terbuka.rows[0] as Record<string, unknown>)['c']);
  const jumlahAgendaMenunggu = Number((agendaMenunggu.rows[0] as Record<string, unknown>)['c']);

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

  return {
    boleh: jumlahMenunggu === 0 && jumlahCheckinTerbuka === 0 && jumlahAgendaMenunggu === 0,
    jumlahMenunggu,
    jumlahCheckinTerbuka,
    jumlahAgendaMenunggu,
    peringatan,
  };
}

interface KaryawanToko {
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
}

async function karyawanDalamCakupan(filter: FilterRekap, ex: Executor): Promise<KaryawanToko[]> {
  // Union karyawan yang punya event, penandaan, jadwal, ATAU laporan agenda dalam
  // cakupan.
  //
  // `agenda_laporan` HARUS ikut di sini (BR-G16): kalau tidak, karyawan yang
  // hanya bekerja pada agenda — tanpa absensi, jadwal, atau penandaan — tidak akan
  // pernah muncul di sheet Ringkasan — kolom Agenda Selesai/Ditolak yang baru
  // ditambah akan selalu 0 untuk dia, dan itu tidak ketahuan karena tabelnya
  // tetap "terisi" oleh karyawan lain.
  const sE: string[] = ['tanggal BETWEEN ? AND ?'];
  const aE: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sE, aE);
  const sT: string[] = ['tanggal BETWEEN ? AND ?'];
  const aT: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sT, aT);
  const sJ: string[] = ['tanggal BETWEEN ? AND ?'];
  const aJ: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sJ, aJ);
  // DRAFT dikecualikan: belum punya tanggal, jadi tidak pernah masuk periode mana pun.
  const sG: string[] = ["status <> 'DRAFT'", 'tanggal BETWEEN ? AND ?'];
  const aG: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sG, aG);
  const res = await ex.execute({
    sql: `SELECT k.id AS karyawan_id, k.nama AS karyawan_nama, o.id AS toko_id, o.nama AS toko_nama FROM (
      SELECT karyawan_id, toko_id FROM absensi WHERE ${sE.join(' AND ')}
      UNION SELECT karyawan_id, toko_id FROM ketidakhadiran WHERE ${sT.join(' AND ')}
      UNION SELECT karyawan_id, toko_id FROM jadwal WHERE ${sJ.join(' AND ')}
      UNION SELECT karyawan_id, toko_id FROM agenda_laporan WHERE ${sG.join(' AND ')}
    ) u JOIN karyawan k ON k.id = u.karyawan_id JOIN toko o ON o.id = u.toko_id
    ORDER BY k.nama ASC, o.nama ASC`,
    args: [...aE, ...aT, ...aJ, ...aG],
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

    // BR-G16: dua kolom aggregate agenda per karyawan per toko.
    const agenda = await hitungAgendaPerKaryawan(k.karyawan_id, filter.dari, filter.sampai, filter.tokoId, ex);

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
        agendaSelesai: agenda.selesai,
        agendaDitolak: agenda.ditolak,
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
  keterangan: string | null;
  catatan_koreksi: string | null;
}

/**
 * Data mentah sheet kalender (K-68/BR-R9), BUKAN grid — pengelompokan ke
 * pekan/pekan milik fungsi murni `aturan/kalender.ts`.
 *
 * Dua bentuk data yang berbeda sengaja dipisah di sini:
 *   - `kehadiran`: check-in berstatus <> DITOLAK. Event DITOLAK tidak pernah
 *     ikut (BR-R9: disembunyikan dari kalender, masih ada di `Detail Harian`).
 *   - `penandaan`: hari izin/tanpa keterangan, termasuk yang TIDAK punya
 *     absensi sama sekali — itu sebabnya butuh query sendiri, bukan hasil
 *     scan `barisDetail`.
 *
 * `checkout_waktu` diambil dari check-out AKTIF (`status <> 'DITOLAK'`) yang
 * terakhir. Subquery dipakai supaya satu check-in dengan beberapa check-out
 * tidak menggandakan baris.
 */
export interface BarisKehadiranKalender {
  karyawan_id: number;
  tanggal: string;
  pasangan: PasanganKalender[];
}

export interface BarisPenandaanKalender {
  karyawan_id: number;
  tanggal: string;
  jenis: JenisTidakBerangkat;
}

export interface DataKalender {
  kehadiran: BarisKehadiranKalender[];
  penandaan: BarisPenandaanKalender[];
}

/** Data kalender dari filter yang sama, satu query per bentuk data. */
export async function kalenderPeriode(filter: FilterRekap, ex: Executor): Promise<DataKalender> {
  const sCi: string[] = ["ci.jenis = 'CHECKIN'", "ci.status <> 'DITOLAK'", 'ci.tanggal BETWEEN ? AND ?'];
  const aCi: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('ci.toko_id', filter.tokoId, sCi, aCi);
  const ci = await ex.execute({
    sql: `SELECT ci.karyawan_id AS karyawan_id, ci.tanggal AS tanggal, ci.waktu AS waktu,
        ci.keterlambatan_final_menit AS final_menit,
        (SELECT co.waktu FROM absensi co WHERE co.checkin_id = ci.id AND co.jenis = 'CHECKOUT' AND co.status <> 'DITOLAK'
          ORDER BY co.id DESC LIMIT 1) AS waktu_co
      FROM absensi ci WHERE ${sCi.join(' AND ')} ORDER BY ci.tanggal ASC, ci.waktu ASC, ci.id ASC`,
    args: aCi,
  });
  type BarisCiKalender = {
    karyawan_id: number;
    tanggal: string;
    waktu: string;
    final_menit: number | null;
    waktu_co: string | null;
  };
  const kehadiran: BarisKehadiranKalender[] = [];
  for (const c of ci.rows as unknown as BarisCiKalender[]) {
    const pasangan = {
      checkin: formatJam(c.waktu),
      checkout: c.waktu_co === null ? null : formatJam(c.waktu_co),
      final_menit: c.final_menit,
    };
    // Check-in sudah diurutkan waktu ASC, id ASC, jadi pasangan di dalam satu
    // tanggal otomatis kronologis tanpa diurutkan ulang.
    const terakhir = kehadiran[kehadiran.length - 1];
    if (terakhir && terakhir.karyawan_id === c.karyawan_id && terakhir.tanggal === c.tanggal) {
      terakhir.pasangan.push(pasangan);
    } else {
      kehadiran.push({ karyawan_id: c.karyawan_id, tanggal: c.tanggal, pasangan: [pasangan] });
    }
  }

  const sTd: string[] = ['tanggal BETWEEN ? AND ?'];
  const aTd: (string | number | null)[] = [filter.dari, filter.sampai];
  syaringToko('toko_id', filter.tokoId, sTd, aTd);
  const td = await ex.execute({
    sql: `SELECT karyawan_id, tanggal, jenis FROM ketidakhadiran WHERE ${sTd.join(' AND ')} ORDER BY tanggal ASC, id ASC`,
    args: aTd,
  });
  const penandaan = td.rows as unknown as BarisPenandaanKalender[];

  return { kehadiran, penandaan };
}

/**
 * Satu sheet kalender per karyawan yang ada di `ringkasan` (cakupan BR-R4),
 * bukan semua karyawan aktif (K-68). Urutan mengikuti `ringkasan` supaya
 * sheet-nya urut seperti tabel Ringkasan.
 */
export async function susunKalender(
  filter: FilterRekap,
  ringkasan: KartuRingkasan[],
  ex: Executor,
): Promise<KalenderKaryawan[]> {
  const data = await kalenderPeriode(filter, ex);
  const urut: KartuRingkasan[] = [];
  const sudah = new Set<number>();
  for (const r of ringkasan) {
    if (sudah.has(r.karyawan_id)) continue;
    sudah.add(r.karyawan_id);
    urut.push(r);
  }
  return urut.map((r) =>
    susunKalenderKaryawan({
      dari: filter.dari,
      sampai: filter.sampai,
      karyawan_id: r.karyawan_id,
      karyawan_nama: r.karyawan_nama,
      // Karyawan berpindah toko di tengah periode muncul di >1 baris Ringkasan;
      // sheet-nya tetap satu, jadi nama toko digabung.
      toko_nama: ringkasan.filter((x) => x.karyawan_id === r.karyawan_id).map((x) => x.toko_nama),
      kehadiran: data.kehadiran,
      penandaan: data.penandaan,
    }),
  );
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
      a.waktu, a.status, a.keterlambatan_final_menit, a.alasan_koreksi, a.keterangan
      FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id JOIN toko o ON o.id = a.toko_id
      WHERE ${sCi.join(' AND ')} ORDER BY a.tanggal ASC, a.waktu ASC, a.id ASC`,
    args: aCi,
  });
  type BarisCi = {
    id: number; karyawan_id: number; karyawan_nama: string; toko_id: number; toko_nama: string;
    tanggal: string; waktu: string; status: string; keterlambatan_final_menit: number | null;
    alasan_koreksi: string | null; keterangan: string | null;
  };
  const keluar: BarisDetail[] = [];
  for (const c of ci.rows as unknown as BarisCi[]) {
    const co = await ex.execute({
      sql: `SELECT waktu, status, alasan_koreksi, keterangan FROM absensi WHERE checkin_id = ? AND jenis = 'CHECKOUT' ORDER BY CASE WHEN status <> 'DITOLAK' THEN 0 ELSE 1 END, id DESC LIMIT 1`,
      args: [c.id],
    });
    const coRow = co.rows[0] as unknown as { waktu: string; status: string; alasan_koreksi: string | null; keterangan: string | null } | undefined;

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
      // BR-A13: satu sel untuk satu baris pasangan, jadi ikut aturan yang
      // sudah dipakai kolom sebelahnya (catatan_koreksi): check-in didahulukan,
      // check-out jadi cadangan. Kalau keduanya punya teks BERBEDA, yang
      // check-in yang tampil — sama seperti catatan koreksi. Jangan diubah
      // jadi "digabung" tanpa keputusan pemilik baru.
      keterangan: c.keterangan ?? coRow?.keterangan ?? null,
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
  // BR-G16: sheet "Detail Agenda". Quay dalam hasil yang sama supaya pratinjau dan
  // ekspor tidak bisa melihat jumlah agenda yang berbeda (anti-B-19).
  const detailAgenda = await barisDetailAgenda(filter.dari, filter.sampai, filter.tokoId, ex);
  // K-68/BR-R9: sheet kalender per karyawan. Bao juga dari filter + ringkasan
  // yang sama, jadi sheet mana pun tidak bisa melihat karyawan/tanggal berbeda.
  const kalender = await susunKalender(filter, ringkasan, ex);
  return { pemeriksaan, ringkasan, detail, detailAgenda, kalender };
}

export type { BarisDetailAgenda };
