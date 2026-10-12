'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHeadSticky,
  TableHeaderSticky,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PanelGalat, PanelMemuat } from '../komponen';

/**
 * Komponen presentasional halaman Agenda (M11).
 *
 * Semua user-visible ada di sini supaya bisa diuji dengan `renderToStaticMarkup` —
 * lesson UI-2: string yang hanya hidup di dalam `page.tsx` tidak bisa diuji sama sekali.
 * Tidak ada akses data di file ini; `page.tsx` yang memuat dan mengirim.
 */

export interface BarisAgenda {
  id: number;
  judul: string;
  keterangan: string | null;
  wajib_foto: 0 | 1;
  cakupan: 'KARYAWAN' | 'TOKO' | 'SEMUA';
  toko_id: number | null;
  toko_nama: string | null;
  target_tanggal: string | null;
  status: 'AKTIF' | 'DIBATALKAN';
  alasan_batal: string | null;
  dibuat_oleh_nama: string | null;
  dibuat_oleh_karyawan: number | null;
}

export interface AgendaLengkap {
  agenda: BarisAgenda;
  penerimaIds: number[];
  namaPenerima: string[];
}

export interface FormulirAgenda {
  judul: string;
  keterangan: string;
  wajib_foto: boolean;
  cakupan: 'KARYAWAN' | 'TOKO' | 'SEMUA';
  tokoId: string;
  targetTanggal: string;
  karyawan: number[];
}

export const FORMULIR_KOSONG: FormulirAgenda = {
  judul: '',
  keterangan: '',
  wajib_foto: true,
  cakupan: 'SEMUA',
  tokoId: '',
  targetTanggal: '',
  karyawan: [],
};

export const LABEL_CAKUPAN: Record<BarisAgenda['cakupan'], string> = {
  KARYAWAN: 'Karyawan tertentu',
  TOKO: 'Satu toko',
  SEMUA: 'Seluruh karyawan',
};

/** Batas tampilan; daftar penerima bisa 26 orang dan tidak boleh memanjangkan tabel. */
const MAKS_NAMA_TAMPIL = 5;

