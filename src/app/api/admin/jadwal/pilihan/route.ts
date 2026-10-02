import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { daftarTokoAktif, daftarTemplateAktif } from '../../../../../server/repo/jadwal';

/**
 * GET /api/admin/jadwal/pilihan?toko_id= — toko + template aktif untuk
 * filter dan panel. Read-only; ADMIN butuh ini karena master SUPER-only.
 */
export const GET = guard('jadwal', async (req: NextRequest) => {
  const tokoId = Number(new URL(req.url).searchParams.get('toko_id'));
  const db = getDb();
  const toko = await daftarTokoAktif(db);
  const template = Number.isInteger(tokoId) && tokoId > 0 ? await daftarTemplateAktif(tokoId, db) : [];
  return NextResponse.json({ kode: 'OK', data: { toko, template } });
});
