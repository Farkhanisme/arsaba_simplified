import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { buatTokenLink, urlUntukToken, buatUlangLink } from '../../../../../../server/repo/link';

const SkemaLink = z.object({
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
});

/**
 * BR-LK2: mencabut link lama DAN membuat yang baru dalam SATU transaksi.
 * Bila pembuatan baru gagal, link lama tidak ikut tercabut.
 */
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

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const waktu = serialisasiWIB();
      const { lamaId, baru } = await buatUlangLink(parsed.data.karyawan_id, buatTokenLink(), ctx.pengguna_id, waktu, tx);
      // Audit SENGAJA tidak memuat token lama maupun baru (BR-LK3).
      await catatAudit(
        {
          waktu,
          pengguna_id: ctx.pengguna_id,
          aksi: 'LINK_BUAT_ULANG',
          entitas: 'karyawan_link',
          entitas_id: baru.id,
          sebelum: JSON.stringify({ link_lama_id: lamaId, karyawan_id: parsed.data.karyawan_id, dicabut_at: waktu }),
          sesudah: JSON.stringify({ link_baru_id: baru.id, karyawan_id: parsed.data.karyawan_id, dibuat_at: baru.dibuat_at }),
          catatan: `Link karyawan ${parsed.data.karyawan_id} dibuat ulang oleh ${ctx.username}`,
        },
        tx,
      );
      return { id: baru.id, karyawan_id: baru.karyawan_id, dibuat_at: baru.dibuat_at, url: urlUntukToken(baru.token) };
    });
    return NextResponse.json({ kode: 'LINK_DIBUAT_ULANG', pesan: 'Link lama dicabut, link baru berlaku.', data: hasil }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /tidak memiliki link aktif/.test(e.message)) {
      return NextResponse.json({ kode: 'LINK_TIDAK_ADA', pesan: 'Karyawan tidak memiliki link aktif.' }, { status: 404 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
