import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { validasiJamShift, bentrokNamaTipe, type TipeHari } from '../../../../../server/aturan/shift';
import { daftarShift, buatShift, tipeAdaUntukNama } from '../../../../../server/repo/shift';

const POLA_JAM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const SkemaShift = z.object({
  toko_id: z.number({ required_error: 'Toko wajib dipilih.' }).int().positive('Toko wajib dipilih.'),
  nama: z.string({ required_error: 'Nama shift wajib diisi.' }).trim().min(1, 'Nama shift wajib diisi.').max(100, 'Nama shift maksimal 100 karakter.'),
  tipe_hari: z.enum(['SEMUA', 'WEEKDAY', 'WEEKEND'], { required_error: 'Tipe hari wajib dipilih.' }),
  jam_mulai: z.string({ required_error: 'Jam mulai wajib diisi.' }).regex(POLA_JAM, 'Jam mulai harus format HH:MM (00:00–23:59).'),
  jam_selesai: z.string({ required_error: 'Jam selesai wajib diisi.' }).regex(POLA_JAM, 'Jam selesai harus format HH:MM (00:00–23:59).'),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_shift', async (req: NextRequest) => {
  const param = new URL(req.url).searchParams.get('toko_id');
  const tokoId = param === null || param === '' ? null : Number(param);
  if (tokoId !== null && (!Number.isInteger(tokoId) || tokoId <= 0)) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Parameter toko tidak valid.' }, { status: 400 });
  }
  const daftar = await daftarShift(tokoId, getDb());
  return NextResponse.json({ kode: 'OK', data: daftar });
});

export const POST = guard('master_shift', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaShift.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const { toko_id, nama, tipe_hari, jam_mulai, jam_selesai } = parsed.data;

  // BR-T3: jam_mulai = jam_selesai ditolak; selesai <= mulai = lintas malam.
  const cekJam = validasiJamShift(jam_mulai, jam_selesai);
  if (!cekJam.boleh) {
    return NextResponse.json({ kode: 'JAM_TIDAK_VALID', pesan: cekJam.alasan }, { status: 400 });
  }

  try {
    const dibuat = await denganTransaksi(async (tx) => {
      const toko = await tx.execute({ sql: 'SELECT id FROM toko WHERE id = ?', args: [toko_id] });
      if (toko.rows.length === 0) throw Object.assign(new Error('Toko tidak ditemukan.'), { status: 404 });
      // BR-J1: SEMUA tidak boleh berdampingan dengan WEEKDAY/WEEKEND pada nama sama.
      const ada = await tipeAdaUntukNama(toko_id, nama, null, tx);
      if (bentrokNamaTipe(ada, tipe_hari as TipeHari)) {
        throw Object.assign(
          new Error(
            tipe_hari === 'SEMUA'
              ? `Nama "${nama}" sudah dipakai untuk tipe Weekday/Weekend di toko ini.`
              : `Nama "${nama}" sudah dipakai untuk tipe Semua Hari di toko ini.`,
          ),
          { status: 409 },
        );
      }
      const id = await buatShift({ toko_id, nama, tipe_hari: tipe_hari as TipeHari, jam_mulai, jam_selesai }, serialisasiWIB(), tx);
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'SHIFT_TAMBAH',
          entitas: 'shift_template',
          entitas_id: id,
          sesudah: JSON.stringify({ id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai }),
          catatan: `Shift "${nama}" ditambah oleh ${ctx.username}`,
        },
        tx,
      );
      return { id, toko_id, nama, tipe_hari, jam_mulai, jam_selesai };
    });
    return NextResponse.json({ kode: 'SHIFT_DITAMBAH', pesan: 'Shift berhasil ditambah.', data: dibuat }, { status: 201 });
  } catch (e) {
    const status = (e as unknown as { status?: unknown }).status;
    if (typeof status === 'number') {
      return NextResponse.json({ kode: status === 404 ? 'TIDAK_DITEMUKAN' : 'BENTROK_NAMA', pesan: (e as Error).message }, { status });
    }
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'SHIFT_GANDA', pesan: 'Shift dengan nama dan tipe hari ini sudah ada di toko ini.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
