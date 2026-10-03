process.loadEnvFile('.env.local');
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

// Setiap route diimpor secara STATIS. Kalau ada route baru yang belum didaftar
// di ROUTE_GUARD / ROUTE_PUBLIK, tes "daftar route menutup semua file" di bawah
// akan gagal — bukan diam-diam lolos.
import { POST as loginRoute } from '../src/app/api/login/route';
import { POST as logoutRoute } from '../src/app/api/logout/route';
import { GET as absenInfoRoute } from '../src/app/api/absen/info/route';
import { POST as absenRoute } from '../src/app/api/absen/route';
import { GET as fotoRoute } from '../src/app/api/foto/[id]/route';

import { GET as adminTestRoute } from '../src/app/api/admin/test/route';
import { GET as rekapRoute } from '../src/app/api/admin/rekap/route';
import { POST as rekapPeriksaRoute } from '../src/app/api/admin/rekap/periksa/route';
import { POST as rekapEksporRoute } from '../src/app/api/admin/rekap/ekspor/route';
import { GET as dashboardRoute } from '../src/app/api/admin/dashboard/route';
import { POST as ubahPasswordRoute } from '../src/app/api/admin/ubah-password/route';
import { GET as akunRoute, POST as akunBuatRoute } from '../src/app/api/admin/akun/route';
import { GET as akunIdRoute, PUT as akunUbahRoute } from '../src/app/api/admin/akun/[id]/route';
import { POST as akunResetRoute } from '../src/app/api/admin/akun/[id]/reset/route';
import { POST as bukaKunciRoute } from '../src/app/api/admin/akun/buka-kunci/route';
import { POST as koreksiRoute } from '../src/app/api/admin/koreksi/route';

import { GET as tokoRoute, POST as tokoBuatRoute } from '../src/app/api/admin/master/toko/route';
import { GET as tokoIdRoute, PUT as tokoUbahRoute } from '../src/app/api/admin/master/toko/[id]/route';
import { GET as shiftRoute, POST as shiftBuatRoute } from '../src/app/api/admin/master/shift/route';
import { GET as shiftIdRoute, PUT as shiftUbahRoute } from '../src/app/api/admin/master/shift/[id]/route';
import { GET as karyawanRoute, POST as karyawanBuatRoute } from '../src/app/api/admin/master/karyawan/route';
import { GET as karyawanIdRoute, PUT as karyawanUbahRoute } from '../src/app/api/admin/master/karyawan/[id]/route';
import { GET as linkRoute, POST as linkBuatRoute } from '../src/app/api/admin/master/link/route';
import { POST as linkBuatUlangRoute } from '../src/app/api/admin/master/link/buat-ulang/route';
import { POST as linkCabutRoute } from '../src/app/api/admin/master/link/cabut/route';
import { GET as penempatanRoute, POST as penempatanBuatRoute } from '../src/app/api/admin/master/penempatan/route';

import { GET as pengaturanRoute, PUT as pengaturanUbahRoute } from '../src/app/api/admin/pengaturan/route';
import { GET as tidakBerangkatRoute, POST as tidakBerangkatBuatRoute } from '../src/app/api/admin/tidak-berangkat/route';
import { PUT as tidakBerangkatUbahRoute, DELETE as tidakBerangkatHapusRoute } from '../src/app/api/admin/tidak-berangkat/[id]/route';
import { GET as verifikasiRoute } from '../src/app/api/admin/verifikasi/route';
import { POST as verifikasiIdRoute } from '../src/app/api/admin/verifikasi/[id]/route';
import { POST as verifikasiMassalRoute } from '../src/app/api/admin/verifikasi/massal/route';
import { GET as verifikasiPilihanRoute } from '../src/app/api/admin/verifikasi/pilihan/route';
import { GET as jadwalRoute, POST as jadwalBuatRoute } from '../src/app/api/admin/jadwal/route';
import { GET as jadwalPilihanRoute } from '../src/app/api/admin/jadwal/pilihan/route';
import { POST as jadwalMassalRoute } from '../src/app/api/admin/jadwal/massal/route';
import { POST as jadwalOverrideRoute } from '../src/app/api/admin/jadwal/override/route';

