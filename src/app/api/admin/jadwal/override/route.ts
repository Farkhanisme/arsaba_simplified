import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { tanggalValid } from '../../../../../server/aturan/penempatan';
import { simpanOverride, kembalikanStandar } from '../../../../../server/repo/jadwal';
import { GalatAturan } from '../../../../../server/repo/penempatan';

const POLA_JAM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const SkemaSlot = z.object({
  nama: z.string().max(100, 'Nama slot maksimal 100 karakter.'),
  jam_mulai: z.string().regex(POLA_JAM, 'Jam mulai harus format HH:MM (00:00–23:59).'),
  jam_selesai: z.string().regex(POLA_JAM, 'Jam selesai harus format HH:MM (00:00–23:59).'),
});

const SkemaOverride = z.object({
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
  tanggal: z.string({ required_error: 'Tanggal wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).'),
  aksi: z.enum(['simpan', 'kembalikan'], { required_error: 'Aksi wajib dipilih.' }),
  // K-27 ditegakkan di aplikasi (cekBatasSlot) agar pesannya jelas —
  // jadi zod mengizinkan sampai 3 untuk diuji, selebihnya ditolak zod.
  slots: z.array(SkemaSlot).max(3, 'Maksimal 2 slot per tanggal.').optional(),
  // K-37: catatan opsional.
  catatan: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
  nama_template: z.string().trim().max(100).optional(),
});

/**
 * POST /api/admin/jadwal/override — perubahan khusus satu hari (BR-J6)
 * atau kembali ke shift standar. Overlap = peringatan, tetap simpan (BR-J7).
 */
export const POST = guard('jadwal', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaOverride.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const { karyawan_id, tanggal, aksi } = parsed.data;

  try {
    if (aksi === 'kembalikan') {
      if (!parsed.data.nama_template) {
        return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Shift standar wajib dipilih.' }, { status: 400 });
      }
      const hasil = await denganTransaksi(async (tx) =>
        kembalikanStandar({ karyawanId: karyawan_id, tanggal, namaTemplate: parsed.data.nama_template!, pelaku: { id: ctx.pengguna_id, peran: ctx.peran } }, tx),
      );
      return NextResponse.json({ kode: 'JADWAL_STANDAR', pesan: 'Jadwal dikembalikan ke shift standar.', data: hasil });
    }

    const slots = parsed.data.slots ?? [];
    const hasil = await denganTransaksi(async (tx) =>
      simpanOverride(
        { karyawanId: karyawan_id, tanggal, slots, catatan: parsed.data.catatan ?? null, pelaku: { id: ctx.pengguna_id, peran: ctx.peran } },
        tx,
      ),
    );
    const pesan =
      hasil.peringatan.length > 0
        ? 'Perubahan khusus disimpan. Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.'
        : 'Perubahan khusus disimpan.';
    return NextResponse.json({ kode: 'OVERRIDE_DISIMPAN', pesan, data: hasil }, { status: 201 });
  } catch (e) {
    if (e instanceof GalatAturan) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : e.status === 403 ? 'PERIODE_TEREKSPOR' : 'JADWAL_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
