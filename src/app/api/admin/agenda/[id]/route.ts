import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { idTerakhirDariUrl } from '../../../../../server/url';
import { CAKUPAN, MAKS_TUJUAN_EKPLISIT } from '../../../../../server/aturan/agenda';
import { batalkanAgenda, gantiTujuanAgenda, GalatAgenda } from '../../../../../server/repo/agenda';

/**
 * PUT /api/admin/agenda/[id] — dua aksi saja, tidak ada edit judul (K-62).
 *
 * `BATALKAN`  → status DIBATALKAN, alasan wajib (BR-G4), tanpa hapus permanen.
 * `TUJUAN`    → ganti cakupan/daftar penerima, hanya agenda buatan admin (BR-G5).
 */
const SkemaAksi = z.discriminatedUnion('aksi', [
  z.object({
    aksi: z.literal('BATALKAN'),
    alasan: z.string().min(1, 'Alasan pembatalan wajib diisi.').max(500, 'Alasan maksimal 500 karakter.'),
  }),
  z.object({
    aksi: z.literal('TUJUAN'),
    cakupan: z.enum(CAKUPAN as unknown as ['KARYAWAN', 'TOKO', 'SEMUA'], { required_error: 'Pilih penerima agenda.' }),
    toko_id: z.number().int().positive().optional(),
    karyawan_ids: z.array(z.number().int().positive()).max(MAKS_TUJUAN_EKPLISIT).optional(),
  }),
]);

export const PUT = guard('agenda', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID agenda tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaAksi.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const pelaku = { id: ctx.pengguna_id, peran: ctx.peran };
  // Disalin ke variabel lokal supaya TypeScript bisa mempersempit union diskriminan di
  // dalam closure. Membaca parsed.data.alasan langsung di dalam closure tidak bisa
  // dipersempit, jadi galat union bocor ke bawah.
  const aksi = parsed.data;

  try {
    if (aksi.aksi === 'BATALKAN') {
      const alasan = aksi.alasan;
      await denganTransaksi(async (tx) => batalkanAgenda(id, alasan, pelaku, tx));
      return NextResponse.json({ kode: 'AGENDA_DIBATALKAN', pesan: 'Agenda berhasil dibatalkan.' });
    }
    const tujuan = aksi;
    await denganTransaksi(async (tx) => gantiTujuanAgenda(id, tujuan, pelaku, tx));
    return NextResponse.json({ kode: 'AGENDA_DIUBAH', pesan: 'Penerima agenda berhasil diubah.' });
  } catch (e) {
    if (e instanceof GalatAgenda) {
      const kode =
        e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 409 ? 'AGENDA_DITOLAK' : 'AGENDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});