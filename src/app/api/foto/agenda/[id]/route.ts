import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { idTerakhirDariUrl } from '../../../../../server/url';
import { laporanById } from '../../../../../server/repo/agenda-laporan';
import { unduhFotoTelegram } from '../../../../../server/telegram';

/**
 * GET /api/foto/agenda/[id]?foto=sebelum|sesudah — proxy foto laporan agenda.
 *
 * Terpisah dari `/api/foto/[id]` (absensi) karena tabel dan kolumnya berbeda, dan
 * karena satu laporan punya DUA foto. `Cache-Control: private` sama seperti
 * proxy absensi: URL unduhan Telegram mengandung token bot sehingga TIDAK PERNAH
 * dikirim ke klien — yang dialirkan hanya bytes (rules/03 §7).
 */
export const GET = guard('verifikasi_agenda', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID laporan tidak valid.' }, { status: 400 });
  }
  const jenis = new URL(req.url).searchParams.get('foto') ?? 'sebelum';
  if (jenis !== 'sebelum' && jenis !== 'sesudah') {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: 'Foto harus "sebelum" atau "sesudah".' },
      { status: 400 },
    );
  }

  const laporan = await laporanById(id, getDb());
  // BR-G9: draft tidak pernah terlihat admin — termasuk fotonya. Ini yang membuat
  // aturan "draft tidak terlihat" berlaku di jalur gambar, bukan cuma di daftar.
  if (!laporan || laporan.status === 'DRAFT') {
    return NextResponse.json({ kode: 'FOTO_TIDAK_DITEMUKAN', pesan: 'Foto tidak ditemukan.' }, { status: 404 });
  }
  const fileId = jenis === 'sebelum' ? laporan.sebelum_file_id : laporan.sesudah_file_id;
  if (!fileId) {
    return NextResponse.json({ kode: 'FOTO_TIDAK_DITEMUKAN', pesan: 'Foto tidak ditemukan.' }, { status: 404 });
  }
  try {
    const isi = await unduhFotoTelegram(fileId);
    return new NextResponse(new Uint8Array(isi), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private' },
    });
  } catch {
    return NextResponse.json({ kode: 'FOTO_GAGAL_DIMUAT', pesan: 'Foto tidak dapat dimuat. Coba lagi.' }, { status: 502 });
  }
});