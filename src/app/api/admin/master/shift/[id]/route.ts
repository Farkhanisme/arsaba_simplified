import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../../server/db';
import { guard } from '../../../../../../server/guard';
import { catatAudit } from '../../../../../../server/audit';
import { serialisasiWIB } from '../../../../../../server/waktu';
import { validasiJamShift, bentrokNamaTipe, type TipeHari } from '../../../../../../server/aturan/shift';
import { shiftById, ubahShift, tipeAdaUntukNama } from '../../../../../../server/repo/shift';
import { idTerakhirDariUrl } from '../../../../../../server/url';

const POLA_JAM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const SkemaUbahShift = z.object({
  nama: z.string().trim().min(1, 'Nama shift wajib diisi.').max(100, 'Nama shift maksimal 100 karakter.').optional(),
  tipe_hari: z.enum(['SEMUA', 'WEEKDAY', 'WEEKEND']).optional(),
  jam_mulai: z.string().regex(POLA_JAM, 'Jam mulai harus format HH:MM (00:00–23:59).').optional(),
  jam_selesai: z.string().regex(POLA_JAM, 'Jam selesai harus format HH:MM (00:00–23:59).').optional(),
  aktif: z.union([z.literal(0), z.literal(1)]).optional(),
});

function galatUnik(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export const GET = guard('master_shift', async (req: NextRequest) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID shift tidak valid.' }, { status: 400 });
  }
  const shift = await shiftById(id, getDb());
  if (!shift) {
    return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Shift tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ kode: 'OK', data: shift });
});

export const PUT = guard('master_shift', async (req: NextRequest, ctx) => {
  const id = idTerakhirDariUrl(req);
  if (id === null) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'ID shift tidak valid.' }, { status: 400 });
  }
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaUbahShift.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const sebelum = await shiftById(id, tx);
      if (!sebelum) return null;
      const gabung = {
        nama: parsed.data.nama ?? sebelum.nama,
        tipe_hari: (parsed.data.tipe_hari ?? sebelum.tipe_hari) as TipeHari,
        jam_mulai: parsed.data.jam_mulai ?? sebelum.jam_mulai,
        jam_selesai: parsed.data.jam_selesai ?? sebelum.jam_selesai,
      };
      const cekJam = validasiJamShift(gabung.jam_mulai, gabung.jam_selesai);
      if (!cekJam.boleh) throw Object.assign(new Error(cekJam.alasan), { status: 400 });
      const ada = await tipeAdaUntukNama(sebelum.toko_id, gabung.nama, id, tx);
      if (bentrokNamaTipe(ada, gabung.tipe_hari)) {
        throw Object.assign(new Error(`Nama "${gabung.nama}" bentrok dengan tipe hari lain di toko ini.`), { status: 409 });
      }
      const sesudah = await ubahShift(id, parsed.data, tx);
      await catatAudit(
        {
          waktu: serialisasiWIB(),
          pengguna_id: ctx.pengguna_id,
          aksi: 'SHIFT_UBAH',
          entitas: 'shift_template',
          entitas_id: id,
          sebelum: JSON.stringify(sebelum),
          sesudah: JSON.stringify(sesudah),
          catatan: `Shift "${sebelum.nama}" diubah oleh ${ctx.username}`,
        },
        tx,
      );
      return sesudah;
    });
    if (!hasil) {
      return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Shift tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ kode: 'SHIFT_DIUBAH', pesan: 'Shift berhasil diubah.', data: hasil });
  } catch (e) {
    const status = (e as unknown as { status?: unknown }).status;
    if (typeof status === 'number') {
      return NextResponse.json({ kode: status === 409 ? 'BENTROK_NAMA' : 'JAM_TIDAK_VALID', pesan: (e as Error).message }, { status });
    }
    if (galatUnik(e)) {
      return NextResponse.json({ kode: 'SHIFT_GANDA', pesan: 'Shift dengan nama dan tipe hari ini sudah ada di toko ini.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
