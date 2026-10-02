/**
 * Repo dashboard (M7). SQL berparameter, tanpa ORM. Read-only.
 * WAJIB query massal: ambil slot, event, dan penandaan hari ini sekaligus,
 * lalu hitung di memori dengan fungsi murni aturan/dashboard.ts.
 * Tidak ada date('now')/datetime('now') di SQL — tanggal selalu parameter
 * dari tanggalWIB() server (Jebakan F).
 */
import type { Executor } from '../audit';
import { eventAktif } from '../aturan/absensi';
import { kartuToko, terlambatSistem, type KartuToko } from '../aturan/dashboard';
import type { ItemHitungN, SlotAcuan } from '../aturan/keterlambatan';
import { bacaAmbang } from './pengaturan';

interface BarisJadwalSlot {
  karyawan_id: number;
  toko_id: number;
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface BarisCheckin {
  id: number;
  karyawan_id: number;
  toko_id: number;
  waktu: string;
  status: string;
}

/**
 * Kartu per toko untuk tanggal itu: terjadwal, sudah_absen, terlambat,
 * belum_absen. Definisi rules/02 §12 persis.
 */
export async function metrikPerToko(tanggal: string, ex: Executor): Promise<KartuToko[]> {
  const ambang = await bacaAmbang(ex);

  const tokoRes = await ex.execute({ sql: 'SELECT id, nama FROM toko WHERE aktif = 1 ORDER BY nama ASC', args: [] });
  const daftarToko = tokoRes.rows as unknown as { id: number; nama: string }[];

  const jadwalRes = await ex.execute({
    sql: 'SELECT j.karyawan_id, j.toko_id, s.nama, s.jam_mulai, s.jam_selesai FROM jadwal j JOIN jadwal_slot s ON s.jadwal_id = j.id WHERE j.tanggal = ? ORDER BY s.urutan ASC',
    args: [tanggal],
  });
  const slotPerKaryawan = new Map<number, { toko_id: number; slots: SlotAcuan[] }>();
  for (const r of jadwalRes.rows as unknown as BarisJadwalSlot[]) {
    const ada = slotPerKaryawan.get(r.karyawan_id);
    if (ada) ada.slots.push({ nama: r.nama, jam_mulai: r.jam_mulai, jam_selesai: r.jam_selesai });
    else slotPerKaryawan.set(r.karyawan_id, { toko_id: r.toko_id, slots: [{ nama: r.nama, jam_mulai: r.jam_mulai, jam_selesai: r.jam_selesai }] });
  }

  const ciRes = await ex.execute({
    sql: "SELECT id, karyawan_id, toko_id, waktu, status FROM absensi WHERE tanggal = ? AND jenis = 'CHECKIN'",
    args: [tanggal],
  });
  const checkins = ciRes.rows as unknown as BarisCheckin[];
  const perKaryawan = new Map<number, BarisCheckin[]>();
  for (const c of checkins) {
    const daftar = perKaryawan.get(c.karyawan_id) ?? [];
    daftar.push(c);
    perKaryawan.set(c.karyawan_id, daftar);
  }

  const tandaRes = await ex.execute({
    sql: 'SELECT karyawan_id, toko_id FROM ketidakhadiran WHERE tanggal = ?',
    args: [tanggal],
  });
  const tandaPerToko = new Map<number, Set<number>>();
  for (const r of tandaRes.rows as unknown as { karyawan_id: number; toko_id: number }[]) {
    const s = tandaPerToko.get(r.toko_id) ?? new Set<number>();
    s.add(r.karyawan_id);
    tandaPerToko.set(r.toko_id, s);
  }

  const terjadwalPerToko = new Map<number, Set<number>>();
  for (const [karyawanId, info] of slotPerKaryawan) {
    const s = terjadwalPerToko.get(info.toko_id) ?? new Set<number>();
    s.add(karyawanId);
    terjadwalPerToko.set(info.toko_id, s);
  }

  const sudahPerToko = new Map<number, Set<number>>();
  const terlambatGlobal = new Set<number>();
  for (const [karyawanId, daftar] of perKaryawan) {
    const aktif = daftar.filter((c) => eventAktif(c.status));
    if (aktif.length === 0) continue;
    const items: ItemHitungN[] = daftar.map((c) => ({ id: c.id, waktu: c.waktu, jenis: 'CHECKIN', status: c.status }));
    const slots = slotPerKaryawan.get(karyawanId)?.slots ?? null;
    let terlambat = false;
    for (const c of aktif) {
      const tokoSet = sudahPerToko.get(c.toko_id) ?? new Set<number>();
      tokoSet.add(karyawanId);
      sudahPerToko.set(c.toko_id, tokoSet);
      if (!terlambat && terlambatSistem({ id: c.id, waktu: c.waktu }, items, slots, ambang)) {
        terlambat = true;
      }
    }
    if (terlambat) terlambatGlobal.add(karyawanId);
  }

  return daftarToko.map((t) =>
    kartuToko(
      t.id,
      t.nama,
      terjadwalPerToko.get(t.id) ?? new Set<number>(),
      sudahPerToko.get(t.id) ?? new Set<number>(),
      new Set([...(sudahPerToko.get(t.id) ?? [])].filter((k) => terlambatGlobal.has(k))),
      tandaPerToko.get(t.id) ?? new Set<number>(),
    ),
  );
}

/** Antrean verifikasi: event MENUNGGU dari SEMUA tanggal. */
export async function antreanVerifikasi(ex: Executor): Promise<number> {
  const res = await ex.execute({ sql: "SELECT COUNT(*) AS c FROM absensi WHERE status = 'MENUNGGU'", args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['c']);
}

/**
 * Angka banding untuk tes: hitung ulang per toko dengan query naif
 * terpisah (bukan bulk). HANYA untuk pembanding tes — route memakai
 * metrikPerToko. Keduanya harus sama persis pada data yang sama.
 */
export async function angkaBanding(tanggal: string, ex: Executor): Promise<KartuToko[]> {
  const ambang = await bacaAmbang(ex);
  const tokoRes = await ex.execute({ sql: 'SELECT id, nama FROM toko WHERE aktif = 1 ORDER BY nama ASC', args: [] });
  const daftarToko = tokoRes.rows as unknown as { id: number; nama: string }[];
  const keluar: KartuToko[] = [];

  for (const t of daftarToko) {
    const jd = await ex.execute({
      sql: 'SELECT DISTINCT karyawan_id FROM jadwal WHERE toko_id = ? AND tanggal = ?',
      args: [t.id, tanggal],
    });
    const terjadwal = new Set((jd.rows as unknown as { karyawan_id: number }[]).map((r) => r.karyawan_id));

    const ci = await ex.execute({
      sql: "SELECT id, karyawan_id, waktu, status FROM absensi WHERE toko_id = ? AND tanggal = ? AND jenis = 'CHECKIN'",
      args: [t.id, tanggal],
    });
    const baris = ci.rows as unknown as { id: number; karyawan_id: number; waktu: string; status: string }[];
    const sudahAbsen = new Set<number>();
    const terlambat = new Set<number>();
    const perKaryawan = new Map<number, typeof baris>();
    for (const b of baris) {
      const daftar = perKaryawan.get(b.karyawan_id) ?? [];
      daftar.push(b);
      perKaryawan.set(b.karyawan_id, daftar);
    }
    for (const [karyawanId, daftar] of perKaryawan) {
      const aktif = daftar.filter((c) => eventAktif(c.status));
      if (aktif.length === 0) continue;
      sudahAbsen.add(karyawanId);
      const items: ItemHitungN[] = daftar.map((c) => ({ id: c.id, waktu: c.waktu, jenis: 'CHECKIN', status: c.status }));
      const sl = await ex.execute({
        sql: 'SELECT s.nama, s.jam_mulai, s.jam_selesai FROM jadwal j JOIN jadwal_slot s ON s.jadwal_id = j.id WHERE j.karyawan_id = ? AND j.tanggal = ? ORDER BY s.urutan ASC',
        args: [karyawanId, tanggal],
      });
      const slots = (sl.rows as unknown as SlotAcuan[]).length > 0 ? (sl.rows as unknown as SlotAcuan[]) : null;
      if (aktif.some((c) => terlambatSistem({ id: c.id, waktu: c.waktu }, items, slots, ambang))) {
        terlambat.add(karyawanId);
      }
    }

    const td = await ex.execute({
      sql: 'SELECT DISTINCT karyawan_id FROM ketidakhadiran WHERE toko_id = ? AND tanggal = ?',
      args: [t.id, tanggal],
    });
    const bertanda = new Set((td.rows as unknown as { karyawan_id: number }[]).map((r) => r.karyawan_id));

    keluar.push(kartuToko(t.id, t.nama, terjadwal, sudahAbsen, terlambat, bertanda));
  }
  return keluar;
}
