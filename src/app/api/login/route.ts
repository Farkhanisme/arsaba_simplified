import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../server/db';
import { hashPassword, verifyPassword, createSession, checkLoginAttempts, recordLoginAttempt } from '../../../server/auth';
import { catatAudit } from '../../../server/audit';
import { serialisasiWIB } from '../../../server/waktu';

export async function POST(req: NextRequest) {
  try {
    // Origin diperiksa LEBIH DAHULU, sebelum parsing input (rules/03 §9.4).
    //
    // Route ini sengaja TIDAK memakai guardTanpaSesi: pesan Origin yang gagal di sini
    // harus tetap "Username atau password salah.", sama seperti semua kegagalan lain,
    // supaya penyerang tidak bisa membedakan login ditolak karena Origin dengan
    // ditolak karena kredensial (BR-AUTH).
    const origin = req.headers.get('origin') || '';
    const appOrigin = process.env['APP_ORIGIN'] || '';
    if (appOrigin && origin !== appOrigin) {
      return NextResponse.json({ kode: 'ORIGIN_TIDAK_VALID', pesan: 'Username atau password salah.' }, { status: 403 });
    }

    const formData = await req.formData();
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '');

    if (!username || !password) {
      return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Username atau password salah.' }, { status: 400 });
    }

    const db = getDb();
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const ipStr = Array.isArray(ipHeader) ? ipHeader[0] : String(ipHeader);

    const { blocked } = await checkLoginAttempts(username, ipStr);
    if (blocked) {
      await recordLoginAttempt(username, ipStr, false);
      await catatAudit({
        waktu: serialisasiWIB(),
        pengguna_id: null as any,
        aksi: 'LOGIN_GAGAL',
        entitas: 'pengguna_admin',
        entitas_id: null as any,
        sebelum: JSON.stringify({ username }),
        sesudah: JSON.stringify({ alasan: 'Terlalu banyak percobaan' }),
        catatan: `IP: ${ipStr}`,
      });
      return NextResponse.json({ kode: 'LOGIN_DIBLOKIR', pesan: 'Username atau password salah.' }, { status: 429 });
    }

    const userRes = await db.execute({
      sql: 'SELECT id, username, password_hash, nama, peran, aktif FROM pengguna_admin WHERE username = ?',
      args: [username],
    });

    const userRow = userRes.rows[0] as Record<string, unknown> | undefined;

    if (!userRow) {
      await recordLoginAttempt(username, ipStr, false);
      await catatAudit({
        waktu: serialisasiWIB(),
        pengguna_id: null as any,
        aksi: 'LOGIN_GAGAL',
        entitas: 'pengguna_admin',
        entitas_id: null as any,
        sebelum: JSON.stringify({ username }),
        sesudah: JSON.stringify({ alasan: 'Username tidak ditemukan' }),
        catatan: `IP: ${ipStr}`,
      });
      return NextResponse.json({ kode: 'LOGIN_GAGAL', pesan: 'Username atau password salah.' }, { status: 401 });
    }

    const userId = Number(userRow['id']);
    const aktif = Number(userRow['aktif']);
    const peran = String(userRow['peran']);
    const combinedHash = String(userRow['password_hash']);

    if (aktif !== 1) {
      await recordLoginAttempt(username, ipStr, false);
      await catatAudit({
        waktu: serialisasiWIB(),
        pengguna_id: userId,
        aksi: 'LOGIN_GAGAL',
        entitas: 'pengguna_admin',
        entitas_id: userId,
        sebelum: JSON.stringify({ username, aktif }),
        sesudah: JSON.stringify({ alasan: 'Akun tidak aktif' }),
        catatan: `IP: ${ipStr}`,
      });
      return NextResponse.json({ kode: 'LOGIN_GAGAL', pesan: 'Username atau password salah.' }, { status: 401 });
    }

    const valid = verifyPassword(password, combinedHash);
    if (!valid) {
      await recordLoginAttempt(username, ipStr, false);
      await catatAudit({
        waktu: serialisasiWIB(),
        pengguna_id: userId,
        aksi: 'LOGIN_GAGAL',
        entitas: 'pengguna_admin',
        entitas_id: userId,
        sebelum: JSON.stringify({ username }),
        sesudah: JSON.stringify({ alasan: 'Password salah' }),
        catatan: `IP: ${ipStr}`,
      });
      return NextResponse.json({ kode: 'LOGIN_GAGAL', pesan: 'Username atau password salah.' }, { status: 401 });
    }

    const { raw: idSesi, kedaluwarsa_at } = await createSession(userId);

    await recordLoginAttempt(username, ipStr, true);
    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: userId,
      aksi: 'LOGIN_BERHASIL',
      entitas: 'pengguna_admin',
      entitas_id: userId,
      sebelum: JSON.stringify({ username }),
      sesudah: JSON.stringify({ kedaluwarsa_at }),
      catatan: `IP: ${ipStr}`,
    });

    const response = NextResponse.json({ kode: 'LOGIN_BERHASIL', pesan: 'Masuk berhasil.' });
    // Cookie memuat id sesi MENTAH. Yang tersimpan di database adalah sha256(id_sesi).
    // Kalau cookie diisi hash-nya, getSession akan menghash dua kali dan selalu gagal (BR-AUTH1).
    response.cookies.set('sesi', idSesi, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (e) {
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
}
