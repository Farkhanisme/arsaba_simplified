import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { denganTransaksi } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { catatAudit } from '../../../../server/audit';
import { serialisasiWIB, tanggalWIB, geserJamISO } from '../../../../server/waktu';
import { tokoPadaTanggal, bolehKoreksi, sudahDiekspor } from '../../../../server/aturan/absensi';
import {
  jumlahCheckInAktifPadaTanggal,
  penandaanPadaTanggal,
  riwayatPenempatanUntukTanggal,
} from '../../../../server/repo/absensi';
import { detailEvent, adaCheckoutAktifLain } from '../../../../server/repo/verifikasi';

const POLA_WAKTU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+07:00$/;

function waktuValid(w: string): boolean {
  if (!POLA_WAKTU.test(w)) return false;
  try {
    geserJamISO(w, 0);
    return true;
  } catch {
    return false;
  }
}

const SkemaKoreksi = z.object({
  operasi: z.enum(['tambah_checkout', 'tambah_checkin', 'ubah_waktu'], {
    errorMap: () => ({ message: 'Operasi tidak dikenal.' }),
  }),
  checkin_id: z.number().int().positive().optional(),
  event_id: z.number().int().positive().optional(),
  karyawan_id: z.number().int().positive().optional(),
  waktu: z.string().optional(),
  alasan: z.string().max(500, 'Alasan maksimal 500 karakter.').optional(),
});

class GalatKoreksi extends Error {
  constructor(
    public readonly status: number,
    public readonly kode: string,
    message: string,
  ) {
    super(message);
    this.name = 'GalatKoreksi';
  }
}

/**
 * POST /api/admin/koreksi — koreksi manual (BR-K1..K6).
 * Record: sumber KOREKSI_ADMIN, tanpa foto, lokasi TIDAK_ADA, alasan wajib,
 * langsung DISETUJUI oleh admin pelaku. Tanpa hapus permanen (BR-K5).
 */
