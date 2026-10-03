import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 640 }}>
      <h1>Arsaba Management Center</h1>
      <p>Aplikasi internal untuk absensi karyawan Arsaba.</p>
      <p>
        Karyawan membuka tautan absen pribadi dari admin. Admin mengelola
        jadwal, verifikasi, dan rekap setelah masuk.
      </p>
      <p>
        <Link href="/login">Masuk sebagai admin</Link>
      </p>
    </main>
  );
}
