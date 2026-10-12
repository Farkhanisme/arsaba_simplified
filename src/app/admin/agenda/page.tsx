'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AksesDitolak, adalahAksesDitolak } from '../komponen';
import {
  FilterAgenda,
  FormulirBuatAgenda,
  IsiDialogBatalkan,
  IsiDialogGantiPenerima,
  PanelGalat,
  PanelMemuat,
  TabelAgenda,
  FORMULIR_KOSONG,
  type AgendaLengkap,
  type BarisAgenda,
  type FormGantiPenerima,
  type FormulirAgenda,
} from './komponen';

/**
 * Halaman Agenda (M11) — sisi admin: buat agenda, lihat penerima, batalkan, ganti penerima.
 *
 * Sisi karyawan (tab Agenda di /a/[token]), verifikasi, dan rekap adalah milestone
 * terpisah (M12–M14) dan sengaja belum ada di sini.
 */
function HalamanAgenda() {
  const router = useRouter();
  const params = useSearchParams();
  const [daftar, setDaftar] = useState<AgendaLengkap[]>([]);
  const [pilihan, setPilihan] = useState<{ toko: { id: number; nama: string }[]; karyawan: { id: number; nama: string }[] }>({ toko: [], karyawan: [] });
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [aksesDitolak, setAksesDitolak] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [form, setForm] = useState<FormulirAgenda>(FORMULIR_KOSONG);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [batalkan, setBatalkan] = useState<{ agenda: BarisAgenda; alasan: string } | null>(null);
  const [ganti, setGanti] = useState<{ agenda: BarisAgenda; form: FormGantiPenerima } | null>(null);

  const query = params.toString();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    setAksesDitolak(false);
    try {
      const [rDaftar, rPilih] = await Promise.all([
        fetch(`/api/admin/agenda?${query}`),
        fetch('/api/admin/verifikasi/pilihan'),
      ]);
      if (!rDaftar.ok) {
        if (await adalahAksesDitolak(rDaftar)) {
          setAksesDitolak(true);
          return;
        }
        const b = await rDaftar.json().catch(() => null);
        throw new Error((b?.pesan as string) ?? 'Gagal memuat data.');
      }
      setDaftar((await rDaftar.json()).data as AgendaLengkap[]);
      if (rPilih.ok) setPilihan((await rPilih.json()).data);
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
    router.replace(`/admin/agenda?${p.toString()}`);
  }

  async function kirim() {
    setSedangSimpan(true);
    setPesan(null);
    const res = await fetch('/api/admin/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judul: form.judul,
        keterangan: form.keterangan || undefined,
        wajib_foto: form.wajib_foto,
        cakupan: form.cakupan,
        toko_id: form.cakupan === 'TOKO' ? Number(form.tokoId) || undefined : undefined,
        target_tanggal: form.targetTanggal || undefined,
        karyawan_ids: form.cakupan === 'KARYAWAN' ? form.karyawan : undefined,
      }),
    });
    const b = await res.json().catch(() => null);
    setSedangSimpan(false);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal menyimpan agenda.');
      return;
    }
    setForm(FORMULIR_KOSONG);
    setPesan('Agenda berhasil dibuat.');
    muat();
  }

  async function simpanBatal() {
    if (!batalkan) return;
    const res = await fetch(`/api/admin/agenda/${batalkan.agenda.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aksi: 'BATALKAN', alasan: batalkan.alasan }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setBatalkan({ ...batalkan, alasan: batalkan.alasan });
      setPesan((b?.pesan as string) ?? 'Gagal membatalkan agenda.');
      return;
    }
    setBatalkan(null);
    setPesan('Agenda berhasil dibatalkan.');
    muat();
  }

  async function simpanPenerima() {
    if (!ganti) return;
    const res = await fetch(`/api/admin/agenda/${ganti.agenda.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aksi: 'TUJUAN',
        cakupan: ganti.form.cakupan,
        toko_id: ganti.form.cakupan === 'TOKO' ? Number(ganti.form.tokoId) || undefined : undefined,
        karyawan_ids: ganti.form.cakupan === 'KARYAWAN' ? ganti.form.karyawan : undefined,
      }),
    });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setPesan((b?.pesan as string) ?? 'Gagal mengubah penerima.');
      return;
    }
    setGanti(null);
    setPesan('Penerima agenda berhasil diubah.');
    muat();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-0 text-2xl font-semibold tracking-tight">Agenda</h1>
      {pesan ? (
        <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      ) : null}

      <FormulirBuatAgenda
        form={form}
        pilihanToko={pilihan.toko}
        pilihanKaryawan={pilihan.karyawan}
        onUbah={setForm}
        onKirim={kirim}
        sedangSimpan={sedangSimpan}
      />

      <FilterAgenda
        status={params.get('status') ?? ''}
        tokoId={params.get('toko_id') ?? ''}
        pilihanToko={pilihan.toko}
        onUbah={aturParam}
      />

      {memuat ? (
        <PanelMemuat />
      ) : aksesDitolak ? (
        <AksesDitolak />
      ) : galat ? (
        <PanelGalat pesan={galat} onCobaLagi={muat} />
      ) : (
        <TabelAgenda
          daftar={daftar}
          onBatalkan={(agenda) => setBatalkan({ agenda, alasan: '' })}
          onGantiPenerima={(agenda) =>
            setGanti({
              agenda,
              form: { cakupan: agenda.cakupan, tokoId: agenda.toko_id ? String(agenda.toko_id) : '', karyawan: [] },
            })
          }
        />
      )}

      <Dialog open={batalkan !== null} onOpenChange={(buka) => !buka && setBatalkan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Batalkan agenda</DialogTitle>
          </DialogHeader>
          {batalkan ? (
            <IsiDialogBatalkan
              judulAgenda={batalkan.agenda.judul}
              alasan={batalkan.alasan}
              onUbahAlasan={(v) => setBatalkan({ ...batalkan, alasan: v })}
              onBatal={() => setBatalkan(null)}
              onSimpan={simpanBatal}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={ganti !== null} onOpenChange={(buka) => !buka && setGanti(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Ubah penerima agenda</DialogTitle>
          </DialogHeader>
          {ganti ? (
            <IsiDialogGantiPenerima
              form={ganti.form}
              pilihanToko={pilihan.toko}
              pilihanKaryawan={pilihan.karyawan}
              onUbah={(f) => setGanti({ ...ganti, form: f })}
              onBatal={() => setGanti(null)}
              onSimpan={simpanPenerima}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PanelMemuat />}>
      <HalamanAgenda />
    </Suspense>
  );
}