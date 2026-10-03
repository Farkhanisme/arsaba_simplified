'use client';

/**
 * Interaksi absen karyawan (K-52, K-53, BR-A2, BR-A3).
 *
 * Alur: pratinjau langsung -> [Foto][Ganti Kamera] -> foto diambil ->
 * [Foto Ulang][Absen] -> kirim -> Telegram. Tanpa <input type="file">.
 * Kompresi JPEG otomatis (src/lib/kompres.ts). Lokasi apa pun tidak
 * menghalangi kirim. request_id dibuat saat foto diambil, dipakai ulang
 * untuk percobaan ulang foto yang sama; Foto Ulang -> request_id baru.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import type { InfoAbsen } from '../../../server/absen-info';
import { kompresBlobBrowser } from '../../../lib/kompres';

type StatusLokasi = { keadaan: 'TERSEDIA'; lat: number; lng: number } | { keadaan: 'DITOLAK' | 'GAGAL' | 'BELUM' };

/**
 * Gaya bersama memakai token CSS, bukan warna literal.
 *
 * BUG-UI-07: `background: '#fff'` dan `border: '1px solid #ddd'` tidak pernah
 * berubah saat mode gelap aktif. Panel tetap putih, teks tetap gelap — di HP
 * layar terang kontrasnya batas, di layar gelap hampir tidak terbaca.
 *
 * Token `--card`, `--border`, `--foreground` punya nilai berbeda di `:root` dan
 * `.dark` (src/app/globals.css), jadi semua ikut gelap tanpa logika tambahan.
 */
const gayaKartu: CSSProperties = {
  background: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
};

/** Tombol besar: tinggi sentuh 44px (K-53) + warna token. */
const gayaTombol: CSSProperties = {
  flex: 1,
  padding: 12,
  fontSize: 16,
  minHeight: 44,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--secondary)',
  color: 'var(--secondary-foreground)',
  cursor: 'pointer',
};

/** Tombol utama (aksi absen) — warna primary, tetap terbaca di dua mode. */
const gayaTombolUtama: CSSProperties = {
  ...gayaTombol,
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  borderColor: 'var(--primary)',
};

