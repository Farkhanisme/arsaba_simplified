import { describe, it, expect } from 'vitest';
import {
  serialisasiWIB,
  sekarangWIB,
  tanggalWIB,
  menitDalamHari,
} from '../src/server/waktu';

/**
 * Penjaga-jaga yang akan menangkap kelas bug "waktu geser dua kali".
 *
 * BUG-01 (2026-10-03): pola `serialisasiWIB(sekarangWIB())` dipakai di 88 call site.
 * Karena `sekarangWIB()` SUDAH mengembalikan Date yang digeser +07:00, mengumpannya
 * lagi ke fungsi waktu lain menggeser dua kali — hasilnya 7 jam di masa depan.
 * Semua `dibuat_at`, `diubah_at`, `diverifikasi_at`, dan audit `waktu` terpengaruh.
 *
 * Bug itu TIDAK bisa ditangkap `test:tz`: selisihnya absolut, sama di semua timezone.
 * Yang menangkapnya adalah tes di bawah — membandingkan timestamp yang dihasilkan
 * aplikasi dengan waktu nyata, bukan antar-tes yang sama-sama salah.
 */

/** Selisih dalam menit antara dua string ISO. */
function selisihMenit(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 60_000;
}

describe('penjaga geser-ganda (BUG-01)', () => {
  it('serialisasiWIB() tanpa argumen = waktu sekarang, bukan 7 jam ke depan', () => {
    const nyata = serialisasiWIB(new Date());
    expect(selisihMenit(serialisasiWIB(), nyata)).toBeLessThan(1);
  });

  it('tanggalWIB() tanpa argumen cocok dengan tanggal pada serialisasiWIB()', () => {
    // Kalau ada yang menulis tanggalWIB(sekarangWIB()), tanggal ini bergeser
    // satu HARI dan seluruh data demo/riwayat masuk ke tanggal yang salah.
    expect(tanggalWIB()).toBe(serialisasiWIB().slice(0, 10));
    expect(tanggalWIB(new Date())).toBe(tanggalWIB());
  });

  it('menitDalamHari(now) cocok dengan jam pada serialisasiWIB()', () => {
    // menitDalamHari mengharuskan argumen (tidak opsional) — itu memang lebih aman:
    // pemanggil wajib menyebut instant, jadi tidak ada yang diam-diam memakai jam mesin.
    const jam = serialisasiWIB().slice(11, 13);
    const menit = serialisasiWIB().slice(14, 16);
    expect(menitDalamHari(new Date())).toBe(Number(jam) * 60 + Number(menit));
  });

  it('MENANDAKAN jebakan: sekarangWIB() sudah digeser, jangan diumpankan lagi', () => {
    // Tes ini sengaja menghidupkan kembali pola yang pernah ada di 88 call site,
    // supaya kalau ada yang memakainya lagi, ia melihat sendiri bedanya.
    const benar = serialisasiWIB();
    const geserGanda = serialisasiWIB(sekarangWIB());
    expect(selisihMenit(geserGanda, benar)).toBe(420); // tepat 7 jam

    const t = serialisasiWIB();
    expect(tanggalWIB(sekarangWIB())).not.toBe(t.slice(0, 10)); // bisa bergeser sehari
  });

  it('hasil serialisasiWIB() selalu offset +07:00 yang konsisten', () => {
    // Kalau ada yang menggeser dengan cara lain (mis. getTimezoneOffset lokal),
    // bentuk stringnya akan berbeda walau jamnya kebetulan cocok.
    expect(serialisasiWIB()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
  });

  it('serialisasiWIB(new Date(...)) sama dengan bentuk ISO dari instant itu', () => {
    const instan = '2026-10-03T02:05:45Z';
    expect(serialisasiWIB(instan)).toBe('2026-10-03T09:05:45+07:00');
  });
});
