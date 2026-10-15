'use client';

/**
 * Tab "Absen | Agenda" di halaman karyawan (M12).
 *
 * Kenapa tab dan bukan halaman terpisah: link karyawan `/a/{token}` adalah satu-satunya
 * permukaan yang ia punya (K-01). Halaman kedua berarti link kedua untuk dibagikan,
 * dan link bisa bocor (risiko D-1 di `rules/00`) — jadi lebih sedikit permukaan
 * lebih baik.
 *
 * Dashboard pun tidak dibuka sampai tab itu dipilih. Alasannya disengaja: dua
 * permintaan `getUserMedia` yang hidup bersamaan membuat kamera depan gagal
 * dibuka di perangkat Android tertentu, dan itu akan mematikan absen — bukan cuma
 * agenda. Meminta izin hanya saat tab yang dipakai dibuka.
 *
 * K-67 memindahkan tab ini ke BAWAH lewat komponen `NavigasiBawah`. Jumlah item
 * tetap dua dan tidak boleh bertambah tanpa keputusan pemilik baru. Status tab
 * tetap state lokal — tidak pernah ditulis ke URL.
 */
import { useState } from 'react';
import { CameraIcon, ClipboardListIcon } from 'lucide-react';
import { NavigasiBawah, type ItemNavigasiBawah } from '@/components/ui/navigasi-bawah';
import AbsenClient from './AbsenClient';
import AgendaClient from './AgendaClient';
import type { InfoAbsen } from '../../../server/absen-info';
import type { InfoAgenda } from '../../../server/agenda-info';

type Tab = 'absen' | 'agenda';

/**
 * Dua item, dan hanya dua (K-67). Bentuk ikon dipilih supaya berbeda jauh, bukan
 * cuma berbeda nama: "Absen" berupa kotak dengan **lensa bulat besar** di tengah
 * (persis ikon yang sudah dipakai tombol "Foto" di halaman ini), "Agenda" berupa
 * papan memanjang dengan **deretan garis horizontal** dan klip di atas. Isi dan
 * siluetnya berbeda jauh, jadi tetap terbaca tanpa mengandalkan warna.
 */
const ITEM_NAVIGASI: ItemNavigasiBawah[] = [
  { nilai: 'absen', label: 'Absen', Ikon: CameraIcon },
  { nilai: 'agenda', label: 'Agenda', Ikon: ClipboardListIcon },
];

export default function TabsHalamanClient({
  infoAbsen,
  infoAgenda,
}: {
  infoAbsen: InfoAbsen;
  infoAgenda: InfoAgenda;
}) {
  const [tab, setTab] = useState<Tab>('absen');

  return (
    <>
      <IsiTab tab={tab} infoAbsen={infoAbsen} infoAgenda={infoAgenda} />
      <NavigasiBawah
        label="Navigasi halaman"
        nilai={tab}
        item={ITEM_NAVIGASI}
        onPilih={(v: string) => setTab(v as Tab)}
      />
    </>
  );
}

/**
 * Isi tab yang sedang aktif — dan **hanya** itu.
 *
 * Tab yang tidak aktif tidak dirender sama sekali, bukan disembunyikan dengan
 * CSS. Itu sebabnya `key` di bawah tidak boleh dihapus: dengan `key` berisi nilai
 * tab, React membuat **instance baru** setiap kali tab berganti. Kalau instance
 * lamanya dipakai ulang, state kamera ikut terbawa dan `getUserMedia` dari tab
 * yang sudah ditinggalkan tidak pernah dilepas — persis kegagalan yang membuat
 * kamera depan gagal dibuka di Android tertentu.
 *
 * `IsiTab` diekspor supaya kedua keadaan bisa diuji tanpa browser: dengan tab
 * "agenda", markup harus benar-benar **tidak** memuat kamera.
 */
export function IsiTab({
  tab,
  infoAbsen,
  infoAgenda,
}: {
  tab: Tab;
  infoAbsen: InfoAbsen;
  infoAgenda: InfoAgenda;
}) {
  return [tab].map((nilai) =>
    nilai === 'absen' ? (
      <AbsenClient key={nilai} infoAwal={infoAbsen} />
    ) : (
      <AgendaClient key={nilai} infoAwal={infoAgenda} />
    ),
  );
}