/** Tombol nonaktif. */
const gayaTombolMati: CSSProperties = {
  ...gayaTombol,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const gayaTombolMatiUtama: CSSProperties = {
  ...gayaTombolUtama,
  opacity: 0.5,
  cursor: 'not-allowed',
};

/**
 * Warna pesan. Semuanya lewat token supaya kontrasnya terjamin di dua mode —
 * warna literal `#fee2e2` di mode gelap jadi abu-abu muda dengan teks merah tua
 * yang nyaris tidak terbaca.
 */
const gayaPesanSukses: CSSProperties = {
  background: 'var(--badge-setuju)',
  color: 'var(--badge-setuju-teks)',
  border: '1px solid var(--badge-setuju-teks)',
  padding: 8,
  borderRadius: 4,
  margin: '8px 0 0',
};

const gayaPesanGalat: CSSProperties = {
  background: 'var(--badge-ditolak)',
  color: 'var(--badge-ditolak-teks)',
  border: '1px solid var(--badge-ditolak-teks)',
  padding: 8,
  borderRadius: 4,
  margin: '8px 0 0',
};

const gayaPesanPeringatan: CSSProperties = {
  background: 'var(--badge-menunggu)',
  color: 'var(--badge-menunggu-teks)',
  border: '1px solid var(--badge-menunggu-teks)',
  padding: 8,
  borderRadius: 4,
  margin: '8px 0 0',
};

export default function AbsenClient({ infoAwal }: { infoAwal: InfoAbsen }) {
  // Token dibaca dari URL di browser (pemilik link sudah memilikinya lewat
  // URL) — tidak dikirim lewat props agar tak terserialisasi ke HTML.
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [info, setInfo] = useState<InfoAbsen>(infoAwal);
  const [kamera, setKamera] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [galatKamera, setGalatKamera] = useState<string | null>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState<StatusLokasi>({ keadaan: 'BELUM' });
  const [mengirim, setMengirim] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: 'sukses' | 'galat'; teks: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const mulaiKamera = useCallback(async (mode: 'user' | 'environment') => {
    setGalatKamera(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGalatKamera('Kamera tidak ditemukan di perangkat ini.');
        return;
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      setStream((lama) => {
        lama?.getTracks().forEach((t) => t.stop());
        return s;
      });
      setKamera(mode);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        setGalatKamera('Izin kamera diperlukan untuk absen. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.');
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        setGalatKamera('Kamera tidak ditemukan di perangkat ini.');
      } else {
        setGalatKamera('Kamera tidak dapat dibuka. Coba lagi.');
      }
    }
  }, []);

  // Kamera + lokasi dimulai saat halaman dibuka.
  useEffect(() => {
    void mulaiKamera('user');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLokasi({ keadaan: 'TERSEDIA', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLokasi({ keadaan: err.code === err.PERMISSION_DENIED ? 'DITOLAK' : 'GAGAL' }),
        { timeout: 8000 },
      );
    } else {
      setLokasi({ keadaan: 'GAGAL' });
    }
    return () => {
      setStream((lama) => {
        lama?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [mulaiKamera]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    return () => {
      if (pratinjau) URL.revokeObjectURL(pratinjau);
    };
  }, [pratinjau]);

  async function ambilFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setPesan({ jenis: 'galat', teks: 'Kamera belum siap. Tunggu pratinjau tampil.' });
      return;
    }
    const kanvas = document.createElement('canvas');
    kanvas.width = video.videoWidth;
    kanvas.height = video.videoHeight;
    kanvas.getContext('2d')?.drawImage(video, 0, 0);
    const mentah: Blob | null = await new Promise((selesai) => kanvas.toBlob((b) => selesai(b), 'image/jpeg', 0.95));
    if (!mentah) {
      setPesan({ jenis: 'galat', teks: 'Foto tidak dapat diproses. Coba lagi.' });
      return;
    }
    setFoto(mentah);
    setPratinjau((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return URL.createObjectURL(mentah);
    });
    setRequestId(crypto.randomUUID());
    setPesan(null);
  }

  async function muatUlang() {
    try {
      const res = await fetch(`/api/absen/info?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setPesan({ jenis: 'galat', teks: 'Link tidak berlaku. Hubungi admin.' });
        return;
      }
      const badan = await res.json();
      setInfo(badan.data as InfoAbsen);
      setFoto(null);
      setRequestId(null);
      setPesan(null);
    } catch {
      setPesan({ jenis: 'galat', teks: 'Tidak ada koneksi internet. Sambungkan lalu coba lagi.' });
    }
  }

  async function kirim() {
    if (!foto || !requestId) return;
    if (!navigator.onLine) {
      setPesan({ jenis: 'galat', teks: 'Tidak ada koneksi internet. Sambungkan lalu coba lagi.' });
      return;
    }
    setMengirim(true);
    setPesan(null);
    try {
      // Kompresi otomatis (K-53); karyawan tidak melihat proses ini.
      const hasil = await kompresBlobBrowser(foto);
      if (!hasil) {
        setPesan({ jenis: 'galat', teks: 'Foto terlalu besar, ambil ulang dengan pencahayaan lebih baik.' });
        return;
      }
      const fd = new FormData();
      fd.set('token', token);
      fd.set('jenis', info.aksi === 'CHECKOUT' ? 'CHECKOUT' : 'CHECKIN');
      fd.set('foto', new File([hasil.blob], 'absen.jpg', { type: 'image/jpeg' }));
      if (lokasi.keadaan === 'TERSEDIA') {
        fd.set('lat', String(lokasi.lat));
        fd.set('lng', String(lokasi.lng));
      } else if (lokasi.keadaan === 'DITOLAK' || lokasi.keadaan === 'GAGAL') {
        fd.set('lokasi_status', lokasi.keadaan);
      }
      // request_id DIPAKAI ULANG untuk percobaan ulang foto yang sama (BR-A11).
      fd.set('request_id', requestId);
      const res = await fetch('/api/absen', { method: 'POST', body: fd });
      const badan = await res.json();
      if (!res.ok) {
        setPesan({ jenis: 'galat', teks: (badan.pesan as string) ?? 'Absen gagal dikirim dan tidak tersimpan. Silakan coba lagi.' });
        return;
      }
      setPesan({ jenis: 'sukses', teks: badan.pesan as string });
      await muatUlang();
    } catch {
      setPesan({ jenis: 'galat', teks: 'Tidak ada koneksi internet. Sambungkan lalu coba lagi.' });
    } finally {
      setMengirim(false);
    }
  }

  if (info.aksi === 'TIDAK_TERSEDIA') {
    return (
      <section aria-label="Status absen" style={gayaKartu}>
        <p style={{ margin: '0 0 8px' }}>{info.alasan}</p>
        <button type="button" onClick={muatUlang} style={gayaTombolUtama}>
          Periksa lagi
        </button>
        {pesan ? (
          <p role={pesan.jenis === 'sukses' ? 'status' : 'alert'} style={pesan.jenis === 'sukses' ? gayaPesanSukses : gayaPesanGalat}>
            {pesan.teks}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Ambil absen" style={gayaKartu}>
      {galatKamera ? (
        <p role="alert" style={gayaPesanGalat}>{galatKamera}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000' }} aria-label="Pratinjau kamera" />
      )}
      {lokasi.keadaan !== 'TERSEDIA' && lokasi.keadaan !== 'BELUM' ? (
        <p role="status" style={gayaPesanPeringatan}>
          Lokasi tidak aktif. Absen tetap bisa dikirim tanpa lokasi.
        </p>
      ) : null}

      {pratinjau && foto ? (
        <img src={pratinjau} alt="Hasil foto absen" style={{ width: '100%', borderRadius: 8, marginTop: 8 }} />
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!foto ? (
          <>
            <button type="button" onClick={ambilFoto} disabled={mengirim || !stream} style={mengirim || !stream ? gayaTombolMati : gayaTombol}>
              Foto
            </button>
            <button type="button" onClick={() => mulaiKamera(kamera === 'user' ? 'environment' : 'user')} disabled={mengirim} style={mengirim ? gayaTombolMati : gayaTombol}>
              Ganti Kamera
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={ambilFoto} disabled={mengirim} style={mengirim ? gayaTombolMati : gayaTombol}>
              Foto Ulang
            </button>
            <button type="button" onClick={kirim} disabled={mengirim} style={mengirim ? gayaTombolMatiUtama : gayaTombolUtama}>
              {mengirim ? 'Mengirim…' : info.aksi === 'CHECKOUT' ? 'Absen Check-out' : 'Absen'}
            </button>
          </>
        )}
      </div>

      {info.aksi === 'CHECKOUT' && !foto ? (
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Ada check-in terbuka. Ambil foto untuk check-out.</p>
      ) : null}

      {pesan ? (
        <div style={{ marginTop: 8 }}>
          <p role={pesan.jenis === 'sukses' ? 'status' : 'alert'} style={pesan.jenis === 'sukses' ? gayaPesanSukses : gayaPesanGalat}>
            {pesan.teks}
          </p>
          {pesan.jenis === 'sukses' ? (
            <button type="button" onClick={muatUlang} style={gayaTombolUtama}>
              Selesai
            </button>
          ) : null}
          {pesan.jenis === 'galat' && foto ? (
            <button type="button" onClick={kirim} disabled={mengirim} style={mengirim ? gayaTombolMati : gayaTombol}>
              Coba Lagi
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
