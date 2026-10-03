'use client';

/**
 * Bagian presentasional halaman Verifikasi Absensi (rules/05 §5.3).
 *
 * Dipisah dari `page.tsx` dengan sengaja: komponen ini murni tampilan dan tidak
 * menyentuh jaringan maupun state, jadi bisa dirender dengan
 * `renderToStaticMarkup` lalu diperiksa HTML-nya. Kalau markup masih inline,
 * `renderToStaticMarkup` tidak bisa membuktikannya.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export interface Keterlambatan {
  n: number;
  slot: { nama: string; jam_mulai: string; jam_selesai: string } | null;
  selisih: number | null;
  terlambatSistem: boolean;
}

export interface Baris {
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

export interface Pilihan {
  toko: { id: number; nama: string }[];
  karyawan: { id: number; nama: string }[];
}

/**
 * Kenapa filter memakai NativeSelect, bukan Select (base-ui).
 *
 * Select base-ui menaruh SelectItem di dalam Portal yang TIDAK ter-mount saat
 * popup tertutup (`SelectPortal`: `mounted || forceMount`). Akibatnya daftar item
 * tidak pernah terdaftar dan `SelectValue` jatuh ke `serializeValue(value)` —
 * trigger menampilkan KODE MENTAH, bukan label:
 *
 *     <span data-slot="select-value">DISETUJUI</span>   <- seharusnya "Disetujui"
 *
 * Terverifikasi langsung pada `@base-ui/react@1.8`: tidak hanya di server, tapi
 * juga di browser, sampai dropdown dibuka sekali. Ditambah item-nya tidak masuk
 * render statis, jadi tidak bisa diuji.
 *
 * NativeSelect adalah `<select>` asli: label dan penanda `selected` ikut
 * ter-render di server, bisa diuji, dan tetap bisa difokus dengan papan ketik.
 */
const SEMUA = 'SEMUA';

/**
 * Mengelompokkan absensi per karyawan + tanggal (rules/05 §5.3: "indikator
 * Pasangan: check-in dengan check-out terkait ditampilkan dikelompokkan
 * (karyawan + tanggal)").
 *
 * Dipisah ke sini, bukan di halaman, supaya bisa diuji tanpa merender komponen
 * klien yang butuh `next/navigation`.
 */
export function kelompokkan(daftar: Baris[]): [string, Baris[]][] {
  const peta = new Map<string, Baris[]>();
  for (const b of daftar) {
    const kunci = `${b.karyawan_id}|${b.tanggal}`;
    const isi = peta.get(kunci) ?? [];
    isi.push(b);
    peta.set(kunci, isi);
  }
  return [...peta.entries()];
}

