/**
 * Kompresi foto otomatis di browser (K-53, rules/05 §3a).
 *
 * Karyawan tidak melihat proses ini: JPEG, sisi terpanjang 1600 px,
 * kualitas awal 0,75 diturunkan bertahap, hasil akhir wajib di bawah
 * 4,5 MB (batas Vercel). Bila masih besar di kualitas terendah -> null
 * (halaman menampilkan "Foto terlalu besar, ambil ulang dengan
 * pencahayaan lebih baik") dan request TIDAK dikirim.
 */

/** Sisi terpanjang keluaran (K-53). */
export const SISI_MAKS_PX = 1600;
/** Kualitas awal (K-53), lalu turun bertahap. */
export const LANGKAH_KUALITAS = [0.75, 0.6, 0.5, 0.4, 0.3];
/** Target ukuran dengan margin dari batas keras 4,5 MB Vercel. */
export const TARGET_BYTE = 4_400_000;

/** Hitung dimensi muat-dalam-kotak: hanya mengecilkan, rasio dipertahankan. */
export function hitungDimensi(lebar: number, tinggi: number, sisiMaks = SISI_MAKS_PX): { lebar: number; tinggi: number } {
  const sisi = Math.max(lebar, tinggi);
  if (sisi <= sisiMaks) return { lebar, tinggi };
  const skala = sisiMaks / sisi;
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

export interface GambarSumber {
  lebar: number;
  tinggi: number;
}

/**
 * Loop kompresi: resize SEKALI di awal, lalu hanya kualitas yang diturunkan
 * (bukan pixel dihapus). `encode(dimensi, kualitas)` disuntik agar bisa diuji
 * tanpa canvas; implementasi browser ada di bawah.
 *
 * Mengembalikan { blob, kualitas } pertama yang <= target, atau null bila
 * semua langkah masih melebihi target.
 */
export async function kompresDenganEncoder(
  gambar: GambarSumber,
  encode: (dimensi: { lebar: number; tinggi: number }, kualitas: number) => Promise<Blob>,
  target = TARGET_BYTE,
): Promise<{ blob: Blob; kualitas: number } | null> {
  const dimensi = hitungDimensi(gambar.lebar, gambar.tinggi);
  for (const kualitas of LANGKAH_KUALITAS) {
    const blob = await encode(dimensi, kualitas);
    if (blob.size <= target) return { blob, kualitas };
  }
  return null;
}

/**
 * Implementasi browser: decode Blob -> canvas 1600 px -> JPEG bertahap.
 * Hanya dipanggil di browser (memakai createImageBitmap + canvas).
 */
export async function kompresBlobBrowser(blob: Blob): Promise<{ blob: Blob; kualitas: number } | null> {
  const bitmap = await createImageBitmap(blob);
  try {
    const dimensi = hitungDimensi(bitmap.width, bitmap.height);
    const kanvas = document.createElement('canvas');
    kanvas.width = dimensi.lebar;
    kanvas.height = dimensi.tinggi;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas tidak tersedia.');
    ctx.drawImage(bitmap, 0, 0, dimensi.lebar, dimensi.tinggi);
    const encode = (d: { lebar: number; tinggi: number }, kualitas: number): Promise<Blob> =>
      new Promise((selesai, gagal) => {
        // d selalu sama dengan dimensi kanvas (resize sekali di atas).
        void d;
        kanvas.toBlob(
          (hasil) => {
            if (hasil) selesai(hasil);
            else gagal(new Error('Foto tidak dapat diproses. Coba lagi.'));
          },
          'image/jpeg',
          kualitas,
        );
      });
    return kompresDenganEncoder({ lebar: bitmap.width, tinggi: bitmap.height }, encode);
  } finally {
    bitmap.close();
  }
}
