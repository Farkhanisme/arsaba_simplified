import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../../server/db';
import { guard } from '../../../../../server/guard';
import { catatAudit } from '../../../../../server/audit';
import { serialisasiWIB } from '../../../../../server/waktu';
import { buatTokenLink, urlUntukToken, linkAktif, buatLink } from '../../../../../server/repo/link';

const SkemaLink = z.object({
  karyawan_id: z.number({ required_error: 'Karyawan wajib dipilih.' }).int().positive('Karyawan wajib dipilih.'),
});

export const GET = guard('link_karyawan', async (req: NextRequest) => {
  const param = new URL(req.url).searchParams.get('karyawan_id');
  if (!param) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Parameter karyawan_id wajib diisi.' }, { status: 400 });
  }
  const karyawanId = Number(param);
  if (!Number.isInteger(karyawanId) || karyawanId <= 0) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Parameter karyawan_id tidak valid.' }, { status: 400 });
  }
  // Satu-satunya tempat token dikembalikan ke UI — hanya halaman Karyawan
  // yang menampilkannya (rules/05 §5.7). Bukan log (BR-LK3).
  const link = await linkAktif(karyawanId, getDb());
  if (!link) return NextResponse.json({ kode: 'OK', data: null });
  return NextResponse.json({
    kode: 'OK',
    data: { id: link.id, karyawan_id: link.karyawan_id, dibuat_at: link.dibuat_at, url: urlUntukToken(link.token) },
  });
});

export const POST = guard('link_karyawan', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaLink.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const dibuat = await denganTransaksi(async (tx) => {
      const waktu = serialisasiWIB();
      const link = await buatLink(parsed.data.karyawan_id, buatTokenLink(), ctx.pengguna_id, waktu, tx);
      // Audit SENGAJA tidak memuat token (BR-LK3).
      await catatAudit(
        {
          waktu,
          pengguna_id: ctx.pengguna_id,
          aksi: 'LINK_BUAT',
          entitas: 'karyawan_link',
          entitas_id: link.id,
          sesudah: JSON.stringify({ link_id: link.id, karyawan_id: link.karyawan_id, dibuat_at: link.dibuat_at }),
          catatan: `Link karyawan ${parsed.data.karyawan_id} dibuat oleh ${ctx.username}`,
        },
        tx,
      );
      return { id: link.id, karyawan_id: link.karyawan_id, dibuat_at: link.dibuat_at, url: urlUntukToken(link.token) };
    });
    return NextResponse.json({ kode: 'LINK_DIBUAT', pesan: 'Link berhasil dibuat.', data: dibuat }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /Karyawan tidak ditemukan/.test(e.message)) {
      return NextResponse.json({ kode: 'TIDAK_DITEMUKAN', pesan: 'Karyawan tidak ditemukan.' }, { status: 404 });
    }
    if (e instanceof Error && /masih memiliki link aktif/.test(e.message)) {
      return NextResponse.json({ kode: 'LINK_AKTIF_ADA', pesan: 'Karyawan masih memiliki link aktif. Gunakan Buat Ulang.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