const APP_ORIGIN = process.env['APP_ORIGIN'] as string;

/** Semua route memakai guard()/guardTanpaSesi() yang mengembalikan handler berparameter `req` saja. */
type Handler = (req: NextRequest) => Promise<Response>;

interface DaftarRoute {
  nama: string;
  metode: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  panggil: Handler;
}

/** Route yang memakai guard(fitur, ...) — butuh sesi admin. */
const ROUTE_GUARD: DaftarRoute[] = [
  { nama: 'GET  /api/admin/test', metode: 'GET', url: '/api/admin/test', panggil: adminTestRoute },
  { nama: 'GET  /api/admin/rekap', metode: 'GET', url: '/api/admin/rekap', panggil: rekapRoute },
  { nama: 'POST /api/admin/rekap/periksa', metode: 'POST', url: '/api/admin/rekap/periksa', panggil: rekapPeriksaRoute },
  { nama: 'POST /api/admin/rekap/ekspor', metode: 'POST', url: '/api/admin/rekap/ekspor', panggil: rekapEksporRoute },
  { nama: 'GET  /api/admin/dashboard', metode: 'GET', url: '/api/admin/dashboard', panggil: dashboardRoute },
  { nama: 'POST /api/admin/ubah-password', metode: 'POST', url: '/api/admin/ubah-password', panggil: ubahPasswordRoute },

  { nama: 'GET  /api/admin/akun', metode: 'GET', url: '/api/admin/akun', panggil: akunRoute },
  { nama: 'POST /api/admin/akun', metode: 'POST', url: '/api/admin/akun', panggil: akunBuatRoute },
  { nama: 'GET  /api/admin/akun/1', metode: 'GET', url: '/api/admin/akun/1', panggil: akunIdRoute },
  { nama: 'PUT  /api/admin/akun/1', metode: 'PUT', url: '/api/admin/akun/1', panggil: akunUbahRoute },
  { nama: 'POST /api/admin/akun/1/reset', metode: 'POST', url: '/api/admin/akun/1/reset', panggil: akunResetRoute },
  { nama: 'POST /api/admin/akun/buka-kunci', metode: 'POST', url: '/api/admin/akun/buka-kunci', panggil: bukaKunciRoute },

  { nama: 'POST /api/admin/koreksi', metode: 'POST', url: '/api/admin/koreksi', panggil: koreksiRoute },

  { nama: 'GET  /api/admin/master/toko', metode: 'GET', url: '/api/admin/master/toko', panggil: tokoRoute },
  { nama: 'POST /api/admin/master/toko', metode: 'POST', url: '/api/admin/master/toko', panggil: tokoBuatRoute },
  { nama: 'GET  /api/admin/master/toko/1', metode: 'GET', url: '/api/admin/master/toko/1', panggil: tokoIdRoute },
  { nama: 'PUT  /api/admin/master/toko/1', metode: 'PUT', url: '/api/admin/master/toko/1', panggil: tokoUbahRoute },
  { nama: 'GET  /api/admin/master/shift', metode: 'GET', url: '/api/admin/master/shift', panggil: shiftRoute },
  { nama: 'POST /api/admin/master/shift', metode: 'POST', url: '/api/admin/master/shift', panggil: shiftBuatRoute },
  { nama: 'GET  /api/admin/master/shift/1', metode: 'GET', url: '/api/admin/master/shift/1', panggil: shiftIdRoute },
  { nama: 'PUT  /api/admin/master/shift/1', metode: 'PUT', url: '/api/admin/master/shift/1', panggil: shiftUbahRoute },
  { nama: 'GET  /api/admin/master/karyawan', metode: 'GET', url: '/api/admin/master/karyawan', panggil: karyawanRoute },
  { nama: 'POST /api/admin/master/karyawan', metode: 'POST', url: '/api/admin/master/karyawan', panggil: karyawanBuatRoute },
  { nama: 'GET  /api/admin/master/karyawan/1', metode: 'GET', url: '/api/admin/master/karyawan/1', panggil: karyawanIdRoute },
  { nama: 'PUT  /api/admin/master/karyawan/1', metode: 'PUT', url: '/api/admin/master/karyawan/1', panggil: karyawanUbahRoute },
  { nama: 'GET  /api/admin/master/link', metode: 'GET', url: '/api/admin/master/link', panggil: linkRoute },
  { nama: 'POST /api/admin/master/link', metode: 'POST', url: '/api/admin/master/link', panggil: linkBuatRoute },
  { nama: 'POST /api/admin/master/link/buat-ulang', metode: 'POST', url: '/api/admin/master/link/buat-ulang', panggil: linkBuatUlangRoute },
  { nama: 'POST /api/admin/master/link/cabut', metode: 'POST', url: '/api/admin/master/link/cabut', panggil: linkCabutRoute },
  { nama: 'GET  /api/admin/master/penempatan', metode: 'GET', url: '/api/admin/master/penempatan', panggil: penempatanRoute },
  { nama: 'POST /api/admin/master/penempatan', metode: 'POST', url: '/api/admin/master/penempatan', panggil: penempatanBuatRoute },

  { nama: 'GET  /api/admin/pengaturan', metode: 'GET', url: '/api/admin/pengaturan', panggil: pengaturanRoute },
  { nama: 'PUT  /api/admin/pengaturan', metode: 'PUT', url: '/api/admin/pengaturan', panggil: pengaturanUbahRoute },

  { nama: 'GET  /api/admin/tidak-berangkat', metode: 'GET', url: '/api/admin/tidak-berangkat', panggil: tidakBerangkatRoute },
  { nama: 'POST /api/admin/tidak-berangkat', metode: 'POST', url: '/api/admin/tidak-berangkat', panggil: tidakBerangkatBuatRoute },
  { nama: 'PUT  /api/admin/tidak-berangkat/1', metode: 'PUT', url: '/api/admin/tidak-berangkat/1', panggil: tidakBerangkatUbahRoute },
  { nama: 'DELETE /api/admin/tidak-berangkat/1', metode: 'DELETE', url: '/api/admin/tidak-berangkat/1', panggil: tidakBerangkatHapusRoute },

  { nama: 'GET  /api/admin/verifikasi', metode: 'GET', url: '/api/admin/verifikasi', panggil: verifikasiRoute },
  { nama: 'GET  /api/admin/verifikasi/pilihan', metode: 'GET', url: '/api/admin/verifikasi/pilihan', panggil: verifikasiPilihanRoute },
  { nama: 'POST /api/admin/verifikasi/1', metode: 'POST', url: '/api/admin/verifikasi/1', panggil: verifikasiIdRoute },
  { nama: 'POST /api/admin/verifikasi/massal', metode: 'POST', url: '/api/admin/verifikasi/massal', panggil: verifikasiMassalRoute },

  { nama: 'GET  /api/admin/jadwal', metode: 'GET', url: '/api/admin/jadwal', panggil: jadwalRoute },
  { nama: 'POST /api/admin/jadwal', metode: 'POST', url: '/api/admin/jadwal', panggil: jadwalBuatRoute },
  { nama: 'GET  /api/admin/jadwal/pilihan', metode: 'GET', url: '/api/admin/jadwal/pilihan', panggil: jadwalPilihanRoute },
  { nama: 'POST /api/admin/jadwal/massal', metode: 'POST', url: '/api/admin/jadwal/massal', panggil: jadwalMassalRoute },
  { nama: 'POST /api/admin/jadwal/override', metode: 'POST', url: '/api/admin/jadwal/override', panggil: jadwalOverrideRoute },

  { nama: 'GET  /api/foto/1', metode: 'GET', url: '/api/foto/1', panggil: fotoRoute },
];

