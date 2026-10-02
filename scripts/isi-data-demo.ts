/**
 * Mengisi database DEMO/PRODUKSI dengan data master yang nyata:
 * 10 toko, 26 karyawan, penempatan, shift template, jadwal bulan berjalan,
 * riwayat absensi 21 hari terakhir, dan beberapa penandaan tidak berangkat.
 *
 * TUJUAN: memberi angka yang masuk akal supaya M7 (dashboard) bisa diuji dengan
 * nilai non-nol. Tanpa ini semua agregasi dashboard mengembalikan 0 dan bug
 * agregasi tidak akan pernah muncul.
 *
 * KENAPA SKRIP TERPISAH DARI scripts/seed.ts:
 *   seed.ts dipakai 22 file tes (hanya berisi 2 akun admin). Kalau data realistis
 *   ikut masuk ke sana, seluruh tes M2 dan M5 ikut berubah. seed.ts TIDAK diubah.
 *
 * CARA PAKAI:
 *   npx tsx scripts/isi-data-demo.ts            # isi data/demo.db
 *   TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' \
 *     npx tsx scripts/isi-data-demo.ts           # isi database Turso
 *   npx tsx scripts/isi-data-demo.ts --force    # kosongkan lalu isi ulang
 *
 * CATATAN PENTING SOAL FOTO:
 *   Baris absensi di sini memakai foto_file_id / foto_chat_id / foto_message_id
 *   PALSU, karena CHECK constraint mewajibkan ketiganya untuk sumber='KARYAWAN'.
 *   Konsekuensinya /api/foto/[id] akan GAGAL untuk data demo ini, karena file_id
 *   palsu tidak ada di Telegram. Ini disengaja: data demo bukan bukti bahwa foto
 *   benar-benar terkirim ke bot.
 */
process.loadEnvFile('.env.local');

import { createClient } from '@libsql/client';
import { sekarangWIB, tanggalWIB, jenisHari, geserJamISO, serialisasiWIB } from '../src/server/waktu';

const MULAI_PENEMPATAN = '2026-01-01';
const HARI_ABSENSI = 21;
const FORCE = process.argv.includes('--force');

const URL = process.env['TURSO_DATABASE_URL'] ?? 'file:./data/demo.db';
const TOKEN = process.env['TURSO_AUTH_TOKEN'];

// ---------------------------------------------------------------------------
// Data master — 10 toko, 26 karyawan (sumber: daftar pemilik, 2026-10-03)
// ---------------------------------------------------------------------------

const TOKO = [
  'arsaba induk',
  'al madad widuri',
  'mie ayam',
  'dapur rumah',
  'bgm dieng',
  'arsaba temanggung',
  'sambal bakar busan',
  'arsaba mart',
  'arsaba dieng',
  'beras wangi',
];

/** [nama, toko, jabatan] — urutan sesuai daftar pemilik. */
const KARYAWAN: [string, string, string][] = [
  ['nur rochmad ikhsan', 'arsaba induk', 'karyawan'],
  ['lina pujiarti', 'arsaba induk', 'karyawan'],
  ['rumaiza ulfa mandarizka', 'arsaba induk', 'karyawan'],
  ['dwi nafisatul hayati', 'arsaba induk', 'kepala toko'],
  ['thoriqul mufaizin', 'arsaba induk', 'karyawan'],
  ['adeline azzahrah', 'al madad widuri', 'karyawan'],
  ['kunti fadlilah', 'al madad widuri', 'karyawan'],
  ['ayu septi anggraeni', 'mie ayam', 'karyawan'],
  ['istihanah', 'mie ayam', 'kepala toko'],
  ['fatimatul wakidah', 'dapur rumah', 'karyawan'],
  ['rumini', 'bgm dieng', 'kepala toko'],
  ['sri haryati', 'bgm dieng', 'karyawan'],
  ['ahmad maulidin fanani', 'bgm dieng', 'karyawan'],
  ['jefri ichsanudin', 'bgm dieng', 'karyawan'],
  ['hendri muhammad khoirul zifki', 'bgm dieng', 'karyawan'],
  ['sindy salsabila apriliana', 'arsaba temanggung', 'karyawan'],
  ['inti perwita', 'arsaba temanggung', 'kepala toko'],
  ['gufron ali imron', 'sambal bakar busan', 'kepala toko'],
  ['muhammad zayyid fahma', 'sambal bakar busan', 'karyawan'],
  ['hikmah tiana dila', 'arsaba mart', 'kepala toko'],
  ['reno choirul anam', 'arsaba mart', 'karyawan'],
  ['muhammad abdul baqi', 'arsaba dieng', 'karyawan'],
  ['desta al hadi', 'arsaba dieng', 'karyawan'],
  ['ahmad sidiq', 'arsaba dieng', 'kepala toko'],
  ['alfian nur anggraeni', 'beras wangi', 'kepala toko'],
  ['ernawati', 'arsaba induk', 'kepala toko'],
];

