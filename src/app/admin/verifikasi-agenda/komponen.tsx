'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { PanelGalat, PanelMemuat } from '../komponen';
// Paginasi dipakai ulang dari halaman Verifikasi Absensi, bukan ditulis
// ulang: API kedua halaman sama-sama tanpa limit/offset, jadi pemotongannya
// identik. Tidak ada siklus impor (komponen verifikasi tidak mengimpor balik).
import { KontrolHalaman } from '../verifikasi/komponen';

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

/**
 * Gambar laporan dengan jatuh-bangun jujur.
 *
 * `adaFoto` di halaman ini hardcoded `true` (warisan tabel lama — API tidak
 * memberi tahu foto mana yang ada). Jadi gambar yang ternyata tidak ada
 * (proxy 404) diganti teks "Tanpa foto" saat `onError`, bukan dibiarkan jadi
 * ikon gambar rusak. Jalur `onError` hanya jalan di browser, jadi hanya bisa
 * dibuktikan manual — sama seperti fokus keyboard (B-20).
 */
export function GambarMiniLaporan({ src }: { src: string }) {
  const [gagal, setGagal] = useState(false);
  if (gagal) return <span className="text-xs text-muted-foreground">Tanpa foto</span>;
  return (
    <img
      src={src}
      alt=""
      width={56}
      height={56}
      className="size-14 rounded-md object-cover"
      onError={() => setGagal(true)}
    />
  );
}

export function GambarBesarLaporan({ src, alt }: { src: string; alt: string }) {
  const [gagal, setGagal] = useState(false);
  if (gagal) return <span className="text-sm text-muted-foreground">Tanpa foto</span>;
  return (
    <img src={src} alt={alt} className="max-h-[50vh] w-auto rounded-lg" onError={() => setGagal(true)} />
  );
}

/**
 * Pita ringkasan antrean. Bukan kartu — pita ringkasan, mengikuti pola halaman
 * Verifikasi Absensi. Tanpa pola `·` dan tanpa panah.
 */
export function PitaAntreanAgenda({
  menunggu,
  total,
  onBantuan,
}: {
  menunggu: number;
  total: number;
  onBantuan: () => void;
}) {
  return (
    <section aria-label="Ringkasan antrean agenda" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span>
        <strong className="font-semibold tabular-nums">{menunggu}</strong> menunggu verifikasi
      </span>
      <span className="text-muted-foreground">
        dari <strong className="font-semibold tabular-nums">{total}</strong> laporan pada filter ini
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onBantuan} aria-label="Bantuan pintasan keyboard">
        Pintasan keyboard (?)
      </Button>
    </section>
  );
}

/**
 * Satu laporan agenda sebagai kartu (pengganti baris tabel).
 *
 * Foto before/after tampil berdampingan sebagai thumbnail — klik membuka
 * lightbox banding, bukan tab baru, supaya konteks antrean tidak hilang.
 * Agenda tanpa foto itu sah (BR-G8), jadi sisi yang tidak ada diganti teks
 * "Tanpa foto", bukan tautan mati.
 */
