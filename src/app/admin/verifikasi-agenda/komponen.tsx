'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PanelGalat, PanelMemuat } from '../komponen';

/**
 * Komponen presentasional halaman Verifikasi Agenda (M13).
 *
 * Sengaja TIDAK punya kolom menit keterlambatan, kolom pasangan, atau kolom
 * koordinat — semuanya tidak berlaku untuk agenda (BR-G13). Menyalin tabel
 * verifikasi absensi dan menyembunyikan kolom akan menyisakan baris yang selalu
 * kosong; lebih baik tabelnya memang berbeda.
 *
 * Foto before/after lewat proxy server `/api/foto/agenda/[id]`; URL Telegram tidak
 * pernah sampai ke klien (rules/03 §7).
 */

export interface BarisLaporanAgenda {
  id: number;
  agenda_id: number;
  karyawan_nama: string;
  toko_nama: string | null;
  tanggal: string;
  percobaan: number;
  status: string;
  keterangan: string | null;
  dikirim_at: string | null;
  diverifikasi_nama: string | null;
  alasan_tolak: string | null;
}

export function tanggalPendek(t: string | null): string {
  if (!t) return '—';
  const bagian = t.split('-');
  if (bagian.length !== 3) return t;
  return `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
}

export function LabelStatusLaporan({ status }: { status: string }) {
  if (status === 'DISETUJUI') return <Badge>Disetujui</Badge>;
  if (status === 'DITOLAK') return <Badge variant="destructive">Ditolak</Badge>;
  return <Badge variant="secondary">Menunggu</Badge>;
}

export function FilterVerifikasiAgenda({
  status,
  tokoId,
  dari,
  sampai,
  pilihanToko,
  onUbah,
}: {
  status: string;
  tokoId: string;
  dari: string;
  sampai: string;
  pilihanToko: { id: number; nama: string }[];
  onUbah: (kunci: string, nilai: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="va-status">Status</Label>
          <NativeSelect id="va-status" value={status} className="w-44" onChange={(e) => onUbah('status', e.target.value)}>
            <NativeSelectOption value="">Semua</NativeSelectOption>
            <NativeSelectOption value="MENUNGGU">Menunggu</NativeSelectOption>
            <NativeSelectOption value="DISETUJUI">Disetujui</NativeSelectOption>
            <NativeSelectOption value="DITOLAK">Ditolak</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="va-toko">Toko</Label>
          <NativeSelect id="va-toko" value={tokoId} className="w-44" onChange={(e) => onUbah('toko_id', e.target.value)}>
            <NativeSelectOption value="">Semua</NativeSelectOption>
            {pilihanToko.map((t) => (
              <NativeSelectOption key={t.id} value={String(t.id)}>
                {t.nama}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="va-dari">Dari</Label>
          <Input id="va-dari" type="date" value={dari} className="w-40" onChange={(e) => onUbah('dari', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="va-sampai">Sampai</Label>
          <Input id="va-sampai" type="date" value={sampai} className="w-40" onChange={(e) => onUbah('sampai', e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Dua foto laporan. `adaFoto` menentukan apakah tautannya ditampilkan. */
export function PanelFotoLaporan({
  id,
  adaSebelum,
  adaSesudah,
}: {
  id: number;
  adaSebelum: boolean;
  adaSesudah: boolean;
}) {
  if (!adaSebelum && !adaSesudah) {
    return <span className="text-muted-foreground">Tanpa foto</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {adaSebelum ? (
        <a href={`/api/foto/agenda/${id}?foto=sebelum`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          Foto before
        </a>
      ) : null}
      {adaSesudah ? (
        <a href={`/api/foto/agenda/${id}?foto=sesudah`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          Foto after
        </a>
      ) : null}
    </div>
  );
}

export function TabelLaporanAgenda({
  daftar,
  adaFoto,
  onSetujui,
  onTolak,
}: {
  daftar: BarisLaporanAgenda[];
  adaFoto: (id: number) => { sebelum: boolean; sesudah: boolean };
  onSetujui: (id: number) => void;
  onTolak: (baris: BarisLaporanAgenda) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada laporan agenda pada filter ini.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Karyawan</TableHead>
              <TableHead>Toko</TableHead>
              <TableHead>Percobaan</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Foto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((r) => {
              const foto = adaFoto(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>{tanggalPendek(r.tanggal)}</TableCell>
                  <TableCell>{r.karyawan_nama}</TableCell>
                  <TableCell>{r.toko_nama ?? '—'}</TableCell>
                  <TableCell>{r.percobaan}</TableCell>
                  <TableCell>{r.keterangan ?? '—'}</TableCell>
                  <TableCell>
                    <PanelFotoLaporan id={r.id} adaSebelum={foto.sebelum} adaSesudah={foto.sesudah} />
                  </TableCell>
                  <TableCell>
                    <LabelStatusLaporan status={r.status} />
                    {r.alasan_tolak ? (
                      <div className="text-xs text-muted-foreground">{r.alasan_tolak}</div>
                    ) : null}
                    {r.diverifikasi_nama ? (
                      <div className="text-xs text-muted-foreground">oleh {r.diverifikasi_nama}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSetujui(r.id)}>
                        Setujui
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onTolak(r)}>
                        Tolak
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function IsiDialogTolakLaporan({
  namaKaryawan,
  alasan,
  onUbahAlasan,
  onBatal,
  onSimpan,
}: {
  namaKaryawan: string;
  alasan: string;
  onUbahAlasan: (v: string) => void;
  onBatal: () => void;
  onSimpan: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <AlertDescription>
          Menolak laporan &quot;{namaKaryawan}&quot; tidak menghanguskan kesempatan. Karyawan boleh mengulang sebagai
          percobaan baru dengan foto baru.
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="va-alasan">Alasan penolakan (wajib)</Label>
        <Textarea id="va-alasan" value={alasan} rows={3} maxLength={500} onChange={(e) => onUbahAlasan(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={onSimpan}>
          Tolak Laporan
        </Button>
        <Button type="button" variant="outline" onClick={onBatal}>
          Kembali
        </Button>
      </div>
    </div>
  );
}

export { PanelGalat, PanelMemuat };