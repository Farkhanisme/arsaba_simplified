'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileSpreadsheetIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LockIcon,
  ScrollTextIcon,
  SettingsIcon,
  StoreIcon,
  UserXIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

/**
 * Ikon per label menu. Dipetakan di sini (komponen klien), BUKAN di `menu.ts`:
 * `menu.ts` adalah data murni yang diuji lewat JSON, dan referensi komponen
 * tidak bisa diserialisasi. Label yang tidak ada di peta tetap tampil tanpa
 * ikon — menu tidak boleh hilang hanya karena ikonnya lupa didaftarkan.
 */
const IKON_MENU: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboardIcon,
  'Verifikasi Absensi': ClipboardCheckIcon,
  Jadwal: CalendarIcon,
  'Tandai Tidak Berangkat': UserXIcon,
  'Rekap & Ekspor': FileSpreadsheetIcon,
  Toko: StoreIcon,
  Shift: ClockIcon,
  Karyawan: UsersIcon,
  'Akun Admin': KeyRoundIcon,
  Pengaturan: SettingsIcon,
  'Audit Log': ScrollTextIcon,
  'Ubah Password': LockIcon,
};

/** Tautan menu dengan penanda aktif yang jelas (path persis). */
export default function TautanMenu({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const Ikon = IKON_MENU[label];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname === href}
        render={
          <Link href={href}>
            {Ikon ? <Ikon /> : null}
            {label}
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}
