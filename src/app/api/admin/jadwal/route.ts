import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalValid } from '../../../../server/aturan/penempatan';
import { rentangMode } from '../../../../server/aturan/jadwal';
import { namaHariWIB, jenisHari, serialisasiWIB, tanggalWIB } from '../../../../server/waktu';
import {
  daftarKaryawanDiToko,
  penempatanRentang,
  daftarJadwal,
  namaTemplateCocok,
  buatAtauTimpa,
} from '../../../../server/repo/jadwal';
import { GalatAturan } from '../../../../server/repo/penempatan';

/**
 * GET /api/admin/jadwal?toko_id=&mode=hari|minggu|bulan&tanggal=
 * Grid: rentang (+nama hari Weekend), karyawan, penempatan, jadwal + slot.
 */
export const GET = guard('jadwal', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const tokoId = Number(p.get('toko_id'));
  const mode = p.get('mode');
  // Tanggal acuan kosong -> hari ini menurut server WIB (bukan jam klien).
  const tanggal = p.get('tanggal') || tanggalWIB(serialisasiWIB());
  if (!Number.isInteger(tokoId) || tokoId <= 0) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Toko wajib dipilih.' }, { status: 400 });
  }
  if (mode !== 'hari' && mode !== 'minggu' && mode !== 'bulan') {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Mode harus hari, minggu, atau bulan.' }, { status: 400 });
  }
  if (!tanggalValid(tanggal)) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Tanggal acuan tidak valid (YYYY-MM-DD).' }, { status: 400 });
  }

  const db = getDb();
  const adaToko = await db.execute({ sql: 'SELECT id FROM toko WHERE id = ?', args: [tokoId] });
  if (adaToko.rows.length === 0) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Toko tidak ditemukan.' }, { status: 404 });
  }

  const rentang = rentangMode(mode, tanggal);
  const karyawan = await daftarKaryawanDiToko(tokoId, rentang[0]!, rentang[rentang.length - 1]!, db);
  const penempatan = await penempatanRentang(tokoId, rentang[0]!, rentang[rentang.length - 1]!, db);
  const jadwal = await daftarJadwal(tokoId, rentang[0]!, rentang[rentang.length - 1]!, db);

  const templateCocok: Record<string, string[]> = {};
  for (const t of rentang) {
    templateCocok[t] = await namaTemplateCocok(tokoId, t, db);
  }

  return NextResponse.json({
    kode: 'OK',
    data: {
      rentang: rentang.map((t) => ({ tanggal: t, hari: namaHariWIB(t), weekend: jenisHari(t) === 'WEEKEND' })),
      karyawan,
      penempatan,
      jadwal,
      templateCocok,
    },
  });
});

const SkemaSel = z.object({
  toko_id: z.number({ required_error: 'Toko wajib dipilih.' }).int().positive('Toko wajib dipilih.'),
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
  tanggal: z.string({ required_error: 'Tanggal wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).'),
  nama_template: z.string({ required_error: 'Shift wajib dipilih.' }).trim().min(1, 'Shift wajib dipilih.').max(100),
  // BR-J5: mode WAJIB dipilih eksplisit — tanpa default diam-diam ke timpa.
  mode: z.enum(['lewati', 'timpa'], { required_error: 'Pilih lewati atau timpa bila sel sudah ada.' }),
});

/** POST /api/admin/jadwal — buat/timpa satu sel (BR-J2..J5, J8, J9). */
export const POST = guard('jadwal', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaSel.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const hasil = await denganTransaksi(async (tx) =>
      buatAtauTimpa(
        {
          tokoId: parsed.data.toko_id,
          karyawanId: parsed.data.karyawan_id,
          tanggal: parsed.data.tanggal,
          namaTemplate: parsed.data.nama_template,
          mode: parsed.data.mode,
          pelaku: { id: ctx.pengguna_id, peran: ctx.peran },
        },
        tx,
      ),
    );
    const pesan =
      hasil.status === 'dibuat'
        ? 'Jadwal berhasil dibuat.'
        : hasil.status === 'ditimpa'
          ? 'Jadwal berhasil ditimpa.'
          : 'Sel sudah ada jadwal — dilewati.';
    return NextResponse.json({ kode: 'JADWAL_DISIMPAN', pesan, data: hasil }, { status: hasil.status === 'dilewati' ? 200 : 201 });
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'JADWAL_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
