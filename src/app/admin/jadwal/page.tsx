'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import { slotTumpangTindih } from '../../../server/aturan/shift';

interface Slot { nama: string; jam_mulai: string; jam_selesai: string; urutan?: number }
interface BarisJadwal {
  id: number;
  karyawan_id: number;
  karyawan_nama: string;
  tanggal: string;
  shift_template_id: number | null;
  template_nama: string | null;
  is_override: number;
  catatan: string | null;
  slot: Slot[];
  peringatan: { a: number; b: number }[];
}
interface DataGrid {
  rentang: { tanggal: string; hari: string; weekend: boolean }[];
  karyawan: { id: number; nama: string }[];
  penempatan: { karyawan_id: number; mulai: string; sampai: string | null }[];
  jadwal: BarisJadwal[];
  templateCocok: Record<string, string[]>;
}

function tanggalPendek(t: string): string {
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

function ditempatkanPada(p: DataGrid['penempatan'], kid: number, tanggal: string): boolean {
  return p.some((r) => r.karyawan_id === kid && r.mulai <= tanggal && (r.sampai === null || r.sampai >= tanggal));
}

function HalamanJadwal() {
  const router = useRouter();
  const params = useSearchParams();
  const tokoId = params.get('toko_id') ?? '';
  const mode = params.get('mode') ?? 'minggu';
  const tanggal = params.get('tanggal') ?? '';

  const [data, setData] = useState<DataGrid | null>(null);
  const [tokoList, setTokoList] = useState<{ id: number; nama: string }[]>([]);
  const [templateList, setTemplateList] = useState<{ nama: string; tipe_hari: string; jam_mulai: string; jam_selesai: string }[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sel, setSel] = useState<{ karyawan_id: number; tanggal: string } | null>(null);
  const [panelMode, setPanelMode] = useState<'lewati' | 'timpa'>('lewati');
  const [panelTemplate, setPanelTemplate] = useState('');
  const [ovSlots, setOvSlots] = useState<Slot[]>([{ nama: '', jam_mulai: '', jam_selesai: '' }]);
  const [ovCatatan, setOvCatatan] = useState('');
  const [ovBaru, setOvBaru] = useState(false);
  const [massal, setMassal] = useState({ karyawan: [] as number[], dari: '', sampai: '', template: '', mode: 'lewati' as 'lewati' | 'timpa' });
  const [pra, setPra] = useState<{ baru: unknown[]; dilewati: { karyawan_id: number; tanggal: string }[]; ditimpa: unknown[]; ditolak: { karyawan_id: number; tanggal: string; alasan: string }[] } | null>(null);
  const [hasilMassal, setHasilMassal] = useState<HasilMassalUI | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    if (!tokoId) {
      setData(null);
    } else {
      setMemuat(true);
      setGalat(null);
      setAksesDitolak(false);
      try {
        const res = await fetch(`/api/admin/jadwal?${query}`);
        if (!res.ok) {
          if (await adalahAksesDitolak(res)) {
            setAksesDitolak(true);
            return;
          }
          const b = await res.json().catch(() => null);
          throw new Error((b?.pesan as string) ?? 'Gagal memuat jadwal.');
        }
        setData(((await res.json()).data as DataGrid));
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal memuat jadwal.');
      } finally {
        setMemuat(false);
      }
    }
    try {
      const r = await fetch(`/api/admin/jadwal/pilihan?toko_id=${tokoId}`);
      if (r.ok) {
        const b = await r.json();
        setTokoList(b.data.toko);
        setTemplateList(b.data.template);
      }
    } catch {
      /* abaikan */
    }
  }, [query, tokoId]);

  useEffect(() => {
    muat();
  }, [muat]);

  function aturParam(kunci: string, nilai: string) {
    const p = new URLSearchParams(params.toString());
    if (nilai) p.set(kunci, nilai);
    else p.delete(kunci);
    router.replace(`/admin/jadwal?${p.toString()}`);
  }

  const petaJadwal = useMemo(() => {
    const m = new Map<string, BarisJadwal>();
    for (const j of data?.jadwal ?? []) m.set(`${j.karyawan_id}|${j.tanggal}`, j);
    return m;
  }, [data]);

  const jadwalSel = sel ? petaJadwal.get(`${sel.karyawan_id}|${sel.tanggal}`) ?? null : null;

  async function simpanSel() {
    if (!sel || !panelTemplate) return;
    const res = await fetch('/api/admin/jadwal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toko_id: Number(tokoId), karyawan_id: sel.karyawan_id, tanggal: sel.tanggal, nama_template: panelTemplate, mode: panelMode }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    setPesan(b.pesan as string);
    setSel(null);
    setPanelTemplate('');
    muat();
  }

  const ovPeringatan = useMemo(() => {
    const out: { a: number; b: number }[] = [];
    for (let i = 0; i < ovSlots.length; i++) {
      for (let j = i + 1; j < ovSlots.length; j++) {
        const a = ovSlots[i]!;
        const b = ovSlots[j]!;
        if (a.jam_mulai && a.jam_selesai && b.jam_mulai && b.jam_selesai && slotTumpangTindih(a.jam_mulai, a.jam_selesai, b.jam_mulai, b.jam_selesai)) {
          out.push({ a: i, b: j });
        }
      }
    }
    return out;
  }, [ovSlots]);

  async function simpanOverride() {
    if (!sel) return;
    const res = await fetch('/api/admin/jadwal/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: sel.karyawan_id, tanggal: sel.tanggal, aksi: 'simpan', slots: ovSlots, catatan: ovCatatan || undefined }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    setPesan(b.pesan as string);
    setSel(null);
    setOvBaru(false);
    muat();
  }

  async function kembaliStandar(namaTemplate: string) {
    if (!sel) return;
    const res = await fetch('/api/admin/jadwal/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ karyawan_id: sel.karyawan_id, tanggal: sel.tanggal, aksi: 'kembalikan', nama_template: namaTemplate }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal mengembalikan.');
      return;
    }
    setPesan(b.pesan as string);
    setSel(null);
    muat();
  }

  async function pratinjau() {
    const res = await fetch('/api/admin/jadwal/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toko_id: Number(tokoId), karyawan_ids: massal.karyawan, dari: massal.dari, sampai: massal.sampai, nama_template: massal.template, mode: massal.mode, pratinjau: true }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal membuat pratinjau.');
      return;
    }
    setPra(b.data);
    setHasilMassal(null);
  }

  async function terapkan() {
    const res = await fetch('/api/admin/jadwal/massal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toko_id: Number(tokoId), karyawan_ids: massal.karyawan, dari: massal.dari, sampai: massal.sampai, nama_template: massal.template, mode: massal.mode }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menerapkan.');
      return;
    }
    setPesan(b.pesan as string);
    setHasilMassal(b.data);
    setPra(null);
    muat();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Jadwal</h1>
      {pesan ? <p role="status" style={{ background: '#dcfce7', padding: 8, borderRadius: 4 }}>{pesan}</p> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <div>
          <label htmlFor="j-toko">Toko<br />
            <select id="j-toko" value={tokoId} onChange={(e) => aturParam('toko_id', e.target.value)} style={{ padding: 8 }}>
              <option value="">— Pilih toko —</option>
              {tokoList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </label>
        </div>
        <div role="group" aria-label="Mode tampil">
          {(['hari', 'minggu', 'bulan'] as const).map((m) => (
            <button key={m} type="button" onClick={() => aturParam('mode', m)} aria-pressed={mode === m} style={{ padding: 8, fontWeight: mode === m ? 'bold' : 'normal', textTransform: 'capitalize' }}>
              {m === 'hari' ? 'Hari' : m === 'minggu' ? 'Minggu' : 'Bulan'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="j-tanggal">Tanggal acuan<br /><input id="j-tanggal" type="date" value={tanggal} onChange={(e) => aturParam('tanggal', e.target.value)} style={{ padding: 8 }} /></label>
        </div>
      </div>

      {memuat ? (
        <p>Memuat…</p>
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <div><p role="alert">{galat}</p><button type="button" onClick={muat}>Coba lagi</button></div>
      ) : !data ? (
        <p>Pilih toko untuk melihat jadwal.</p>
      ) : data.karyawan.length === 0 ? (
        <p>Belum ada karyawan di toko ini.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', background: '#fff' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', position: 'sticky', left: 0, background: '#fff' }}>Karyawan</th>
                {data.rentang.map((r) => (
                  <th key={r.tanggal} style={{ padding: 8, borderBottom: '2px solid #ddd', background: r.weekend ? '#fef3c7' : '#fff', minWidth: 110 }}>
                    {r.hari.slice(0, 3)} {tanggalPendek(r.tanggal)}{r.weekend ? ' (Weekend)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.karyawan.map((k) => (
                <tr key={k.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', position: 'sticky', left: 0, background: '#fff', fontWeight: 'bold' }}>{k.nama}</td>
                  {data.rentang.map((r) => {
                    const j = petaJadwal.get(`${k.id}|${r.tanggal}`);
                    const boleh = ditempatkanPada(data.penempatan, k.id, r.tanggal);
                    return (
                      <td key={r.tanggal} style={{ padding: 4, borderBottom: '1px solid #eee', background: boleh ? (r.weekend ? '#fffbeb' : '#fff') : '#f3f4f6' }}>
                        <button
                          type="button"
                          disabled={!boleh}
                          onClick={() => { setSel({ karyawan_id: k.id, tanggal: r.tanggal }); setOvBaru(false); setPanelTemplate(''); }}
                          style={{ width: '100%', padding: 8, textAlign: 'left', cursor: boleh ? 'pointer' : 'not-allowed' }}
                          aria-label={`Jadwal ${k.nama} ${tanggalPendek(r.tanggal)}`}
                        >
                          {j ? (
                            <>
                              <div>{j.slot.map((s) => `${s.nama} ${s.jam_mulai}–${s.jam_selesai}`).join(' + ')}</div>
                              {j.is_override === 1 ? <span style={{ fontSize: 12 }}>★ Khusus</span> : null}
                              {j.peringatan.length > 0 ? <span style={{ fontSize: 12 }} title="Jam slot saling tumpang tindih"> ⚠</span> : null}
                            </>
                          ) : <span style={{ color: '#888' }}>—</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {templateList.length === 0 && tokoId ? (
        <p>Minta Super Admin menambah template di Data Master › Shift.</p>
      ) : null}

      {sel && data ? (
        <section aria-label="Panel sel" style={{ marginTop: 12, background: '#fff', border: '1px solid #ddd', padding: 12, maxWidth: 560 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Jadwal {tanggalPendek(sel.tanggal)}</h2>
          {jadwalSel ? (
            <div style={{ marginBottom: 8, fontSize: 14 }}>
              <div>{jadwalSel.slot.map((s) => `${s.nama} · ${s.jam_mulai}–${s.jam_selesai}`).join(' + ')}</div>
              {jadwalSel.is_override === 1 ? <span>★ Khusus{jadwalSel.catatan ? ` — ${jadwalSel.catatan}` : ''}</span> : null}
              {jadwalSel.peringatan.length > 0 ? <p style={{ background: '#fef9c3', padding: 6, borderRadius: 4 }}>Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.</p> : null}
            </div>
          ) : <p style={{ fontSize: 14 }}>Sel kosong.</p>}
          {!ovBaru ? (
            <>
              <div>
                <label htmlFor="p-shift">Shift (hanya yang sesuai hari itu)<br />
                  <select id="p-shift" value={panelTemplate} onChange={(e) => setPanelTemplate(e.target.value)} style={{ padding: 8 }}>
                    <option value="">— Pilih shift —</option>
                    {(data.templateCocok[sel.tanggal] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div role="group" aria-label="Bila sel sudah ada" style={{ margin: '8px 0' }}>
                <label><input type="radio" checked={panelMode === 'lewati'} onChange={() => setPanelMode('lewati')} /> Lewati bila sudah ada</label>{' '}
                <label><input type="radio" checked={panelMode === 'timpa'} onChange={() => setPanelMode('timpa')} /> Timpa</label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={simpanSel} disabled={!panelTemplate}>Simpan</button>
                <button type="button" onClick={() => { setOvBaru(true); setOvSlots(jadwalSel ? jadwalSel.slot.map((s) => ({ ...s })) : [{ nama: '', jam_mulai: '', jam_selesai: '' }]); setOvCatatan(jadwalSel?.catatan ?? ''); }}>Ubah khusus hari ini</button>
                {jadwalSel && jadwalSel.is_override === 1 ? (
                  <button type="button" onClick={() => kembaliStandar(panelTemplate)} disabled={!panelTemplate}>Kembali ke shift standar</button>
                ) : null}
                <button type="button" onClick={() => { setSel(null); setOvBaru(false); }}>Tutup</button>
              </div>
            </>
          ) : (
            <>
              {ovSlots.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'end' }}>
                  <label>Nama<br /><input value={s.nama} onChange={(e) => setOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, nama: e.target.value } : x)))} maxLength={100} style={{ padding: 6, width: 110 }} /></label>
                  <label>Mulai<br /><input type="time" value={s.jam_mulai} onChange={(e) => setOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, jam_mulai: e.target.value } : x)))} style={{ padding: 6 }} /></label>
                  <label>Selesai<br /><input type="time" value={s.jam_selesai} onChange={(e) => setOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, jam_selesai: e.target.value } : x)))} style={{ padding: 6 }} /></label>
                  {ovSlots.length > 1 ? <button type="button" onClick={() => setOvSlots(ovSlots.filter((_, xi) => xi !== i))} aria-label={`Hapus slot ${i + 1}`}>Hapus</button> : null}
                </div>
              ))}
              {ovSlots.length < 2 ? <button type="button" onClick={() => setOvSlots([...ovSlots, { nama: '', jam_mulai: '', jam_selesai: '' }])}>Tambah slot (maks 2)</button> : null}
              {ovPeringatan.length > 0 ? <p style={{ background: '#fef9c3', padding: 6, borderRadius: 4 }}>Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.</p> : null}
              <div style={{ marginTop: 8 }}>
                <label>Catatan (opsional)<br /><input value={ovCatatan} onChange={(e) => setOvCatatan(e.target.value)} maxLength={500} style={{ padding: 6, width: '100%' }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={simpanOverride}>Simpan</button>
                <button type="button" onClick={() => setOvBaru(false)}>Batal</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <section aria-label="Isi massal" style={{ marginTop: 16, background: '#fff', border: '1px solid #ddd', padding: 12, maxWidth: 640 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Isi massal</h2>
        {data && data.karyawan.length > 0 ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
            {data.karyawan.map((k) => (
              <label key={k.id}><input type="checkbox" checked={massal.karyawan.includes(k.id)} onChange={(e) => setMassal({ ...massal, karyawan: e.target.checked ? [...massal.karyawan, k.id] : massal.karyawan.filter((x) => x !== k.id) })} /> {k.nama}</label>
            ))}
          </div>
        ) : <p>Pilih toko dulu.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>Dari<br /><input type="date" value={massal.dari} onChange={(e) => setMassal({ ...massal, dari: e.target.value })} style={{ padding: 6 }} /></label>
          <label>Sampai<br /><input type="date" value={massal.sampai} onChange={(e) => setMassal({ ...massal, sampai: e.target.value })} style={{ padding: 6 }} /></label>
          <label>Shift<br />
            <select value={massal.template} onChange={(e) => setMassal({ ...massal, template: e.target.value })} style={{ padding: 6 }}>
              <option value="">— Pilih —</option>
              {[...new Set(templateList.map((t) => t.nama))].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label><input type="radio" checked={massal.mode === 'lewati'} onChange={() => setMassal({ ...massal, mode: 'lewati' })} /> Lewati</label>
          <label><input type="radio" checked={massal.mode === 'timpa'} onChange={() => setMassal({ ...massal, mode: 'timpa' })} /> Timpa</label>
          <button type="button" onClick={pratinjau} disabled={massal.karyawan.length === 0 || !massal.dari || !massal.sampai || !massal.template}>Pratinjau</button>
        </div>
        {pra ? (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <p>{pra.baru.length} sel baru, {pra.dilewati.length} dilewati, {pra.ditimpa.length} ditimpa, {pra.ditolak.length} ditolak.</p>
            {pra.ditolak.length > 0 ? (
              <ul>{pra.ditolak.slice(0, 10).map((d, i) => <li key={i}>{tanggalPendek(d.tanggal)}: {d.alasan}</li>)}</ul>
            ) : null}
            <button type="button" onClick={terapkan}>Terapkan</button>
          </div>
        ) : null}
        {hasilMassal ? <PanelHasilMassal hasil={hasilMassal} /> : null}
      </section>
    </div>
  );
}

export interface EntriSel {
  karyawan_id: number;
  tanggal: string;
}

export interface HasilMassalUI {
  baru: unknown[];
  dilewati: EntriSel[];
  ditimpa: EntriSel[];
  ditolak: (EntriSel & { alasan: string })[];
}

/** Panel hasil apply massal: dibuat + ditimpa (B-19) + dilewati + ditolak. */
export function PanelHasilMassal({ hasil }: { hasil: HasilMassalUI }) {
  return (
    <div style={{ marginTop: 8, fontSize: 14 }}>
      <p>
        {hasil.baru.length} dibuat, {hasil.ditimpa.length} ditimpa, {hasil.dilewati.length} dilewati, {hasil.ditolak.length} ditolak.
      </p>
      {hasil.ditimpa.length > 0 ? (
        <ul>{hasil.ditimpa.map((d, i) => <li key={i}>Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)} (ditimpa)</li>)}</ul>
      ) : null}
      {hasil.dilewati.length > 0 ? (
        <ul>{hasil.dilewati.map((d, i) => <li key={i}>Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}</li>)}</ul>
      ) : null}
      {hasil.ditolak.length > 0 ? (
        <ul>{hasil.ditolak.map((d, i) => <li key={i}>Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}: {d.alasan}</li>)}</ul>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Memuat…</p>}>
      <HalamanJadwal />
    </Suspense>
  );
}
