process.loadEnvFile('.env.local');
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getDb } from '../src/server/db';
import { hashPassword } from '../src/server/auth';
import { POST as loginRoute } from '../src/app/api/login/route';
import { GET as adminTestRoute } from '../src/app/api/admin/test/route';
import { POST as ubahPasswordRoute } from '../src/app/api/admin/ubah-password/route';
import * as fs from 'fs';
import { execSync } from 'child_process';

const DB_PATH = 'data/uji_route.db';
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'https://arsaba.vercel.app';

function req(
  url: string,
  opsi: { method?: string; body?: FormData; cookie?: string; origin?: string | null } = {},
) {
  const headers = new Headers();
  // origin: null berarti header sengaja TIDAK dikirim (meniru curl/alat server-side)
  if (opsi.origin !== null) headers.set('origin', opsi.origin ?? APP_ORIGIN);
  if (opsi.cookie) headers.set('cookie', `sesi=${opsi.cookie}`);
  return new NextRequest(`https://arsaba.vercel.app${url}`, {
    method: opsi.method ?? 'GET',
    headers,
    body: opsi.body,
  });
}

function formLogin(username: string, password: string) {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('password', password);
  return fd;
}

async function cookieDari(res: Response): Promise<string> {
  const setCookie = res.headers.get('set-cookie') || '';
  const cocok = /sesi=([^;]+)/.exec(setCookie);
  if (!cocok) throw new Error('Header set-cookie tidak memuat sesi: ' + setCookie);
  return cocok[1]!;
}

