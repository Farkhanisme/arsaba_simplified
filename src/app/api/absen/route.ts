import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, denganTransaksi } from '../../../server/db';
import { guardTanpaSesi } from '../../../server/guard';
import { serialisasiWIB, tanggalWIB, geserJamISO } from '../../../server/waktu';
import {
  bolehCheckIn,
  bolehCheckOut,
  tokoPadaTanggal,
  tentukanStatusLokasi,
} from '../../../server/aturan/absensi';
import {
  resolveLinkAktif,
  checkInTerbuka,
  checkInTerbukaTanpaBatas,
  jumlahCheckInAktifPadaTanggal,
  eventDariRequestId,
  insertEvent,
  penandaanPadaTanggal,
  riwayatPenempatanUntukTanggal,
  type EventAbsensi,
} from '../../../server/repo/absensi';
import { tokoById } from '../../../server/repo/toko';
import { kirimFotoKeTelegram } from '../../../server/telegram';

/** Batas Telegram sendPhoto multipart (rules/NOTES.md §5). */
const BATAS_FOTO_BYTE = 10 * 1024 * 1024;

const PESAN_LINK = 'Link tidak berlaku. Hubungi admin.';

const SkemaDasar = z.object({
  token: z.string().min(1, 'Link tidak berlaku. Hubungi admin.'),
  jenis: z.enum(['CHECKIN', 'CHECKOUT'], { errorMap: () => ({ message: 'Jenis absen tidak valid.' }) }),
  request_id: z.string().uuid('ID permintaan tidak valid.'),
  lokasi_status: z.enum(['DITOLAK', 'GAGAL']).optional(),
});

class GalatAbsen extends Error {
  constructor(
    public readonly status: number,
    public readonly kode: string,
    message: string,
  ) {
    super(message);
    this.name = 'GalatAbsen';
  }
}

function jamMenit(waktuISO: string): string {
  return waktuISO.slice(11, 16);
}

function responsSukses(event: { jenis: string; waktu: string; status: string }, dibuatBaru: boolean) {
  const label = event.jenis === 'CHECKIN' ? 'Absen' : 'Absen checkout';
  return NextResponse.json(
    {
      kode: 'ABSEN_TERCATAT',
      pesan: `${label} berhasil dicatat pukul ${jamMenit(event.waktu)} WIB. Menunggu verifikasi admin.`,
      data: { jenis: event.jenis, waktu: event.waktu, status: event.status },
    },
    { status: dibuatBaru ? 201 : 200 },
  );
}

