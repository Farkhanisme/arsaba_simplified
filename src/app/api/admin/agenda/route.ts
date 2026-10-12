import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalValid } from '../../../../server/aturan/penempatan';
import { JUDUL_MAKS, KETERANGAN_MAKS, MAKS_TUJUAN_EKPLISIT, CAKUPAN } from '../../../../server/aturan/agenda';
import { agendaDenganPenerima, buatAgenda, daftarAgenda, GalatAgenda } from '../../../../server/repo/agenda';

/**
 * GET /api/admin/agenda — daftar agenda + penerima hasil resolusi BR-G2.
 *
 * Penerima ikut dikirim per agenda supaya halaman admin tidak perlu memanggil endpoint lain
 * dan tidak pernah menampilkan daftar penerima basi dari cache.
 */
export const GET = guard('agenda', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const num = (nama: string): number | undefined => {
    const v = p.get(nama);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const status = p.get('status');
  if (status !== null && status !== '' && status !== 'AKTIF' && status !== 'DIBATALKAN') {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Status agenda tidak valid.' }, { status: 400 });
  }
  const cakupan = p.get('cakupan');
  if (cakupan !== null && cakupan !== '' && !CAKUPAN.includes(cakupan as never)) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Cakupan tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const daftar = await daftarAgenda(
    {
      status: (status as 'AKTIF' | 'DIBATALKAN') || undefined,
      cakupan: (cakupan as 'KARYAWAN' | 'TOKO' | 'SEMUA') || undefined,
      tokoId: num('toko_id'),
    },
    db,
  );

  const lengkap = await Promise.all(daftar.map((a) => agendaDenganPenerima(a.id, db)));
  return NextResponse.json({ kode: 'OK', data: lengkap.filter((x) => x !== null) });
});

const SkemaBuat = z.object({
  judul: z.string().max(JUDUL_MAKS, `Judul maksimal ${JUDUL_MAKS} karakter.`),
  keterangan: z.string().max(KETERANGAN_MAKS, `Keterangan maksimal ${KETERANGAN_MAKS} karakter.`).optional(),
  wajib_foto: z.boolean({ required_error: 'Pilih apakah agenda wajib foto.' }),
  cakupan: z.enum(CAKUPAN as unknown as ['KARYAWAN', 'TOKO', 'SEMUA'], { required_error: 'Pilih penerima agenda.' }),
  toko_id: z.number().int().positive().optional(),
  target_tanggal: z.string().refine((t) => tanggalValid(t), 'Tanggal target tidak valid (YYYY-MM-DD).').optional(),
  karyawan_ids: z.array(z.number().int().positive()).max(MAKS_TUJUAN_EKPLISIT).optional(),
});

/**
 * POST /api/admin/agenda — buat agenda + assign (BR-G1..G3).
 *
 * Judul/keterangan tidak bisa diubah setelah pembuatan (K-62), jadi tidak ada PUT untuk
 * keduanya; `PUT /api/admin/agenda/[id]` hanya membatalkan dan menukar penerima.
 */
export const POST = guard('agenda', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaBuat.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const id = await denganTransaksi(async (tx) =>
      buatAgenda(
        {
          judul: d.judul,
          keterangan: d.keterangan,
          wajib_foto: d.wajib_foto,
          cakupan: d.cakupan,
          toko_id: d.toko_id,
          target_tanggal: d.target_tanggal,
          karyawan_ids: d.karyawan_ids,
          dibuatOleh: ctx.pengguna_id,
        },
        tx,
      ),
    );
    return NextResponse.json({ kode: 'AGENDA_DISIMPAN', pesan: 'Agenda berhasil dibuat.', data: { id } }, { status: 201 });
  } catch (e) {
    if (e instanceof GalatAgenda) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : 'AGENDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});