import { NextResponse } from 'next/server';
import { getDb } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalWIB, tanggalPanjangWIB } from '../../../../server/waktu';
import { metrikPerToko, antreanVerifikasi } from '../../../../server/repo/dashboard';

/**
 * GET /api/admin/dashboard — kartu per toko hari ini (server) + antrean.
 * Tanpa pemilih tanggal (rules/05 §5.2): tanggal selalu dari tanggalWIB()
 * server. Parameter tanggal yang dikirim klien DIABAIKAN.
 */
export const GET = guard('dashboard', async () => {
  const db = getDb();
  const tanggal = tanggalWIB();
  const [kartu, antrean] = await Promise.all([metrikPerToko(tanggal, db), antreanVerifikasi(db)]);
  return NextResponse.json({
    kode: 'OK',
    data: { tanggal, tanggalPanjang: tanggalPanjangWIB(tanggal), kartu, antrean },
  });
});
