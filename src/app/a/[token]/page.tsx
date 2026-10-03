import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { muatInfoAbsen } from '../../../server/absen-info';
import AbsenClient from './AbsenClient';

/**
 * Halaman absen karyawan (US-K1). Publik — token link yang memverifikasi.
 * Token tak dikenal/dicabut -> pesan generik (BR-A1), tanpa membocorkan data.
 */
export default async function HalamanAbsen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await muatInfoAbsen(token);
  if (!info) notFound();

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui', fontSize: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: '8px 0 4px' }}>{info.nama}</h1>
        <p style={{ margin: 0, color: 'var(--muted-foreground)' }}>{info.toko}</p>
        <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)' }}>
          {info.tanggalPanjang} · <span suppressHydrationWarning>{info.jam} WIB</span>
        </p>
      </header>

      <section aria-label="Jadwal hari ini" style={gayaKartu}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Jadwal hari ini</h2>
        {!info.jadwal || info.jadwal.slot.length === 0 ? (
          <p style={{ margin: 0 }}>Tidak ada jadwal (absen tetap bisa dilakukan).</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {info.jadwal.slot.map((s, i) => (
              <li key={i}>
                {s.nama} · {s.jam_mulai}–{s.jam_selesai}
                {info.jadwal!.khusus ? ' (Jadwal khusus)' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AbsenClient infoAwal={info} />

      <section aria-label="Absen hari ini" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 16 }}>Absen hari ini</h2>
        <DaftarRiwayat riwayat={info.riwayat} />
      </section>
    </main>
  );
}

/**
 * Latar panel memakai token CSS, bukan warna literal.
 *
 * BUG-UI-07: warna literal seperti `#fff` dan `#ddd` tidak pernah berubah saat
 * mode gelap aktif, jadi panel tetap putih di atas latar gelap — teks putih di
 * atas putih, hampir tidak terbaca. `var(--card)` dan `var(--border)` punya
 * nilai berbeda di `:root` dan `.dark` (src/app/globals.css), jadi panel ikut
 * gelap tanpa logika tambahan.
 */
const gayaKartu: CSSProperties = {
  background: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
};

/** Warna badge status: dua mode, jadi dua set token. */
function gayaBadge(status: string): CSSProperties {
  const dasar = { padding: '2px 8px', borderRadius: 4, fontSize: 14, border: '1px solid transparent' };
  if (status === 'MENUNGGU') return { ...dasar, background: 'var(--badge-menunggu)', color: 'var(--badge-menunggu-teks)', borderColor: 'var(--badge-menunggu-teks)' };
  if (status === 'DISETUJUI') return { ...dasar, background: 'var(--badge-setuju)', color: 'var(--badge-setuju-teks)', borderColor: 'var(--badge-setuju-teks)' };
  return { ...dasar, background: 'var(--badge-ditolak)', color: 'var(--badge-ditolak-teks)', borderColor: 'var(--badge-ditolak-teks)' };
}

export function DaftarRiwayat({ riwayat }: { riwayat: { jenis: string; waktu: string; status: string; alasan_tolak: string | null }[] }) {
  if (riwayat.length === 0) return <p>Belum ada absen hari ini.</p>;
  const labelStatus = (s: string) => (s === 'MENUNGGU' ? 'Menunggu' : s === 'DISETUJUI' ? 'Disetujui' : 'Ditolak');
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {riwayat.map((r, i) => (
        <li key={i} style={{ ...gayaKartu, padding: 10 }}>
          <span>{r.jenis === 'CHECKIN' ? 'Check-in' : 'Check-out'} · {r.waktu} WIB</span>{' '}
          <span style={gayaBadge(r.status)}>{labelStatus(r.status)}</span>
          {r.status === 'DITOLAK' && r.alasan_tolak ? <p style={{ margin: '4px 0 0' }}>Ditolak: {r.alasan_tolak}</p> : null}
        </li>
      ))}
    </ul>
  );
}
