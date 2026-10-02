import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { tanggalValid } from '../../../../../server/aturan/penempatan';
import { pindahKaryawan, riwayatPenempatan, GalatAturan } from '../../../../../server/repo/penempatan';

const SkemaPindah = z.object({
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
  toko_tujuan_id: z.number({ required_error: 'Toko tujuan wajib dipilih.' }).int().positive('Toko tujuan wajib dipilih.'),
  tanggal_efektif: z
    .string({ required_error: 'Tanggal efektif wajib diisi.' })
    .refine((t) => tanggalValid(t), 'Tanggal efektif tidak valid (YYYY-MM-DD).'),
});

export const GET = guard('master_penempatan', async (req: NextRequest) => {
  const param = new URL(req.url).searchParams.get('karyawan_id');
  if (!param) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Parameter karyawan_id wajib diisi.' }, { status: 400 });
  }
  const karyawanId = Number(param);
  if (!Number.isInteger(karyawanId) || karyawanId <= 0) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Parameter karyawan_id tidak valid.' }, { status: 400 });
  }
  const riwayat = await riwayatPenempatan(karyawanId, getDb());
  return NextResponse.json({ kode: 'OK', data: riwayat });
});

export const POST = guard('master_penempatan', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaPindah.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const pindah = await pindahKaryawan(parsed.data.karyawan_id, parsed.data.toko_tujuan_id, parsed.data.tanggal_efektif, tx);
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'PENEMPATAN_PINDAH',
          entitas: 'karyawan_penempatan',
          entitas_id: pindah.baru.id,
          sebelum: pindah.lama ? JSON.stringify(pindah.lama) : undefined,
          sesudah: JSON.stringify(pindah.baru),
          catatan: `Karyawan ${parsed.data.karyawan_id} dipindah ke toko ${parsed.data.toko_tujuan_id} efektif ${parsed.data.tanggal_efektif} oleh ${ctx.username}`,
        },
        tx,
      );
      return pindah;
    });
    return NextResponse.json({ kode: 'PENEMPATAN_DIPINDAH', pesan: 'Karyawan berhasil dipindah.', data: hasil }, { status: 201 });
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 409 ? 'PINDAH_DIBLOKIR' : 'INPUT_TIDAK_VALID';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
