'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import { slotTumpangTindih } from '../../../server/aturan/shift';
import { toast } from 'sonner';
import {
  FilterJadwal,
  GridJadwal,
  PanelGalatJadwal,
  PanelHasilMassal,
  PanelIsiMassal,
  PanelMemuatJadwal,
  PanelSel,
  PesanButuhTemplate,
  PitaRingkasanJadwal,
  ditempatkanPada,
  ringkasanGrid,
  type BarisJadwal,
  type BentukMassal,
  type DataGrid,
  type HasilMassalUI,
  type PraMassal,
  type Slot,
} from './komponen';

export { PanelHasilMassal };
export type { HasilMassalUI };

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
  const [sel, setSel] = useState<{ karyawan_id: number; tanggal: string } | null>(null);
  const [fokusSel, setFokusSel] = useState<{ karyawan_id: number; tanggal: string } | null>(null);
  const [panelMode, setPanelMode] = useState<'lewati' | 'timpa'>('lewati');
  const [panelTemplate, setPanelTemplate] = useState('');
  const [ovSlots, setOvSlots] = useState<Slot[]>([{ nama: '', jam_mulai: '', jam_selesai: '' }]);
  const [ovCatatan, setOvCatatan] = useState('');
  const [ovBaru, setOvBaru] = useState(false);
  const [massal, setMassal] = useState<BentukMassal>({ karyawan: [], dari: '', sampai: '', template: '', mode: 'lewati' });
  const [pra, setPra] = useState<PraMassal | null>(null);
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

  const ringkasan = useMemo(() => (data ? ringkasanGrid(data) : null), [data]);

  function fokusKeSel(s: { karyawan_id: number; tanggal: string }) {
    const el = document.querySelector<HTMLElement>(`[data-sel="${s.karyawan_id}|${s.tanggal}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const kurangiGerakan = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: kurangiGerakan ? 'auto' : 'smooth' });
  }

  function tutupPanel(kembalikanFokus = true) {
    const s = sel;
    setSel(null);
    setOvBaru(false);
    if (kembalikanFokus && s) fokusKeSel(s);
  }

  // Fokus mengikuti sel aktif dari navigasi panah di grid.
  useEffect(() => {
    if (fokusSel) fokusKeSel(fokusSel);
  }, [fokusSel]);

  // Escape menutup panel sel dan mengembalikan fokus ke selnya.
  useEffect(() => {
    function saatTombol(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (sel) {
        e.preventDefault();
        tutupPanel(true);
      }
    }
    window.addEventListener('keydown', saatTombol);
    return () => window.removeEventListener('keydown', saatTombol);
  }, [sel]);

  async function simpanSel() {
    if (!sel || !panelTemplate) return;
    const res = await fetch('/api/admin/jadwal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toko_id: Number(tokoId), karyawan_id: sel.karyawan_id, tanggal: sel.tanggal, nama_template: panelTemplate, mode: panelMode }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    toast.success(b.pesan as string);
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
      toast.error((b?.pesan as string) ?? 'Gagal menyimpan.');
      return;
    }
    toast.success(b.pesan as string);
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
      toast.error((b?.pesan as string) ?? 'Gagal mengembalikan.');
      return;
    }
    toast.success(b.pesan as string);
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
      toast.error((b?.pesan as string) ?? 'Gagal membuat pratinjau.');
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
      toast.error((b?.pesan as string) ?? 'Gagal menerapkan.');
      return;
    }
    toast.success(b.pesan as string);
    setHasilMassal(b.data);
    setPra(null);
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Jadwal</h1>

      <FilterJadwal tokoId={tokoId} tokoList={tokoList} mode={mode} tanggal={tanggal} onUbah={aturParam} />

      {memuat ? (
        <PanelMemuatJadwal />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalatJadwal pesan={galat} onCobaLagi={muat} />
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Pilih toko untuk melihat jadwal.</p>
      ) : (
        <>
          {ringkasan ? (
            <PitaRingkasanJadwal
              terisi={ringkasan.terisi}
              totalSel={ringkasan.totalSel}
              khusus={ringkasan.khusus}
              peringatan={ringkasan.peringatan}
            />
          ) : null}
          <GridJadwal
            data={data}
            petaJadwal={petaJadwal}
            fokusSel={fokusSel}
            onFokusSel={setFokusSel}
            onPilihSel={(s) => {
              setSel(s);
              setFokusSel(s);
              setOvBaru(false);
              setPanelTemplate('');
            }}
          />
        </>
      )}

      {templateList.length === 0 && tokoId ? <PesanButuhTemplate /> : null}

      {/* Panel edit sel tampil sebagai MODAL, bukan panel inline di bawah
          grid: di tampilan bulan admin harus scroll jauh untuk mencapai panel
          inline. Isi PanelSel tidak berubah — yang pindah hanya wadahnya.
          Tutup sembarangan (klik-luar/Escape) membuang ketikan — disengaja
          dan konsisten dengan seluruh dialog repo (keputusan pemilik). */}
      <Dialog
        open={sel !== null && data !== null}
        onOpenChange={(buka) => {
          if (!buka) tutupPanel(true);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Ubah jadwal sel</DialogTitle>
          </DialogHeader>
          {sel && data ? (
            <PanelSel
              tanggal={sel.tanggal}
              jadwalSel={jadwalSel}
              templateCocok={data.templateCocok[sel.tanggal] ?? []}
              panelTemplate={panelTemplate}
              panelMode={panelMode}
              ovBaru={ovBaru}
              ovSlots={ovSlots}
              ovCatatan={ovCatatan}
              ovPeringatan={ovPeringatan}
              onUbahTemplate={setPanelTemplate}
              onUbahMode={setPanelMode}
              onSimpan={simpanSel}
              onMintaUbahKhusus={() => {
                setOvBaru(true);
                setOvSlots(jadwalSel ? jadwalSel.slot.map((s) => ({ ...s })) : [{ nama: '', jam_mulai: '', jam_selesai: '' }]);
                setOvCatatan(jadwalSel?.catatan ?? '');
              }}
              onKembaliStandar={() => kembaliStandar(panelTemplate)}
              onTutup={() => tutupPanel(true)}
              onUbahOvSlots={setOvSlots}
              onUbahOvCatatan={setOvCatatan}
              onTambahSlot={() => setOvSlots([...ovSlots, { nama: '', jam_mulai: '', jam_selesai: '' }])}
              onHapusSlot={(i) => setOvSlots(ovSlots.filter((_, xi) => xi !== i))}
              onSimpanOverride={simpanOverride}
              onBatalOverride={() => setOvBaru(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <PanelIsiMassal
        karyawanList={data?.karyawan ?? []}
        adaData={(data?.karyawan.length ?? 0) > 0}
        massal={massal}
        templateNama={[...new Set(templateList.map((t) => t.nama))]}
        pra={pra}
        hasilMassal={hasilMassal}
        onUbah={setMassal}
        onPratinjau={pratinjau}
        onTerapkan={terapkan}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuatJadwal />}>
      <HalamanJadwal />
    </Suspense>
  );
}

export { ditempatkanPada };