/** Route publik: Origin tetap wajib, sesi tidak. */
const ROUTE_PUBLIK: DaftarRoute[] = [
  { nama: 'POST /api/logout', metode: 'POST', url: '/api/logout', panggil: logoutRoute },
  { nama: 'GET  /api/absen/info', metode: 'GET', url: '/api/absen/info', panggil: absenInfoRoute },
  { nama: 'POST /api/absen', metode: 'POST', url: '/api/absen', panggil: absenRoute },
];

function buatRequest(r: DaftarRoute, origin: string | null): NextRequest {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new NextRequest(`${APP_ORIGIN}${r.url}`, { method: r.metode, headers });
}

async function json(res: Response): Promise<{ kode: string; pesan: string }> {
  return (await res.json()) as { kode: string; pesan: string };
}

describe('Origin diperiksa di SEMUA route, lewat perilaku', () => {
  it('daftar route menutup semua file route.ts yang ada di src/app/api', async () => {
    // Pagar anti-lupa. Kalau M5+ menambah route baru dan tidak mendaftarkannya di
    // sini, tes INI yang gagal — bukan diam-diam lolos tanpa pemeriksaan Origin.
    const { readdir } = await import('node:fs/promises');
    const semua = await readdir(`${process.cwd()}/src/app/api`, { recursive: true, encoding: 'utf8' });
    // readdir di src/app/api -> "absen/info/route.ts". Bandingkan dalam bentuk
    // yang sama dengan daftar route: "absen/info".
    const files = semua
      .filter((f) => f.endsWith('route.ts'))
      .map((f) => f.replace(/\\/g, '/').replace(/\/?route\.ts$/, '').replace(/\[[^\]]+\]/g, '1'));

    const terdaftar = new Set(
      [...ROUTE_GUARD, ...ROUTE_PUBLIK].map((r) =>
        r.nama.replace(/^(GET|POST|PUT|DELETE)\s+/, '').replace(/^\/api\//, '').replace(/\/$/, ''),
      ),
    );
    const belum: string[] = [];
    for (const f of files.sort()) {
      if (f === 'login') continue; // punya pemeriksaan Origin manual, diuji terpisah
      if (terdaftar.has(f)) continue;
      belum.push(f);
    }
    expect(belum, 'route yang belum diuji Origin-nya').toEqual([]);
    expect(files.length, 'route.ts yang ditemukan; login diuji terpisah').toBeGreaterThanOrEqual(27);
  });

  for (const r of ROUTE_GUARD) {
    // BUG-UI-05: browser TIDAK mengirim Origin pada request same-origin GET/HEAD.
    // rules/03 §9.4 menulis "cek Origin PADA MUTASI", jadi Origin kosong pada
    // GET/HEAD tidak lagi ditolak — request lanjut ke pemeriksaan sesi (401).
    // TES INI SEBELUMNYA MENYATAKAN LAIN (403), yaitu mengodifikasi bug itu:
    // seluruh UI admin tidak pernah bisa dipakai di browser.
    it(`${r.nama}: Origin kosong -> ${r.metode === 'GET' ? 'lanjut lalu 401 TANPA_SESI' : 'DITOLAK 403 (mutasi wajib Origin)'}`, async () => {
      // BUG-UI-05. Aturannya (rules/03 §9.4) adalah "cek Origin PADA MUTASI":
      //   - GET/HEAD: browser same-origin TIDAK mengirim Origin, jadi Origin kosong
      //     DITERIMA dan request lanjut ke pemeriksaan sesi (401 tanpa cookie).
      //     Tes ini SEBELUMNYA menuntut 403 untuk semua metode — itu mengodifikasi
      //     bug yang membuat seluruh UI admin tidak bisa dipakai di browser.
      //   - POST/PUT/PATCH/DELETE: Origin WAJIB ada dan harus cocok. Tidak ada
      //     pengecualian, dan inilah proteksi CSRF yang sesungguhnya.
      const res = await r.panggil(buatRequest(r, null));
      if (r.metode === 'GET') {
        expect(res.status, `${r.nama} GET tanpa Origin`).toBe(401);
        expect((await json(res)).kode, r.nama).toBe('TANPA_SESI');
      } else {
        expect(res.status, `${r.nama} ${r.metode} tanpa Origin`).toBe(403);
        expect((await json(res)).kode, r.nama).toBe('ORIGIN_TIDAK_VALID');
      }
    });

    it(`${r.nama}: Origin berawalan sama DITOLAK 403`, async () => {
      const res = await r.panggil(buatRequest(r, `${APP_ORIGIN}.penyerang.com`));
      expect(res.status, `${r.nama} dengan Origin palsu`).toBe(403);
      expect((await json(res)).kode, r.nama).toBe('ORIGIN_TIDAK_VALID');
    });

    it(`${r.nama}: Origin benar tanpa sesi -> 401 TANPA_SESI (bukan 500)`, async () => {
      // Bukti dua sisi: Origin yang benar LOLOS, lalu pemeriksaan sesi yang menolak.
      // Tanpa tes ini, 403 di atas bisa muncul karena apa pun (mis. handler rusak).
      const res = await r.panggil(buatRequest(r, APP_ORIGIN));
      expect(res.status, `${r.nama} Origin benar tanpa sesi`).toBe(401);
      expect((await json(res)).kode, r.nama).toBe('TANPA_SESI');
    });
  }

  for (const r of ROUTE_PUBLIK) {
    it(`${r.nama}: Origin kosong -> ${r.metode === 'GET' ? 'lanjut (bukan 403)' : 'DITOLAK 403 (mutasi wajib Origin)'}`, async () => {
      // Sama seperti route terlindungi: hanya GET/HEAD yang boleh lanjut tanpa
      // Origin. POST (logout, absen) tetap 403 — semuanya mutasi.
      const res = await r.panggil(buatRequest(r, null));
      if (r.metode === 'GET') {
        expect(res.status, `${r.nama} GET tanpa Origin`).not.toBe(403);
      } else {
        expect(res.status, `${r.nama} ${r.metode} tanpa Origin`).toBe(403);
        expect((await json(res)).kode, r.nama).toBe('ORIGIN_TIDAK_VALID');
      }
    });

    it(`${r.nama}: Origin berawalan sama DITOLAK 403`, async () => {
      const res = await r.panggil(buatRequest(r, `${APP_ORIGIN}.penyerang.com`));
      expect(res.status, `${r.nama} dengan Origin palsu`).toBe(403);
      expect((await json(res)).kode, r.nama).toBe('ORIGIN_TIDAK_VALID');
    });
  }

  it('POST /api/login: Origin salah ditolak TETAPI pesan tetap generik', async () => {
    // Login punya penyimpangan disengaja: Origin diperiksa manual, bukan lewat guard,
    // supaya pesan gagalnya sama persis dengan kegagalan kredensial (BR-AUTH).
    const res = await loginRoute(buatRequest({ nama: 'x', metode: 'POST', url: '/api/login', panggil: loginRoute }, `${APP_ORIGIN}.penyerang.com`));
    expect(res.status).toBe(403);
    expect((await json(res)).pesan).toBe('Username atau password salah.');
  });

  it('POST /api/login: Origin kosong juga ditolak 403', async () => {
    const res = await loginRoute(buatRequest({ nama: 'x', metode: 'POST', url: '/api/login', panggil: loginRoute }, null));
    expect(res.status).toBe(403);
    expect((await json(res)).pesan).toBe('Username atau password salah.');
  });
});
