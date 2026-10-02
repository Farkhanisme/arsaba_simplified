import type { Executor } from '../audit';

export const AMBANG_DEFAULT = 5;

/** Membaca ambang_terlambat_menit (default 5 bila belum ada). */
export async function bacaAmbang(ex: Executor): Promise<number> {
  const res = await ex.execute({
    sql: "SELECT nilai FROM pengaturan WHERE kunci = 'ambang_terlambat_menit'",
    args: [],
  });
  const baris = res.rows[0] as Record<string, unknown> | undefined;
  if (!baris) return AMBANG_DEFAULT;
  const n = Number(baris['nilai']);
  return Number.isInteger(n) && n >= 0 ? n : AMBANG_DEFAULT;
}

export async function ubahAmbang(
  nilai: number,
  diubahOleh: number,
  diubahAt: string,
  ex: Executor,
): Promise<number> {
  await ex.execute({
    sql: "INSERT INTO pengaturan (kunci, nilai, diubah_at, diubah_oleh) VALUES ('ambang_terlambat_menit', ?, ?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_at = excluded.diubah_at, diubah_oleh = excluded.diubah_oleh",
    args: [String(nilai), diubahAt, diubahOleh],
  });
  return bacaAmbang(ex);
}
