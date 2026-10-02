import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { karyawanById, ubahKaryawan } from '../../../../../../server/repo/karyawan';
import { idTerakhirDariUrl } from '../../../../../../server/url';

const Opsional = z.string().max(500, 'Maksimal 500 karakter.').nullish();

const SkemaUbahKaryawan = z.object({
  nama: z.string().trim().min(1, 'Nama karyawan wajib diisi.').max(200, 'Nama maksimal 200 karakter.').optional(),
  nik: z.string().max(50, 'NIK maksimal 50 karakter.').nullable().optional(),
  jabatan: Opsional.optional(),
  alamat: Opsional.optional(),
  nomor_hp: Opsional.optional(),
  kontak_darurat: Opsional.optional(),
  aktif: z.union([z.literal(0), z.literal(1)]).optional(),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_karyawan', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID karyawan tidak valid.' }, { status: 400 });
  }
  const karyawan = await karyawanById(id, getDb());
  if (!karyawan) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Karyawan tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'OK', data: karyawan });
});

export const PUT = guard('master_karyawan', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID karyawan tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaUbahKaryawan.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const sebelum = await karyawanById(id, tx);
      if (!sebelum) return null;
      const sesudah = await ubahKaryawan(
        id,
        {
          nama: parsed.data.nama,
          nik: parsed.data.nik === undefined ? undefined : (parsed.data.nik ?? null),
          jabatan: parsed.data.jabatan === undefined ? undefined : (parsed.data.jabatan ?? null),
          alamat: parsed.data.alamat === undefined ? undefined : (parsed.data.alamat ?? null),
          nomor_hp: parsed.data.nomor_hp === undefined ? undefined : (parsed.data.nomor_hp ?? null),
          kontak_darurat: parsed.data.kontak_darurat === undefined ? undefined : (parsed.data.kontak_darurat ?? null),
          aktif: parsed.data.aktif,
        },
        tx,
      );
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'KARYAWAN_UBAH',
          entitas: 'karyawan',
          entitas_id: id,
          sebelum: JSON.stringify(sebelum),
          sesudah: JSON.stringify(sesudah),
          catatan: `Karyawan "${sebelum.nama}" diubah oleh ${ctx.username}`,
        },
        tx,
      );
      return sesudah;
    });
    if (!hasil) {
      return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Karyawan tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ kode: 'KARYAWAN_DIUBAH', pesan: 'Karyawan berhasil diubah.', data: hasil });
  } catch (e) {
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'NIK_GANDA', pesan: 'NIK sudah dipakai karyawan lain.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
