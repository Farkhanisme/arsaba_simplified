import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { idTerakhirDariUrl } from '../../../../../server/url';
import { ubah, hapus } from '../../../../../server/repo/ketidakhadiran';
import { GalatAturan } from '../../../../../server/repo/penempatan';

const SkemaUbah = z.object({
  jenis: z.enum(['IZIN', 'TANPA_KETERANGAN']).optional(),
  catatan: z.string().max(500, 'Catatan maksimal 500 karakter.').nullable().optional(),
});

/** PUT /api/admin/tidak-berangkat/[id] — BR-X4 ubah jenis/catatan. */
export const PUT = guard('tidak_berangkat', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID penandaan tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaUbah.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  if (parsed.data.jenis === undefined && parsed.data.catatan === undefined) {
    return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Tidak ada perubahan.' }, { status: 400 });
  }

  try {
    const sesudah = await denganTransaksi(async (tx) =>
      ubah(id, { jenis: parsed.data.jenis, catatan: parsed.data.catatan === undefined ? undefined : (parsed.data.catatan ?? null) }, { id: ctx.pengguna_id, peran: ctx.peran }, tx),
    );
    return NextResponse.json({ kode: 'TANDA_DIUBAH', pesan: 'Penandaan berhasil diubah.', data: sesudah });
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'TANDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});

/** DELETE /api/admin/tidak-berangkat/[id] — BR-X4 hapus (membuka blokir K-31). */
export const DELETE = guard('tidak_berangkat', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID penandaan tidak valid.' }, { status: 400 });
  }
  try {
    await denganTransaksi(async (tx) => hapus(id, { id: ctx.pengguna_id, peran: ctx.peran }, tx));
    return NextResponse.json({ kode: 'TANDA_DIHAPUS', pesan: 'Penandaan berhasil dihapus.' });
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'TANDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