export function KartuLaporanAgenda({
  r,
  adaFoto,
  onLihatFoto,
  onSetujui,
  onTolak,
}: {
  r: BarisLaporanAgenda;
  adaFoto: (id: number) => { sebelum: boolean; sesudah: boolean };
  onLihatFoto: () => void;
  onSetujui: () => void;
  onTolak: () => void;
}) {
  const foto = adaFoto(r.id);
  return (
    <Card data-slot="kartu-laporan-agenda" data-laporan-id={r.id} tabIndex={-1} aria-label={`Laporan agenda ${r.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{r.karyawan_nama}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {r.toko_nama ?? '—'} · {tanggalPendek(r.tanggal)} · Percobaan {r.percobaan}
          </span>
          <span className="ml-auto">
            <LabelStatusLaporan status={r.status} />
          </span>
        </div>
        {r.keterangan ? (
          <div className="text-xs text-muted-foreground">Keterangan: {r.keterangan}</div>
        ) : null}
        {r.alasan_tolak ? (
          <div className="text-xs text-muted-foreground">Ditolak: {r.alasan_tolak}</div>
        ) : null}
        {r.diverifikasi_nama ? (
          <div className="text-xs text-muted-foreground">oleh {r.diverifikasi_nama}</div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {foto.sebelum || foto.sesudah ? (
            <>
              {foto.sebelum ? (
                <Button variant="ghost" size="icon-sm" onClick={onLihatFoto} aria-label={`Lihat foto before ${r.id}`}>
                  <GambarMiniLaporan src={`/api/foto/agenda/${r.id}?foto=sebelum`} />
                </Button>
              ) : null}
              {foto.sesudah ? (
                <Button variant="ghost" size="icon-sm" onClick={onLihatFoto} aria-label={`Lihat foto after ${r.id}`}>
                  <GambarMiniLaporan src={`/api/foto/agenda/${r.id}?foto=sesudah`} />
                </Button>
              ) : null}
              <span className="text-xs text-muted-foreground">Klik foto untuk membandingkan</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Tanpa foto</span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button type="button" size="sm" onClick={onSetujui}>
            Setujui
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onTolak}>
            Tolak
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DaftarKartuLaporan({
  daftar,
  adaFoto,
  onLihatFoto,
  onSetujui,
  onTolak,
}: {
  daftar: BarisLaporanAgenda[];
  adaFoto: (id: number) => { sebelum: boolean; sesudah: boolean };
  onLihatFoto: (id: number) => void;
  onSetujui: (id: number) => void;
  onTolak: (baris: BarisLaporanAgenda) => void;
}) {
  if (daftar.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada laporan agenda pada filter ini.</p>;
  }
  return (
    <div className="flex flex-col gap-3" data-slot="daftar-kartu-laporan">
      {daftar.map((r) => (
        <KartuLaporanAgenda
          key={r.id}
          r={r}
          adaFoto={adaFoto}
          onLihatFoto={() => onLihatFoto(r.id)}
          onSetujui={() => onSetujui(r.id)}
          onTolak={() => onTolak(r)}
        />
      ))}
    </div>
  );
}

/**
 * Isi dialog banding foto before/after. Mengikuti pola `IsiLightbox`
 * halaman absensi: foto + detail + 4 tombol (Setujui, Tolak, Berikutnya,
 * Tutup). Foto lewat proxy server; URL Telegram tidak pernah ke klien.
 */
export function IsiLightboxBanding({
  r,
  adaFoto,
  onSetujui,
  onTolak,
  onBerikutnya,
  onTutup,
}: {
  r: BarisLaporanAgenda;
  adaFoto: { sebelum: boolean; sesudah: boolean };
  onSetujui: () => void;
  onTolak: () => void;
  onBerikutnya: () => void;
  onTutup: () => void;
}) {
  return (
    <>
      <h2 className="text-base font-medium">
        {r.karyawan_nama} · {tanggalPendek(r.tanggal)} · Percobaan {r.percobaan}
      </h2>
      {r.keterangan ? (
        <p className="text-sm text-muted-foreground">Keterangan: {r.keterangan}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <figure className="flex flex-col gap-1">
          <figcaption className="text-sm font-medium">Foto before</figcaption>
          {adaFoto.sebelum ? (
            <GambarBesarLaporan
              src={`/api/foto/agenda/${r.id}?foto=sebelum`}
              alt={`Foto before ${r.karyawan_nama}`}
            />
          ) : (
            <span className="text-sm text-muted-foreground">Tanpa foto</span>
          )}
        </figure>
        <figure className="flex flex-col gap-1">
          <figcaption className="text-sm font-medium">Foto after</figcaption>
          {adaFoto.sesudah ? (
            <GambarBesarLaporan
              src={`/api/foto/agenda/${r.id}?foto=sesudah`}
              alt={`Foto after ${r.karyawan_nama}`}
            />
          ) : (
            <span className="text-sm text-muted-foreground">Tanpa foto</span>
          )}
        </figure>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" onClick={onSetujui}>
          Setujui
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onTolak}>
          Tolak
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onBerikutnya}>
          Berikutnya
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onTutup}>
          Tutup
        </Button>
      </div>
    </>
  );
}

/**
 * Isi dialog bantuan pintasan keyboard halaman ini. Daftarnya beda dari
 * halaman absensi (tidak ada koreksi di agenda), jadi ditulis sendiri, bukan
 * dipakai ulang — daftar yang salah lebih buruk daripada duplikasi kecil.
 */
export function IsiBantuanPintasanAgenda({ onTutup }: { onTutup: () => void }) {
  const pintasan: [string, string][] = [
    ['J / K', 'Pindah ke laporan berikutnya / sebelumnya'],
    ['A', 'Setujui laporan yang sedang aktif'],
    ['T', 'Buka dialog tolak untuk laporan yang sedang aktif'],
    ['?', 'Buka bantuan ini'],
    ['Esc', 'Tutup dialog'],
  ];
  return (
    <>
      <h2 className="text-base font-medium">Pintasan keyboard</h2>
      <p className="text-sm text-muted-foreground">
        Pintasan hanya aktif di luar kolom isian dan di luar dialog. Fokus yang
        terlihat selalu mengikuti laporan yang aktif.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {pintasan.map(([tombol, arti]) => (
          <li key={tombol} className="flex items-center gap-3">
            <kbd className="min-w-16 rounded-md border bg-muted px-2 py-1 text-center font-mono text-xs">
              {tombol}
            </kbd>
            <span>{arti}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onTutup}>
          Tutup
        </Button>
      </div>
    </>
  );
}

export { KontrolHalaman };

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