export function tanggalPendek(t: string | null): string {
  if (!t) return '—';
  const bagian = t.split('-');
  if (bagian.length !== 3) return t;
  return `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
}

export function LabelCakupan({ cakupan }: { cakupan: BarisAgenda['cakupan'] }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
      {LABEL_CAKUPAN[cakupan]}
    </span>
  );
}

export function LabelStatusAgenda({ status }: { status: BarisAgenda['status'] }) {
  return (
    <span
      className={
        status === 'DIBATALKAN'
          ? 'inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
          : 'inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100'
      }
    >
      {status === 'DIBATALKAN' ? 'Dibatalkan' : 'Aktif'}
    </span>
  );
}

/** Ringkas penerima; kalau lebih dari batas, tampilkan sisanya sebagai "+n lainnya". */
export function TeksPenerima({ namaPenerima }: { namaPenerima: string[] }) {
  if (namaPenerima.length === 0) {
    return <span className="text-muted-foreground">Tidak ada penerima aktif</span>;
  }
  const shown = namaPenerima.slice(0, MAKS_NAMA_TAMPIL);
  const sisa = namaPenerima.length - shown.length;
  return (
    <span>
      {shown.join(', ')}
      {sisa > 0 ? ` +${sisa} lainnya` : ''}
    </span>
  );
}

export function FormulirBuatAgenda({
  form,
  pilihanToko,
  pilihanKaryawan,
  onUbah,
  onKirim,
  sedangSimpan,
}: {
  form: FormulirAgenda;
  pilihanToko: { id: number; nama: string }[];
  pilihanKaryawan: { id: number; nama: string }[];
  onUbah: (f: FormulirAgenda) => void;
  onKirim: () => void;
  sedangSimpan: boolean;
}) {
  const ubah = (sebagian: Partial<FormulirAgenda>) => onUbah({ ...form, ...sebagian });

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onKirim();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-judul">Judul agenda</Label>
            <Input
              id="ag-judul"
              value={form.judul}
              maxLength={120}
              onChange={(e) => ubah({ judul: e.target.value })}
              placeholder="Contoh: Ganti lampu emergency di rak 3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-keterangan">Keterangan (opsional)</Label>
            <Textarea
              id="ag-keterangan"
              value={form.keterangan}
              maxLength={500}
              rows={2}
              onChange={(e) => ubah({ keterangan: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ag-wajib-foto">Wajib foto before dan after</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="ag-wajib-foto"
                checked={form.wajib_foto}
                onCheckedChange={(c) => ubah({ wajib_foto: c === true })}
              />
              <span>
                {form.wajib_foto
                  ? 'Karyawan wajib mengambil foto before dan foto after.'
                  : 'Karyawan cukup mengisi keterangan opsional.'}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-cakupan">Diberikan ke</Label>
              <NativeSelect
                id="ag-cakupan"
                value={form.cakupan}
                className="w-52"
                onChange={(e) => ubah({ cakupan: e.target.value as FormulirAgenda['cakupan'] })}
              >
                <NativeSelectOption value="SEMUA">Seluruh karyawan</NativeSelectOption>
                <NativeSelectOption value="TOKO">Satu toko</NativeSelectOption>
                <NativeSelectOption value="KARYAWAN">Karyawan tertentu</NativeSelectOption>
              </NativeSelect>
            </div>

            {form.cakupan === 'TOKO' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ag-toko">Toko</Label>
                <NativeSelect
                  id="ag-toko"
                  value={form.tokoId}
                  className="w-44"
                  onChange={(e) => ubah({ tokoId: e.target.value })}
                >
                  <NativeSelectOption value="">Pilih toko</NativeSelectOption>
                  {pilihanToko.map((t) => (
                    <NativeSelectOption key={t.id} value={String(t.id)}>
                      {t.nama}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-target">Tanggal target (opsional)</Label>
              <Input
                id="ag-target"
                type="date"
                value={form.targetTanggal}
                className="w-40"
                onChange={(e) => ubah({ targetTanggal: e.target.value })}
              />
            </div>
          </div>

          {form.cakupan === 'KARYAWAN' ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Pilih karyawan</legend>
              <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                {pilihanKaryawan.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada karyawan.</p>
                ) : (
                  pilihanKaryawan.map((k) => {
                    const terpilih = form.karyawan.includes(k.id);
                    return (
                      <label key={k.id} className="flex items-center gap-2 py-1 text-sm">
                        <Checkbox
                          checked={terpilih}
                          onCheckedChange={(c) =>
                            ubah({
                              karyawan: c === true ? [...form.karyawan, k.id] : form.karyawan.filter((x) => x !== k.id),
                            })
                          }
                        />
                        <span>{k.nama}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>
          ) : null}

          <div>
            <Button type="submit" disabled={sedangSimpan}>
              {sedangSimpan ? 'Menyimpan…' : 'Simpan Agenda'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function FilterAgenda({
  status,
  tokoId,
  pilihanToko,
  onUbah,
}: {
  status: string;
  tokoId: string;
  pilihanToko: { id: number; nama: string }[];
  onUbah: (kunci: string, nilai: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fa-status">Status</Label>
          <NativeSelect
            id="fa-status"
            value={status}
            className="w-40"
            onChange={(e) => onUbah('status', e.target.value)}
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            <NativeSelectOption value="AKTIF">Aktif</NativeSelectOption>
            <NativeSelectOption value="DIBATALKAN">Dibatalkan</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fa-toko">Toko</Label>
          <NativeSelect
            id="fa-toko"
            value={tokoId}
            className="w-44"
            onChange={(e) => onUbah('toko_id', e.target.value)}
          >
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {pilihanToko.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabelAgenda({
  daftar,
  onBatalkan,
  onGantiPenerima,
}: {
  daftar: AgendaLengkap[];
  onBatalkan: (a: BarisAgenda) => void;
  onGantiPenerima: (a: BarisAgenda) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada agenda.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table maxH="70vh" scrollLabel="Tabel agenda">
          <TableHeaderSticky>
            <TableRow>
              <TableHeadSticky>Judul</TableHeadSticky>
              <TableHeadSticky>Penerima</TableHeadSticky>
              <TableHeadSticky>Foto</TableHeadSticky>
              <TableHeadSticky>Target</TableHeadSticky>
              <TableHeadSticky>Status</TableHeadSticky>
              <TableHeadSticky>Aksi</TableHeadSticky>
            </TableRow>
          </TableHeaderSticky>
          <TableBody>
            {daftar.map(({ agenda, namaPenerima }) => (
              <TableRow key={agenda.id}>
                <TableCell>
                  <div className="font-medium">{agenda.judul}</div>
                  {agenda.keterangan ? (
                    <div className="text-xs text-muted-foreground">{agenda.keterangan}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    {agenda.dibuat_oleh_nama
                      ? `Dibuat ${agenda.dibuat_oleh_nama}`
                      : 'Dibuat oleh karyawan sendiri'}
                  </div>
                </TableCell>
                <TableCell>
                  <LabelCakupan cakupan={agenda.cakupan} />
                  {agenda.cakupan === 'TOKO' && agenda.toko_nama ? (
                    <div className="text-xs text-muted-foreground">{agenda.toko_nama}</div>
                  ) : null}
                  <div className="text-xs">
                    <TeksPenerima namaPenerima={namaPenerima} />
                  </div>
                </TableCell>
                <TableCell>{agenda.wajib_foto === 1 ? 'Before + After' : 'Tanpa foto'}</TableCell>
                <TableCell>{tanggalPendek(agenda.target_tanggal)}</TableCell>
                <TableCell>
                  <LabelStatusAgenda status={agenda.status} />
                  {agenda.alasan_batal ? (
                    <div className="text-xs text-muted-foreground">{agenda.alasan_batal}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {agenda.status === 'AKTIF' ? (
                    <div className="flex gap-1.5">
                      {agenda.dibuat_oleh_karyawan === null ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => onGantiPenerima(agenda)}>
                          Ubah Penerima
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="outline" onClick={() => onBatalkan(agenda)}>
                        Batalkan
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Selesai</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function IsiDialogBatalkan({
  judulAgenda,
  alasan,
  onUbahAlasan,
  onBatal,
  onSimpan,
}: {
  judulAgenda: string;
  alasan: string;
  onUbahAlasan: (v: string) => void;
  onBatal: () => void;
  onSimpan: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <AlertDescription>
          Membatalkan agenda tidak menghapus laporan yang sudah ada. Agenda &quot;{judulAgenda}&quot; tidak lagi
          muncul di daftar karyawan.
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ag-alasan">Alasan pembatalan (wajib)</Label>
        <Textarea id="ag-alasan" value={alasan} rows={3} maxLength={500} onChange={(e) => onUbahAlasan(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={onSimpan}>
          Batalkan Agenda
        </Button>
        <Button type="button" variant="outline" onClick={onBatal}>
          Kembali
        </Button>
      </div>
    </div>
  );
}

export interface FormGantiPenerima {
  cakupan: BarisAgenda['cakupan'];
  tokoId: string;
  karyawan: number[];
}

export function IsiDialogGantiPenerima({
  form,
  pilihanToko,
  pilihanKaryawan,
  onUbah,
  onBatal,
  onSimpan,
}: {
  form: FormGantiPenerima;
  pilihanToko: { id: number; nama: string }[];
  pilihanKaryawan: { id: number; nama: string }[];
  onUbah: (f: FormGantiPenerima) => void;
  onBatal: () => void;
  onSimpan: () => void;
}) {
  const ubah = (sebagian: Partial<FormGantiPenerima>) => onUbah({ ...form, ...sebagian });
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertDescription>
          Penerima dihitung dari penempatan karyawan saat ini. Karyawan yang pindah toko setelah ini akan otomatis
          lepas atau masuk mengikuti penempatannya.
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gp-cakupan">Diberikan ke</Label>
        <NativeSelect
          id="gp-cakupan"
          value={form.cakupan}
          className="w-52"
          onChange={(e) => ubah({ cakupan: e.target.value as BarisAgenda['cakupan'] })}
        >
          <NativeSelectOption value="SEMUA">Seluruh karyawan</NativeSelectOption>
          <NativeSelectOption value="TOKO">Satu toko</NativeSelectOption>
          <NativeSelectOption value="KARYAWAN">Karyawan tertentu</NativeSelectOption>
        </NativeSelect>
      </div>
      {form.cakupan === 'TOKO' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gp-toko">Toko</Label>
          <NativeSelect id="gp-toko" value={form.tokoId} className="w-44" onChange={(e) => ubah({ tokoId: e.target.value })}>
            <NativeSelectOption value="">Pilih toko</NativeSelectOption>
            {pilihanToko.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {form.cakupan === 'KARYAWAN' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Pilih karyawan</legend>
          <div className="max-h-48 overflow-y-auto rounded-md border p-2">
            {pilihanKaryawan.map((k) => (
              <label key={k.id} className="flex items-center gap-2 py-1 text-sm">
                <Checkbox
                  checked={form.karyawan.includes(k.id)}
                  onCheckedChange={(c) =>
                    ubah({
                      karyawan: c === true ? [...form.karyawan, k.id] : form.karyawan.filter((x) => x !== k.id),
                    })
                  }
                />
                <span>{k.nama}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" onClick={onSimpan}>
          Simpan Penerima
        </Button>
        <Button type="button" variant="outline" onClick={onBatal}>
          Kembali
        </Button>
      </div>
    </div>
  );
}

export { PanelGalat, PanelMemuat };