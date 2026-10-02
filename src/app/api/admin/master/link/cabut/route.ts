import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { cabutLink } from '../../../../../../server/repo/link';

const SkemaLink = z.object({
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
});

export const POST = guard('link_karyawan', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaLink.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  const waktu = serialisasiWIB();
  const tercabut = await denganTransaksi(async (tx) => {
    const hasil = await cabutLink(parsed.data.karyawan_id, waktu, tx);
    await catatAudit(
      {
        waktu,
        pengguna_id: ctx.pengguna_id,
        aksi: 'LINK_CABUT',
        entitas: 'karyawan_link',
        sebelum: JSON.stringify({ karyawan_id: parsed.data.karyawan_id, link_aktif: hasil }),
        sesudah: JSON.stringify({ karyawan_id: parsed.data.karyawan_id, dicabut_at: hasil ? waktu : null }),
        catatan: `Link karyawan ${parsed.data.karyawan_id} dicabut oleh ${ctx.username}`,
      },
      tx,
    );
    return hasil;
  });
  if (!tercabut) {
    return NextResponse.json({ kode: 'LINK_TIDAK_ADA', pesan: 'Karyawan tidak memiliki link aktif.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'LINK_DICABUT', pesan: 'Link berhasil dicabut dan tidak berlaku lagi.' });
});
