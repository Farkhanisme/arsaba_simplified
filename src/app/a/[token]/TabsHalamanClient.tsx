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
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AbsenClient from './AbsenClient';
import AgendaClient from './AgendaClient';
import type { InfoAbsen } from '../../../server/absen-info';
import type { InfoAgenda } from '../../../server/agenda-info';

export default function TabsHalamanClient({
  infoAbsen,
  infoAgenda,
}: {
  infoAbsen: InfoAbsen;
  infoAgenda: InfoAgenda;
}) {
  const [tab, setTab] = useState<'absen' | 'agenda'>('absen');

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as 'absen' | 'agenda')}
      className="flex flex-col gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="absen" className="flex-1">
          Absen
        </TabsTrigger>
        <TabsTrigger value="agenda" className="flex-1">
          Agenda
        </TabsTrigger>
      </TabsList>
      <TabsContent value="absen">
        {/* key dipakai supaya pindah tab me-remount komponen: stream kamera dari
            tab yang ditinggalkan harus benar-benar dilepas, bukan hanya disembunyikan
            (sembunyi saja tetap memegang perangkat kamera). */}
        <AbsenClient key="absen" infoAwal={infoAbsen} />
      </TabsContent>
      <TabsContent value="agenda">
        <AgendaClient key="agenda" infoAwal={infoAgenda} />
      </TabsContent>
    </Tabs>
  );
}