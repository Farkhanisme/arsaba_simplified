'use client';

/**
 * Bagian presentasional halaman Jadwal (rules/05 §5.4).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state + router hidup di `page.tsx`.
 * Fungsi murni `tanggalPendek`/`ditempatkanPada` dipindah ke sini supaya bisa
 * diuji tanpa merender komponen klien yang butuh `next/navigation`.
 */

import { StarIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Slot {
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
  urutan?: number;
}

export interface BarisJadwal {
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

export interface DataGrid {
  rentang: { tanggal: string; hari: string; weekend: boolean }[];
  karyawan: { id: number; nama: string }[];
  penempatan: { karyawan_id: number; mulai: string; sampai: string | null }[];
  jadwal: BarisJadwal[];
  templateCocok: Record<string, string[]>;
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

export type PraMassal = {
  baru: unknown[];
  dilewati: { karyawan_id: number; tanggal: string }[];
  ditimpa: unknown[];
  ditolak: { karyawan_id: number; tanggal: string; alasan: string }[];
};

export function tanggalPendek(t: string): string {
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Tanggal hari ini dalam WIB sebagai `YYYY-MM-DD`.
 *
 * Dipakai HANYA sebagai penanda visual kolom ("Hari ini") — bukan dasar
 * keputusan apa pun. Jam klien tetap dilarang untuk waktu absen; ini bukan
 * waktu absen. `Intl` dengan `timeZone: 'Asia/Jakarta'` dipakai supaya benar
 * di mesin mana pun, tanpa `getHours()`/`getDate()` yang mengikuti timezone
 * mesin (bug B-13).
 */
export function tanggalHariIniWIB(sekarang: Date = new Date()): string {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(sekarang);
  return bagian;
}

/**
 * Ringkasan grid yang sedang tampil — dihitung sisi klien dari `DataGrid`,
 * tanpa API baru. `terisi` = sel yang punya baris jadwal; `khusus` dan
 * `peringatan` dihitung dari barisnya.
 */
export function ringkasanGrid(data: DataGrid): {
  totalSel: number;
  terisi: number;
  khusus: number;
  peringatan: number;
} {
  return {
    totalSel: data.karyawan.length * data.rentang.length,
    terisi: data.jadwal.length,
    khusus: data.jadwal.filter((j) => j.is_override === 1).length,
    peringatan: data.jadwal.filter((j) => j.peringatan.length > 0).length,
  };
}

/**
 * Pita ringkasan grid. Bukan kartu — pita ringkasan, mengikuti pola halaman
 * lain. Angka dipisah koma; tanpa pola `·` dan tanpa panah.
 */
export function PitaRingkasanJadwal({
  terisi,
  totalSel,
  khusus,
  peringatan,
}: {
  terisi: number;
  totalSel: number;
  khusus: number;
  peringatan: number;
}) {
  return (
    <section aria-label="Ringkasan jadwal" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span>
        <strong className="font-semibold tabular-nums">{terisi}</strong> dari{' '}
        <strong className="font-semibold tabular-nums">{totalSel}</strong> sel terisi
      </span>
      <span>
        <strong className="font-semibold tabular-nums">{khusus}</strong> khusus
      </span>
      <span>
        <strong className="font-semibold tabular-nums">{peringatan}</strong> peringatan tumpang tindih
      </span>
    </section>
  );
}

export function ditempatkanPada(
  p: DataGrid['penempatan'],
  kid: number,
  tanggal: string,
): boolean {
  return p.some((r) => r.karyawan_id === kid && r.mulai <= tanggal && (r.sampai === null || r.sampai >= tanggal));
}

export function FilterJadwal({
  tokoId,
  tokoList,
  mode,
  tanggal,
  onUbah,
}: {
  tokoId: string;
  tokoList: { id: number; nama: string }[];
  mode: string;
  tanggal: string;
  onUbah: (kunci: string, nilai: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="j-toko">Toko</Label>
          <NativeSelect
            id="j-toko"
            value={tokoId}
            onChange={(e) => onUbah('toko_id', e.target.value)}
            className="w-48"
          >
            <NativeSelectOption value="">— Pilih toko —</NativeSelectOption>
            {tokoList.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="label-mode" className="text-sm font-medium">
            Mode tampil
          </span>
          <Tabs value={mode} onValueChange={(v) => onUbah('mode', v)} aria-labelledby="label-mode">
            <TabsList>
              <TabsTrigger value="hari">Hari</TabsTrigger>
              <TabsTrigger value="minggu">Minggu</TabsTrigger>
              <TabsTrigger value="bulan">Bulan</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="j-tanggal">Tanggal acuan</Label>
          <Input
            id="j-tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => onUbah('tanggal', e.target.value)}
            className="w-40"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function GridJadwal({
  data,
  petaJadwal,
  onPilihSel,
  fokusSel = null,
  onFokusSel = () => {},
  hariIni = tanggalHariIniWIB(),
}: {
  data: DataGrid;
  petaJadwal: Map<string, BarisJadwal>;
  onPilihSel: (sel: { karyawan_id: number; tanggal: string }) => void;
  /** Sel yang sedang memegang fokus roving. Null = sel pertama. */
  fokusSel?: { karyawan_id: number; tanggal: string } | null;
  onFokusSel?: (sel: { karyawan_id: number; tanggal: string }) => void;
  /** Tanggal hari ini (WIB, YYYY-MM-DD). Hanya penanda visual kolom. */
  hariIni?: string;
}) {
  if (data.karyawan.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada karyawan di toko ini.</p>;
  }

  function gerak(
    karyawanId: number,
    tanggal: string,
    tombol: string,
  ): { karyawan_id: number; tanggal: string } | null {
    const ki = data.karyawan.findIndex((k) => k.id === karyawanId);
    const ti = data.rentang.findIndex((r) => r.tanggal === tanggal);
    if (ki < 0 || ti < 0) return null;
    let dk = 0;
    let dt = 0;
    if (tombol === 'ArrowRight') dt = 1;
    else if (tombol === 'ArrowLeft') dt = -1;
    else if (tombol === 'ArrowDown') dk = 1;
    else if (tombol === 'ArrowUp') dk = -1;
    else return null;
    // Lewati sel yang tombolnya nonaktif (karyawan tidak ditempatkan pada
    // tanggal itu): tombol nonaktif tidak bisa menerima fokus, jadi berhenti
    // di sana berarti fokus hilang diam-diam.
    let nk = ki + dk;
    let nt = ti + dt;
    while (nk >= 0 && nk < data.karyawan.length && nt >= 0 && nt < data.rentang.length) {
      const bk = data.karyawan[nk]!;
      const bt = data.rentang[nt]!;
      if (ditempatkanPada(data.penempatan, bk.id, bt.tanggal)) {
        return { karyawan_id: bk.id, tanggal: bt.tanggal };
      }
      nk += dk;
      nt += dt;
    }
    return null;
  }

  const selPertama = { karyawan_id: data.karyawan[0]!.id, tanggal: data.rentang[0]?.tanggal ?? '' };
  const aktif = fokusSel ?? selPertama;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">Karyawan</TableHead>
              {data.rentang.map((r) => {
                const iniHariIni = r.tanggal === hariIni;
                return (
                  // UI-8 B2c: kolom weekend punya pita latar, bukan cuma teks —
                  // teks "(Weekend)" tetap ada (§5.4 + kunci tes UI-2), warna
                  // tidak pernah jadi satu-satunya pembeda (§1.3).
                  <TableHead
                    key={r.tanggal}
                    className={[
                      'min-w-28',
                      r.weekend ? 'bg-muted/50' : '',
                      iniHariIni ? 'bg-primary/10' : '',
                    ].join(' ')}
                  >
                    {r.hari.slice(0, 3)} {tanggalPendek(r.tanggal)}
                    {r.weekend ? ' (Weekend)' : ''}
                    {iniHariIni ? <Badge>Hari ini</Badge> : null}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.karyawan.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="sticky left-0 bg-card font-bold">{k.nama}</TableCell>
                {data.rentang.map((r) => {
                  const j = petaJadwal.get(`${k.id}|${r.tanggal}`);
                  const boleh = ditempatkanPada(data.penempatan, k.id, r.tanggal);
                  // Pita yang sama di sel isi, supaya kolom weekend terbaca
                  // sebagai lajur saat grid di-scroll horizontal.
                  const iniFokus = aktif.karyawan_id === k.id && aktif.tanggal === r.tanggal;
                  const iniHariIni = r.tanggal === hariIni;
                  return (
                    <TableCell
                      key={r.tanggal}
                      className={[r.weekend ? 'bg-muted/50' : '', iniHariIni ? 'bg-primary/5' : ''].join(' ')}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!boleh}
                        tabIndex={iniFokus ? 0 : -1}
                        data-sel={`${k.id}|${r.tanggal}`}
                        onClick={() => onPilihSel({ karyawan_id: k.id, tanggal: r.tanggal })}
                        onFocus={() => onFokusSel({ karyawan_id: k.id, tanggal: r.tanggal })}
                        onKeyDown={(e) => {
                          const tujuan = gerak(k.id, r.tanggal, e.key);
                          if (tujuan) {
                            e.preventDefault();
                            onFokusSel(tujuan);
                          }
                        }}
                        aria-label={`Jadwal ${k.nama} ${tanggalPendek(r.tanggal)}`}
                        // Sel terisi punya garis tepi kiri — pembeda BENTUK,
                        // bukan cuma warna (§1.3). Sel kosong tetap polos.
                        className={j ? 'h-auto w-full justify-start border-l-2 border-primary whitespace-normal' : 'h-auto w-full justify-start whitespace-normal'}
                      >
                        {j ? (
                          <span className="flex flex-col items-start gap-1 text-left">
                            <span>{j.slot.map((s) => `${s.nama} ${s.jam_mulai}–${s.jam_selesai}`).join(' + ')}</span>
                            <span className="flex items-center gap-1">
                              {j.is_override === 1 ? <Badge variant="outline"><StarIcon />Khusus</Badge> : null}
                              {j.peringatan.length > 0 ? (
                                <span title="Jam slot saling tumpang tindih" className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <TriangleAlertIcon />
                                  <span className="text-xs font-medium">Tumpang tindih</span>
                                </span>
                              ) : null}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PanelSel({
  tanggal,
  jadwalSel,
  templateCocok,
  panelTemplate,
  panelMode,
  ovBaru,
  ovSlots,
  ovCatatan,
  ovPeringatan,
  onUbahTemplate,
  onUbahMode,
  onSimpan,
  onMintaUbahKhusus,
  onKembaliStandar,
  onTutup,
  onUbahOvSlots,
  onUbahOvCatatan,
  onTambahSlot,
  onHapusSlot,
  onSimpanOverride,
  onBatalOverride,
}: {
  tanggal: string;
  jadwalSel: BarisJadwal | null;
  templateCocok: string[];
  panelTemplate: string;
  panelMode: 'lewati' | 'timpa';
  ovBaru: boolean;
  ovSlots: Slot[];
  ovCatatan: string;
  ovPeringatan: { a: number; b: number }[];
  onUbahTemplate: (nilai: string) => void;
  onUbahMode: (mode: 'lewati' | 'timpa') => void;
  onSimpan: () => void;
  onMintaUbahKhusus: () => void;
  onKembaliStandar: () => void;
  onTutup: () => void;
  onUbahOvSlots: (slots: Slot[]) => void;
  onUbahOvCatatan: (nilai: string) => void;
  onTambahSlot: () => void;
  onHapusSlot: (indeks: number) => void;
  onSimpanOverride: () => void;
  onBatalOverride: () => void;
}) {
  return (
    <Card className="max-w-2xl" aria-label="Panel sel">
      <CardHeader>
        <CardTitle>Jadwal {tanggalPendek(tanggal)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {jadwalSel ? (
          <div className="flex flex-col gap-1 text-sm">
            <div>{jadwalSel.slot.map((s) => `${s.nama} · ${s.jam_mulai}–${s.jam_selesai}`).join(' + ')}</div>
            {jadwalSel.is_override === 1 ? (
              <span className="inline-flex items-center gap-1">
                <StarIcon />Khusus{jadwalSel.catatan ? ` — ${jadwalSel.catatan}` : ''}
              </span>
            ) : null}
            {jadwalSel.peringatan.length > 0 ? (
              <Alert className="border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
                <AlertDescription>
                  Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : (
          <p className="text-sm">Sel kosong.</p>
        )}
        {!ovBaru ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-shift">Shift (hanya yang sesuai hari itu)</Label>
              <NativeSelect
                id="p-shift"
                value={panelTemplate}
                onChange={(e) => onUbahTemplate(e.target.value)}
                className="w-56"
              >
                <NativeSelectOption value="">— Pilih shift —</NativeSelectOption>
                {templateCocok.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div role="group" aria-label="Bila sel sudah ada" className="flex gap-4">
              <label htmlFor="mode-lewati" className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  id="mode-lewati"
                  checked={panelMode === 'lewati'}
                  onCheckedChange={(c) => c && onUbahMode('lewati')}
                />
                Lewati bila sudah ada
              </label>
              <label htmlFor="mode-timpa" className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  id="mode-timpa"
                  checked={panelMode === 'timpa'}
                  onCheckedChange={(c) => c && onUbahMode('timpa')}
                />
                Timpa
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" onClick={onSimpan} disabled={!panelTemplate}>
                Simpan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onMintaUbahKhusus}>
                Ubah khusus hari ini
              </Button>
              {jadwalSel && jadwalSel.is_override === 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={onKembaliStandar} disabled={!panelTemplate}>
                  Kembali ke shift standar
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={onTutup}>
                Tutup
              </Button>
            </div>
          </>
        ) : (
          <>
            {ovSlots.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ov-nama-${i}`}>Nama</Label>
                  <Input
                    id={`ov-nama-${i}`}
                    value={s.nama}
                    onChange={(e) =>
                      onUbahOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, nama: e.target.value } : x)))
                    }
                    maxLength={100}
                    className="w-28"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ov-mulai-${i}`}>Mulai</Label>
                  <Input
                    id={`ov-mulai-${i}`}
                    type="time"
                    value={s.jam_mulai}
                    onChange={(e) =>
                      onUbahOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, jam_mulai: e.target.value } : x)))
                    }
                    className="w-28"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ov-selesai-${i}`}>Selesai</Label>
                  <Input
                    id={`ov-selesai-${i}`}
                    type="time"
                    value={s.jam_selesai}
                    onChange={(e) =>
                      onUbahOvSlots(ovSlots.map((x, xi) => (xi === i ? { ...x, jam_selesai: e.target.value } : x)))
                    }
                    className="w-28"
                  />
                </div>
                {ovSlots.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onHapusSlot(i)} aria-label={`Hapus slot ${i + 1}`}>
                    Hapus
                  </Button>
                ) : null}
              </div>
            ))}
            {ovSlots.length < 2 ? (
              <Button type="button" size="sm" variant="outline" onClick={onTambahSlot}>
                Tambah slot (maks 2)
              </Button>
            ) : null}
            {ovPeringatan.length > 0 ? (
              <Alert className="border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
                <AlertDescription>
                  Peringatan: jam slot saling tumpang tindih. Anda tetap dapat menyimpan.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ov-catatan">Catatan (opsional)</Label>
              <Input
                id="ov-catatan"
                value={ovCatatan}
                onChange={(e) => onUbahOvCatatan(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" onClick={onSimpanOverride}>
                Simpan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onBatalOverride}>
                Batal
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface BentukMassal {
  karyawan: number[];
  dari: string;
  sampai: string;
  template: string;
  mode: 'lewati' | 'timpa';
}

export function PanelIsiMassal({
  karyawanList,
  adaData,
  massal,
  templateNama,
  pra,
  hasilMassal,
  onUbah,
  onPratinjau,
  onTerapkan,
}: {
  karyawanList: { id: number; nama: string }[];
  adaData: boolean;
  massal: BentukMassal;
  templateNama: string[];
  pra: PraMassal | null;
  hasilMassal: HasilMassalUI | null;
  onUbah: (m: BentukMassal) => void;
  onPratinjau: () => void;
  onTerapkan: () => void;
}) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Isi massal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">1. Pilih karyawan, rentang, dan shift</h3>
        {adaData ? (
          <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto">
            {karyawanList.map((k) => (
              <label key={k.id} htmlFor={`massal-${k.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  id={`massal-${k.id}`}
                  checked={massal.karyawan.includes(k.id)}
                  onCheckedChange={(c) =>
                    onUbah({
                      ...massal,
                      karyawan: c ? [...massal.karyawan, k.id] : massal.karyawan.filter((x) => x !== k.id),
                    })
                  }
                />
                {k.nama}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pilih toko dulu.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-dari">Dari</Label>
            <Input
              id="m-dari"
              type="date"
              value={massal.dari}
              onChange={(e) => onUbah({ ...massal, dari: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-sampai">Sampai</Label>
            <Input
              id="m-sampai"
              type="date"
              value={massal.sampai}
              onChange={(e) => onUbah({ ...massal, sampai: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-shift">Shift</Label>
            <NativeSelect
              id="m-shift"
              value={massal.template}
              onChange={(e) => onUbah({ ...massal, template: e.target.value })}
              className="w-44"
            >
              <NativeSelectOption value="">— Pilih —</NativeSelectOption>
              {templateNama.map((n) => (
                <NativeSelectOption key={n} value={n}>
                  {n}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex gap-4">
            <label htmlFor="m-lewati" className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id="m-lewati"
                checked={massal.mode === 'lewati'}
                onCheckedChange={(c) => c && onUbah({ ...massal, mode: 'lewati' })}
              />
              Lewati
            </label>
            <label htmlFor="m-timpa" className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id="m-timpa"
                checked={massal.mode === 'timpa'}
                onCheckedChange={(c) => c && onUbah({ ...massal, mode: 'timpa' })}
              />
              Timpa
            </label>
          </div>
          <Button
            type="button"
            onClick={onPratinjau}
            disabled={massal.karyawan.length === 0 || !massal.dari || !massal.sampai || !massal.template}
          >
            Pratinjau
          </Button>
        </div>
        {pra ? (
          <div className="flex flex-col gap-2 text-sm">
            <h3 className="text-sm font-medium">2. Pratinjau</h3>
            <p>
              {pra.baru.length} sel baru, {pra.dilewati.length} dilewati, {pra.ditimpa.length} ditimpa,{' '}
              {pra.ditolak.length} ditolak.
            </p>
            {pra.ditolak.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {pra.ditolak.slice(0, 10).map((d, i) => (
                  <li key={i}>
                    {tanggalPendek(d.tanggal)}: {d.alasan}
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <Button type="button" size="sm" onClick={onTerapkan}>
                Terapkan
              </Button>
            </div>
          </div>
        ) : null}
        {hasilMassal ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">3. Hasil</h3>
            <PanelHasilMassal hasil={hasilMassal} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Panel hasil apply massal: dibuat + ditimpa (B-19) + dilewati + ditolak. */
export function PanelHasilMassal({ hasil }: { hasil: HasilMassalUI }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {hasil.baru.length} dibuat, {hasil.ditimpa.length} ditimpa, {hasil.dilewati.length} dilewati,{' '}
        {hasil.ditolak.length} ditolak.
      </p>
      {hasil.ditimpa.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {hasil.ditimpa.map((d, i) => (
            <li key={i}>
              Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)} (ditimpa)
            </li>
          ))}
        </ul>
      ) : null}
      {hasil.dilewati.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {hasil.dilewati.map((d, i) => (
            <li key={i}>
              Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}
            </li>
          ))}
        </ul>
      ) : null}
      {hasil.ditolak.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {hasil.ditolak.map((d, i) => (
            <li key={i}>
              Karyawan #{d.karyawan_id} · {tanggalPendek(d.tanggal)}: {d.alasan}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** M9-01: arahan bila toko belum punya template shift (rules/05 §5.4). */
export function PesanButuhTemplate() {
  return (
    <p className="text-sm text-muted-foreground">
      Minta Super Admin menambah template di Data Master › Shift.
    </p>
  );
}

export function PanelMemuatJadwal() {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function PanelGalatJadwal({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{pesan}</span>
        <Button size="sm" variant="outline" onClick={onCobaLagi}>
          Coba lagi
        </Button>
      </AlertDescription>
    </Alert>
  );
}
