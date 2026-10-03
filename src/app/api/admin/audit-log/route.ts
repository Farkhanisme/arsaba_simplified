import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { tanggalValid } from '../../../../server/aturan/penempatan';
import {
  daftarAksiAuditLog,
  daftarAuditLog,
  daftarEntitasAuditLog,
  daftarPelakuAuditLog,
} from '../../../../server/repo/audit-log';

const SkemaQuery = z.object({
  dari: z
    .string()
    .refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).')
    .optional(),
  sampai: z
    .string()
    .refine((t) => tanggalValid(t), 'Tanggal tidak valid (YYYY-MM-DD).')
    .optional(),
  pengguna_id: z.coerce.number().int('ID pelaku harus bilangan bulat.').positive('ID pelaku harus positif.').optional(),
  aksi: z.string().min(1, 'Aksi tidak boleh kosong.').max(100, 'Aksi maksimal 100 karakter.').optional(),
  entitas: z.string().min(1, 'Entitas tidak boleh kosong.').max(100, 'Entitas maksimal 100 karakter.').optional(),
  limit: z.coerce
    .number()
    .int('Batas harus bilangan bulat.')
    .min(1, 'Batas minimal 1.')
    .max(200, 'Batas maksimal 200.')
    .optional(),
  offset: z.coerce.number().int('Offset harus bilangan bulat.').min(0, 'Offset minimal 0.').optional(),
});

/**
 * GET /api/admin/audit-log — daftar hanya-baca (rules/05 §5.10).
 * Hanya SUPER_ADMIN (matriks izin `audit_log`). Pagination + filter waktu,
 * pelaku, aksi, entitas. Opsi filter diambil dari isi tabel.
 */
export const GET = guard('audit_log', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const mentah: Record<string, string> = {};
  for (const kunci of ['dari', 'sampai', 'pengguna_id', 'aksi', 'entitas', 'limit', 'offset'] as const) {
    const v = p.get(kunci);
    if (v !== null && v !== '') mentah[kunci] = v;
  }
  const parsed = SkemaQuery.safeParse(mentah);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Parameter tidak valid.' },
      { status: 400 },
    );
  }
  const q = parsed.data;
  if (q.dari && q.sampai && q.sampai < q.dari) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: 'Tanggal sampai tidak boleh sebelum tanggal dari.' },
      { status: 400 },
    );
  }
  const db = getDb();
  const [hasil, aksi, entitas, pelaku] = await Promise.all([
    daftarAuditLog(
      {
        dari: q.dari,
        sampai: q.sampai,
        penggunaId: q.pengguna_id,
        aksi: q.aksi,
        entitas: q.entitas,
        limit: q.limit,
        offset: q.offset,
      },
      db,
    ),
    daftarAksiAuditLog(db),
    daftarEntitasAuditLog(db),
    daftarPelakuAuditLog(db),
  ]);
  return NextResponse.json({
    kode: 'OK',
    data: { baris: hasil.baris, total: hasil.total, filter: { aksi, entitas, pelaku } },
  });
});

function metodeTakDiizinkan(): NextResponse {
  return NextResponse.json(
    { kode: 'METODE_TIDAK_DIIZINKAN', pesan: 'Audit log hanya bisa dibaca.' },
    { status: 405 },
  );
}

/** Audit log hanya-baca: mutasi apa pun ditolak 405 (bukan sekadar tidak dipakai). */
export async function POST(): Promise<NextResponse> {
  return metodeTakDiizinkan();
}

export async function PUT(): Promise<NextResponse> {
  return metodeTakDiizinkan();
}

export async function PATCH(): Promise<NextResponse> {
  return metodeTakDiizinkan();
}

export async function DELETE(): Promise<NextResponse> {
  return metodeTakDiizinkan();
}
