import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guardTanpaSesi } from '../../../../server/guard';
import { serialisasiWIB } from '../../../../server/waktu';
import { resolveLinkAktif } from '../../../../server/repo/absensi';
import { denganTransaksiBuatAgenda, GalatAgendaPribadi, type InputBuatPribadi } from '../../../../server/repo/agenda-pribadi';

/**
 * POST /api/agenda/buat (M12) — karyawan membuat agenda untuk dirinya sendiri.
 *
 * Bentuknya SEPERTI agenda admin: langsung menyimpan judul + keterangan sebagai
 * agenda berstatus AKTIF, bukan draft. Yang berbeda hanya sisanya:
 *   - tidak ada pilihan wajib-foto (K-59: agenda pribadi selalu wajib foto),
 *   - penerima adalah dirinya sendiri (BR-G3), jadi tanpa `agenda_tujuan`,
 *   - `target_tanggal` TIDAK diterima — tidak ada keputusan pemilik yang
 *     memberi karyawan kolom ini, jadi tidak dikarang di sini.
 *
 * Setelah agenda tersimpan, karyawan memakai endpoint `/api/agenda/laporan`
 * dengan `tahap = DRAFT` untuk mengunggah foto before seperti biasa. Jadi
 * "buat agenda" dan "mulai mengerjakan" tetap dua langkah yang terlihat berbeda
 * di layar.
 */

const PESAN_LINK = 'Link tidak berlaku. Hubungi admin.';

const SkemaBuat = z.object({
  token: z.string().min(1, PESAN_LINK),
  judul: z.string().min(1, 'Judul agenda wajib diisi.').max(120, 'Judul maksimal 120 karakter.'),
  keterangan: z.string().max(500, 'Keterangan maksimal 500 karakter.').optional(),
});

export const POST = guardTanpaSesi(async (req: NextRequest) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaBuat.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const karyawan = await resolveLinkAktif(parsed.data.token, db);
    if (!karyawan) {
      return NextResponse.json({ kode: 'LINK_TIDAK_BERLAKU', pesan: PESAN_LINK }, { status: 404 });
    }

    const input: InputBuatPribadi = {
      judul: parsed.data.judul,
      keterangan: parsed.data.keterangan,
      karyawanId: karyawan.karyawan_id,
    };
    const id = await denganTransaksi(async (tx) => denganTransaksiBuatAgenda(input, tx));
    return NextResponse.json(
      {
        kode: 'AGENDA_DISIMPAN',
        pesan: 'Agenda tersimpan. Ambil foto before untuk memulai.',
        data: { id, dibuat_at: serialisasiWIB() },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof GalatAgendaPribadi) {
      const kode = e.status === 404 ? 'TIDAK_DITEMUKAN' : 'AGENDA_DITOLAK';
      return NextResponse.json({ kode, pesan: e.message }, { status: e.status });
    }
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) {
      return NextResponse.json({ kode: 'KEADAAN_BERUBAH', pesan: 'Data berubah. Halaman dimuat ulang.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});