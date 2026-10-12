import { NextRequest, NextResponse } from 'next/server';
import { guardTanpaSesi } from '../../../../server/guard';
import { muatInfoAgenda } from '../../../../server/agenda-info';

/**
 * GET /api/agenda/info — daftar agenda untuk link karyawan (M12).
 *
 * Publik tanpa sesi, TAPI token link yang sama dengan absen (BR-A1): token tidak
 * dikenal/dicabut/karyawan nonaktif -> 404 dengan pesan generik. Tidak pernah
 * membocorkan agenda karyawan lain — `muatInfoAgenda` hanya memfilter lewat
 * `menerimaAgenda()` untuk karyawan yang tokennya dipakai.
 */
export const GET = guardTanpaSesi(async (req: NextRequest) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const info = await muatInfoAgenda(token);
  if (!info) {
    return NextResponse.json(
      { kode: 'LINK_TIDAK_BERLAKU', pesan: 'Link tidak berlaku. Hubungi admin.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ kode: 'OK', data: info });
});