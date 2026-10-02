import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { daftarToko, buatToko } from '../../../../../server/repo/toko';

const SkemaToko = z.object({
  nama: z.string({ required_error: 'Nama toko wajib diisi.' }).trim().min(1, 'Nama toko wajib diisi.').max(100, 'Nama toko maksimal 100 karakter.'),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_toko', async () => {
  const daftar = await daftarToko(getDb());
  return NextResponse.json({ kode: 'OK', data: daftar });
});

export const POST = guard('master_toko', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaToko.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const dibuat = await denganTransaksi(async (tx) => {
      const id = await buatToko(parsed.data.nama, serialisasiWIB(), tx);
      const sesudah = JSON.stringify({ id, nama: parsed.data.nama, aktif: 1 });
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'TOKO_TAMBAH',
          entitas: 'toko',
          entitas_id: id,
          sesudah,
          catatan: `Toko "${parsed.data.nama}" ditambah oleh ${ctx.username}`,
        },
        tx,
      );
      return { id, nama: parsed.data.nama };
    });
    return NextResponse.json({ kode: 'TOKO_DITAMBAH', pesan: 'Toko berhasil ditambah.', data: dibuat }, { status: 201 });
  } catch (e) {
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'NAMA_GANDA', pesan: 'Nama toko sudah dipakai.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
