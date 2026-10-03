'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

/** Tautan menu dengan penanda aktif yang jelas (path persis). */
export default function TautanMenu({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={pathname === href} render={<Link href={href}>{label}</Link>} />
    </SidebarMenuItem>
  );
}