type Tipe = 'SEMUA' | 'WEEKDAY' | 'WEEKEND';
type Template = [nama: string, tipe: Tipe, mulai: string, selesai: string];

/**
 * Bentuk shift template sengaja dibuat berbeda-beda agar data demo ikut
 * menguji aturan yang sudah ada:
 *   - bgm dieng punya "Malam" 23:00-06:00  -> BR-T3 lintas tengah malam
 *   - arsaba mart memakai WEEKDAY + WEEKEND -> BR-J1 dan BR-J2 tipe hari
 *   - toko lain memakai SEMUA -> selalu cocok
 */
const TEMPLATE_KHUSUS: Record<string, Template[]> = {
  'bgm dieng': [
    ['Pagi', 'SEMUA', '07:00', '15:00'],
    ['Sore', 'SEMUA', '15:00', '23:00'],
    ['Malam', 'SEMUA', '23:00', '06:00'],
  ],
  'arsaba mart': [
    ['Pagi', 'WEEKDAY', '07:00', '15:00'],
    ['Pagi', 'WEEKEND', '08:00', '16:00'],
    ['Sore', 'SEMUA', '15:00', '23:00'],
  ],
};
const TEMPLATE_UMUM: Template[] = [
  ['Pagi', 'SEMUA', '07:00', '15:00'],
  ['Sore', 'SEMUA', '15:00', '23:00'],
];
const templateUntuk = (toko: string): Template[] => TEMPLATE_KHUSUS[toko] ?? TEMPLATE_UMUM;

