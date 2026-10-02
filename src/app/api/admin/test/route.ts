import { NextRequest, NextResponse } from 'next/server';
import { guard } from '../../../../server/guard';
import { izinDiperlukan } from '../../../../server/izin';

/**
 * Endpoint pembuktian izin. Dipakai untuk memverifikasi bahwa ADMIN dan SUPER_ADMIN
 * dibedakan DI SERVER, bukan hanya dengan menyembunyikan menu di UI (rules/02 §13).
 *
 * Nama fitur yang dipakai HARUS ada di IZIN_MATRIX. Nama yang tidak dikenal selalu
 * ditolak, jadi salah ketik tidak bisa membuat endpoint terbuka untuk semua orang.
 */
export const GET = guard('dashboard', async (_req: NextRequest, ctx) => {
  return NextResponse.json({
    kode: 'OK',
    peran: ctx.peran,
    izinUmum: true,
    izinSuper: izinDiperlukan('master_toko', ctx.peran),
  });
});
