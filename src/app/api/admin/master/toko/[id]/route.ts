import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { tokoById, ubahToko } from '../../../../../../server/repo/toko';
import { idTerakhirDariUrl } from '../../../../../../server/url';

const SkemaUbahToko = z.object({
  nama: z.string().trim().min(1, 'Nama toko wajib diisi.').max(100, 'Nama toko maksimal 100 karakter.').optional(),
  aktif: z.union([z.literal(0), z.literal(1)]).optional(),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_toko', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID toko tidak valid.' }, { status: 400 });
  }
  const toko = await tokoById(id, getDb());
  if (!toko) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Toko tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'OK', data: toko });
});

export const PUT = guard('master_toko', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID toko tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaUbahToko.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  if (parsed.data.nama === undefined && parsed.data.aktif === undefined) {
    return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Tidak ada perubahan.' }, { status: 400 });
  }

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const sebelum = await tokoById(id, tx);
      if (!sebelum) return null;
      const sesudah = await ubahToko(id, parsed.data, tx);
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'TOKO_UBAH',
          entitas: 'toko',
          entitas_id: id,
          sebelum: JSON.stringify(sebelum),
          sesudah: JSON.stringify(sesudah),
          catatan: `Toko "${sebelum.nama}" diubah oleh ${ctx.username}`,
        },
        tx,
      );
      return sesudah;
    });
    if (!hasil) {
      return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Toko tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ kode: 'TOKO_DIUBAH', pesan: 'Toko berhasil diubah.', data: hasil });
  } catch (e) {
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'NAMA_GANDA', pesan: 'Nama toko sudah dipakai.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
