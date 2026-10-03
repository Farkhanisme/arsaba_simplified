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
 * Satu-satunya tempat memutuskan Origin mana yang diterima.
 *
 * Aturan produksi TIDAK BERUBAH: Origin harus sama PERSIS dengan APP_ORIGIN.
 * Perbandingan WAJIB eksak. `startsWith` akan membiarkan
 * "https://arsaba.vercel.app.penyerang.com" lolos, dan Origin yang kosong
 * (dikirim curl atau alat server-side) sama sekali tidak boleh diterima.
 *
 * Jalur development EKSPLISIT (BUG-UI-02): bila DAN HANYA BILA
 * NODE_ENV === 'development' DAN variabel APP_ORIGIN_DEV diset, Origin yang
 * sama persis dengan APP_ORIGIN_DEV juga diterima — supaya aplikasi bisa
 * dibuka di localhost tanpa menimpa APP_ORIGIN. Di produksi
 * (NODE_ENV=production) cabang ini mati total: APP_ORIGIN_DEV diabaikan
 * walau diset, jadi production tidak pernah menerima Origin apa pun selain
 * APP_ORIGIN. Dipakai wajibOrigin() dan route login (keduanya harus sama,
 * kalau tidak login localhost tetap 403).
 */
export function originDiterima(origin: string): boolean {
  const appOrigin = process.env['APP_ORIGIN'];
  if (!appOrigin) return true; // APP_ORIGIN belum diset — tidak ada yang bisa dibandingkan.
  if (origin === appOrigin) return true;
  if (process.env['NODE_ENV'] === 'development') {
    const devOrigin = process.env['APP_ORIGIN_DEV'];
    if (devOrigin && origin === devOrigin) return true;
  }
  return false;
}

/** Metode yang mengubah state. Untuk semuanya, Origin WAJIB ada dan harus cocok. */
const METODE_MUTASI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * BUG-UI-05 (2026-10-03): application's entire admin UI is unusable in a browser.
 *
 * Browser TIDAK mengirim header Origin pada request same-origin GET/HEAD
 * (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin):
 * "same-origin requests except for GET or HEAD requests". Semua halaman admin
 * mengambil data dengan fetch() GET, jadi Origin selalu kosong, dan seluruh
 * fetch() berakhir 403 "Akses ditolak".
 *
 * Arahkan spec: rules/03 §9.4 berbunyi
 *   "Cookie sesi HttpOnly; Secure; SameSite=Lax; cek Origin PADA MUTASI."
 * Implementasi lama mengeceknya pada SEMUA request, menyimpang dari spec sendiri.
 *
 * Perbaikan ini SELARAS dengan spec, bukan melemahkannya:
 *   - MUTASI (POST/PUT/PATCH/DELETE): Origin WAJIB ada dan harus cocok persis.
 *     Browser selalu mengirim Origin untuk metode-metode ini, jadi tidak ada
 *     yang lolos, dan proteksi CSRF tetap utuh.
 *   - GET/HEAD: kalau Origin DIKIRIM, tetap harus cocok persis — jadi browser
 *     cross-origin yang kebetulan mengirim Origin tetap ditolak. Origin yang
 *     TIDAK ada hanya diterima untuk GET/HEAD.
 *
 * Mengapa aman menerima Origin kosong pada GET:
 *   1. Cookie sesi sudah SameSite=Lax (login/route.ts). Under Lax, browser
 *      TIDAK mengirim cookie pada request cross-site non-top-level seperti
 *      <img> atau fetch() — jadi penyerang tidak punya otoritas sama sekali.
 *   2. Route GET di aplikasi ini hanya membaca; tidak ada mutasi yang bisa
 *      dipancing lewat GET.
 *   3. Penyerang non-browser bisa memalsukan header Apa Pun, tapi tanpa cookie
 *      sesi tidak ada yang bisa dilakukan.
 */
export function wajibOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin') || '';
  if (originDiterima(origin)) return;

  if (!METODE_MUTASI.has(req.method.toUpperCase()) && origin === '') {
    // GET/HEAD tanpa Origin = request same-origin dari browser. Lihat catatan di atas.
    return;
  }

  throw new GuardError('ORIGIN_TIDAK_VALID', 403, 'Akses ditolak.');
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
