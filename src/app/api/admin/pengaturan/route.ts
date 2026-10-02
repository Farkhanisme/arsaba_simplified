import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { catatAudit } from '../../../../server/audit';
import { serialisasiWIB } from '../../../../server/waktu';
import { bacaAmbang, ubahAmbang } from '../../../../server/repo/pengaturan';

const SkemaPengaturan = z.object({
  ambang_terlambat_menit: z
    .number({ required_error: 'Ambang terlambat wajib diisi.' })
    .int('Ambang harus bilangan bulat.')
    .min(0, 'Ambang tidak boleh negatif.'),
});

export const GET = guard('pengaturan', async () => {
  // Token bot TIDAK pernah dibaca/dikembalikan di sini (rules/05 §5.9).
  const ambang = await bacaAmbang(getDb());
  return NextResponse.json({ kode: 'OK', data: { ambang_terlambat_menit: ambang } });
});

export const PUT = guard('pengaturan', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaPengaturan.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  const hasil = await denganTransaksi(async (tx) => {
    const sebelum = await bacaAmbang(tx);
    const sesudah = await ubahAmbang(parsed.data.ambang_terlambat_menit, ctx.pengguna_id, serialisasiWIB(), tx);
    await catatAudit(
      {
        waktu: serialisasiWIB(),
        pengguna_id: ctx.pengguna_id,
        aksi: 'PENGATURAN_UBAH',
        entitas: 'pengaturan',
        sebelum: JSON.stringify({ ambang_terlambat_menit: sebelum }),
        sesudah: JSON.stringify({ ambang_terlambat_menit: sesudah }),
        catatan: `Ambang terlambat diubah oleh ${ctx.username}`,
      },
      tx,
    );
    return sesudah;
  });
  return NextResponse.json({
    kode: 'PENGATURAN_DISIMPAN',
    pesan: 'Pengaturan berhasil disimpan.',
    data: { ambang_terlambat_menit: hasil },
  });
});
