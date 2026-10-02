// Menjalankan seluruh suite tes di TIGA timezone sekaligus (K-44).
//
// Kenapa tiga, bukan dua: UTC dan Asia/Jakarta sama-sama offset non-negatif, jadi
// keduanya memberi jawaban IDENTIK untuk kelas bug "tanggal ikut timezone mesin"
// (bug B-13). Offset negatif (America/New_York, -04:00) satu-satunya yang bisa
// membedakan kode yang benar dari kode yang kelihatan benar.
//
// Bukti: pola salah `new Date(tanggal).getDay()` meleset 6 dari 6 tanggal di
// New York, tapi 0 dari 6 di UTC, Jakarta, maupun Kiritimati (UTC+14).
// Lihat rules/OPEN_QUESTIONS.md B-18 dan rules/NOTES.md §11.
//
// Berkas tes tidak boleh jalan paralel (semuanya memakai data/uji_*.db), jadi
// tiap timezone dijalankan berurutan, bukan bersamaan.
//
// Keluar dengan kode selain 0 kalau timezone mana pun gagal — supaya CI berhenti.

import { spawnSync } from 'node:child_process';

const TIMEZONE = ['UTC', 'Asia/Jakarta', 'America/New_York'];
const gagal = [];

for (const tz of TIMEZONE) {
  process.stdout.write(`\n=== TZ=${tz} ${'='.repeat(Math.max(0, 46 - tz.length))}\n`);
  const hasil = spawnSync('npm', ['test'], {
    stdio: 'inherit',
    env: { ...process.env, TZ: tz },
    shell: false,
  });
  if (hasil.status !== 0) gagal.push(tz);
}

process.stdout.write(`\n${'='.repeat(52)}\n`);
if (gagal.length > 0) {
  console.error(`GAGAL di timezone: ${gagal.join(', ')}`);
  process.exit(1);
}
console.log(`Lulus di semua ${TIMEZONE.length} timezone: ${TIMEZONE.join(', ')}`);
