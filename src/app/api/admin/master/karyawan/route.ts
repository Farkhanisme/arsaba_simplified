import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { daftarKaryawan, buatKaryawan } from '../../../../../server/repo/karyawan';

// K-34: enam field. NIK opsional (nullable); string kosong dinormalisasi
// menjadi NULL di repo agar dua karyawan tanpa NIK tetap diterima.
const Opsional = z.string().max(500, 'Maksimal 500 karakter.').nullish();

const SkemaKaryawan = z.object({
  nama: z.string({ required_error: 'Nama karyawan wajib diisi.' }).trim().min(1, 'Nama karyawan wajib diisi.').max(200, 'Nama maksimal 200 karakter.'),
  nik: z.string().max(50, 'NIK maksimal 50 karakter.').nullish(),
  jabatan: Opsional,
  alamat: Opsional,
  nomor_hp: Opsional,
  kontak_darurat: Opsional,
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_karyawan', async () => {
  const daftar = await daftarKaryawan(getDb());
  return NextResponse.json({ kode: 'OK', data: daftar });
});

export const POST = guard('master_karyawan', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaKaryawan.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const dibuat = await denganTransaksi(async (tx) => {
      const id = await buatKaryawan(
        {
          nama: parsed.data.nama,
          nik: parsed.data.nik ?? null,
          jabatan: parsed.data.jabatan ?? null,
          alamat: parsed.data.alamat ?? null,
          nomor_hp: parsed.data.nomor_hp ?? null,
          kontak_darurat: parsed.data.kontak_darurat ?? null,
        },
        serialisasiWIB(),
        tx,
      );
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'KARYAWAN_TAMBAH',
          entitas: 'karyawan',
          entitas_id: id,
          sesudah: JSON.stringify({ id, nama: parsed.data.nama }),
          catatan: `Karyawan "${parsed.data.nama}" ditambah oleh ${ctx.username}`,
        },
        tx,
      );
      return { id, ...parsed.data };
    });
    return NextResponse.json({ kode: 'KARYAWAN_DITAMBAH', pesan: 'Karyawan berhasil ditambah.', data: dibuat }, { status: 201 });
  } catch (e) {
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'NIK_GANDA', pesan: 'NIK sudah dipakai karyawan lain.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
