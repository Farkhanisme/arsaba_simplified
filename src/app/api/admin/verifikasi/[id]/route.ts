import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { idTerakhirDariUrl } from '../../../../../server/url';
import { terapkanKeputusan, GalatVerifikasi } from '../../../../../server/repo/verifikasi';

const SkemaKeputusan = z.object({
  keputusan: z.enum(['DISETUJUI', 'DITOLAK'], { errorMap: () => ({ message: 'Keputusan harus DISETUJUI atau DITOLAK.' }) }),
  alasan_tolak: z.string().max(500, 'Alasan maksimal 500 karakter.').optional(),
  // K-54: 0–1440, pesan tunggal untuk seluruh rentang (batas atas hanya di aplikasi, C-2).
  keterlambatan_final_menit: z
    .number({ invalid_type_error: 'Menit terlambat harus antara 0 dan 1440.' })
    .refine((n) => Number.isInteger(n) && n >= 0 && n <= 1440, 'Menit terlambat harus antara 0 dan 1440.')
    .optional(),
});

/** POST /api/admin/verifikasi/[id] — setujui/tolak satuan (BR-V2..V7). */
export const POST = guard('verifikasi', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID absensi tidak valid.' }, { status: 400 });
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
      terapkanKeputusan(id, parsed.data, { id: ctx.pengguna_id, peran: ctx.peran }, tx),
    );
    return NextResponse.json({ kode: 'KEPUTUSAN_DISIMPAN', pesan: 'Keputusan berhasil disimpan.', data: sesudah });
  } catch (e) {
    if (e instanceof GalatVerifikasi) {
      return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
