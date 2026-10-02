import { NextRequest, NextResponse } from 'next/server';
import { guardTanpaSesi } from '../../../../server/guard';
import { muatInfoAbsen } from '../../../../server/absen-info';

/**
 * GET /api/absen/info?token=... — data untuk halaman /a/[token] dan refresh
 * keadaan tombol. Publik (token yang memverifikasi). Token gagal -> pesan
 * generik yang SAMA dengan POST /api/absen (BR-A1).
 */
export const GET = guardTanpaSesi(async (req: NextRequest) => {
  const token = new URL(req.url).searchParams.get('token') || '';
  const info = await muatInfoAbsen(token);
  if (!info) {
    return NextResponse.json(
      { kode: 'LINK_TIDAK_BERLAKU', pesan: 'Link tidak berlaku. Hubungi admin.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ kode: 'OK', data: info });
});
