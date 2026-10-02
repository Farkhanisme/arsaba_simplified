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
    const data = await res.json();
    if (typeof data?.pesan === 'string' && data.pesan.length > 0) return data.pesan;
  } catch {
    /* abaikan */
  }
  return bawaan;
}