export const POST = guardTanpaSesi(async (req: NextRequest) => {
  // 1. Validasi bentuk input (zod), ukuran dan tipe foto.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaDasar.safeParse({
    token: String(form.get('token') ?? ''),
    jenis: String(form.get('jenis') ?? ''),
    request_id: String(form.get('request_id') ?? ''),
    lokasi_status: form.get('lokasi_status') === null ? undefined : String(form.get('lokasi_status')),
  });
  if (!parsed.success) {
    const pesan = parsed.error.issues[0]?.message ?? 'Input tidak valid.';
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan }, { status: 400 });
  }
  const { token, jenis, request_id } = parsed.data;

  const foto = form.get('foto');
  if (!(foto instanceof File) || foto.size === 0) {
    return NextResponse.json({ kode: 'FOTO_WAJIB', pesan: 'Foto wajib diambil dari kamera.' }, { status: 400 });
  }
  if (foto.type !== 'image/jpeg') {
    return NextResponse.json({ kode: 'FOTO_TIDAK_VALID', pesan: 'Foto harus format JPEG.' }, { status: 400 });
  }
  if (foto.size > BATAS_FOTO_BYTE) {
    return NextResponse.json(
      { kode: 'FOTO_TERLALU_BESAR', pesan: 'Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.' },
      { status: 413 },
    );
  }

  function angkaLatLng(nama: string): number | undefined {
    const mentah = form.get(nama);
    if (mentah === null || String(mentah).trim() === '') return undefined;
    const n = Number(String(mentah));
    return Number.isFinite(n) ? n : undefined;
  }
  const lat = angkaLatLng('lat');
  const lng = angkaLatLng('lng');
  if (form.get('lat') !== null && lat === undefined) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Koordinat tidak valid.' }, { status: 400 });
  }
  if (form.get('lng') !== null && lng === undefined) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Koordinat tidak valid.' }, { status: 400 });
  }
  const lokasiStatus = tentukanStatusLokasi(lat, lng, parsed.data.lokasi_status);

  try {
    const db = getDb();

    // 2. Resolve token link aktif -> karyawan aktif. Gagal -> generik (BR-A1).
    const karyawan = await resolveLinkAktif(token, db);
    if (!karyawan) {
      return NextResponse.json({ kode: 'LINK_TIDAK_BERLAKU', pesan: PESAN_LINK }, { status: 404 });
    }

    // 3. Idempotensi: request_id sama -> hasil sebelumnya (BR-A11).
    const sudahAda = await eventDariRequestId(request_id, db);
    if (sudahAda) return responsSukses(sudahAda, false);

    // 4. Waktu server WIB; tanggal dan toko menyusul per jenis.
    const sekarang = serialisasiWIB();
    const batasTertua = geserJamISO(sekarang, -20);

    let tanggal: string;
    let tokoId: number;
    let checkinId: number | null = null;

    if (jenis === 'CHECKOUT') {
      const terbuka = await checkInTerbuka(karyawan.karyawan_id, batasTertua, db);
      const target = terbuka[0];
      if (!target) {
        const ada = await checkInTerbukaTanpaBatas(karyawan.karyawan_id, db);
        const cek = bolehCheckOut({ dalamBatas: false, adaTerbuka: ada.length > 0 });
        return NextResponse.json({ kode: 'CHECKOUT_DITOLAK', pesan: cek.alasan }, { status: 409 });
      }
      // Check-out mewarisi tanggal dan toko check-in-nya.
      tanggal = target.tanggal;
      tokoId = target.toko_id;
      checkinId = target.id;
    } else {
      tanggal = tanggalWIB(sekarang);
      // BR-A9: tanggal bertanda tidak berangkat diblokir.
      const tanda = await penandaanPadaTanggal(karyawan.karyawan_id, tanggal, db);
      if (tanda) {
        return NextResponse.json(
          { kode: 'TANGGAL_BERTANDA', pesan: 'Tanggal ini ditandai tidak berangkat. Hubungi admin.' },
          { status: 409 },
        );
      }
      // BR-A12: toko penempatan pada tanggal absensi.
      const riwayat = await riwayatPenempatanUntukTanggal(karyawan.karyawan_id, db);
      const toko = tokoPadaTanggal(riwayat, tanggal);
      if (toko === null) {
        return NextResponse.json(
          { kode: 'TANPA_PENEMPATAN', pesan: 'Karyawan belum ditempatkan di toko. Hubungi admin.' },
          { status: 409 },
        );
      }
      tokoId = toko;
      const terbuka = await checkInTerbuka(karyawan.karyawan_id, batasTertua, db);
      const jumlah = await jumlahCheckInAktifPadaTanggal(karyawan.karyawan_id, tanggal, db);
      const cek = bolehCheckIn({ terbukaDalamBatas: terbuka.length > 0, jumlahAktifHariIni: jumlah });
      if (!cek.boleh) {
        return NextResponse.json({ kode: 'CHECKIN_DITOLAK', pesan: cek.alasan }, { status: 409 });
      }
    }

    // 6. Kirim foto ke Telegram DULU. Gagal -> tanpa penulisan DB (BR-A4).
    const toko = await tokoById(tokoId, db);
    const caption = `${karyawan.nama} · ${toko?.nama ?? `Toko ${tokoId}`} · ${jenis} · ${sekarang} · ${request_id}`;
    const bytes = Buffer.from(await foto.arrayBuffer());
    let hasilTelegram;
    try {
      hasilTelegram = await kirimFotoKeTelegram(bytes, caption);
    } catch {
      // Tanpa token/link/foto di pesan — hanya pesan generik §5.
      return NextResponse.json(
        { kode: 'TELEGRAM_GAGAL', pesan: 'Absen gagal dikirim dan tidak tersimpan. Silakan coba lagi.' },
        { status: 502 },
      );
    }

    // 7. Transaksi: validasi ULANG aturan (balapan), lalu INSERT.
    const eventBaru = await denganTransaksi(async (tx) => {
      const dupe = await eventDariRequestId(request_id, tx);
      if (dupe) return { dupe: true as const, event: dupe };
      if (jenis === 'CHECKOUT') {
        const terbuka = await checkInTerbuka(karyawan.karyawan_id, batasTertua, tx);
        const target = terbuka[0];
        if (!target || target.id !== checkinId) {
          throw new GalatAbsen(409, 'CHECKOUT_DITOLAK', 'Data absen berubah. Halaman dimuat ulang.');
        }
      } else {
        const tanda = await penandaanPadaTanggal(karyawan.karyawan_id, tanggal, tx);
        if (tanda) {
          throw new GalatAbsen(409, 'TANGGAL_BERTANDA', 'Tanggal ini ditandai tidak berangkat. Hubungi admin.');
        }
        const terbuka = await checkInTerbuka(karyawan.karyawan_id, batasTertua, tx);
        const jumlah = await jumlahCheckInAktifPadaTanggal(karyawan.karyawan_id, tanggal, tx);
        const cek = bolehCheckIn({ terbukaDalamBatas: terbuka.length > 0, jumlahAktifHariIni: jumlah });
        if (!cek.boleh) throw new GalatAbsen(409, 'CHECKIN_DITOLAK', cek.alasan);
      }
      const id = await insertEvent(
        {
          request_id,
          karyawan_id: karyawan.karyawan_id,
          toko_id: tokoId,
          tanggal,
          jenis,
          checkin_id: checkinId,
          waktu: sekarang,
          foto_file_id: hasilTelegram.fileId,
          foto_chat_id: hasilTelegram.chatId,
          foto_message_id: hasilTelegram.messageId,
          lat: lat ?? null,
          lng: lng ?? null,
          lokasi_status: lokasiStatus,
        },
        sekarang,
        tx,
      );
      const baca = await tx.execute({
        sql: 'SELECT jenis, waktu, status FROM absensi WHERE id = ?',
        args: [id],
      });
      const baris = baca.rows[0] as unknown as EventAbsensi;
      return { dupe: false as const, event: baris };
    });

    // 8. Respons ringkasan.
    return responsSukses(eventBaru.event, !eventBaru.dupe);
  } catch (e) {
    if (e instanceof GalatAbsen) {
      return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
    }
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) {
      return NextResponse.json({ kode: 'KEADAAN_BERUBAH', pesan: 'Data absen berubah. Halaman dimuat ulang.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
