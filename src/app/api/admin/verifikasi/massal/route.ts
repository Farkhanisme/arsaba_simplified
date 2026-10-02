import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { terapkanKeputusan, GalatVerifikasi } from '../../../../../server/repo/verifikasi';

const SkemaMassal = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu baris.').max(200, 'Maksimal 200 baris sekaligus.'),
  keputusan: z.enum(['DISETUJUI', 'DITOLAK'], { errorMap: () => ({ message: 'Keputusan harus DISETUJUI atau DITOLAK.' }) }),
  // Tolak massal memakai SATU alasan bersama (BR-V2).
  alasan_tolak: z.string().max(500, 'Alasan maksimal 500 karakter.').optional(),
  // Setujui massal: final per event (BR-V7 berlaku per event).
  final_menit: z.record(z.string(), z.number()).optional(),
});

/**
 * POST /api/admin/verifikasi/massal — setujui/tolak massal.
 * Satu transaksi: semua berhasil atau semua batal.
 */
export const POST = guard('verifikasi', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaMassal.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const { ids, keputusan, alasan_tolak, final_menit } = parsed.data;

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const keluar = [];
      for (const id of ids) {
        const final = final_menit?.[String(id)];
        keluar.push(await terapkanKeputusan(id, { keputusan, alasan_tolak, keterlambatan_final_menit: final }, { id: ctx.pengguna_id, peran: ctx.peran }, tx));
      }
      return keluar;
    });
    return NextResponse.json({
      kode: 'KEPUTUSAN_MASSAL_DISIMPAN',
      pesan: `${hasil.length} absensi berhasil diproses.`,
      data: { jumlah: hasil.length },
    });
  } catch (e) {
    if (e instanceof GalatVerifikasi) {
      return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
