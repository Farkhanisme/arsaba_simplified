import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { akunById, setAktifAkun } from '../../../../../server/repo/pengguna';
import { idTerakhirDariUrl } from '../../../../../server/url';

const SkemaUbahAkun = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi.').max(200, 'Nama maksimal 200 karakter.').optional(),
  aktif: z.union([z.literal(0), z.literal(1)]).optional(),
});

export const GET = guard('master_akun', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID akun tidak valid.' }, { status: 400 });
  }
  const akun = await akunById(id, getDb());
  if (!akun) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Akun tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'OK', data: akun });
});

export const PUT = guard('master_akun', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID akun tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaUbahAkun.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  if (parsed.data.nama === undefined && parsed.data.aktif === undefined) {
    return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Tidak ada perubahan.' }, { status: 400 });
  }

  const hasil = await denganTransaksi(async (tx) => {
    const sebelum = await akunById(id, tx);
    if (!sebelum) return null;
    if (parsed.data.nama !== undefined) {
      await tx.execute({ sql: 'UPDATE pengguna_admin SET nama = ? WHERE id = ?', args: [parsed.data.nama, id] });
    }
    if (parsed.data.aktif !== undefined) {
      await setAktifAkun(id, parsed.data.aktif, tx);
    }
    const sesudah = await akunById(id, tx);
    await catatAudit(
      {
        waktu: serialisasiWIB(),
        pengguna_id: ctx.pengguna_id,
        aksi: 'AKUN_UBAH',
        entitas: 'pengguna_admin',
        entitas_id: id,
        sebelum: JSON.stringify(sebelum),
        sesudah: JSON.stringify(sesudah),
        catatan: `Akun "${sebelum.username}" diubah oleh ${ctx.username}`,
      },
      tx,
    );
    return sesudah;
  });
  if (!hasil) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Akun tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'AKUN_DIUBAH', pesan: 'Akun berhasil diubah.', data: hasil });
});
