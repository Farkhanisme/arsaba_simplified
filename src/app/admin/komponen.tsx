'use client';

import { useEffect, useState } from 'react';

export interface Pesan {
  jenis: 'sukses' | 'galat';
  teks: string;
}

/**
 * Toast bersama halaman admin (rules/05 §6): sukses hijau hilang sendiri,
 * error merah menetap sampai ditutup.
 */
export function Toast({ pesan, onTutup }: { pesan: Pesan | null; onTutup: () => void }) {
  const [terlihat, setTerlihat] = useState(false);

  useEffect(() => {
    if (!pesan) {
      setTerlihat(false);
      return;
    }
    setTerlihat(true);
    if (pesan.jenis === 'sukses') {
      const t = setTimeout(() => {
        setTerlihat(false);
        onTutup();
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [pesan, onTutup]);

  if (!pesan || !terlihat) return null;
  const gaya =
    pesan.jenis === 'sukses'
      ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
      : { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
  return (
    <div role={pesan.jenis === 'sukses' ? 'status' : 'alert'} style={{ ...gaya, padding: '10px 12px', borderRadius: 6, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span>{pesan.teks}</span>
      {pesan.jenis === 'galat' ? (
        <button type="button" onClick={() => { setTerlihat(false); onTutup(); }} aria-label="Tutup pesan" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
          ✕
        </button>
      ) : null}
    </div>
  );
}

/** Membaca pesan galat { kode, pesan } dari respons JSON. */
export async function pesanGalat(res: Response, bawaan: string): Promise<string> {
  try {
    const data = await res.clone().json();
    if (typeof data?.pesan === 'string' && data.pesan.length > 0) return data.pesan;
  } catch {
    /* abaikan */
  }
  return bawaan;
}

/**
 * True bila respons adalah 403 AKSES_DITOLAK (peran tidak cukup, K-22).
 * Memakai clone() supaya body asli tetap bisa dibaca pemanggil.
 */
export async function adalahAksesDitolak(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const data = await res.clone().json();
    return (data as { kode?: unknown })?.kode === 'AKSES_DITOLAK';
  } catch {
    return false;
  }
}

/**
 * Keadaanpengganti halaman saat API menjawab 403 AKSES_DITOLAK (BUG-UI-03):
 * pesan jelas, bukan layar kosong. Server tetap yang menolak — ini hanya
 * tampilannya.
 */
export function AksesDitolak() {
  return (
    <div role="alert" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 24, maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>Akses ditolak</h1>
      <p style={{ margin: 0 }}>Anda tidak punya akses ke halaman ini.</p>
    </div>
  );
}