describe('route HTTP end-to-end (M1 perbaikan)', () => {
  beforeAll(async () => {
    process.env['TURSO_DATABASE_URL'] = `file:./${DB_PATH}`;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    execSync('npx tsx scripts/migrate.ts', { stdio: 'inherit' });
    execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  }, 120_000);

  afterAll(async () => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  // ---------------------------------------------------------------------
  // Poin [1] — cookie harus id sesi mentah, bukan hash-nya (BR-AUTH1)
  // ---------------------------------------------------------------------
  it('LOGIN: cookie berisi id sesi mentah, database berisi sha256-nya', async () => {
    const res = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234') }));
    expect(res.status).toBe(200);

    const cookie = await cookieDari(res);
    const db = getDb();
    const semua = await db.execute({ sql: 'SELECT id_hash FROM sesi_admin', args: [] });
    const hashes: string[] = semua.rows.map((r) => String((r as Record<string, unknown>)['id_hash']));

    // Nilai cookie HARUS ada di database sebagai hasil sha256, BUKAN sebagai nilai mentah.
    const hashDariCookie = createHash('sha256').update(cookie).digest('base64url');
    expect(hashes).toContain(hashDariCookie);
    expect(hashes).not.toContain(cookie);
  });

  it('LOGIN: cookie dari route login bisa dipakai di endpoint terproteksi (regresi utama)', async () => {
    const login = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234') }));
    const cookie = await cookieDari(login);

    // Inilah yang gagal sebelum perbaikan: hash masuk cookie, jadi getSession
    // menghash dua kali dan selalu mengembalikan null.
    const akses = await adminTestRoute(req('/api/admin/test', { cookie }));
    expect(akses.status).toBe(200);
    const body = await akses.json();
    expect(body.kode).toBe('OK');
  });

  it('LOGIN: cookie hash yang dipalsukan tidak bisa dipakai', async () => {
    const login = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234') }));
    const cookie = await cookieDari(login);
    const hashCurian = createHash('sha256').update(cookie).digest('base64url');

    // Nilai yang tersimpan di DB harus TIDAK langsung berlaku sebagai cookie.
    const akses = await adminTestRoute(req('/api/admin/test', { cookie: hashCurian }));
    expect(akses.status).toBe(401);
  });

  // ---------------------------------------------------------------------
  // Poin [5] — Origin diperiksa sungguhan, bukan dibaca dari teks file
  // ---------------------------------------------------------------------
  it('LOGIN: Origin ditolak saat hilang, salah, atau berawalan sama', async () => {
    const tidakAda = await loginRoute(
      req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234'), origin: null }),
    );
    expect(tidakAda.status).toBe(403);

    const pencetus = await loginRoute(
      req('/api/login', {
        method: 'POST',
        body: formLogin('superadmin', 'test1234'),
        origin: `${APP_ORIGIN}.penyerang.com`,
      }),
    );
    expect(pencetus.status).toBe(403);

    const http = await loginRoute(
      req('/api/login', {
        method: 'POST',
        body: formLogin('superadmin', 'test1234'),
        origin: APP_ORIGIN.replace('https://', 'http://'),
      }),
    );
    expect(http.status).toBe(403);

    const benar = await loginRoute(
      req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234'), origin: APP_ORIGIN }),
    );
    expect(benar.status).toBe(200);
  });

  it('LOGIN: password salah tetap 401, username tak dikenal juga 401 (pesan sama)', async () => {
    const salah = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('superadmin', 'salahbanget') }));
    const takAda = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('entahsiapa', 'apa saja') }));

    expect(salah.status).toBe(401);
    expect(takAda.status).toBe(401);
    // BR-AUTH: jangan bocorkan mana yang salah lewat pesan berbeda.
    expect((await salah.json()).pesan).toBe((await takAda.json()).pesan);
  });

  // ---------------------------------------------------------------------
  // Poin [6] — password tidak boleh di-trim()
  // ---------------------------------------------------------------------
  it('LOGIN: password ber-spasi depan/belakang dipakai apa adanya', async () => {
    const db = getDb();
    const passwordBerspasi = '  test1234  ';
    await db.execute({
      sql: 'UPDATE pengguna_admin SET password_hash = ? WHERE username = ?',
      args: [hashPassword(passwordBerspasi).combined, 'superadmin'],
    });

    const denganSpasi = await loginRoute(
      req('/api/login', { method: 'POST', body: formLogin('superadmin', passwordBerspasi) }),
    );
    expect(denganSpasi.status).toBe(200);

    // Tanpa spasi harus GAGAL — membuktikan trim() benar-benar dihapus.
    const tanpaSpasi = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('superadmin', 'test1234') }));
    expect(tanpaSpasi.status).toBe(401);

    // Kembalikan agar tes lain tidak bergantung pada urutan.
    await db.execute({
      sql: 'UPDATE pengguna_admin SET password_hash = ? WHERE username = ?',
      args: [hashPassword('test1234').combined, 'superadmin'],
    });
  });

  // ---------------------------------------------------------------------
  // Poin [8] — ganti password (K-47, K-48) dan pembatalan sesi
  // ---------------------------------------------------------------------
  it('UBAH PASSWORD: mengganti password membatalkan seluruh sesi', async () => {
    const login1 = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'test1234') }));
    const cookie1 = await cookieDari(login1);
    const login2 = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'test1234') }));
    const cookie2 = await cookieDari(login2);
    expect(cookie1).not.toBe(cookie2);

    const fd = new FormData();
    fd.set('passwordSaatIni', 'test1234');
    fd.set('passwordBaru', 'passwordbaru123');
    fd.set('konfirmasi', 'passwordbaru123');
    const ganti = await ubahPasswordRoute(req('/api/admin/ubah-password', { method: 'POST', body: fd, cookie: cookie1 }));
    expect(ganti.status).toBe(200);

    // Kedua sesi lama harus mati.
    expect((await adminTestRoute(req('/api/admin/test', { cookie: cookie1 }))).status).toBe(401);
    expect((await adminTestRoute(req('/api/admin/test', { cookie: cookie2 }))).status).toBe(401);

    // Password baru berlaku, password lama tidak.
    expect(
      (await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'test1234') }))).status,
    ).toBe(401);
    expect(
      (await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'passwordbaru123') }))).status,
    ).toBe(200);

    // Kembalikan password admin.
    const db = getDb();
    await db.execute({
      sql: 'UPDATE pengguna_admin SET password_hash = ? WHERE username = ?',
      args: [hashPassword('test1234').combined, 'admin'],
    });
  });

  it('UBAH PASSWORD: ditolak saat password lama salah, baru < 8 karakter, atau konfirmasi beda', async () => {
    const login = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'test1234') }));
    const cookie = await cookieDari(login);

    const salah = new FormData();
    salah.set('passwordSaatIni', 'bukan-password-ini');
    salah.set('passwordBaru', 'passwordbaru123');
    salah.set('konfirmasi', 'passwordbaru123');
    expect((await ubahPasswordRoute(req('/api/admin/ubah-password', { method: 'POST', body: salah, cookie }))).status).toBe(401);

    const pendek = new FormData();
    pendek.set('passwordSaatIni', 'test1234');
    pendek.set('passwordBaru', 'pendek');
    pendek.set('konfirmasi', 'pendek');
    expect((await ubahPasswordRoute(req('/api/admin/ubah-password', { method: 'POST', body: pendek, cookie }))).status).toBe(400);

    const beda = new FormData();
    beda.set('passwordSaatIni', 'test1234');
    beda.set('passwordBaru', 'passwordbaru123');
    beda.set('konfirmasi', 'passwordbeda456');
    expect((await ubahPasswordRoute(req('/api/admin/ubah-password', { method: 'POST', body: beda, cookie }))).status).toBe(400);
  });

  it('UBAH PASSWORD:Origin salah ditolak sebelum menyentuh sesi', async () => {
    const login = await loginRoute(req('/api/login', { method: 'POST', body: formLogin('admin', 'test1234') }));
    const cookie = await cookieDari(login);

    const fd = new FormData();
    fd.set('passwordSaatIni', 'test1234');
    fd.set('passwordBaru', 'passwordbaru123');
    fd.set('konfirmasi', 'passwordbaru123');
    const tolak = await ubahPasswordRoute(
      req('/api/admin/ubah-password', {
        method: 'POST',
        body: fd,
        cookie,
        origin: `${APP_ORIGIN}.penyerang.com`,
      }),
    );
    expect(tolak.status).toBe(403);
  });
});
