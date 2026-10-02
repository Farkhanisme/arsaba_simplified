/**
 * Info halaman absen karyawan — dipakai server component /a/[token] dan
 * GET /api/absen/info agar keduanya selalu konsisten (satu sumber).
 */
import { getDb } from './db';
import { serialisasiWIB, tanggalWIB, tanggalPanjangWIB, geserJamISO } from './waktu';
import { bolehCheckIn } from './aturan/absensi';
import {
  resolveLinkAktif,
  checkInTerbuka,
  jumlahCheckInAktifPadaTanggal,
  eventPadaTanggal,
  penandaanPadaTanggal,
  riwayatPenempatanUntukTanggal,
  jadwalPadaTanggal,
} from './repo/absensi';
import { tokoById } from './repo/toko';

export interface InfoAbsen {
  nama: string;
  toko: string;
  tanggal: string;
  tanggalPanjang: string;
  jam: string;
  jadwal: { khusus: boolean; slot: { nama: string; jam_mulai: string; jam_selesai: string }[] } | null;
  riwayat: { jenis: string; waktu: string; status: string; alasan_tolak: string | null }[];
  aksi: 'CHECKIN' | 'CHECKOUT' | 'TIDAK_TERSEDIA';
  alasan: string;
}

/** Null bila token tidak dikenal/dicabut/karyawan nonaktif (BR-A1). */
export async function muatInfoAbsen(token: string): Promise<InfoAbsen | null> {
  if (!token) return null;
  const db = getDb();
  const karyawan = await resolveLinkAktif(token, db);
  if (!karyawan) return null;

  const sekarang = serialisasiWIB();
  const tanggal = tanggalWIB(sekarang);
  const riwayat = await riwayatPenempatanUntukTanggal(karyawan.karyawan_id, db);
  const cocok = riwayat.find((r) => r.mulai <= tanggal && (r.sampai === null || r.sampai >= tanggal));
  const toko = cocok ? await tokoById(cocok.toko_id, db) : null;
  const jadwal = await jadwalPadaTanggal(karyawan.karyawan_id, tanggal, db);
  const event = await eventPadaTanggal(karyawan.karyawan_id, tanggal, db);

  const bertanda = await penandaanPadaTanggal(karyawan.karyawan_id, tanggal, db);
  const terbuka = await checkInTerbuka(karyawan.karyawan_id, geserJamISO(sekarang, -20), db);
  const jumlah = await jumlahCheckInAktifPadaTanggal(karyawan.karyawan_id, tanggal, db);

  let aksi: InfoAbsen['aksi'] = 'CHECKIN';
  let alasan = '';
  if (bertanda) {
    aksi = 'TIDAK_TERSEDIA';
    alasan = 'Tanggal ini ditandai tidak berangkat. Hubungi admin.';
  } else if (!toko) {
    aksi = 'TIDAK_TERSEDIA';
    alasan = 'Karyawan belum ditempatkan di toko. Hubungi admin.';
  } else if (terbuka.length > 0) {
    aksi = 'CHECKOUT';
  } else {
    const cek = bolehCheckIn({ terbukaDalamBatas: false, jumlahAktifHariIni: jumlah });
    if (!cek.boleh) {
      aksi = 'TIDAK_TERSEDIA';
      alasan = cek.alasan;
    }
  }

  return {
    nama: karyawan.nama,
    toko: toko ? toko.nama : '—',
    tanggal,
    tanggalPanjang: tanggalPanjangWIB(tanggal),
    jam: sekarang.slice(11, 16),
    jadwal: jadwal
      ? {
          khusus: jadwal.is_override === 1,
          slot: jadwal.slot.map((s) => ({ nama: s.nama, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai })),
        }
      : null,
    riwayat: event.map((e) => ({
      jenis: e.jenis,
      waktu: e.waktu.slice(11, 16),
      status: e.status,
      alasan_tolak: e.alasan_tolak,
    })),
    aksi,
    alasan,
  };
}
