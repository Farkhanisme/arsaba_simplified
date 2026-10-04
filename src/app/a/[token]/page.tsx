import { notFound } from 'next/navigation';
import { muatInfoAbsen } from '../../../server/absen-info';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AbsenClient from './AbsenClient';

/**
 * Halaman absen karyawan (US-K1). Publik — token link yang memverifikasi.
 * Token tak dikenal/dicabut -> pesan generik (BR-A1), tanpa membocorkan data.
 *
 * Memakai komponen shadcn (Card, Badge, Separator) sejak 2026-10-03. Sebelumnya
 * 100% inline style dengan warna literal, yang membuat panel tetap putih saat
 * mode gelap aktif (BUG-UI-07). Warna sekarang datang dari token CSS shadcn,
 * jadi otomatis mengikuti mode terang dan gelap.
 *
 * Komponen-komponen ini ringan: tidak ada grafik, tidak ada dialog, tidak ada
 * state. rules/05 §3 merancang alur ini sengaja sesederhana mungkin karena
 * dipakai 26 orang di HP dengan jaringan seluler.
 */
export default async function HalamanAbsen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await muatInfoAbsen(token);
  if (!info) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 p-4 animate-in fade-in duration-300 motion-reduce:animate-none">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{info.nama}</h1>
        <p className="text-sm text-muted-foreground">{info.toko}</p>
        <p className="text-sm text-muted-foreground">
          {info.tanggalPanjang} · <span suppressHydrationWarning>{info.jam} WIB</span>
        </p>
      </header>

      {/* Jarak antar kartu datang dari gap-4 pada <main>.
          Sebelumnya jarak ini hilang karena marginBottom ikut hilang saat
          gayaKartu diekstrak (BUG-UI-08). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal hari ini</CardTitle>
        </CardHeader>
        <CardContent>
          {!info.jadwal || info.jadwal.slot.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada jadwal (absen tetap bisa dilakukan).</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {info.jadwal.slot.map((s, i) => (
                <li key={i} className="text-sm">
                  {s.nama} · {s.jam_mulai}–{s.jam_selesai}
                  {info.jadwal!.khusus ? ' (Jadwal khusus)' : ''}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AbsenClient infoAwal={info} />

      <Separator />

      <section aria-label="Absen hari ini" className="flex flex-col gap-2">
        <h2 className="text-base font-medium">Absen hari ini</h2>
        <DaftarRiwayat riwayat={info.riwayat} />
      </section>
    </main>
  );
}

/** Variant Badge per status. Teksnya selalu ikut — warna tidak pernah jadi satu-satunya pembawa arti. */
function variantStatus(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'MENUNGGU') return 'secondary';
  if (status === 'DITOLAK') return 'destructive';
  return 'default';
}

export function DaftarRiwayat({ riwayat }: { riwayat: { jenis: string; waktu: string; status: string; alasan_tolak: string | null }[] }) {
  if (riwayat.length === 0) return <p className="text-sm text-muted-foreground">Belum ada absen hari ini.</p>;
  const labelStatus = (s: string) => (s === 'MENUNGGU' ? 'Menunggu' : s === 'DISETUJUI' ? 'Disetujui' : 'Ditolak');
  return (
    <ul className="flex flex-col gap-2">
      {riwayat.map((r, i) => (
        <Card key={i} className="animate-in fade-in slide-in-from-bottom duration-300 motion-reduce:animate-none">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm">
              {r.jenis === 'CHECKIN' ? 'Check-in' : 'Check-out'} · {r.waktu} WIB
            </span>
            <Badge variant={variantStatus(r.status)}>{labelStatus(r.status)}</Badge>
            {r.status === 'DITOLAK' && r.alasan_tolak ? (
              <p className="w-full text-xs text-muted-foreground">Ditolak: {r.alasan_tolak}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}