/**
 * Info agenda untuk halaman karyawan (M12).
 *
 * Satu sumber untuk Server Component `/a/[token]` dan route
 * `GET /api/agenda/info`, sama seperti `absen-info.ts` untuk absensi — supaya
 * render awal dan hasil fetch setelah submit tidak bisa berbeda isi.
 *
 * Yang TIDAK ikut di sini: draft untuk admin. Laporan DRAFT milik karyawan dan
 * tidak pernah keluar lewat fungsi mana pun di file ini.
 */
import { getDb } from './db';
import { serialisasiWIB, tanggalWIB } from './waktu';
import { resolveLinkAktif } from './repo/absensi';
import { agendaUntukKaryawan, type BarisLaporan } from './repo/agenda-laporan';
import { aksiYangTersedia, type AksiLaporan } from './aturan/laporan';

export interface AgendaUntukTampilan {
  id: number;
  judul: string;
  keterangan: string | null;
  wajib_foto: boolean;
  cakupan: string;
  target_tanggal: string | null;
  /** Dibuat karyawan ini sendiri? (BR-G3) */
  dibuat_sendiri: boolean;
  aksi: AksiLaporan;
  /**
   * Laporan TERAKHIR, termasuk yang DITOLAK. null = belum pernah mengerjakan.
   *
   * Termasuk DITOLAK supaya alasan penolakan masih terlihat setelah ditolak —
   * kalau tidak, layar akan berubah jadi "belum pernah" dan karyawan mengulang
   * tanpa tahu apa yang salah (lihat `laporanTerakhir()` di repo).
   */
  laporan: {
    id: number;
    status: string;
    percobaan: number;
    keterangan: string | null;
    alasan_tolak: string | null;
    dikirim_at: string | null;
    ada_foto_sebelum: boolean;
    ada_foto_sesudah: boolean;
  } | null;
}

export interface InfoAgenda {
  nama: string;
  tanggal: string;
  daftar: AgendaUntukTampilan[];
}

/** Null bila token tidak dikenal/dicabut/karyawan nonaktif (BR-A1, pesan generik). */
export async function muatInfoAgenda(token: string): Promise<InfoAgenda | null> {
  if (!token) return null;
  const db = getDb();
  const karyawan = await resolveLinkAktif(token, db);
  if (!karyawan) return null;

  const milik = await agendaUntukKaryawan(karyawan.karyawan_id, db);
  const daftar: AgendaUntukTampilan[] = milik.map(({ agenda, laporanAktif }) => {
    const dibuatSendiri = agenda.dibuat_oleh_karyawan === karyawan.karyawan_id;
    const laporan = laporanAktif
      ? {
          id: laporanAktif.id,
          status: laporanAktif.status,
          percobaan: laporanAktif.percobaan,
          keterangan: laporanAktif.keterangan,
          alasan_tolak: laporanAktif.alasan_tolak,
          dikirim_at: laporanAktif.dikirim_at,
          ada_foto_sebelum: laporanAktif.sebelum_file_id !== null,
          ada_foto_sesudah: laporanAktif.sesudah_file_id !== null,
        }
      : null;
    return {
      id: agenda.id,
      judul: agenda.judul,
      keterangan: agenda.keterangan,
      wajib_foto: agenda.wajib_foto === 1,
      cakupan: agenda.cakupan,
      target_tanggal: agenda.target_tanggal,
      dibuat_sendiri: dibuatSendiri,
      aksi: aksiYangTersedia({
        statusAgenda: agenda.status,
        adalahPenerima: true,
        dibuatSendiri,
        wajibFoto: agenda.wajib_foto === 1,
        laporanTerakhir: laporan
          ? {
              id: laporan.id,
              percobaan: laporan.percobaan,
              status: laporan.status,
              sebelum_file_id: laporan.ada_foto_sebelum ? 'ada' : null,
              sesudah_file_id: laporan.ada_foto_sesudah ? 'ada' : null,
              alasan_tolak: laporan.alasan_tolak,
            }
          : null,
      }),
      laporan,
    };
  });

  return {
    nama: karyawan.nama,
    tanggal: tanggalWIB(serialisasiWIB()),
    daftar,
  };
}

export type { BarisLaporan };