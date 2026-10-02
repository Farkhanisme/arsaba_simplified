'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Keterlambatan {
  n: number;
  slot: { nama: string; jam_mulai: string; jam_selesai: string } | null;
  selisih: number | null;
  terlambatSistem: boolean;
}

interface Baris {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  toko_id: number;
  toko_nama: string;
  tanggal: string;
  jenis: 'CHECKIN' | 'CHECKOUT';
  checkin_id: number | null;
  waktu: string;
  sumber: string;
  foto_file_id: string | null;
  lat: number | null;
  lng: number | null;
  lokasi_status: string;
  status: string;
  alasan_tolak: string | null;
  keterlambatan_final_menit: number | null;
  alasan_koreksi: string | null;
  keterlambatan: Keterlambatan | null;
}

function tanggalPendek(isoTanggal: string): string {
  const [y, m, d] = isoTanggal.split('-');
  return `${d}/${m}/${y}`;
}

function HalamanVerifikasi() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<Baris[]>([]);
  const [ambang, setAmbang] = useState(5);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pilihan, setPilihan] = useState<{ toko: { id: number; nama: string }[]; karyawan: { id: number; nama: string }[] }>({ toko: [], karyawan: [] });
  const [pilih, setPilih] = useState<number[]>([]);
  const [finalInput, setFinalInput] = useState<Record<number, string>>({});
  const [dialogTolak, setDialogTolak] = useState<{ ids: number[] } | null>(null);
  const [alasanTolak, setAlasanTolak] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [koreksi, setKoreksi] = useState<{ id: number; operasi: string; waktu: string; alasan: string } | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const [rDaftar, rPilih] = await Promise.all([
        fetch(`/api/admin/verifikasi?${query}`),
        fetch('/api/admin/verifikasi/pilihan'),
      ]);
      if (!rDaftar.ok) {
        const b = await rDaftar.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat data.');
      }
      const badan = await rDaftar.json();
      setDaftar(badan.data as Baris[]);
      setAmbang(badan.ambang as number);
      if (rPilih.ok) setPilihan((await rPilih.json()).data);
      setPilih([]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setMemuat(false);
    }
  }, [query]);

  useEffect(() => {
    muat();
  }, [muat]);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/verifikasi?${p.toString()}`);
  }

  async function kirimKeputusan(id: number, keputusan: 'DISETUJUI' | 'DITOLAK', alasan?: string) {
    const baris = daftar.find((b) => b.id === id);
    const body: Record<string, unknown> = { keputusan };
    if (alasan !== undefined) body['alasan_tolak'] = alasan;
    if (keputusan === 'DISETUJUI' && baris?.jenis === 'CHECKIN') {
      const v = finalInput[id];
      if (v !== undefined && v !== '') body['keterlambatan_final_menit'] = Number(v);
    }
    const res = await fetch(`/api/admin/verifikasi/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan keputusan.');
      return false;
    }
    return true;
  }

  async function setujuiSatuan(id: number): Promise<boolean> {
    if (await kirimKeputusan(id, 'DISETUJUI')) {
      setPesan('Keputusan berhasil disimpan.');
      muat();
      return true;
    }
    return false;
  }

  async function kirimTolakMassal() {
    if (!dialogTolak || alasanTolak.trim() === '') return;
    const res = await fetch('/api/admin/verifikasi/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: dialogTolak.ids, keputusan: 'DITOLAK', alasan_tolak: alasanTolak.trim() }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal memproses massal.');
      return;
    }
    setDialogTolak(null);
    setAlasanTolak('');
    setPesan('Keputusan berhasil disimpan.');
    muat();
  }

  async function setujuiMassal() {
    const finals: Record<string, number> = {};
    for (const id of pilih) {
      const v = finalInput[id];
      if (v !== undefined && v !== '') finals[String(id)] = Number(v);
    }
    const res = await fetch('/api/admin/verifikasi/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pilih, keputusan: 'DISETUJUI', final_menit: finals }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal memproses massal.');
      return;
    }
    setPesan('Keputusan berhasil disimpan.');
    muat();
  }

  async function kirimKoreksi() {
    if (!koreksi || koreksi.alasan.trim() === '' || koreksi.waktu === '') return;
    const waktuISO = `${koreksi.waktu}:00+07:00`;
    const body: Record<string, unknown> = { alasan: koreksi.alasan.trim() };
    if (koreksi.operasi === 'tambah_checkout') {
      body['operasi'] = 'tambah_checkout';
      body['checkin_id'] = koreksi.id;
      body['waktu'] = waktuISO;
    } else if (koreksi.operasi === 'tambah_checkin') {
      const baris = daftar.find((b) => b.id === koreksi.id);
      body['operasi'] = 'tambah_checkin';
      body['karyawan_id'] = baris?.karyawan_id;
      body['waktu'] = waktuISO;
    } else {
      body['operasi'] = 'ubah_waktu';
      body['event_id'] = koreksi.id;
      body['waktu'] = waktuISO;
    }
    const res = await fetch('/api/admin/koreksi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan koreksi.');
      return;
    }
    setKoreksi(null);
    setPesan('Koreksi berhasil disimpan.');
    muat();
  }

  const kelompok = useMemo(() => {
    const peta = new Map<string, Baris[]>();
    for (const b of daftar) {
      const kunci = `${b.karyawan_id}|${b.tanggal}`;
      const isi = peta.get(kunci) ?? [];
      isi.push(b);
      peta.set(kunci, isi);
    }
    return [...peta.entries()];
  }, [daftar]);

  const barisLightbox = lightbox !== null ? daftar.find((b) => b.id === lightbox) ?? null : null;
  const indeksLightbox = lightbox !== null ? daftar.findIndex((b) => b.id === lightbox) : -1;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Verifikasi Absensi</h1>
      {pesan ? <p role="status" style={{ background: '#dcfce7', padding: 8, borderRadius: 4 }}>{pesan}</p> : null}

      <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }} onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="f-status">Status<br />
            <select id="f-status" value={params.get('status') ?? 'MENUNGGU'} onChange={(e) => aturParam('status', e.target.value)} style={{ padding: 8 }}>
              <option value="MENUNGGU">Menunggu</option>
              <option value="DISETUJUI">Disetujui</option>
              <option value="DITOLAK">Ditolak</option>
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="f-toko">Toko<br />
            <select id="f-toko" value={params.get('toko_id') ?? ''} onChange={(e) => aturParam('toko_id', e.target.value)} style={{ padding: 8 }}>
              <option value="">Semua</option>
              {pilihan.toko.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="f-dari">Dari<br /><input id="f-dari" type="date" value={params.get('dari') ?? ''} onChange={(e) => aturParam('dari', e.target.value)} style={{ padding: 8 }} /></label>
        </div>
        <div>
          <label htmlFor="f-sampai">Sampai<br /><input id="f-sampai" type="date" value={params.get('sampai') ?? ''} onChange={(e) => aturParam('sampai', e.target.value)} style={{ padding: 8 }} /></label>
        </div>
        <div>
          <label htmlFor="f-karyawan">Karyawan<br />
            <select id="f-karyawan" value={params.get('karyawan_id') ?? ''} onChange={(e) => aturParam('karyawan_id', e.target.value)} style={{ padding: 8 }}>
              <option value="">Semua</option>
              {pilihan.karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="f-jenis">Jenis<br />
            <select id="f-jenis" value={params.get('jenis') ?? ''} onChange={(e) => aturParam('jenis', e.target.value)} style={{ padding: 8 }}>
              <option value="">Semua</option>
              <option value="CHECKIN">Check-in</option>
              <option value="CHECKOUT">Check-out</option>
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="f-belum">
            <input id="f-belum" type="checkbox" checked={(params.get('belum_checkout') ?? '') === '1'} onChange={(e) => aturParam('belum_checkout', e.target.checked ? '1' : '')} /> Check-in belum check-out
          </label>
        </div>
      </form>

      {pilih.length > 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ddd', padding: 8, marginBottom: 12, display: 'flex', gap: 8 }}>
          <span>{pilih.length} dipilih</span>
          <button type="button" onClick={setujuiMassal}>Setujui terpilih</button>
          <button type="button" onClick={() => { setDialogTolak({ ids: [...pilih] }); setAlasanTolak(''); }}>Tolak terpilih</button>
        </div>
      ) : null}

      {memuat ? (
        <div aria-label="Memuat"><p>Memuat…</p></div>
      ) : galat ? (
        <div><p role="alert">{galat}</p><button type="button" onClick={muat}>Coba lagi</button></div>
      ) : daftar.length === 0 ? (
        <p>Tidak ada absensi yang menunggu verifikasi.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', minWidth: 1100 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
              <tr>
                <th style={{ padding: 8, borderBottom: '2px solid #ddd' }}><span className="sr-only">Pilih</span></th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Waktu</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Karyawan</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Toko</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Jenis</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Foto</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Lokasi</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Selisih</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Menit terlambat (final)</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kelompok.map(([kunci, barisKelompok]) => (
                <Fragment key={`g-${kunci}`}>
                  <tr>
                    <td colSpan={11} style={{ padding: '6px 8px', background: '#f3f4f6', fontSize: 13 }}>
                      {barisKelompok[0]!.karyawan_nama} · {tanggalPendek(barisKelompok[0]!.tanggal)} · {barisKelompok[0]!.toko_nama}
                    </td>
                  </tr>
                  {barisKelompok.map((b) => (
                    <tr key={b.id}>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        <input type="checkbox" aria-label={`Pilih absensi ${b.id}`} checked={pilih.includes(b.id)} onChange={(e) => setPilih(e.target.checked ? [...pilih, b.id] : pilih.filter((x) => x !== b.id))} />
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{tanggalPendek(b.tanggal)} {b.waktu.slice(11, 16)} WIB</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.karyawan_nama}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.toko_nama}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        {b.jenis === 'CHECKIN' ? 'Check-in' : 'Check-out'}
                        {b.jenis === 'CHECKOUT' && b.checkin_id !== null ? <span style={{ fontSize: 12 }}> ↳ #{b.checkin_id}</span> : null}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        {b.foto_file_id ? (
                          <button type="button" onClick={() => setLightbox(b.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} aria-label={`Lihat foto ${b.id}`}>
                            <img src={`/api/foto/${b.id}`} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} />
                          </button>
                        ) : <span style={{ color: '#888' }}>—</span>}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee', fontSize: 13 }}>
                        {b.lat !== null && b.lng !== null ? (
                          <a href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">Buka peta</a>
                        ) : 'Lokasi tidak tersedia'}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        {b.jenis === 'CHECKIN' && b.keterlambatan ? (
                          <>
                            {b.keterlambatan.selisih === null ? '—' : b.keterlambatan.selisih > 0 ? `+${b.keterlambatan.selisih} mnt` : `${b.keterlambatan.selisih} mnt`}{' '}
                            {b.keterlambatan.terlambatSistem ? <span style={{ background: '#fed7aa', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>Terlambat</span> : null}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        <span style={{ background: b.status === 'MENUNGGU' ? '#fef3c7' : b.status === 'DISETUJUI' ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>
                          {b.status === 'MENUNGGU' ? 'Menunggu' : b.status === 'DISETUJUI' ? 'Disetujui' : 'Ditolak'}
                        </span>
                        {b.sumber === 'KOREKSI_ADMIN' ? <span style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 4, fontSize: 12, marginLeft: 4 }}>✎ Dikoreksi</span> : null}
                        {b.status === 'DITOLAK' && b.alasan_tolak ? <div style={{ fontSize: 12 }}>Ditolak: {b.alasan_tolak}</div> : null}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        {b.jenis === 'CHECKIN' ? (
                          <input type="number" min={0} max={1440} step={1} aria-label={`Menit final ${b.id}`} value={finalInput[b.id] ?? (b.keterlambatan_final_menit ?? '')} onChange={(e) => setFinalInput({ ...finalInput, [b.id]: e.target.value })} style={{ width: 80, padding: 6 }} />
                        ) : '—'}
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setujuiSatuan(b.id)}>Setujui</button>
                          <button type="button" onClick={() => { setDialogTolak({ ids: [b.id] }); setAlasanTolak(''); }}>Tolak</button>
                          <button type="button" onClick={() => setKoreksi({ id: b.id, operasi: 'ubah_waktu', waktu: '', alasan: '' })}>Koreksi</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 13, color: '#555' }}>Ambang terlambat sistem: {ambang} menit (diatur Super Admin di Pengaturan).</p>

      {dialogTolak ? (
        <div role="dialog" aria-label="Alasan penolakan" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 440, width: '100%' }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Tolak {dialogTolak.ids.length} absensi</h2>
            <label>Alasan (wajib)<br />
              <textarea value={alasanTolak} onChange={(e) => setAlasanTolak(e.target.value)} rows={3} style={{ width: '100%', padding: 8 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setDialogTolak(null)}>Batal</button>
              <button type="button" onClick={kirimTolakMassal} disabled={alasanTolak.trim() === ''} style={{ background: '#b91c1c', color: '#fff' }}>Tolak</button>
            </div>
          </div>
        </div>
      ) : null}

      {koreksi ? (
        <div role="dialog" aria-label="Koreksi manual" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 440, width: '100%' }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Koreksi absensi #{koreksi.id}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label>Operasi<br />
                <select value={koreksi.operasi} onChange={(e) => setKoreksi({ ...koreksi, operasi: e.target.value })} style={{ padding: 8 }}>
                  <option value="ubah_waktu">Ubah waktu</option>
                  <option value="tambah_checkout">Tambah check-out</option>
                  <option value="tambah_checkin">Tambah check-in</option>
                </select>
              </label>
              <label>Waktu (tanggal + jam, WIB)<br />
                <input type="datetime-local" value={koreksi.waktu} onChange={(e) => setKoreksi({ ...koreksi, waktu: e.target.value })} style={{ padding: 8 }} />
              </label>
              <label>Alasan (wajib)<br />
                <textarea value={koreksi.alasan} onChange={(e) => setKoreksi({ ...koreksi, alasan: e.target.value })} rows={2} style={{ width: '100%', padding: 8 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setKoreksi(null)}>Batal</button>
              <button type="button" onClick={kirimKoreksi} disabled={koreksi.alasan.trim() === '' || koreksi.waktu === ''}>Simpan</button>
            </div>
          </div>
        </div>
      ) : null}

      {barisLightbox && lightbox !== null ? (
        <div role="dialog" aria-label="Foto absensi" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, flexDirection: 'column', gap: 8 }}>
          <img src={`/api/foto/${barisLightbox.id}`} alt={`Foto ${barisLightbox.karyawan_nama}`} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }} />
          <p style={{ color: '#fff', margin: 0 }}>{barisLightbox.karyawan_nama} · {tanggalPendek(barisLightbox.tanggal)} {barisLightbox.waktu.slice(11, 16)} WIB</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setujuiSatuan(barisLightbox.id).then((ok) => { if (ok) setLightbox(null); })}>Setujui</button>
            <button type="button" onClick={() => { setLightbox(null); setDialogTolak({ ids: [barisLightbox.id] }); setAlasanTolak(''); }}>Tolak</button>
            <button
              type="button"
              onClick={() => {
                const berikutnya = daftar[(indeksLightbox + 1) % daftar.length];
                if (berikutnya) setLightbox(berikutnya.id);
              }}
            >
              Berikutnya
            </button>
            <button type="button" onClick={() => setLightbox(null)}>Tutup</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanVerifikasi />
    </Suspense>
  );
}
