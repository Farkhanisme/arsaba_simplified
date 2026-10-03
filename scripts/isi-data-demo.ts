/**
 * Mengisi database dengan DATA MASTER saja: 10 toko, 26 karyawan, dan
 * penempatannya.
 *
 * ISI SKRIP INI CUMA TIGA TABEL:
 *   - `toko`               (nama)
 *   - `karyawan`           (nama, jabatan)
 *   - `karyawan_penempatan` (karyawan_id, toko_id, berlaku_mulai)
 *
 * YANG SENGAJA TIDAK DIISI dan harus diisi lewat UI:
 *   - `shift_template`  -> Data Master > Shift, per toko
 *   - `jadwal`          -> harus ada shift template lebih dulu
 *   - `absensi`         -> tercatat sendiri saat karyawan absen
 *   - `ketidakhadiran`  -> dicatat admin saat menandai tidak berangkat
 *
 * Kolom `nik`, `alamat`, `nomor_hp`, dan `kontak_darurat` pada `karyawan`
 * sengaja dibiarkan NULL. Semuanya opsional di skema, dan biayanya nol —
 * admin bisa mengisinya nanti lewat Data Master > Karyawan.
 *
 * KENAPA SKRIP TERPISAH DARI scripts/seed.ts:
 *   seed.ts dipakai 22 file tes (hanya berisi 2 akun admin). Kalau data master
 *   ikut masuk ke sana, seluruh tes M2 dan M5 ikut berubah. seed.ts TIDAK diubah.
 *
 * CARA PAKAI:
 *   npx tsx scripts/isi-data-demo.ts            # isi data/demo.db
 *   TURSO_DATABASE_URL='libsql://...' TURSO_AUTH_TOKEN='...' \
 *     npx tsx scripts/isi-data-demo.ts           # isi database Turso
 *   npx tsx scripts/isi-data-demo.ts --force    # kosongkan lalu isi ulang
 *
 * CATATAN SOAL --force:
 *   --force mengosongkan SELURUH tabel yang bergantung padanya, bukan cuma tiga
 *   di atas. Itu wajib: `absensi` dan `jadwal` mereferensikan `karyawan`, jadi `karyawan`
 *   tidak bisa dihapus selama baris-baris itu masih ada. Menghapus jadwal dan
 *   absensi berarti database benar-benar bersih, bukan setengah bersih.
 */
process.loadEnvFile('.env.local');

import { createClient } from '@libsql/client';
import { serialisasiWIB } from '../src/server/waktu';

const MULAI_PENEMPATAN = '2026-01-01';
const FORCE = process.argv.includes('--force');

const URL = process.env['TURSO_DATABASE_URL'] ?? 'file:./data/demo.db';
const TOKEN = process.env['TURSO_AUTH_TOKEN'];

/**
 * Tabel yang di-dikosongkan dengan DELETE saat --force. Urutan dari yang paling bergantung padanya
 * (absensi) ke yang paling induk (toko) — memutar urutan ini membuat
 * FOREIGN KEY constraint gagal.
 */
const TABEL_KOSONG = [
  'absensi',
  'jadwal_slot',
  'jadwal',
  'ketidakhadiran',
  'shift_template',
  'karyawan_penempatan',
  'karyawan',
  'toko',
];

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
  if (!Number((admin.rows[0] as Record<string, unknown>)['id'])) {
    console.error('Belum ada akun admin. Jalankan `npm run migrate` lalu `npx tsx scripts/seed.ts` lebih dulu.');
    process.exit(1);
  }

  const sekarang = serialisasiWIB();

  const tx = await db.transaction();
  /** Transaction.execute hanya menerima bentuk objek. */
  type Arg = string | number | null;
  const run = (sql: string, args: Arg[] = []) => tx.execute({ sql, args });

  try {
    if (FORCE) {
      for (const t of TABEL_KOSONG) {
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
    // Hanya nama dan jabatan. NIK, alamat, nomor HP, dan kontak darurat
    // dibiarkan NULL — semuanya opsional di skema.
    for (const [nama, toko, jabatan] of KARYAWAN) {
      const r = await run('INSERT INTO karyawan (nama, jabatan, aktif, dibuat_at) VALUES (?, ?, 1, ?)', [
        nama,
        jabatan,
        sekarang,
      ]);
      await run('INSERT INTO karyawan_penempatan (karyawan_id, toko_id, berlaku_mulai) VALUES (?, ?, ?)', [
        Number(r.lastInsertRowid),
        tokoId.get(toko)!,
        MULAI_PENEMPATAN,
      ]);
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    console.error('Gagal — semua perubahan dibatalkan:', e);
    process.exit(1);
  }

  console.log(`\nDatabase: ${URL}`);
  console.log(`Toko ${TOKO.length} · Karyawan ${KARYAWAN.length} · Penempatan ${KARYAWAN.length}`);
  console.log(`Penempatan berlaku mulai ${MULAI_PENEMPATAN}`);
  console.log('\nSudah terisi:');
  console.log('  - nama toko (10)');
  console.log('  - nama karyawan + jabatan (26)');
  console.log('  - penempatan karyawan ke toko (26)');
  console.log('\nBELUM terisi — isi lewat UI, bukan lewat skrip ini:');
  console.log('  1. Shift template per toko   : Data Master > Shift');
  console.log('  2. Jadwal                    : Jadwal (butuh shift template dulu)');
  console.log('  3. NIK / alamat / HP         : Data Master > Karyawan (opsional)');
  console.log('  4. Absensi                   : tercatat sendiri saat karyawan absen');
  console.log('\nSampai shift template diisi, halaman Jadwal akan kosong dan dashboard');
  console.log('menampilkan angka nol. Itu normal — bukan kegagalan skrip ini.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});