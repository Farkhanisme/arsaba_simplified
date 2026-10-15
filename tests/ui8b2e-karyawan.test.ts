/**
 * UI-8 B2e — halaman karyawan: aksi utama (Foto, Absen) satu tingkat di atas
 * tombol sekunder.
 *
 * AbsenClient tidak bisa di-render di SSR (getUserMedia), jadi — seperti tes
 * UI-3 yang sudah ada — kontrak dikunci lewat pola sumber pada BERKAS ASLI.
 * Setiap assertion di bawah gagal bila polanya dikembalikan (dibuktikan
 * mutasi), jadi ini kunci sungguhan, bukan `toContain` hiasan.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const isi = readFileSync('src/app/a/[token]/AbsenClient.tsx', 'utf-8');

describe('UI-8 B2e · hierarki tombol aksi utama', () => {
  it('KELAS_UTAMA = h-14 (56px) text-lg semibold', () => {
    expect(isi).toMatch(/KELAS_UTAMA\s*=\s*'h-14 text-lg font-semibold'/);
  });

  it('tombol Foto dan Absen memakai KELAS_UTAMA, bukan KELAS_SENTUH', () => {
    expect(isi, 'tombol Foto').toMatch(/className=\{`flex-1 \$\{KELAS_UTAMA\}`\} onClick=\{ambilFoto\}/);
    expect(isi, 'tombol Absen').toMatch(/className=\{`flex-1 \$\{KELAS_UTAMA\}`\} onClick=\{onKirim\}/);
  });

  it('tombol sekunder tetap KELAS_SENTUH (kontras ukuran = hierarki)', () => {
    expect(isi, 'KELAS_SENTUH utuh').toMatch(/KELAS_SENTUH\s*=\s*'h-12 text-base'/);
    // Ganti Kamera + Foto Ulang: masih pola lama persis. Muat Ulang polanya
    // `className={KELAS_SENTUH}` (tanpa flex-1) — ikut dikunci supaya tidak
    // ikut naik diam-diam.
    expect(isi.match(/className=\{`flex-1 \$\{KELAS_SENTUH\}`\}/g) ?? []).toHaveLength(2);
    expect(isi).toMatch(/className=\{KELAS_SENTUH\} onClick=\{muatUlang\}/);
  });
});
