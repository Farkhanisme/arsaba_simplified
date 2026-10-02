import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../server/db';
import { guard } from '../../../../server/guard';
import { menitDalamHari } from '../../../../server/waktu';
import { pilihSlot, hitungN, hitungSelisih } from '../../../../server/aturan/keterlambatan';
import { bacaAmbang } from '../../../../server/repo/pengaturan';
import { daftarEvent, checkinUntukHitungN, slotUntuk, type FilterEvent } from '../../../../server/repo/verifikasi';

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function angkaParam(nama: string, nilai: string | null): number | undefined {
  if (nilai === null || nilai === '') return undefined;
  const n = Number(nilai);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * GET /api/admin/verifikasi — daftar + selisih keterlambatan + badge.
 * Filter via URL (tersimpan agar bisa di-refresh); default status MENUNGGU.
 */
export const GET = guard('verifikasi', async (req: NextRequest) => {
  const p = new URL(req.url).searchParams;
  const status = p.get('status') ?? 'MENUNGGU';
  if (status !== 'MENUNGGU' && status !== 'DISETUJUI' && status !== 'DITOLAK') {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Status tidak valid.' }, { status: 400 });
  }
  const jenis = p.get('jenis');
  if (jenis !== null && jenis !== '' && jenis !== 'CHECKIN' && jenis !== 'CHECKOUT') {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Jenis tidak valid.' }, { status: 400 });
  }
  const dari = p.get('dari');
  const sampai = p.get('sampai');
  if ((dari !== null && dari !== '' && !POLA_TANGGAL.test(dari)) || (sampai !== null && sampai !== '' && !POLA_TANGGAL.test(sampai))) {
    return NextResponse.json({ kode: 'INPUT_TIDAK_VALID', pesan: 'Rentang tanggal tidak valid (YYYY-MM-DD).' }, { status: 400 });
  }
  const filter: FilterEvent = {
    status,
    tokoId: angkaParam('toko_id', p.get('toko_id')),
    dari: dari || undefined,
    sampai: sampai || undefined,
    karyawanId: angkaParam('karyawan_id', p.get('karyawan_id')),
    jenis: jenis ? (jenis as 'CHECKIN' | 'CHECKOUT') : undefined,
    belumCheckout: p.get('belum_checkout') === '1',
  };

  const db = getDb();
  const baris = await daftarEvent(filter, db);
  const ambang = await bacaAmbang(db);

  const data = [];
  for (const b of baris) {
    if (b.jenis === 'CHECKIN') {
      const semua = await checkinUntukHitungN(b.karyawan_id, b.tanggal, db);
      const n = hitungN(semua, b.id);
      const jadwal = await slotUntuk(b.karyawan_id, b.tanggal, db);
      const slot = pilihSlot(jadwal ? jadwal.slot : [], n);
      const { selisih, terlambatSistem } = hitungSelisih(menitDalamHari(b.waktu), slot, ambang);
      data.push({
        ...b,
        keterlambatan: {
          n,
          slot: slot ? { nama: slot.nama, jam_mulai: slot.jam_mulai, jam_selesai: slot.jam_selesai } : null,
          selisih,
          terlambatSistem,
        },
      });
    } else {
      data.push({ ...b, keterlambatan: null });
    }
  }
  return NextResponse.json({ kode: 'OK', data, ambang });
});
