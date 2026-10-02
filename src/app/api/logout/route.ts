import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { destroySession } from '../../../server/auth';
import { guardTanpaSesi } from '../../../server/guard';

/**
 * Logout memusnahkan sesi di server, bukan sekadar menghapus cookie di browser.
 *
 * CATATAN (bug yang pernah ada di file ini): destroySession() mencari kolom id_hash,
 * yaitu sha256(id_sesi). Nilai di cookie adalah id_sesi MENTAH. Kalau yang dikirim
 * adalah nilai cookie, DELETE selalu kena 0 baris dan sesi tetap hidup sampai
 * kedaluwarsa 12 jam. Jadi yang harus dikirim adalah hash dari nilai cookie.
 */
export const POST = guardTanpaSesi(async (req: NextRequest) => {
  const cookie = req.cookies.get('sesi')?.value;
  if (cookie) {
    const hashId = createHash('sha256').update(cookie).digest('base64url');
    await destroySession(hashId);
  }

  const response = NextResponse.json({ kode: 'LOGOUT_BERHASIL', pesan: 'Keluar berhasil.' });
  response.cookies.delete('sesi');
  return response;
});