export const POST = guard('koreksi', async (req: NextRequest, ctx) => {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Isi permintaan tidak valid.' }, { status: 400 });
  }
  const parsed = SkemaKoreksi.safeParse(badan);
  if (!parsed.success) {
    return NextResponse.json(
      { kode: 'INPUT_TIDAK_VALID', pesan: parsed.error.issues[0]?.message ?? 'Input tidak valid.' },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (!input.alasan || input.alasan.trim().length === 0) {
    return NextResponse.json({ kode: 'ALASAN_WAJIB', pesan: 'Alasan koreksi wajib diisi.' }, { status: 400 });
  }
  const alasan = input.alasan.trim();

  try {
    const hasil = await denganTransaksi(async (tx) => {
      const sekarang = serialisasiWIB();

      if (input.operasi === 'tambah_checkout') {
        // BR-K3: check-out untuk check-in terbuka, termasuk lewat 20 jam.
        if (!input.checkin_id || !input.waktu || !waktuValid(input.waktu)) {
          throw new GalatKoreksi(400, 'INPUT_TIDAK_VALID', 'Check-in dan waktu (ISO +07:00) wajib diisi.');
        }
        const ci = await detailEvent(input.checkin_id, tx);
        if (!ci || ci.jenis !== 'CHECKIN') throw new GalatKoreksi(404, 'TIDAK_DITEMUKAN', 'Check-in tidak ditemukan.');
        if (ci.status === 'DITOLAK') throw new GalatKoreksi(409, 'CHECKIN_DITOLAK', 'Check-in sudah ditolak.');
        if (await adaCheckoutAktifLain(ci.id, null, tx)) {
          throw new GalatKoreksi(409, 'SUDAH_ADA_CHECKOUT', 'Check-in ini sudah memiliki check-out.');
        }
        // Check-out mewarisi tanggal & toko check-in-nya.
        const tolakEkspor = await sudahDiekspor(ci.tanggal, ci.toko_id, tx);
        const cekKoreksi = bolehKoreksi(tolakEkspor, ctx.peran);
        if (!cekKoreksi.boleh) throw new GalatKoreksi(403, 'PERIODE_TEREKSPOR', cekKoreksi.alasan);
        if (await penandaanPadaTanggal(ci.karyawan_id, ci.tanggal, tx)) {
          throw new GalatKoreksi(409, 'TANGGAL_BERTANDA', 'Tanggal ini ditandai tidak berangkat. Hubungi admin.');
        }
        await tx.execute({
          sql: "INSERT INTO absensi (karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber, lokasi_status, status, alasan_koreksi, dikoreksi_oleh, diverifikasi_oleh, diverifikasi_at, dibuat_at) VALUES (?, ?, ?, 'CHECKOUT', ?, ?, 'KOREKSI_ADMIN', 'TIDAK_ADA', 'DISETUJUI', ?, ?, ?, ?, ?)",
          args: [ci.karyawan_id, ci.toko_id, ci.tanggal, ci.id, input.waktu, alasan, ctx.pengguna_id, ctx.pengguna_id, sekarang, sekarang],
        });
        const idRes = await tx.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
        const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
        await catatAudit(
          {
            waktu: sekarang,
            pengguna_id: ctx.pengguna_id,
            aksi: 'KOREKSI_TAMBAH_CHECKOUT',
            entitas: 'absensi',
            entitas_id: id,
            sesudah: JSON.stringify({ checkin_id: ci.id, waktu: input.waktu }),
            catatan: alasan,
          },
          tx,
        );
        return { id };
      }

      if (input.operasi === 'tambah_checkin') {
        if (!input.karyawan_id || !input.waktu || !waktuValid(input.waktu)) {
          throw new GalatKoreksi(400, 'INPUT_TIDAK_VALID', 'Karyawan dan waktu (ISO +07:00) wajib diisi.');
        }
        const kry = await tx.execute({ sql: 'SELECT id, aktif FROM karyawan WHERE id = ?', args: [input.karyawan_id] });
        const barisKry = kry.rows[0] as Record<string, unknown> | undefined;
        if (!barisKry || Number(barisKry['aktif']) !== 1) {
          throw new GalatKoreksi(404, 'TIDAK_DITEMUKAN', 'Karyawan tidak ditemukan atau nonaktif.');
        }
        const tanggal = tanggalWIB(input.waktu);
        // Toko snapshot penempatan pada tanggal (BR-A12).
        const riwayat = await riwayatPenempatanUntukTanggal(input.karyawan_id, tx);
        const toko = tokoPadaTanggal(riwayat, tanggal);
        if (toko === null) {
          throw new GalatKoreksi(409, 'TANPA_PENEMPATAN', 'Karyawan tidak ditempatkan di toko pada tanggal tersebut.');
        }
        const cekEkspor = bolehKoreksi(await sudahDiekspor(tanggal, toko, tx), ctx.peran);
        if (!cekEkspor.boleh) throw new GalatKoreksi(403, 'PERIODE_TEREKSPOR', cekEkspor.alasan);
        if (await penandaanPadaTanggal(input.karyawan_id, tanggal, tx)) {
          throw new GalatKoreksi(409, 'TANGGAL_BERTANDA', 'Tanggal ini ditandai tidak berangkat. Hubungi admin.');
        }
        // BR-K4: kuota tetap berlaku pada koreksi.
        const jumlah = await jumlahCheckInAktifPadaTanggal(input.karyawan_id, tanggal, tx);
        if (jumlah >= 2) {
          throw new GalatKoreksi(409, 'KUOTA_PENUH', 'Karyawan sudah memiliki 2 check-in aktif pada tanggal ini.');
        }
        await tx.execute({
          sql: "INSERT INTO absensi (karyawan_id, toko_id, tanggal, jenis, waktu, sumber, lokasi_status, status, alasan_koreksi, dikoreksi_oleh, diverifikasi_oleh, diverifikasi_at, dibuat_at) VALUES (?, ?, ?, 'CHECKIN', ?, 'KOREKSI_ADMIN', 'TIDAK_ADA', 'DISETUJUI', ?, ?, ?, ?, ?)",
          args: [input.karyawan_id, toko, tanggal, input.waktu, alasan, ctx.pengguna_id, ctx.pengguna_id, sekarang, sekarang],
        });
        const idRes = await tx.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
        const id = Number((idRes.rows[0] as Record<string, unknown>)['id']);
        await catatAudit(
          {
            waktu: sekarang,
            pengguna_id: ctx.pengguna_id,
            aksi: 'KOREKSI_TAMBAH_CHECKIN',
            entitas: 'absensi',
            entitas_id: id,
            sesudah: JSON.stringify({ karyawan_id: input.karyawan_id, tanggal, waktu: input.waktu }),
            catatan: alasan,
          },
          tx,
        );
        return { id };
      }

      // ubah_waktu
      if (!input.event_id || !input.waktu || !waktuValid(input.waktu)) {
        throw new GalatKoreksi(400, 'INPUT_TIDAK_VALID', 'Event dan waktu (ISO +07:00) wajib diisi.');
      }
      const ev = await detailEvent(input.event_id, tx);
      if (!ev) throw new GalatKoreksi(404, 'TIDAK_DITEMUKAN', 'Absensi tidak ditemukan.');
      const sebelum = JSON.stringify({ waktu: ev.waktu, tanggal: ev.tanggal, toko_id: ev.toko_id });
      let tanggalBaru = ev.tanggal;
      let tokoBaru = ev.toko_id;
      if (ev.jenis === 'CHECKIN') {
        tanggalBaru = tanggalWIB(input.waktu);
        const riwayat = await riwayatPenempatanUntukTanggal(ev.karyawan_id, tx);
        const toko = tokoPadaTanggal(riwayat, tanggalBaru);
        if (toko === null) {
          throw new GalatKoreksi(409, 'TANPA_PENEMPATAN', 'Karyawan tidak ditempatkan di toko pada tanggal tersebut.');
        }
        tokoBaru = toko;
        // Periode lama MAUPUN baru yang terekspor -> hanya Super Admin.
        const eksporLama = await sudahDiekspor(ev.tanggal, ev.toko_id, tx);
        const eksporBaru = await sudahDiekspor(tanggalBaru, tokoBaru, tx);
        const cekEkspor = bolehKoreksi(eksporLama || eksporBaru, ctx.peran);
        if (!cekEkspor.boleh) throw new GalatKoreksi(403, 'PERIODE_TEREKSPOR', cekEkspor.alasan);
        if (tanggalBaru !== ev.tanggal) {
          if (await penandaanPadaTanggal(ev.karyawan_id, tanggalBaru, tx)) {
            throw new GalatKoreksi(409, 'TANGGAL_BERTANDA', 'Tanggal ini ditandai tidak berangkat. Hubungi admin.');
          }
          const hitung = await tx.execute({
            sql: "SELECT COUNT(*) AS c FROM absensi WHERE karyawan_id = ? AND tanggal = ? AND jenis = 'CHECKIN' AND status <> 'DITOLAK' AND id <> ?",
            args: [ev.karyawan_id, tanggalBaru, ev.id],
          });
          if (Number((hitung.rows[0] as Record<string, unknown>)['c']) >= 2) {
            throw new GalatKoreksi(409, 'KUOTA_PENUH', 'Karyawan sudah memiliki 2 check-in aktif pada tanggal ini.');
          }
        }
      } else {
        // CHECKOUT: tanggal & toko tetap warisan check-in-nya.
        const cekEkspor = bolehKoreksi(await sudahDiekspor(ev.tanggal, ev.toko_id, tx), ctx.peran);
        if (!cekEkspor.boleh) throw new GalatKoreksi(403, 'PERIODE_TEREKSPOR', cekEkspor.alasan);
      }
      await tx.execute({
        sql: 'UPDATE absensi SET waktu = ?, tanggal = ?, toko_id = ?, alasan_koreksi = ?, dikoreksi_oleh = ? WHERE id = ?',
        args: [input.waktu, tanggalBaru, tokoBaru, alasan, ctx.pengguna_id, ev.id],
      });
      let cascade = 0;
      if (ev.jenis === 'CHECKIN' && (tanggalBaru !== ev.tanggal || tokoBaru !== ev.toko_id)) {
        // Anak check-out mewarisi tanggal & toko check-in-nya.
        const anak = await tx.execute({
          sql: "UPDATE absensi SET tanggal = ?, toko_id = ? WHERE checkin_id = ? AND jenis = 'CHECKOUT' AND status <> 'DITOLAK'",
          args: [tanggalBaru, tokoBaru, ev.id],
        });
        cascade = anak.rowsAffected;
      }
      await catatAudit(
        {
          waktu: sekarang,
          pengguna_id: ctx.pengguna_id,
          aksi: 'KOREKSI_UBAH_WAKTU',
          entitas: 'absensi',
          entitas_id: ev.id,
          sebelum,
          sesudah: JSON.stringify({ waktu: input.waktu, tanggal: tanggalBaru, toko_id: tokoBaru, cascade }),
          catatan: alasan,
        },
        tx,
      );
      return { id: ev.id };
    });

    return NextResponse.json({ kode: 'KOREKSI_DISIMPAN', pesan: 'Koreksi berhasil disimpan.', data: hasil });
  } catch (e) {
    if (e instanceof GalatKoreksi) {
      return NextResponse.json({ kode: e.kode, pesan: e.message }, { status: e.status });
    }
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) {
      return NextResponse.json({ kode: 'KEADAAN_BERUBAH', pesan: 'Data absen berubah. Muat ulang halaman.' }, { status: 409 });
    }
    return NextResponse.json({ kode: 'ERROR', pesan: 'Terjadi kesalahan.' }, { status: 500 });
  }
});
