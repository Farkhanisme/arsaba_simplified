import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalValid } from '../../../../server/aturan/penempatan';
import { bentukRentang } from '../../../../server/aturan/ketidakhadiran';
import { daftarPenandaan, terapkanMassal } from '../../../../server/repo/ketidakhadiran';
import { GalatAturan } from '../../../../server/repo/penempatan';

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/tidak-berangkat — daftar + filter toko/tanggal/karyawan. */
export const GET = guard('tidak_berangkat', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const num = (nama: string): number | undefined => {
    const v = p.get(nama);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const dari = p.get('dari');
  const sampai = p.get('sampai');
  if ((dari !== null && dari !== '' && !POLA_TANGGAL.test(dari)) || (sampai !== null && sampai !== '' && !POLA_TANGGAL.test(sampai))) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Rentang tanggal tidak valid (YYYY-MM-DD).' }, { status: 400 });
  }
  const data = await daftarPenandaan(
    { tokoId: num('toko_id'), dari: dari || undefined, sampai: sampai || undefined, karyawanId: num('karyawan_id') },
    getDb(),
  );
  return NextResponse.json({ kode: 'OK', data });
});

const SkemaTandai = z.object({
  karyawan_ids: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu karyawan.').max(100, 'Maksimal 100 karyawan sekaligus.'),
  dari: z.string({ required_error: 'Tanggal wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).'),
  sampai: z
    .string()
    .refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).')
    .optional(),
  jenis: z.enum(['IZIN', 'TANPA_KETERANGAN'], { required_error: 'Jenis wajib dipilih.' }),
  catatan: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

/**
 * POST /api/admin/tidak-berangkat — buat satu/rentang (BR-X1..X5).
 * Sel terblokir DILEWATI + DILAPORKAN; 403 K-32 FAIL-FAST seluruh operasi.
 */
export const POST = guard('tidak_berangkat', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaTandai.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const tanggalan = bentukRentang(parsed.data.dari, parsed.data.sampai);
  if (tanggalan.length === 0) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Rentang tanggal tidak valid.' }, { status: 400 });
  }

  try {
    const hasil = await denganTransaksi(async (tx) =>
      terapkanMassal(
        {
          karyawanIds: parsed.data.karyawan_ids,
          jenis: parsed.data.jenis,
          catatan: parsed.data.catatan?.trim() ? parsed.data.catatan.trim() : null,
          pelaku: { id: ctx.pengguna_id, peran: ctx.peran },
        },
        tanggalan,
        tx,
      ),
    );
    if (hasil.dibuat.length === 0) {
      return NextResponse.json(
        { kode: 'SEMUA_DITOLAK', pesan: `Tidak ada penandaan tersimpan. ${hasil.ditolak.length} sel ditolak.`, data: hasil },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        kode: 'TANDA_DISIMPAN',
        pesan: `${hasil.dibuat.length} penandaan tersimpan, ${hasil.ditolak.length} ditolak.`,
        data: hasil,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'TANDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
