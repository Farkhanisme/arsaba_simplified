import { NextResponse } from 'next/server';
import { getDb } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';

/**
 * GET /api/admin/verifikasi/pilihan — daftar toko + karyawan aktif untuk
 * filter halaman verifikasi. Read-only; ADMIN butuh ini karena endpoint
 * master (SUPER_ADMIN saja) tidak bisa diaksesnya.
 */
export const GET = guard('verifikasi', async () => {
  const db = getDb();
  const toko = await db.execute({ sql: 'SELECT id, nama FROM toko WHERE aktif = 1 ORDER BY nama ASC', args: [] });
  const karyawan = await db.execute({ sql: 'SELECT id, nama FROM karyawan WHERE aktif = 1 ORDER BY nama ASC', args: [] });
  return NextResponse.json({
    kode: 'OK',
    data: {
      toko: toko.rows as unknown as { id: number; nama: string }[],
      karyawan: karyawan.rows as unknown as { id: number; nama: string }[],
    },
  });
});
