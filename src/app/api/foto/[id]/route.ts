import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { absensiById } from '../../../../server/repo/absensi';
import { unduhFotoTelegram } from '../../../../server/telegram';
import { idTerakhirDariUrl } from '../../../../server/url';

/**
 * GET /api/foto/[absensiId] — proxy foto ke admin (rules/03 §7).
 * Butuh sesi admin (fitur verifikasi). URL unduhan Telegram mengandung token
 * bot sehingga TIDAK PERNAH dikirim ke klien — yang dialirkan hanya bytes.
 */
export const GET = guard('verifikasi', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID absensi tidak valid.' }, { status: 400 });
  }
  const event = await absensiById(id, getDb());
  if (!event || !event.foto_file_id) {
    return NextResponse.json({ kode: 'FOTO_TIDAK_DITEMUKAN', pesan: 'Foto tidak ditemukan.' }, { status: 404 });
  }
  try {
    const isi = await unduhFotoTelegram(event.foto_file_id);
    return new NextResponse(new Uint8Array(isi), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private',
      },
    });
  } catch {
    return NextResponse.json({ kode: 'FOTO_GAGAL_DIMUAT', pesan: 'Foto tidak dapat dimuat. Coba lagi.' }, { status: 502 });
  }
});
