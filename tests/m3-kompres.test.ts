import { describe, it, expect } from 'vitest';
import {
  hitungDimensi,
  kompresDenganEncoder,
  LANGKAH_KUALITAS,
  SISI_MAKS_PX,
  TARGET_BYTE,
} from '../src/lib/kompres';

describe('kompresi — dimensi (K-53)', () => {
  it('sisi terpanjang <= 1600 px, rasio dipertahankan', () => {
    expect(SISI_MAKS_PX).toBe(1600);
    const hasil = hitungDimensi(4000, 3000);
    expect(Math.max(hasil.lebar, hasil.tinggi)).toBeLessThanOrEqual(1600);
    expect(hasil.lebar / hasil.tinggi).toBeCloseTo(4000 / 3000, 5);
  });

  it('foto kecil tidak diperbesar', () => {
    expect(hitungDimensi(800, 600)).toEqual({ lebar: 800, tinggi: 600 });
  });

  it('foto tegak dikecilkan dari sisi tinggi', () => {
    const hasil = hitungDimensi(3000, 4000);
    expect(hasil.tinggi).toBe(1600);
    expect(hasil.lebar).toBe(1200);
  });
});

describe('kompresi — loop kualitas (K-53)', () => {
  function encoderUkuranTergantungKualitas(ukuranPenuh: number) {
    const dimensiDipakai: { lebar: number; tinggi: number }[] = [];
    const encode = async (dimensi: { lebar: number; tinggi: number }, kualitas: number): Promise<Blob> => {
      dimensiDipakai.push(dimensi);
      // Stub: ukuran sebanding kualitas (seperti JPEG asli).
      const isi = new Uint8Array(Math.round(ukuranPenuh * kualitas));
      return new Blob([isi], { type: 'image/jpeg' });
    };
    return { encode, dimensiDipakai };
  }

  it('kualitas awal 0,75; berhenti di langkah pertama bila cukup', () => {
    expect(LANGKAH_KUALITAS[0]).toBe(0.75);
  });

  it('hasil akhir di bawah 4,5 MB', async () => {
    const { encode } = encoderUkuranTergantungKualitas(6_000_000);
    const hasil = await kompresDenganEncoder({ lebar: 4000, tinggi: 3000 }, encode);
    expect(hasil).not.toBeNull();
    expect(hasil!.blob.size).toBeLessThan(TARGET_BYTE);
    expect(TARGET_BYTE).toBeLessThan(4_500_000);
  });

  it('kualitas diturunkan bertahap (bukan pixel dihapus): dimensi encode SELALU sama', async () => {
    const { encode, dimensiDipakai } = encoderUkuranTergantungKualitas(10_000_000);
    const hasil = await kompresDenganEncoder({ lebar: 4000, tinggi: 3000 }, encode);
    expect(hasil).not.toBeNull();
    expect(dimensiDipakai.length).toBeGreaterThan(1);
    // Semua langkah memakai dimensi resize yang sama (1600-px, sekali).
    for (const d of dimensiDipakai) {
      expect(Math.max(d.lebar, d.tinggi)).toBeLessThanOrEqual(1600);
      expect(d).toEqual(dimensiDipakai[0]);
    }
    // ...tetapi kualitas yang dipakai adalah langkah yang lebih rendah.
    expect(hasil!.kualitas).toBeLessThan(0.75);
  });

  it('bila semua langkah masih besar -> null (jangan kirim, tampilkan pesan)', async () => {
    const { encode } = encoderUkuranTergantungKualitas(100_000_000);
    const hasil = await kompresDenganEncoder({ lebar: 4000, tinggi: 3000 }, encode);
    expect(hasil).toBeNull();
  });
});
