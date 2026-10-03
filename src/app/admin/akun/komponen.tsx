'use client';

/**
 * Bagian presentasional halaman Akun Admin (rules/05 §5.8).
 *
 * Murni tampilan, tanpa fetch dan tanpa next/navigation, supaya bisa dirender
 * dengan `renderToStaticMarkup`. Jaringan + state hidup di `page.tsx`.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Akun {
  id: number;
  username: string;
  nama: string;
  peran: 'ADMIN' | 'SUPER_ADMIN';
  aktif: number;
}

export interface FormulirAkun {
  username: string;
  password: string;
  nama: string;
  peran: string;
}

export function LabelPeran({ peran }: { peran: Akun['peran'] }) {
  if (peran === 'SUPER_ADMIN') return <Badge>Super Admin</Badge>;
  return <Badge variant="secondary">Admin</Badge>;
}

export function LabelStatusAkun({ aktif }: { aktif: number }) {
  if (aktif === 1) return <Badge>Aktif</Badge>;
  return <Badge variant="secondary">Nonaktif</Badge>;
}

export function PanelPasswordSekali({
  info,
  onSembunyikan,
}: {
  info: { username: string; password: string };
  onSembunyikan: () => void;
}) {
  return (
    <Alert className="border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>
          <strong>Password akun {info.username} (ditampilkan sekali):</strong>{' '}
          <code>{info.password}</code>
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onSembunyikan}>
          Sembunyikan
        </Button>
        <span className="w-full text-xs">Salin sekarang — password tidak akan ditampilkan lagi.</span>
      </AlertDescription>
    </Alert>
  );
}

export function FormulirTambahAkun({
  form,
  onUbah,
  onTambah,
}: {
  form: FormulirAkun;
  onUbah: (sebagian: Partial<FormulirAkun>) => void;
  onTambah: (e: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Tambah akun</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onTambah} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="akun-username">Username</Label>
            <Input
              id="akun-username"
              value={form.username}
              onChange={(e) => onUbah({ username: e.target.value })}
              required
              maxLength={50}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="akun-password">Password (min 8)</Label>
            <Input
              id="akun-password"
              type="password"
              value={form.password}
              onChange={(e) => onUbah({ password: e.target.value })}
              required
              minLength={8}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="akun-nama">Nama</Label>
            <Input
              id="akun-nama"
              value={form.nama}
              onChange={(e) => onUbah({ nama: e.target.value })}
              required
              maxLength={200}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="akun-peran">Peran</Label>
            <NativeSelect
              id="akun-peran"
              value={form.peran}
              onChange={(e) => onUbah({ peran: e.target.value })}
              className="w-36"
            >
              <NativeSelectOption value="ADMIN">Admin</NativeSelectOption>
              <NativeSelectOption value="SUPER_ADMIN">Super Admin</NativeSelectOption>
            </NativeSelect>
          </div>
          <Button type="submit">Tambah</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function TabelAkun({
  daftar,
  onAlihAktif,
  onMintaReset,
  onBukaKunci,
}: {
  daftar: Akun[];
  onAlihAktif: (a: Akun) => void;
  onMintaReset: (a: Akun) => void;
  onBukaKunci: (username: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.username}</TableCell>
                <TableCell>{a.nama}</TableCell>
                <TableCell>
                  <LabelPeran peran={a.peran} />
                </TableCell>
                <TableCell>
                  <LabelStatusAkun aktif={a.aktif} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="outline" onClick={() => onAlihAktif(a)}>
                      {a.aktif === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onMintaReset(a)}>
                      Reset Password
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onBukaKunci(a.username)}>
                      Buka Kunci
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function FormulirResetPassword({
  reset,
  onUbahPassword,
  onBatal,
  onKirim,
}: {
  reset: { id: number; username: string; password: string };
  onUbahPassword: (nilai: string) => void;
  onBatal: () => void;
  onKirim: (e: React.FormEvent) => void;
}) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          Reset password untuk {reset.username}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onKirim} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">Password baru (min 8)</Label>
            <Input
              id="reset-password"
              type="password"
              value={reset.password}
              onChange={(e) => onUbahPassword(e.target.value)}
              required
              minLength={8}
              className="w-56"
            />
          </div>
          <Button type="submit">Reset</Button>
          <Button type="button" variant="outline" onClick={onBatal}>
            Batal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
