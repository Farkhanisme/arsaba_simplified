import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { idTerakhirDariUrl } from '../../../../../server/url';
import { terapkanVerifikasi, GalatLaporan } from '../../../../../server/repo/agenda-laporan';

const SkemaKeputusan = z.object({
  keputusan: z.enum(['DISETUJUI', 'DITOLAK'], { errorMap: () => ({ message: 'Keputusan harus DISETUJUI atau DITOLAK.' }) }),
  alasan_tolak: z.string().max(500, 'Alasan maksimal 500 karakter.').optional(),
});

/**
 * PUT /api/admin/verifikasi-agenda/[id] — setujui/tolak laporan agenda (M13).
 *
 * Sengaja TIDAK punya field menit keterlambatan sama sekali (BR-G13), padahal
 * route verifikasi absensi punya. Agenda tidak punya jadwal untuk dibandingkan,
 * jadi field itu tidak boleh ada di bentuk request — bukan sekadar opsional,
 * karena opsional masih bisa terkirim dan tersimpan diam-diam.
 *
 * PUT bukan POST seperti verifikasi absensi: di sana keputusan adalah aksi satu
 * arah pada event; di sini keputusan boleh diubah DISETUJUI <-> DITOLAK selama
 * periode belum diekspor (BR-G12), jadi lebih tepat sebagai perubahan state.
 */
export const PUT = guard('verifikasi_agenda', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID laporan tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaKeputusan.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const sesudah = await denganTransaksi(async (tx) =>
      terapkanVerifikasi(id, parsed.data, { id: ctx.pengguna_id, peran: ctx.peran }, tx),
    );
    return NextResponse.json({ kode: 'KEPUTUSAN_DISIMPAN', pesan: 'Keputusan berhasil disimpan.', data: sesudah });
  } catch (e) {
    if (e instanceof GalatLaporan) {
      return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});