export function tanggalPendek(isoTanggal: string): string {
  const [y, m, d] = isoTanggal.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Status absensi -> Badge. Terpisah supaya warna status punya satu sumber
 * kebenaran dan bisa diuji tanpa merender seluruh tabel.
 */
export function LabelStatus({ status }: { status: string }) {
  if (status === 'DISETUJUI') return <Badge>Disetujui</Badge>;
  if (status === 'DITOLAK') return <Badge variant="destructive">Ditolak</Badge>;
  return <Badge variant="secondary">Menunggu</Badge>;
}

export interface FilterVerifikasi {
  status: string;
  toko_id: string;
  dari: string;
  sampai: string;
  karyawan_id: string;
  jenis: string;
  belum_checkout: boolean;
}

export function PanelFilterVerifikasi({
  nilai,
  pilihan,
  onUbah,
}: {
  nilai: FilterVerifikasi;
  pilihan: Pilihan;
  onUbah: (kunci: keyof FilterVerifikasi, nilai: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Filter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-status" className="text-sm font-medium">
              Status
            </label>
            <NativeSelect
              id="f-status"
              value={nilai.status || 'MENUNGGU'}
              onChange={(e) => onUbah('status', e.target.value)}
              className="w-36"
            >
              <NativeSelectOption value="MENUNGGU">Menunggu</NativeSelectOption>
              <NativeSelectOption value="DISETUJUI">Disetujui</NativeSelectOption>
              <NativeSelectOption value="DITOLAK">Ditolak</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-toko" className="text-sm font-medium">
              Toko
            </label>
            <NativeSelect
              id="f-toko"
              value={nilai.toko_id || SEMUA}
              onChange={(e) => onUbah('toko_id', e.target.value === SEMUA ? '' : e.target.value)}
              className="w-44"
            >
              <NativeSelectOption value={SEMUA}>Semua</NativeSelectOption>
              {pilihan.toko.map((t) => (
                <NativeSelectOption key={t.id} value={String(t.id)}>
                  {t.nama}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-dari" className="text-sm font-medium">
              Dari
            </label>
            <Input id="f-dari" type="date" value={nilai.dari} onChange={(e) => onUbah('dari', e.target.value)} className="w-40" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-sampai" className="text-sm font-medium">
              Sampai
            </label>
            <Input id="f-sampai" type="date" value={nilai.sampai} onChange={(e) => onUbah('sampai', e.target.value)} className="w-40" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-karyawan" className="text-sm font-medium">
              Karyawan
            </label>
            <NativeSelect
              id="f-karyawan"
              value={nilai.karyawan_id || SEMUA}
              onChange={(e) => onUbah('karyawan_id', e.target.value === SEMUA ? '' : e.target.value)}
              className="w-48"
            >
              <NativeSelectOption value={SEMUA}>Semua</NativeSelectOption>
              {pilihan.karyawan.map((k) => (
                <NativeSelectOption key={k.id} value={String(k.id)}>
                  {k.nama}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-jenis" className="text-sm font-medium">
              Jenis
            </label>
            <NativeSelect
              id="f-jenis"
              value={nilai.jenis || SEMUA}
              onChange={(e) => onUbah('jenis', e.target.value === SEMUA ? '' : e.target.value)}
              className="w-36"
            >
              <NativeSelectOption value={SEMUA}>Semua</NativeSelectOption>
              <NativeSelectOption value="CHECKIN">Check-in</NativeSelectOption>
              <NativeSelectOption value="CHECKOUT">Check-out</NativeSelectOption>
            </NativeSelect>
          </div>

          {/* rules/05 §5.3 menyebut chip, bukan kotak centang polos. */}
          <label
            htmlFor="f-belum"
            data-slot="chip"
            data-checked={nilai.belum_checkout ? '' : undefined}
            className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium has-data-checked:border-primary has-data-checked:bg-primary/10"
          >
            <Checkbox
              id="f-belum"
              checked={nilai.belum_checkout}
              onCheckedChange={(c) => onUbah('belum_checkout', c ? '1' : '')}
            />
            Check-in belum check-out
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

export function PanelAksiMassal({
  jumlah,
  onSetujui,
  onTolak,
}: {
  jumlah: number;
  onSetujui: () => void;
  onTolak: () => void;
}) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge variant="default">{jumlah} dipilih</Badge>
        <Button size="sm" onClick={onSetujui}>
          Setujui terpilih
        </Button>
        <Button size="sm" variant="destructive" onClick={onTolak}>
          Tolak terpilih
        </Button>
      </CardContent>
    </Card>
  );
}

export function PanelGalat({ pesan, onCobaLagi }: { pesan: string; onCobaLagi: () => void }) {
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

/** rules/05 §5.3: "Loading: skeleton baris." */
export function PanelMemuat({ jumlahBaris = 5 }: { jumlahBaris?: number }) {
  return (
    <div aria-label="Memuat" className="flex flex-col gap-2">
      {Array.from({ length: jumlahBaris }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function KartuVerifikasi({
  b,
  terpilih,
  onPilih,
  onLihatFoto,
  nilaiFinal,
  onUbahFinal,
  onSetujui,
  onTolak,
  onKoreksi,
}: {
  b: Baris;
  terpilih: boolean;
  onPilih: (terpilih: boolean) => void;
  onLihatFoto: () => void;
  nilaiFinal: string;
  onUbahFinal: (nilai: string) => void;
  onSetujui: () => void;
  onTolak: () => void;
  onKoreksi: () => void;
}) {
  const jam = b.waktu.slice(11, 16);
  const terlambat = b.jenis === 'CHECKIN' && b.keterlambatan ? b.keterlambatan : null;
  return (
    <Card data-slot="kartu-verifikasi" aria-label={`Absensi ${b.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            aria-label={`Pilih absensi ${b.id}`}
            checked={terpilih}
            onCheckedChange={(c) => onPilih(Boolean(c))}
          />
          <CardTitle className="text-base">{b.karyawan_nama}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {b.jenis === 'CHECKIN' ? 'Check-in' : 'Check-out'}
            {b.jenis === 'CHECKOUT' && b.checkin_id !== null ? ` ↳ #${b.checkin_id}` : null}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <LabelStatus status={b.status} />
            {b.sumber === 'KOREKSI_ADMIN' ? <Badge variant="outline">✎ Dikoreksi</Badge> : null}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {b.toko_nama} · {tanggalPendek(b.tanggal)} · {jam} WIB
        </div>
        {b.status === 'DITOLAK' && b.alasan_tolak ? (
          <div className="text-xs text-muted-foreground">Ditolak: {b.alasan_tolak}</div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {b.foto_file_id ? (
            <Button variant="ghost" size="icon-sm" onClick={onLihatFoto} aria-label={`Lihat foto ${b.id}`}>
              <img src={`/api/foto/${b.id}`} alt="" width={40} height={40} className="size-10 rounded-md object-cover" />
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <div className="text-xs">
            {b.lat !== null && b.lng !== null ? (
              <a
                href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {b.lat.toFixed(5)}, {b.lng.toFixed(5)} — Buka peta
              </a>
            ) : (
              <span className="text-muted-foreground">Lokasi tidak tersedia</span>
            )}
          </div>
          <div className="whitespace-nowrap text-sm">
            {terlambat ? (
              <span className="flex items-center gap-1.5">
                <span>
                  {terlambat.selisih === null
                    ? '—'
                    : terlambat.selisih > 0
                      ? `+${terlambat.selisih} mnt`
                      : `${terlambat.selisih} mnt`}
                </span>
                {terlambat.terlambatSistem ? <Badge variant="outline">Terlambat</Badge> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {b.jenis === 'CHECKIN' ? (
            <label className="flex flex-col gap-1 text-xs font-medium">
              Menit terlambat (final)
              <Input
                type="number"
                min={0}
                max={1440}
                step={1}
                aria-label={`Menit terlambat final ${b.id}`}
                value={nilaiFinal}
                onChange={(e) => onUbahFinal(e.target.value)}
                className="w-24"
              />
            </label>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" onClick={onSetujui}>
              Setujui
            </Button>
            <Button size="sm" variant="destructive" onClick={onTolak}>
              Tolak
            </Button>
            <Button size="sm" variant="outline" onClick={onKoreksi}>
              Koreksi
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DaftarKartuVerifikasi({
  kelompok,
  terpilih,
  onPilih,
  onLihatFoto,
  finalInput,
  onUbahFinal,
  onSetujui,
  onTolak,
  onKoreksi,
}: {
  kelompok: [string, Baris[]][];
  terpilih: number[];
  onPilih: (id: number, terpilih: boolean) => void;
  onLihatFoto: (id: number) => void;
  finalInput: Record<number, string>;
  onUbahFinal: (id: number, nilai: string) => void;
  onSetujui: (id: number) => void;
  onTolak: (id: number) => void;
  onKoreksi: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4" data-slot="daftar-kartu-verifikasi">
      {kelompok.map(([kunci, barisKelompok]) => {
        const kepala = barisKelompok[0]!;
        return (
          <section key={`g-${kunci}`} aria-label={`Kelompok ${kepala.karyawan_nama} ${tanggalPendek(kepala.tanggal)}`}>
            {/* rules/05 §5.3: check-in dan check-out terkait dikelompokkan. */}
            <h2 className="mb-2 text-sm font-medium">
              {kepala.karyawan_nama} · {tanggalPendek(kepala.tanggal)} · {kepala.toko_nama}
            </h2>
            <div className="flex flex-col gap-3">
              {barisKelompok.map((b) => (
                <KartuVerifikasi
                  key={b.id}
                  b={b}
                  terpilih={terpilih.includes(b.id)}
                  onPilih={(c) => onPilih(b.id, c)}
                  onLihatFoto={() => onLihatFoto(b.id)}
                  nilaiFinal={
                    finalInput[b.id] ??
                    (b.keterlambatan_final_menit !== null ? String(b.keterlambatan_final_menit) : '')
                  }
                  onUbahFinal={(n) => onUbahFinal(b.id, n)}
                  onSetujui={() => onSetujui(b.id)}
                  onTolak={() => onTolak(b.id)}
                  onKoreksi={() => onKoreksi(b.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Isi dialog penolakan. Dipisah dari Dialog agar bisa diuji tanpa portal. */
export function IsiDialogTolak({
  jumlah,
  alasan,
  onUbahAlasan,
  onBatal,
  onKirim,
}: {
  jumlah: number;
  alasan: string;
  onUbahAlasan: (nilai: string) => void;
  onBatal: () => void;
  onKirim: () => void;
}) {
  return (
    <>
      <h2 className="text-base font-medium">Tolak {jumlah} absensi</h2>
      <p className="text-sm text-muted-foreground">
        Alasan wajib diisi dan berlaku untuk semua absensi yang dipilih.
      </p>
      <label htmlFor="alasan-tolak" className="text-sm font-medium">
        Alasan
      </label>
      <Textarea
        id="alasan-tolak"
        rows={3}
        value={alasan}
        onChange={(e) => onUbahAlasan(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBatal}>
          Batal
        </Button>
        <Button type="button" variant="destructive" disabled={alasan.trim() === ''} onClick={onKirim}>
          Tolak
        </Button>
      </div>
    </>
  );
}

const OPERASI_KOREKSI = [
  { nilai: 'ubah_waktu', label: 'Ubah waktu' },
  { nilai: 'tambah_checkout', label: 'Tambah check-out' },
  { nilai: 'tambah_checkin', label: 'Tambah check-in' },
] as const;

export function IsiDialogKoreksi({
  id,
  operasi,
  waktu,
  alasan,
  onUbah,
  onBatal,
  onKirim,
}: {
  id: number;
  operasi: string;
  waktu: string;
  alasan: string;
  onUbah: (sebagian: Partial<{ operasi: string; waktu: string; alasan: string }>) => void;
  onBatal: () => void;
  onKirim: () => void;
}) {
  return (
    <>
      <h2 className="text-base font-medium">Koreksi absensi #{id}</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="k-operasi" className="text-sm font-medium">
          Operasi
        </label>
        <NativeSelect
          id="k-operasi"
          value={operasi}
          onChange={(e) => onUbah({ operasi: e.target.value || 'ubah_waktu' })}
        >
          {OPERASI_KOREKSI.map((o) => (
            <NativeSelectOption key={o.nilai} value={o.nilai}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="k-waktu" className="text-sm font-medium">
          Waktu (tanggal + jam, WIB)
        </label>
        <Input
          id="k-waktu"
          type="datetime-local"
          value={waktu}
          onChange={(e) => onUbah({ waktu: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="k-alasan" className="text-sm font-medium">
          Alasan
        </label>
        <Textarea id="k-alasan" rows={2} value={alasan} onChange={(e) => onUbah({ alasan: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBatal}>
          Batal
        </Button>
        <Button type="button" disabled={alasan.trim() === '' || waktu === ''} onClick={onKirim}>
          Simpan
        </Button>
      </div>
    </>
  );
}

/** Isi lightbox foto (rules/05 §5.3: foto besar + detail + 4 tombol). */
export function IsiLightbox({
  baris,
  onSetujui,
  onTolak,
  onBerikutnya,
  onTutup,
}: {
  baris: Baris;
  onSetujui: () => void;
  onTolak: () => void;
  onBerikutnya: () => void;
  onTutup: () => void;
}) {
  return (
    <>
      <h2 className="text-base font-medium">
        Foto {baris.karyawan_nama} · {tanggalPendek(baris.tanggal)} {baris.waktu.slice(11, 16)} WIB
      </h2>
      <img
        src={`/api/foto/${baris.id}`}
        alt={`Foto ${baris.karyawan_nama}`}
        className="max-h-[60vh] w-auto rounded-lg"
      />
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