import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalValid } from '../../../../server/aturan/penempatan';
import { periksaSyaratEkspor, susunRekap, catatEkspor, type FilterRekap } from '../../../../server/repo/rekap';
import { buatWorkbook } from '../../../../server/ekspor';
import { GalatAturan } from '../../../../server/repo/penempatan';

const SkemaFilter = z.object({
  dari: z.string({ required_error: 'Tanggal mulai wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal mulai tidak valid (YYYY-MM-DD).'),
  sampai: z.string({ required_error: 'Tanggal selesai wajib diisi.' }).refine((t) => tanggalValid(t), 'Tanggal selesai tidak valid (YYYY-MM-DD).'),
  toko_id: z.number().int().positive('Toko tidak valid.').nullable().optional(),
});

function bacaFilter(badan: unknown):
  | { ok: true; filter: FilterRekap }
  | { ok: false; respons: NextResponse } {
  const parsed = SkemaFilter.safeParse(badan);
  if (!parsed.success) {
    return {
      ok: false,
      respons: NextResponse.json(
        { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
        { status: 400 },
      ),
    };
  }
  if (parsed.data.dari > parsed.data.sampai) {
    return {
      ok: false,
      respons: NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Tanggal mulai harus <= tanggal selesai.' }, { status: 400 }),
    };
  }
  return { ok: true, filter: { dari: parsed.data.dari, sampai: parsed.data.sampai, tokoId: parsed.data.toko_id ?? null } };
}

function namaFile(filter: FilterRekap): string {
  const toko = filter.tokoId === null ? 'semua-toko' : `toko-${filter.tokoId}`;
  return `rekap-${filter.dari}-${filter.sampai}-${toko}.xlsx`;
}

/**
 * POST /api/admin/rekap/periksa — hasil pemeriksaan syarat ekspor (BR-R2/R3).
 */
export const PERIKSA = guard('rekap', async (req: NextRequest) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const f = bacaFilter(badan);
  if (!f.ok) return f.respons;
  const hasil = await periksaSyaratEkspor(f.filter, getDb());
  return NextResponse.json({
    kode: 'OK',
    pesan: hasil.boleh ? 'Semua absensi pada periode ini sudah diverifikasi.' : 'Ekspor belum bisa dilakukan.',
    data: hasil,
  });
});

/**
 * GET /api/admin/rekap — pratinjau: pemeriksaan + tabel ringkasan.
 * Jalur perhitungan SAMA dengan ekspor (susunRekap).
 */
export const PRATINJAU = guard('rekap', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const f = bacaFilter({
    dari: p.get('dari'),
    sampai: p.get('sampai'),
    toko_id: p.get('toko_id') === null || p.get('toko_id') === '' ? null : Number(p.get('toko_id')),
  });
  if (!f.ok) return f.respons;
  const { pemeriksaan, ringkasan } = await susunRekap(f.filter, getDb());
  return NextResponse.json({ kode: 'OK', data: { filter: f.filter, pemeriksaan, ringkasan } });
});

/**
 * POST /api/admin/rekap/ekspor — file .xlsx (BR-R6/R7).
 * Urutan dalam SATU transaksi: periksa syarat -> catat log_ekspor + audit.
 * File disusun dari data yang dibaca di transaksi yang sama (anti-B-19),
 * lalu dikirim setelah commit.
 */
export const EKSPOR = guard('ekspor', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const f = bacaFilter(badan);
  if (!f.ok) return f.respons;

  try {
    const data = await denganTransaksi(async (tx) => {
      const susun = await susunRekap(f.filter, tx);
      if (!susun.pemeriksaan.boleh) {
        throw new GalatAturan(
          409,
          `Ekspor belum bisa dilakukan: masih ada ${susun.pemeriksaan.jumlahMenunggu} absensi menunggu verifikasi dan ${susun.pemeriksaan.jumlahCheckinTerbuka} check-in tanpa check-out.`,
        );
      }
      await catatEkspor(f.filter, ctx.pengguna_id, tx);
      return { ringkasan: susun.ringkasan, detail: susun.detail };
    });
    const xlsx = await buatWorkbook(data.ringkasan, data.detail);
    return new NextResponse(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namaFile(f.filter)}"`,
      },
    });
  } catch (e) {
    if (e instanceof GalatAturan) {
      return NextResponse.json({ kode: 'EKSPOR_DIBLOKIR', pesan: e.message }, { status: e.status });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