/** Template "Pagi" yang cocok untuk tanggal (BR-J2): SEMUA selalu menang. */
function pilihPagi(toko: string, tanggal: string): Template {
  const pagi = templateUntuk(toko).filter((t) => t[0] === 'Pagi');
  const hari = jenisHari(tanggal);
  return (
    pagi.find((t) => t[1] === 'SEMUA') ??
    pagi.find((t) => t[1] === hari) ??
    templateUntuk(toko)[0]!
  );
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/** Geser tanggal sebanyak `hari`, selalu lewat +07:00 eksplisit (K-45). */
function geserTanggal(tanggal: string, hari: number): string {
  return tanggalWIB(geserJamISO(`${tanggal}T12:00:00+07:00`, hari * 24));
}

/** Tambah menit ke jam "HH:MM" (bisa melewati tengah malam). */
function jamTambah(jam: string, menit: number): string {
  const total = (Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5)) + menit + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Pseudo-random DETERMINISTIK. Sengaja bukan Math.random supaya dua kali jalan
 * menghasilkan data identik — jadi angka bisa dibandingkan antar-jalannya.
 */
function variasi(kunci: string): number {
  let h = 2166136261;
  for (let i = 0; i < kunci.length; i += 1) {
    h ^= kunci.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/** Koordinat palsu sekitar Toko Arsitektur (Yogyakarta) — hanya untuk demo. */
function koordinat(kunci: string): { lat: number; lng: number } {
  const v = variasi(kunci);
  return { lat: -7.797 + (v % 40) / 10000, lng: 110.365 + (v % 40) / 10000 };
}

// ---------------------------------------------------------------------------
// Jalankan
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = createClient({ url: URL, authToken: TOKEN || undefined });

  const cek = await db.execute('SELECT COUNT(*) AS c FROM toko');
  const sudah = Number((cek.rows[0] as Record<string, unknown>)['c']);
  if (sudah > 0 && !FORCE) {
    console.error(`Database ${URL} sudah berisi ${sudah} toko. Jalankan dengan --force untuk mengosongkan.`);
    process.exit(1);
  }

  const admin = await db.execute('SELECT id FROM pengguna_admin ORDER BY id LIMIT 1');
  const adminId = Number((admin.rows[0] as Record<string, unknown>)['id']);
  if (!adminId) {
    console.error('Belum ada akun admin. Jalankan `npm run migrate` lalu `npx tsx scripts/seed.ts` lebih dulu.');
    process.exit(1);
  }

  const sekarang = serialisasiWIB();
  // JANGAN tulis tanggalWIB(): sekarangWIB() sudah mengembalikan
  // Date yang digeser +07:00, jadi mengumpankannya lagi ke tanggalWIB() menggeser
  // dua kali dan menghasilkan tanggal SATU HARI di masa depan.
  const hariIni = tanggalWIB();

  const tx = await db.transaction();
  /** Transaction.execute hanya menerima bentuk objek. */
  type Arg = string | number | null;
  const run = (sql: string, args: Arg[] = []) => tx.execute({ sql, args });

  const hitung = { jadwal: 0, penandaan: 0, absen: 0, checkin: 0, checkout: 0, ditolak: 0, menunggu: 0, terlambat: 0 };

  try {
    if (FORCE) {
      for (const t of ['absensi', 'jadwal_slot', 'jadwal', 'ketidakhadiran', 'shift_template', 'karyawan_penempatan', 'karyawan', 'toko']) {
        await run(`DELETE FROM ${t}`);
      }
    }

    // --- Toko ---------------------------------------------------------
    const tokoId = new Map<string, number>();
    for (const nama of TOKO) {
      const r = await run('INSERT INTO toko (nama, aktif, dibuat_at) VALUES (?, 1, ?)', [nama, sekarang]);
      tokoId.set(nama, Number(r.lastInsertRowid));
    }

    // --- Karyawan + penempatan ------------------------------------------
    const karyawan = new Map<string, { id: number; toko: string }>();
    for (const [nama, toko, jabatan] of KARYAWAN) {
      const r = await run('INSERT INTO karyawan (nama, jabatan, aktif, dibuat_at) VALUES (?, ?, 1, ?)', [nama, jabatan, sekarang]);
      const id = Number(r.lastInsertRowid);
      karyawan.set(nama, { id, toko });
      await run('INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', [
        id,
        tokoId.get(toko)!,
        MULAI_PENEMPATAN,
      ]);
    }

    // --- Shift template ------------------------------------------------
    for (const namaToko of TOKO) {
      for (const [nama, tipe, mulai, selesai] of templateUntuk(namaToko)) {
        await run(
          'INSERT INTO shift_template (toko_id, nama, tipe_hari, jam_mulai, jam_selesai, aktif, dibuat_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
          [tokoId.get(namaToko)!, nama, tipe, mulai, selesai, sekarang],
        );
      }
    }

    // --- Jadwal bulan berjalan ------------------------------------------
    const panjangBulan = Number(hariIni.slice(8, 10));
    for (const [, k] of karyawan) {
      for (let d = 1; d <= panjangBulan; d += 1) {
        const tanggal = `${hariIni.slice(0, 8)}${String(d).padStart(2, '0')}`;
        const [nama, tipe, mulai, selesai] = pilihPagi(k.toko, tanggal);
        const r = await run(
          `INSERT INTO jadwal (karyawan_id, toko_id, tanggal, shift_template_id, is_override, dibuat_oleh, dibuat_at)
           VALUES (?, ?, ?, (SELECT id FROM shift_template WHERE toko_id = ? AND nama = ? AND tipe_hari = ? LIMIT 1), 0, ?, ?)`,
          [k.id, tokoId.get(k.toko)!, tanggal, tokoId.get(k.toko)!, nama, tipe, adminId, sekarang],
        );
        await run('INSERT INTO jadwal_slot (jadwal_id, urutan, nama, jam_mulai, jam_selesai) VALUES (?, 1, ?, ?, ?)', [
          Number(r.lastInsertRowid),
          nama,
          mulai,
          selesai,
        ]);
        hitung.jadwal += 1;
      }
    }

    // --- Absensi ---------------------------------------------------------
    // mundur 0 = HARI INI. Dashboard M7 menampilkan hari ini, jadi hari ini
    // harus berisi data: sebagian belum datang, sebagian masih bekerja (check-in
    // tanpa check-out), sebagian sudah selesai, dan sebagian masih MENUNGGU
    // verifikasi supaya antrean verifikasi tidak kosong.
    for (const [namaKry, k] of karyawan) {
      const idToko = tokoId.get(k.toko)!;
      for (let mundur = HARI_ABSENSI; mundur >= 0; mundur -= 1) {
        const hariIni_r = mundur === 0;
        const tanggal = geserTanggal(hariIni, -mundur);
        const v = variasi(`${namaKry}|${tanggal}`);
        const kunci = `${namaKry}|${tanggal}`;
        const titik = koordinat(kunci);

        if (hariIni_r) {
          // Hari ini: bentuk "sedang berjalan" supaya dashboard M7 punya isi.
          if (v < 25) continue; // belum datang
          const sMinggu = v < 50 ? 'MENUNGGU' : 'DISETUJUI';
          const menitTelat = v < 82 ? -(v % 8) : 6 + (v % 20);
          const jamMasuk = jamTambah('07:00', menitTelat);
          // BR-V7: menyetujui check-in terlambat WAJIB mengisi menit final.
          const final = sMinggu === 'DISETUJUI' && menitTelat > 5 ? menitTelat : null;
          const rIn = await run(
            `INSERT INTO absensi
               (request_id, karyawan_id, toko_id, tanggal, jenis, waktu, sumber,
                foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status,
                status, diverifikasi_oleh, diverifikasi_at, keterlambatan_final_menit, dibuat_at)
             VALUES (?, ?, ?, ?, 'CHECKIN', ?, 'KARYAWAN', ?, ?, ?, ?, ?, 'TERSEDIA',
                     ?, ?, ?, ?, ?)`,
            [
              `demo-${tanggal}-${k.id}-IN`,
              k.id,
              idToko,
              tanggal,
              `${tanggal}T${jamMasuk}:00+07:00`,
              `demo-file-${k.id}-${tanggal}`,
              '-1009999999999',
              100000 + (v % 90000),
              titik.lat,
              titik.lng,
              sMinggu,
              sMinggu === 'MENUNGGU' ? null : adminId,
              sMinggu === 'MENUNGGU' ? null : sekarang,
              final,
              sekarang,
            ],
          );
          hitung.checkin += 1;
          hitung.absen += 1;
          if (final !== null) hitung.terlambat += 1;
          if (sMinggu === 'MENUNGGU') hitung.menunggu += 1;

          // Sebagian sudah selesai shift (mis. shift malam / keluar lebih awal),
          // supaya hitungan "hadir hari ini" tidak nol.
          if (sMinggu !== 'DISETUJUI' || v < 88) continue;
          await run(
            `INSERT INTO absensi
               (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber,
                foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status,
                status, diverifikasi_oleh, diverifikasi_at, dibuat_at)
             VALUES (?, ?, ?, ?, 'CHECKOUT', ?, ?, 'KARYAWAN', ?, ?, ?, ?, ?, 'TERSEDIA',
                     'DISETUJUI', ?, ?, ?)`,
            [
              `demo-${tanggal}-${k.id}-OUT`,
              k.id,
              idToko,
              tanggal,
              Number(rIn.lastInsertRowid),
              `${tanggal}T${jamTambah(jamMasuk, 400 + (v % 90))}:00+07:00`,
              `demo-file-${k.id}-${tanggal}-out`,
              '-1009999999999',
              100000 + (v % 90000),
              titik.lat,
              titik.lng,
              adminId,
              sekarang,
              sekarang,
            ],
          );
          hitung.checkout += 1;
          hitung.absen += 1;
          continue;
        }

        if (v < 6) continue; // ~6% tidak masuk sama sekali

        // Jam check-in. Distribusi sengaja dibuat realistis: ~82% tepat waktu,
        // ~12% terlambat 6-25 menit, ~6% terlambat jauh. Versi pertama skrip ini
        // memakai 55% terlambat, yang membuat dashboard terlihat seperti
        // semua orang selalu terlambat — tidak berguna untuk menilai UI.
        const menitTelat = v < 82 ? -(v % 8) : v < 94 ? 6 + (v % 20) : 50 + (v % 100);
        const jamMasuk = jamTambah('07:00', menitTelat);
        const terlambat = menitTelat > 5;

        // Status: sebagian ditolak, sebagian menunggu (terutama kemarin).
        const status = v >= 95 ? 'DITOLAK' : mundur === 1 && v >= 78 ? 'MENUNGGU' : 'DISETUJUI';
        const alasan = status === 'DITOLAK' ? 'Foto tidak terbaca.' : null;
        // Check-out belum ada pada sebagian data lama dan hari ini.
        const tanpaCheckout = v >= 90 || (mundur === 1 && v >= 70);

        const rIn = await run(
          `INSERT INTO absensi
             (request_id, karyawan_id, toko_id, tanggal, jenis, waktu, sumber,
              foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status,
              status, alasan_tolak, diverifikasi_oleh, diverifikasi_at,
              keterlambatan_final_menit, dibuat_at)
           VALUES (?, ?, ?, ?, 'CHECKIN', ?, 'KARYAWAN', ?, ?, ?, ?, ?, 'TERSEDIA',
                   ?, ?, ?, ?, ?, ?)`,
          [
            `demo-${tanggal}-${k.id}-IN`,
            k.id,
            idToko,
            tanggal,
            `${tanggal}T${jamMasuk}:00+07:00`,
            `demo-file-${k.id}-${tanggal}`,
            '-1009999999999',
            100000 + (v % 90000),
            titik.lat,
            titik.lng,
            status,
            alasan,
            status === 'MENUNGGU' ? null : adminId,
            status === 'MENUNGGU' ? null : sekarang,
            // BR-V7: menyetujui check-in terlambat wajib mengisi menit final.
            status !== 'MENUNGGU' && terlambat ? menitTelat : null,
            sekarang,
          ],
        );
        const idCheckin = Number(rIn.lastInsertRowid);
        hitung.checkin += 1;
        hitung.absen += 1;
        if (status === 'DITOLAK') hitung.ditolak += 1;
        if (status === 'MENUNGGU') hitung.menunggu += 1;
        if (terlambat && status === 'DISETUJUI') hitung.terlambat += 1;

        if (tanpaCheckout || status === 'DITOLAK') continue;

        await run(
          `INSERT INTO absensi
             (request_id, karyawan_id, toko_id, tanggal, jenis, checkin_id, waktu, sumber,
              foto_file_id, foto_chat_id, foto_message_id, lat, lng, lokasi_status,
              status, diverifikasi_oleh, diverifikasi_at, dibuat_at)
           VALUES (?, ?, ?, ?, 'CHECKOUT', ?, ?, 'KARYAWAN', ?, ?, ?, ?, ?, 'TERSEDIA',
                   ?, ?, ?, ?)`,
          [
            `demo-${tanggal}-${k.id}-OUT`,
            k.id,
            idToko,
            tanggal,
            idCheckin,
            `${tanggal}T${jamTambah(jamMasuk, 420 + (v % 120))}:00+07:00`,
            `demo-file-${k.id}-${tanggal}-out`,
            '-1009999999999',
            100000 + (v % 90000),
            titik.lat,
            titik.lng,
            status,
            status === 'MENUNGGU' ? null : adminId,
            status === 'MENUNGGU' ? null : sekarang,
            sekarang,
          ],
        );
        hitung.checkout += 1;
        hitung.absen += 1;
      }
    }

    // --- Penandaan tidak berangkat ----------------------------------------
    // Hanya untuk karyawan yang pada tanggal itu memang tidak punya absensi.
    // Cari pasangan (karyawan, tanggal) yang benar-benar TIDAK punya absensi, lalu
    // tandai. Versi pertama skrip ini hanya mencoba 4 kandidat dan semuanya
    // kebetulan sudah punya absensi, jadi tidak ada satu pun penandaan — cabang
    // "Belum absen dikecualikan penandaan" di dashboard M7 jadi tak teruji.
    // Di sini dipindai sampai Target Achieved penandaan benar-benar ada.
    const TARGET = 6;
    let dibuat = 0;
    // HARI INI didahulukan (mundur 0): tanpa penandaan hari ini, cabang
    // "Belum absen = terjadwal - sudah absen - bertanda" di dashboard M7 tidak
    // pernah teruji — dan itu justru definisi yang paling mudah salah.
    for (const [, k] of karyawan) {
      if (dibuat >= 2) break;
      const ada = await run('SELECT COUNT(*) AS c FROM absensi WHERE karyawan_id = ? AND tanggal = ?', [k.id, hariIni]);
      if (Number((ada.rows[0] as Record<string, unknown>)['c']) > 0) continue;
      const terjadwal = await run('SELECT COUNT(*) AS c FROM jadwal WHERE karyawan_id = ? AND tanggal = ?', [k.id, hariIni]);
      if (Number((terjadwal.rows[0] as Record<string, unknown>)['c']) === 0) continue;
      await run(
        'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, catatan, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [k.id, tokoId.get(k.toko)!, hariIni, 'IZIN', 'Data contoh.', adminId, sekarang],
      );
      dibuat += 1;
    }
    outer: for (let mundur = 1; mundur <= HARI_ABSENSI && dibuat < TARGET; mundur += 1) {
      const tanggal = geserTanggal(hariIni, -mundur);
      for (const [, k] of karyawan) {
        if (dibuat >= TARGET) break outer;
        const ada = await run('SELECT COUNT(*) AS c FROM absensi WHERE karyawan_id = ? AND tanggal = ?', [k.id, tanggal]);
        if (Number((ada.rows[0] as Record<string, unknown>)['c']) > 0) continue;
        const dipakai = await run('SELECT COUNT(*) AS c FROM ketidakhadiran WHERE karyawan_id = ?', [k.id]);
        if (Number((dipakai.rows[0] as Record<string, unknown>)['c']) > 0) continue;
        await run(
          'INSERT INTO ketidakhadiran (karyawan_id, toko_id, tanggal, jenis, catatan, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [k.id, tokoId.get(k.toko)!, tanggal, dibuat % 2 === 0 ? 'IZIN' : 'TANPA_KETERANGAN', 'Data contoh.', adminId, sekarang],
        );
        dibuat += 1;
      }
    }
    hitung.penandaan = dibuat;

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    console.error('Gagal — semua perubahan dibatalkan:', e);
    process.exit(1);
  }

  const hit = await db.execute("SELECT status, COUNT(*) AS c FROM absensi GROUP BY status ORDER BY status");
  console.log(`\nDatabase: ${URL}`);
  console.log(`Tanggal acuan (WIB): ${hariIni}`);
  console.log(`Toko ${TOKO.length} · Karyawan ${KARYAWAN.length} · Penempatan ${KARYAWAN.length}`);
  console.log(`Jadwal bulan berjalan: ${hitung.jadwal}`);
  console.log(`Absensi: ${hitung.absen} baris (check-in ${hitung.checkin}, check-out ${hitung.checkout})`);
  console.log(`  DITOLAK ${hitung.ditolak} · MENUNGGU ${hitung.menunggu} · terlambat ${hitung.terlambat}`);
  console.log('Rincian per status:', hit.rows.map((r) => `${String((r as Record<string, unknown>)['status'])}=${String((r as Record<string, unknown>)['c'])}`).join(' · '));
  console.log('\nCATATAN: foto di data demo ini palsu, jadi /api/foto/[id] akan gagal. Itu disengaja.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
