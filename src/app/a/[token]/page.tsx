import { notFound } from 'next/navigation';
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
        <p style={{ margin: 0, color: '#444' }}>{info.toko}</p>
        <p style={{ margin: '4px 0 0', color: '#444' }}>
          {info.tanggalPanjang} · <span suppressHydrationWarning>{info.jam} WIB</span>
        </p>
      </header>

      <section aria-label="Jadwal hari ini" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
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

export function DaftarRiwayat({ riwayat }: { riwayat: { jenis: string; waktu: string; status: string; alasan_tolak: string | null }[] }) {
  if (riwayat.length === 0) return <p>Belum ada absen hari ini.</p>;
  const labelStatus = (s: string) => (s === 'MENUNGGU' ? 'Menunggu' : s === 'DISETUJUI' ? 'Disetujui' : 'Ditolak');
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {riwayat.map((r, i) => (
        <li key={i} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 10 }}>
          <span>{r.jenis === 'CHECKIN' ? 'Check-in' : 'Check-out'} · {r.waktu} WIB</span>{' '}
          <span
            style={{
              background: r.status === 'MENUNGGU' ? '#fef3c7' : r.status === 'DISETUJUI' ? '#dcfce7' : '#fee2e2',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            {labelStatus(r.status)}
          </span>
          {r.status === 'DITOLAK' && r.alasan_tolak ? <p style={{ margin: '4px 0 0' }}>Ditolak: {r.alasan_tolak}</p> : null}
        </li>
      ))}
    </ul>
  );
}
