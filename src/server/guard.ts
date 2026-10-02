import { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { getSession } from './auth';
import { izinDiperlukan, type Peran } from './izin';

/**
 * Guard bersama untuk seluruh Route Handler yang dilindungi.
 *
 * Tujuannya satu: supaya setiap route wajib melewati urutan yang sama —
 * Origin -> sesi -> izin — tanpa menyalin logikanya ke banyak tempat.
 *
 * Jadi ini urutan WAJIB, bukan gaya penulisan:
 *  - Origin diperiksa lebih dulu supaya request lintas situs dibuang sebelum
 *    menyentuh database.
 *  - Sesi dicek sebelum izin, karena izin tidak bisa dinilai tanpa tahu siapa peminta.
 *  - Izin dicek di server pada setiap request (rules/02 §13), bukan hanya dengan
 *    menyembunyikan menu di UI.
 */

export class GuardError extends Error {
  constructor(
    public readonly kode: string,
    public readonly status: number,
    public readonly pesan: string,
  ) {
    super(pesan);
    this.name = 'GuardError';
  }
}

export interface PenggunaAktif {
  pengguna_id: number;
  username: string;
  peran: Peran;
}

/**
 * Menolak request yang Origin-nya tidak sama persis dengan APP_ORIGIN.
 *
 * Perbandingan WAJIB eksak. `startsWith` akan membiarkan
 * "https://arsaba.vercel.app.penyerang.com" lolos, dan Origin yang kosong
 * (dikirim curl atau alat server-side) sama sekali tidak boleh diterima.
 */
export function wajibOrigin(req: NextRequest): void {
  const appOrigin = process.env['APP_ORIGIN'];
  if (!appOrigin) return; // APP_ORIGIN belum diset — tidak ada yang bisa dibandingkan.
  const origin = req.headers.get('origin') || '';
  if (origin !== appOrigin) {
    throw new GuardError('ORIGIN_TIDAK_VALID', 403, 'Akses ditolak.');
  }
}

/**
 * Memastikan request punya sesi admin yang valid DAN izin untuk `fitur`.
 * Melempar GuardError 401 bila sesi tidak ada/rusak, 403 bila izin tidak cukup.
 */
export async function wajibSesi(req: NextRequest, fitur: string): Promise<PenggunaAktif> {
  const cookie = req.cookies.get('sesi')?.value;
  if (!cookie) {
    throw new GuardError('TANPA_SESI', 401, 'Sesi tidak ditemukan.');
  }

  const session = await getSession(cookie);
  if (!session) {
    throw new GuardError('SESI_TIDAK_VALID', 401, 'Sesi tidak valid.');
  }

  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, peran FROM pengguna_admin WHERE id = ?',
    args: [session.pengguna_id],
  });
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new GuardError('PENGGUNA_TIDAK_DITEMUKAN', 401, 'Pengguna tidak ditemukan.');
  }

  const peran = String(row['peran']) as Peran;
  if (!izinDiperlukan(fitur, peran)) {
    throw new GuardError('AKSES_DITOLAK', 403, 'Akses ditolak.');
  }

  return { pengguna_id: session.pengguna_id, username: String(row['username']), peran };
}

type Handler = (req: NextRequest, ctx: PenggunaAktif) => Promise<NextResponse>;

/**
 * Membungkus Route Handler dengan urutan wajib: Origin -> sesi -> izin -> handler.
 *
 * Contoh pemakaian (pola ini dipakai seluruh route M2 dan seterusnya):
 *
 *   export const POST = guard('master_toko', async (req, ctx) => {
 *     await denganTransaksi(async (tx) => {
 *       await tx.execute({ sql: '...', args: [...] });
 *       await catatAudit({ ... }, tx);   // audit DI DALAM transaksi yang sama
 *     });
 *     return NextResponse.json({ kode: 'OK', pesan: 'Berhasil.' });
 *   });
 *
 * Untuk route yang tidak butuh sesi (mis. /api/login), pakai `guardTanpaSesi`.
 */
export function guard(fitur: string, handler: Handler): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      wajibOrigin(req);
      const ctx = await wajibSesi(req, fitur);
      return await handler(req, ctx);
    } catch (e) {
      return jadiResponsError(e);
    }
  };
}

/**
 * Untuk route publik yang tetap harus memeriksa Origin, seperti POST /api/login.
 * Authentikasi dilakukan sendiri di dalam handler.
 */
export function guardTanpaSesi(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      wajibOrigin(req);
      return await handler(req);
    } catch (e) {
      return jadiResponsError(e);
    }
  };
}

function jadiResponsError(e: unknown): NextResponse {
  if (e instanceof GuardError) {
    return NextResponse.json({ kode: e.kode, pesan: e.pesan }, { status: e.status });
  }
  // Detail teknis tidak pernah sampai ke pengguna (rules/03 §12).
  return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
}
