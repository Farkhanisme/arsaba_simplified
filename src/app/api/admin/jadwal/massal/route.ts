import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { tanggalValid } from '../../../../../server/aturan/penempatan';
import { rentangTanggal } from '../../../../../server/aturan/jadwal';
import { pratinjauMassal, terapkanMassal } from '../../../../../server/repo/jadwal';
import { GalatAturan } from '../../../../../server/repo/penempatan';

const SkemaMassal = z.object({
  toko_id: z.number({ required_error: 'Toko wajib dipilih.' }).int().positive('Toko wajib dipilih.'),
  karyawan_ids: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu karyawan.').max(100, 'Maksimal 100 karyawan sekaligus.'),
  dari: z.string({ required_error: 'Tanggal mulai wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal mulai tidak valid (YYYY-MM-DD).'),
  sampai: z.string({ required_error: 'Tanggal selesai wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal selesai tidak valid (YYYY-MM-DD).'),
  nama_template: z.string({ required_error: 'Shift wajib dipilih.' }).trim().min(1, 'Shift wajib dipilih.').max(100),
  mode: z.enum(['lewati', 'timpa'], { required_error: 'Pilih lewati atau timpa.' }),
  pratinjau: z.boolean().optional(),
});

/**
 * POST /api/admin/jadwal/massal — isi massal (BR-J5).
 * pratinjau=true -> ringkasan TANPA menulis. Tanpa mode -> DITOLAK.
 */
export const POST = guard('jadwal', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaMassal.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const { toko_id, karyawan_ids, dari, sampai, nama_template, mode } = parsed.data;
  const tanggalan = rentangTanggal(dari, sampai);
  if (tanggalan.length === 0) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Rentang tanggal tidak valid.' }, { status: 400 });
  }

  try {
    if (parsed.data.pratinjau === true) {
      const hasil = await pratinjauMassal(
        { tokoId: toko_id, karyawanIds: karyawan_ids, dari, sampai, namaTemplate: nama_template, mode, peran: ctx.peran },
        tanggalan,
        getDb(),
      );
      return NextResponse.json({
        kode: 'PRATINJAU',
        pesan: `${hasil.baru.length} sel baru, ${hasil.dilewati.length} dilewati, ${hasil.ditimpa.length} ditimpa, ${hasil.ditolak.length} ditolak.`,
        data: hasil,
      });
    }
    // B-19 (opsi A): sel ditolak dilewati dan dilaporkan; sel valid tersimpan.
    const hasil = await denganTransaksi(async (tx) =>
      terapkanMassal(
        { tokoId: toko_id, karyawanIds: karyawan_ids, namaTemplate: nama_template, mode, pelaku: { id: ctx.pengguna_id, peran: ctx.peran } },
        tanggalan,
        tx,
      ),
    );
    if (hasil.baru.length === 0 && hasil.ditimpa.length === 0) {
      return NextResponse.json(
        {
          kode: 'SEMUA_DITOLAK',
          pesan: `Tidak ada jadwal tersimpan. ${hasil.ditolak.length} sel ditolak.`,
          data: hasil,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        kode: 'MASSAL_DISIMPAN',
        pesan: `${hasil.baru.length} sel dibuat, ${hasil.ditimpa.length} ditimpa, ${hasil.dilewati.length} dilewati, ${hasil.ditolak.length} ditolak.`,
        data: hasil,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'JADWAL_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
