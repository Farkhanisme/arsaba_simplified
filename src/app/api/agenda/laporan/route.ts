import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../../server/db';
import { guardTanpaSesi } from '../../../../server/guard';
import { resolveLinkAktif } from '../../../../server/repo/absensi';
import {
  periksaDraft,
  periksaSubmit,
  simpanDraft,
  submitLaporan,
  GalatLaporan,
} from '../../../../server/repo/agenda-laporan';
import { kirimFotoKeTelegram } from '../../../../server/telegram';

/**
 * POST /api/agenda/laporan (M12) — dua tahap dalam satu endpoint.
 *
 *   `tahap = DRAFT`    -> simpan foto BEFORE, status tetap DRAFT (BR-G7).
 *   `tahap = MENUNGGU` -> kirim foto AFTER, status jadi MENUNGGU (BR-G7/G8).
 *
 * Kenapa satu endpoint: foto before dan after dikirim pada momen berbeda
 * (sebelum dan sesudah mengerjakan), tapi bentuk validasinya identik. Dua route
 * terpisah berarti dua salinan aturan "foto wajib" — tempat paling umum aturan
 * hanya benar di salah satunya.
 *
 * Urutan WAJIB (BR-A4 persis, tiga langkah, bukan dua):
 *   1. Periksa aturan LEWAT fungsi baca-saja (`periksaDraft`/`periksaSubmit`).
 *      Ini penting: kalau unggah Telegram dilakukan lebih dulu, permintaan yang
 *      memang ditolak (agenda sudah dibatalkan) tetap meninggalkan foto yatim
 *      di grup — dan karyawan tidak akan pernah tahu itu terjadi.
 *   2. Unggah foto ke Telegram.
 *   3. Simpan ke database DI DALAM transaksi, yang memvalidasi ULANG aturan itu.
 *
 * Langkah 1 dan 3 memanggil fungsi murni yang sama (`aturan/laporan.ts`), jadi
 * pratinjau dan penulisan tidak bisa berbeda pendapat.
 */

/** Batas Telegram sendPhoto multipart (rules/NOTES.md §5). */
const BATAS_FOTO_BYTE = 10 * 1024 * 1024;

const PESAN_LINK = 'Link tidak berlaku. Hubungi admin.';

const SkemaDasar = z.object({
  token: z.string().min(1, PESAN_LINK),
  tahap: z.enum(['DRAFT', 'MENUNGGU'], { errorMap: () => ({ message: 'Tahap laporan tidak valid.' }) }),
  agenda_id: z.number({ invalid_type_error: 'Agenda tidak valid.' }).int().positive('Agenda tidak valid.'),
  request_id: z.string().uuid('ID permintaan tidak valid.'),
  keterangan: z.string().max(500, 'Keterangan maksimal 500 karakter.').optional(),
});

