import type { NextRequest } from 'next/server';

/** Mengambil segmen id numerik terakhir dari path (untuk route [id]). */
export function idTerakhirDariUrl(req: NextRequest): number | null {
  const segmen = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const n = Number(segmen);
  return Number.isInteger(n) && n > 0 ? n : null;
}
