import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { catatAudit } from '../../../../server/audit';
import { hashPassword } from '../../../../server/auth';
import { serialisasiWIB } from '../../../../server/waktu';
import { daftarAkun, buatAkun } from '../../../../server/repo/pengguna';

const SkemaAkun = z.object({
  username: z.string({ required_error: 'Username wajib diisi.' }).trim().min(1, 'Username wajib diisi.').max(50, 'Username maksimal 50 karakter.'),
  // BR-AUTH5: password TIDAK di-trim; K-48: minimal 8 karakter.
  password: z.string({ required_error: 'Password wajib diisi.' }).min(8, 'Password baru minimal 8 karakter.').max(200, 'Password maksimal 200 karakter.'),
  nama: z.string({ required_error: 'Nama wajib diisi.' }).trim().min(1, 'Nama wajib diisi.').max(200, 'Nama maksimal 200 karakter.'),
  peran: z.enum(['ADMIN', 'SUPER_ADMIN'], { required_error: 'Peran wajib dipilih.' }),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_akun', async () => {
  const daftar = await daftarAkun(getDb());
  return NextResponse.json({ kode: 'OK', data: daftar });
});

export const POST = guard('master_akun', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaAkun.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    // Password ditampilkan SEKALI di respons ini (rules/05 §5.9); tidak pernah
    // masuk audit, log, atau respons lain. Hash tidak pernah keluar.
    const dibuat = await denganTransaksi(async (tx) => {
      const id = await buatAkun(
        {
          username: parsed.data.username,
          passwordHash: hashPassword(parsed.data.password).combined,
          nama: parsed.data.nama,
          peran: parsed.data.peran,
        },
        serialisasiWIB(),
        tx,
      );
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'AKUN_TAMBAH',
          entitas: 'pengguna_admin',
          entitas_id: id,
          sesudah: JSON.stringify({ id, username: parsed.data.username, nama: parsed.data.nama, peran: parsed.data.peran, aktif: 1 }),
          catatan: `Akun "${parsed.data.username}" dibuat oleh ${ctx.username}`,
        },
        tx,
      );
      return { id, username: parsed.data.username, nama: parsed.data.nama, peran: parsed.data.peran };
    });
    return NextResponse.json(
      {
        kode: 'AKUN_DITAMBAH',
        pesan: 'Akun berhasil dibuat. Salin password sekarang — tidak akan ditampilkan lagi.',
        data: { ...dibuat, password: parsed.data.password },
      },
      { status: 201 },
    );
  } catch (e) {
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'USERNAME_GANDA', pesan: 'Username sudah dipakai.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