export const POST = guardTanpaSesi(async (req: NextRequest) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }

  const parsed = SkemaDasar.safeParse({
    token: String(form.get('token') ?? ''),
    tahap: String(form.get('tahap') ?? ''),
    agenda_id: Number(String(form.get('agenda_id') ?? '')),
    request_id: String(form.get('request_id') ?? ''),
    keterangan: form.get('keterangan') === null ? undefined : String(form.get('keterangan')),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const { token, tahap, request_id, keterangan } = parsed.data;

  // Foto opsional di bentuk request: agenda TANPA foto wajib (BR-G8) tidak
  // mengirim apa pun. Aturan "wajib atau tidak" milik fungsi murni, bukan di sini.
  const mentah = form.get('foto');
  let foto: File | null = null;
  if (mentah instanceof File && mentah.size > 0) {
    if (mentah.type !== 'image/jpeg') {
      return NextResponse.json({ kode: 'FOTO_TIDAK_VALID', pesan: 'Foto harus format JPEG.' }, { status: 400 });
    }
    if (mentah.size > BATAS_FOTO_BYTE) {
      return NextResponse.json(
        { kode: 'FOTO_TERLALU_BESAR', pesan: 'Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.' },
        { status: 413 },
      );
    }
    foto = mentah;
  }

  try {
    const db = getDb();
    const karyawan = await resolveLinkAktif(token, db);
    if (!karyawan) {
      return NextResponse.json({ kode: 'LINK_TIDAK_BERLAKU', pesan: PESAN_LINK }, { status: 404 });
    }

    const employees = karyawan.karyawan_id;

    // (1) Periksa aturan dulu — baca saja, tidak menulis apa pun.
    //
    // `await` itu WAJIB, bukan gaya. Tanpa dia, periksaDraft() mengembalikan
    // promise yang ditolak; route tetap lanjut ke langkah (2) dan mengunggah foto,
    // persis hal yang langkah (1) dirancang untuk cegah. Bug ini nyata terjadi dan
    // ketahuan karena tes "permintaan ditolak tidak mengunggah foto" menghitung
    // jumlah panggilan stub — bukan karena ada error yang terlihat.
    if (tahap === 'DRAFT') {
      await periksaDraft(db, parsed.data.agenda_id, employees, foto !== null);
    } else {
      await periksaSubmit(db, parsed.data.agenda_id, employees, foto !== null);
    }

    // (2) Unggah ke Telegram. Foto null = agenda tidak wajib foto, bukan gagal.
    const telegram = await unggahFoto(foto, {
      nama: karyawan.nama,
      agendaId: parsed.data.agenda_id,
      requestId: request_id,
      tahap,
    });
    if (!telegram.ok) return telegram.respons;

    // (3) Simpan dalam transaksi yang memvalidasi ulang (balapan).
    if (tahap === 'DRAFT') {
      const laporan = await denganTransaksi(async (tx) =>
        simpanDraft(
          {
            agendaId: parsed.data.agenda_id,
            karyawanId: employees,
            requestId: request_id,
            keterangan,
            foto: telegram.telegram,
          },
          tx,
        ),
      );
      return NextResponse.json(
        {
          kode: 'DRAFT_TERSIMPAN',
          pesan: 'Draft tersimpan. Ambil foto after setelah pekerjaan selesai.',
          data: { id: laporan.id },
        },
        { status: 201 },
      );
    }

    const keluar = await denganTransaksi(async (tx) =>
      submitLaporan(
        {
          agendaId: parsed.data.agenda_id,
          karyawanId: employees,
          requestId: request_id,
          keterangan,
          foto: telegram.telegram,
        },
        tx,
      ),
    );
    return NextResponse.json(
      {
        kode: 'LAPORAN_TERKIRIM',
        pesan: 'Laporan agenda berhasil dikirim. Menunggu verifikasi admin.',
        data: { id: keluar.laporan.id, percobaan: keluar.laporan.percobaan, baru: keluar.baru },
      },
      { status: keluar.baru ? 201 : 200 },
    );
  } catch (e) {
    return jadiResponsGalat(e);
  }
});

type HasilUnggah =
  | { ok: true; telegram: { fileId: string; chatId: string; messageId: number } | null }
  | { ok: false; respons: NextResponse };

/**
 * Unggah foto ke Telegram kalau ada. `foto === null` berarti agenda tidak wajib
 * foto — TIDAK gagal di sini, karena keputusan "wajib atau tidak" sudah diambil
 * `periksaDraft`/`periksaSubmit` pada langkah 1.
 */
async function unggahFoto(
  foto: File | null,
  konteks: { nama: string; agendaId: number; requestId: string; tahap: 'DRAFT' | 'MENUNGGU' },
): Promise<HasilUnggah> {
  if (!foto) return { ok: true, telegram: null };
  const label = konteks.tahap === 'DRAFT' ? 'AGENDA BEFORE' : 'AGENDA AFTER';
  const caption = `${konteks.nama} · ${label} · agenda #${konteks.agendaId} · ${konteks.requestId}`;
  const bytes = Buffer.from(await foto.arrayBuffer());
  try {
    const hasil = await kirimFotoKeTelegram(bytes, caption);
    return { ok: true, telegram: { fileId: hasil.fileId, chatId: hasil.chatId, messageId: hasil.messageId } };
  } catch {
    // Tanpa token/link/foto di pesan — pesan generik saja (rules/03 §12).
    return {
      ok: false,
      respons: NextResponse.json(
        { kode: 'TELEGRAM_GAGAL', pesan: 'Foto gagal dikirim dan laporan tidak tersimpan. Silakan coba lagi.' },
        { status: 502 },
      ),
    };
  }
}

function jadiResponsGalat(e: unknown): NextResponse {
  if (e instanceof GalatLaporan) {
    return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
  }
  if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) {
    return NextResponse.json(
      { kode: 'KEADAAN_BERUBAH', pesan: 'Data agenda berubah. Halaman dimuat ulang.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
}