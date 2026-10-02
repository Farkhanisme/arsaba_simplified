import type { Executor } from '../audit';

export interface Karyawan {
  id: number;
  nama: string;
  nik: string | null;
  jabatan: string | null;
  alamat: string | null;
  nomor_hp: string | null;
  kontak_darurat: string | null;
  aktif: number;
  dibuat_at: string;
}

export interface DataKaryawan {
  nama: string;
  nik: string | null;
  jabatan: string | null;
  alamat: string | null;
  nomor_hp: string | null;
  kontak_darurat: string | null;
}

/**
 * NIK kosong ('') dinormalisasi menjadi NULL agar dua karyawan tanpa NIK
 * diterima (UNIQUE SQLite menganggap NULL berbeda). Nilai lain disimpan
 * persis apa adanya, termasuk yang berisi spasi.
 */
export function normalisasiNik(nik: string | null | undefined): string | null {
  if (nik === undefined || nik === null || nik === '') return null;
  return nik;
}

const KOLOM = 'id, nama, nik, jabatan, alamat, nomor_hp, kontak_darurat, aktif, dibuat_at';

export async function daftarKaryawan(ex: Executor): Promise<Karyawan[]> {
  const res = await ex.execute({ sql: `SELECT ${KOLOM} FROM karyawan ORDER BY nama ASC`, args: [] });
  return res.rows as unknown as Karyawan[];
}

export async function karyawanById(id: number, ex: Executor): Promise<Karyawan | null> {
  const res = await ex.execute({ sql: `SELECT ${KOLOM} FROM karyawan WHERE id = ?`, args: [id] });
  const baris = res.rows[0] as unknown as Karyawan | undefined;
  return baris ?? null;
}

export async function buatKaryawan(data: DataKaryawan, dibuatAt: string, ex: Executor): Promise<number> {
  await ex.execute({
    sql: 'INSERT INTO karyawan (nama, nik, jabatan, alamat, nomor_hp, kontak_darurat, aktif, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    args: [
      data.nama,
      normalisasiNik(data.nik),
      data.jabatan,
      data.alamat,
      data.nomor_hp,
      data.kontak_darurat,
      dibuatAt,
    ],
  });
  const res = await ex.execute({ sql: 'SELECT last_insert_rowid() AS id', args: [] });
  return Number((res.rows[0] as Record<string, unknown>)['id']);
}

export async function ubahKaryawan(
  id: number,
  ubahan: Partial<DataKaryawan> & { aktif?: number },
  ex: Executor,
): Promise<Karyawan | null> {
  if (ubahan.nama !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET nama = ? WHERE id = ?', args: [ubahan.nama, id] });
  }
  if (ubahan.nik !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET nik = ? WHERE id = ?', args: [normalisasiNik(ubahan.nik), id] });
  }
  if (ubahan.jabatan !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET jabatan = ? WHERE id = ?', args: [ubahan.jabatan, id] });
  }
  if (ubahan.alamat !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET alamat = ? WHERE id = ?', args: [ubahan.alamat, id] });
  }
  if (ubahan.nomor_hp !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET nomor_hp = ? WHERE id = ?', args: [ubahan.nomor_hp, id] });
  }
  if (ubahan.kontak_darurat !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET kontak_darurat = ? WHERE id = ?', args: [ubahan.kontak_darurat, id] });
  }
  if (ubahan.aktif !== undefined) {
    await ex.execute({ sql: 'UPDATE karyawan SET aktif = ? WHERE id = ?', args: [ubahan.aktif, id] });
  }
  return karyawanById(id, ex);
}
