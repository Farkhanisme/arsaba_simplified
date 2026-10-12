import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { daftarLaporanUntukAdmin } from '../../../../server/repo/agenda-laporan';

/**
 * GET /api/admin/verifikasi-agenda (M13) — antrean laporan agenda.
 *
 * Halaman TERPISA dari verifikasi absensi (BR-G10): kolomnya beda total — tidak ada
 * keterlambatan, tidak ada pasangan, tidak ada koordinat. Kalau digabung, admin
 * akan melihat tabel dengan sebagian baris selalu kosong, dan itu lebih buruk
 * daripada dua halaman.
 *
 * Default `MENUNGGU` seperti verifikasi absensi (rules/05 §5.3), dan DRAFT tidak
 * pernah muncul di sini — penyaringannya di repo, bukan di UI.
 */
export const GET = guard('verifikasi_agenda', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const num = (nama: string): number | undefined => {
    const v = p.get(nama);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const status = p.get('status');
  if (status !== null && status !== '' && !['MENUNGGU', 'DISETUJUI', 'DITOLAK'].includes(status)) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Status laporan tidak valid.' }, { status: 400 });
  }
  const dari = p.get('dari');
  const sampai = p.get('sampai');
  const pola = /^\d{4}-\d{2}-\d{2}$/;
  if ((dari !== null && dari !== '' && !pola.test(dari)) || (sampai !== null && sampai !== '' && !pola.test(sampai))) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Rentang tanggal tidak valid (YYYY-MM-DD).' }, { status: 400 });
  }

  const data = await daftarLaporanUntukAdmin(
    {
      status: status || 'MENUNGGU',
      tokoId: num('toko_id'),
      dari: dari || undefined,
      sampai: sampai || undefined,
      karyawanId: num('karyawan_id'),
      agendaId: num('agenda_id'),
    },
    getDb(),
  );
  return NextResponse.json({ kode: 'OK', data });
});