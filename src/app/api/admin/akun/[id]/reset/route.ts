import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { hashPassword } from '../../../../../../server/auth';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { akunById, setPasswordHash, hapusSemuaSesiAkun } from '../../../../../../server/repo/pengguna';
import { idTerakhirDariUrl } from '../../../../../../server/url';

const SkemaReset = z.object({
  // BR-AUTH5: tidak di-trim; K-48: minimal 8 karakter.
  password: z.string({ required_error: 'Password wajib diisi.' }).min(8, 'Password baru minimal 8 karakter.').max(200, 'Password maksimal 200 karakter.'),
});

/**
 * Reset password oleh Super Admin. Membatalkan SELURUH sesi akun itu
 * (sama seperti ganti password sendiri, K-47). Password baru ditampilkan
 * SEKALI di respons; tidak pernah masuk audit atau log.
 */
export const POST = guard('master_akun', async (req: NextRequest, ctx) => {
  const segmen = new URL(req.url).pathname.split('/').filter(Boolean);
  const idSegmen = segmen[segmen.length - 2];
  const id = idSegmen !== undefined && /^\d+$/.test(idSegmen) ? Number(idSegmen) : idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID akun tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaReset.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  const hasil = await denganTransaksi(async (tx) => {
    const target = await akunById(id, tx);
    if (!target) return null;
    await setPasswordHash(id, hashPassword(parsed.data.password).combined, tx);
    const sesiDibatalkan = await hapusSemuaSesiAkun(id, tx);
    await catatAudit(
      {
        waktu: serialisasiWIB(),
        pengguna_id: ctx.pengguna_id,
        aksi: 'AKUN_RESET_PASSWORD',
        entitas: 'pengguna_admin',
        entitas_id: id,
        sesudah: JSON.stringify({ username: target.username, sesi_dibatalkan: sesiDibatalkan }),
        catatan: `Password akun "${target.username}" di-reset oleh ${ctx.username}; seluruh sesi dibatalkan`,
      },
      tx,
    );
    return { username: target.username, sesiDibatalkan };
  });
  if (!hasil) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Akun tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({
    kode: 'PASSWORD_DI_RESET',
    pesan: 'Password berhasil di-reset. Salin password sekarang — tidak akan ditampilkan lagi.',
    data: { username: hasil.username, sesi_dibatalkan: hasil.sesiDibatalkan, password: parsed.data.password },
  });
});
