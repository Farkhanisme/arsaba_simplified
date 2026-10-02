/**
 * Aturan murni jadwal — tanpa akses database (rules/06 §4.2).
 * Memakai ulang validasiJamShift + slotTumpangTindih (M2) dan
 * tanggalValid (aturan penempatan). Tidak menulis ulang.
 */
import { validasiJamShift, slotTumpangTindih, type TipeHari } from './shift';
import { tanggalValid } from './penempatan';
import { jenisHari } from '../waktu';

export interface SlotInput {
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
}

/** BR-J6: slot diurutkan menurut jam_mulai naik (perbandingan string HH:MM sah). */
export function urutkanSlot(slots: SlotInput[]): SlotInput[] {
  return [...slots].sort((a, b) => (a.jam_mulai < b.jam_mulai ? -1 : a.jam_mulai > b.jam_mulai ? 1 : 0));
}

/** K-27: maksimal 2 slot per karyawan per tanggal. */
export function cekBatasSlot(jumlah: number): { boleh: boolean; alasan: string } {
  if (jumlah > 2) return { boleh: false, alasan: 'Maksimal 2 slot per tanggal.' };
  return { boleh: true, alasan: '' };
}

export interface TemplateNama {
  nama: string;
  tipe_hari: TipeHari;
}

/**
 * BR-J2: pilih template berdasarkan NAMA + tipe hari yang cocok untuk tanggal.
 * Template SEMUA selalu cocok. Tanpa padanan -> null (sel DITOLAK pemanggil).
 */
export function slotMemenuhiTipeHari<T extends TemplateNama>(templates: T[], nama: string, tanggal: string): T | null {
  const calon = templates.filter((t) => t.nama === nama);
  if (calon.length === 0) return null;
  const jenis = jenisHari(tanggal);
  const tepat = calon.find((t) => t.tipe_hari === jenis);
  if (tepat) return tepat;
  return calon.find((t) => t.tipe_hari === 'SEMUA') ?? null;
}

/**
 * Gabungkan validasiJamShift (BR-T3) untuk tiap slot + nama wajib diisi.
 * Mengembalikan daftar pesan (kosong = semua valid).
 */
export function adaSlotTakValid(slots: SlotInput[]): string[] {
  const galat: string[] = [];
  slots.forEach((s, i) => {
    const nomor = `Slot ${i + 1}`;
    if (s.nama.trim().length === 0) galat.push(`${nomor}: nama wajib diisi.`);
    const cek = validasiJamShift(s.jam_mulai, s.jam_selesai);
    if (!cek.boleh) galat.push(`${nomor}: ${cek.alasan}`);
  });
  return galat;
}

/**
 * BR-J7: daftar pasangan slot yang tumpang tindih — PERINGATAN, bukan larangan.
 * Pemanggil menampilkan ini lalu TETAP mengizinkan simpan.
 */
export function peringatanTumpangTindih(slots: SlotInput[]): { a: number; b: number }[] {
  const hasil: { a: number; b: number }[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      if (slotTumpangTindih(a.jam_mulai, a.jam_selesai, b.jam_mulai, b.jam_selesai)) {
        hasil.push({ a: i, b: j });
      }
    }
  }
  return hasil;
}

/** Sehari setelah tanggal YYYY-MM-DD (pola Date.UTC + getUTC*, K-45). */
export function tanggalBerikutnya(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) + 24 * 3600 * 1000;
  const w = new Date(t);
  const yy = String(w.getUTCFullYear()).padStart(4, '0');
  const mm = String(w.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(w.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Daftar tanggal dari..sampai inklusif. Validasi di pemanggil route;
 * di sini yang tidak valid menghasilkan daftar kosong (bukan throw).
 */
export function rentangTanggal(dari: string, sampai: string): string[] {
  if (!tanggalValid(dari) || !tanggalValid(sampai) || dari > sampai) return [];
  const hasil: string[] = [];
  let t = dari;
  while (t <= sampai) {
    hasil.push(t);
    t = tanggalBerikutnya(t);
  }
  return hasil;
}

/** Senin = kolom pertama (rules/05 §2). */
const URUT_HARI_SENIN = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function formatUTCms(t: number): string {
  const w = new Date(t);
  const yy = String(w.getUTCFullYear()).padStart(4, '0');
  const mm = String(w.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(w.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function msTanggal(tanggal: string): number {
  const [y, m, d] = tanggal.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/**
 * Senin pada pekan yang memuat tanggal (pola Date.UTC + getUTC*, K-45).
 */
export function awalMinggu(tanggal: string): string {
  const t = msTanggal(tanggal);
  const day = new Date(t).getUTCDay(); // 0 = Minggu
  const mundur = (day + 6) % 7; // Senin = 0
  return formatUTCms(t - mundur * 24 * 3600 * 1000);
}

/**
 * Rentang kolom grid untuk mode tampil + tanggal acuan (rules/05 §5.4).
 * Bulan dibatasi pada bulan kalender tanggal acuan.
 */
export function rentangMode(mode: 'hari' | 'minggu' | 'bulan', tanggal: string): string[] {
  if (!tanggalValid(tanggal)) return [];
  if (mode === 'hari') return [tanggal];
  if (mode === 'minggu') {
    const senin = awalMinggu(tanggal);
    return rentangTanggal(senin, formatUTCms(msTanggal(senin) + 6 * 24 * 3600 * 1000));
  }
  const prefix = tanggal.slice(0, 7);
  const [y, m] = prefix.split('-').map(Number);
  const awal = `${prefix}-01`;
  const akhirHari = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return rentangTanggal(awal, `${prefix}-${String(akhirHari).padStart(2, '0')}`);
}

/** Daftar nama hari Senin-pertama (untuk dokumen/test, bukan logika). */
export function urutanHariSenin(): string[] {
  return [...URUT_HARI_SENIN];
}
