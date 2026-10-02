import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../server/db';
import { hashPassword, verifyPassword } from '../../../../server/auth';
import { catatAudit } from '../../../../server/audit';
import { serialisasiWIB } from '../../../../server/waktu';
import { guard } from '../../../../server/guard';

export const POST = guard('dashboard', async (req: NextRequest, ctx) => {
  // BR-AUTH5: password TIDAK boleh di-trim(). Spasi di awal/akhir bagian dari password.
  const formData = await req.formData();
  const passwordSaatIni = String(formData.get('passwordSaatIni') ?? '');
  const passwordBaru = String(formData.get('passwordBaru') ?? '');
  const konfirmasi = String(formData.get('konfirmasi') ?? '');

  if (!passwordSaatIni || !passwordBaru || !konfirmasi) {
    return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Semua kolom wajib diisi.' }, { status: 400 });
  }
  if (passwordBaru.length < 8) {
    return NextResponse.json({ kode: 'PASSWORD_PENDEK', pesan: 'Password baru minimal 8 karakter.' }, { status: 400 });
  }
  if (passwordBaru !== konfirmasi) {
    return NextResponse.json({ kode: 'KONFIRMASI_TIDAK_COCOK', pesan: 'Konfirmasi password tidak cocok.' }, { status: 400 });
  }

  const db = getDb();
  const userRes = await db.execute({
    sql: 'SELECT id, username, password_hash FROM pengguna_admin WHERE id = ?',
    args: [ctx.pengguna_id],
  });
  const userRow = userRes.rows[0] as Record<string, unknown> | undefined;
  if (!userRow) {
    return NextResponse.json({ kode: 'PENGGUNA_TIDAK_DITEMUKAN', pesan: 'Pengguna tidak ditemukan.' }, { status: 401 });
  }

  if (!verifyPassword(passwordSaatIni, String(userRow['password_hash']))) {
    await catatAudit({
      waktu: serialisasiWIB(),
      pengguna_id: ctx.pengguna_id,
      aksi: 'GANTI_PASSWORD_GAGAL',
      entitas: 'pengguna_admin',
      entitas_id: ctx.pengguna_id,
      sesudah: JSON.stringify({ alasan: 'Password saat ini salah' }),
      catatan: 'Percobaan ganti password gagal',
    });
    return NextResponse.json({ kode: 'GANTI_PASSWORD_GAGAL', pesan: 'Password saat ini salah.' }, { status: 401 });
  }

  await db.execute({
    sql: 'UPDATE pengguna_admin SET password_hash = ? WHERE id = ?',
    args: [hashPassword(passwordBaru).combined, ctx.pengguna_id],
  });

  // K-47: ganti password membatalkan SELURUH sesi akun ini, termasuk yang sedang dipakai.
  await db.execute({ sql: 'DELETE FROM sesi_admin WHERE pengguna_id = ?', args: [ctx.pengguna_id] });

  await catatAudit({
    waktu: serialisasiWIB(),
    pengguna_id: ctx.pengguna_id,
    aksi: 'GANTI_PASSWORD',
    entitas: 'pengguna_admin',
    entitas_id: ctx.pengguna_id,
    sesudah: JSON.stringify({ alasan: 'Password berhasil diubah' }),
    catatan: 'Seluruh sesi dibatalkan',
  });

  const response = NextResponse.json({
    kode: 'GANTI_PASSWORD_BERHASIL',
    pesan: 'Password berhasil diubah. Silakan login ulang.',
  });
  response.cookies.delete('sesi');
  return response;
});
