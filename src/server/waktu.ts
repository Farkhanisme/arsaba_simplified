/**
 * Satu-satunya modul yang memanipulasi waktu untuk aplikasi — sesuai rules/03 §5 (K-45).
 * Semua operasi tanggal/jam dilakukan dalam OFFSET TETAP +07:00 (WIB), tanpa DST.
 * Tidak bergantung pada timezone mesin: tidak memakai getHours/getDate/getFullYear/getDay
 * lokal — semua memakai getUTC* setelah menggeser instant dengan +7 jam eksplisit.
 */

// Offset tetap WIB dalam milidetik — tidak memakai DST, selalu +07:00
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function shiftWIB(instant?: Date | string | number): Date {
  const d = instant ? new Date(instant) : new Date();
  // Geser ke format yang merepresentasikan WIB: timestamp UTC sama dengan waktu WIB
  return new Date(d.getTime() + WIB_OFFSET_MS);
}

/**
 * Mengembalikan Date absolut UTC yang, jika dibaca sebagai UTC lokal, sama dengan WIB saat ini.
 * Catatan: ini bukan "waktu lokal mesin"; ini waktu yang harus diproses lewat getUTC*().
 */
export function sekarangWIB(): Date {
  return shiftWIB();
}

/**
 * Tanggal (YYYY-MM-DD) dalam WIB untuk instant yang diberikan.
 */
export function tanggalWIB(instant?: Date | string | number): string {
  const wib = shiftWIB(instant);
  const y = String(wib.getUTCFullYear()).padStart(4, '0');
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Menit dalam hari (0..1439) dalam WIB untuk instant.
 * Detik HARUS diabaikan — hanya jam dan menit yang dihitung.
 */
export function menitDalamHari(instant: Date | string | number): number {
  const wib = shiftWIB(instant);
  const jam = wib.getUTCHours();
  const menit = wib.getUTCMinutes();
  return jam * 60 + menit;
}

/**
 * Menentukan apakah tanggal (format YYYY-MM-DD) adalah WEEKDAY atau WEEKEND.
 * Weekend = Sabtu (6) dan Minggu (0), sesuai rules/03 §5 / BR-T2.
 */
export function jenisHari(tanggal: string): 'WEEKDAY' | 'WEEKEND' {
  const parts = tanggal.split('-');
  if (parts.length !== 3) throw new Error('Format tanggal tidak valid');
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  const d = parseInt(parts[2]!, 10);
  // Buat objek UTC murni dari tanggal, tanpa offset lokal mesin
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const hari = dateObj.getUTCDay(); // 0 = Minggu, 6 = Sabtu
  return hari === 0 || hari === 6 ? 'WEEKEND' : 'WEEKDAY';
}

/**
 * Serialisasi instant ke string ISO 8601 dengan offset eksplisit +07:00.
 * Semua komponen (tahun, bulan, hari, jam, menit, detik) diambil dari WIB, bukan lokal mesin.
 */
export function serialisasiWIB(instant?: Date | string | number): string {
  const wib = shiftWIB(instant);
  const y = String(wib.getUTCFullYear()).padStart(4, '0');
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wib.getUTCDate()).padStart(2, '0');
  const jam = String(wib.getUTCHours()).padStart(2, '0');
  const menit = String(wib.getUTCMinutes()).padStart(2, '0');
  const detik = String(wib.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${jam}:${menit}:${detik}+07:00`;
}

/**
 * Menggeser sebuah waktu ISO (ber-offset +07:00) sejauh `jam` jam, hasilnya
 * tetap ISO dengan offset +07:00. Dipakai untuk batas 20 jam check-out mandiri
 * (BR-A10): pemanggil membandingkan string hasilnya secara leksikal — sah
 * karena semua waktu memakai offset yang sama (rules/04 §5).
 *
 * Tidak ada aritmetika manual pada string dan tidak ada metode get* lokal:
 * selisih dihitung pada timestamp absolut (getTime, tidak bergantung zona).
 */
export function geserJamISO(waktuISO: string, jam: number): string {
  const t = new Date(waktuISO).getTime();
  if (Number.isNaN(t)) throw new Error('Waktu ISO tidak valid');
  return serialisasiWIB(new Date(t + jam * 3600 * 1000));
}

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Format panjang Indonesia untuk display, mis. "Rabu, 30 Sep 2026"
 * (rules/05 §2). Murni string YYYY-MM-DD -> string; memakai Date.UTC/getUTC*
 * sehingga tidak bergantung timezone mesin (K-45).
 */
export function tanggalPanjangWIB(tanggal: string): string {
  const bagian = tanggal.split('-');
  if (bagian.length !== 3) throw new Error('Format tanggal tidak valid');
  const y = Number(bagian[0]);
  const m = Number(bagian[1]);
  const d = Number(bagian[2]);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${NAMA_HARI[hari]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/**
 * Nama hari Bahasa Indonesia untuk tanggal YYYY-MM-DD (grid jadwal M5).
 * WAJIB memakai pola Date.UTC + getUTCDay seperti tanggalPanjangWIB.
 * DILARANG `new Date(tanggal).getDay()`: tanggal tanpa offset di-parse
 * sebagai midnight UTC lalu getDay() membaca timezone mesin (kelas bug B-13:
 * benar di UTC/Jakarta, salah di New York — lihat B-18).
 */
export function namaHariWIB(tanggal: string): string {
  const bagian = tanggal.split('-');
  if (bagian.length !== 3) throw new Error('Format tanggal tidak valid');
  const y = Number(bagian[0]);
  const m = Number(bagian[1]);
  const d = Number(bagian[2]);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const nama = NAMA_HARI[hari];
  if (!nama) throw new Error('Format tanggal tidak valid');
  return nama;
}
