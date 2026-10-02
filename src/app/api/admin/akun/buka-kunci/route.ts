import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../server/db';
import { bukaKunciUsername } from '../../../../../server/auth';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { guard } from '../../../../../server/guard';

/**
 * Membuka kunci akun admin yang terkunci karena melewati batas percobaan login (K-46).
 * Hanya SUPER_ADMIN — dicek lewat guard('master_akun', ...).
 *
 * Endpoint ini menyediakan kemampuan; tombolnya belum ada karena halaman "Akun Admin"
 * adalah bagian M2 (rules/05 §5.8).
 */
export const POST = guard('master_akun', async (req: NextRequest, ctx) => {
  const formData = await req.formData();
  const username = String(formData.get('username') || '').trim();
  if (!username) {
    return NextResponse.json({ kode: 'INPUT_KOSONG', pesan: 'Username wajib diisi.' }, { status: 400 });
  }

  const db = getDb();
  const target = await db.execute({
    sql: 'SELECT id FROM pengguna_admin WHERE username = ?',
    args: [username],
  });
  const row = target.rows[0] as Record<string, unknown> | undefined;
  // Tolak username fiktif — jangan melaporkan "terbuka" untuk akun yang tidak ada.
  if (!row) {
    return NextResponse.json({ kode: 'PENGGUNA_TIDAK_DITEMUKAN', pesan: 'Pengguna tidak ditemukan.' }, { status: 404 });
  }

  const targetId = Number(row['id']);
  const jumlahDihapus = await bukaKunciUsername(username);

  await catatAudit({
    waktu: serialisasiWIB(),
    pengguna_id: ctx.pengguna_id,
    aksi: 'BUKA_KUNCI_AKUN',
    entitas: 'pengguna_admin',
    entitas_id: targetId,
    sesudah: JSON.stringify({ username, percobaan_gagal_dihapus: jumlahDihapus }),
    catatan: `Dibuka oleh ${ctx.username} (${ctx.peran})`,
  });

  return NextResponse.json({
    kode: 'KUNCI_DIBUKA',
    pesan: jumlahDihapus > 0
      ? `Kunci akun ${username} dibuka.`
      : `Tidak ada percobaan gagal yang tercatat untuk ${username}.`,
    jumlahDihapus,
  });
});
