import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../server/db';
import { getSession } from '../../server/auth';
import type { Peran } from '../../server/izin';
import { menuUntukPeran } from './menu';
import TombolKeluar from './tombol-keluar';
import TautanMenu from './tautan-menu';
import PengalihTema from '../pengalih-tema';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

/**
 * Layout admin memaksa sesi DI SERVER (bukan hanya cek di UI): tanpa sesi
 * valid, server mengarahkan ke /login sebelum konten apa pun dirender.
 */
async function sesiAdmin(): Promise<{ pengguna_id: number; username: string; peran: Peran } | null> {
  const cookie = (await cookies()).get('sesi')?.value;
  if (!cookie) return null;
  const sesi = await getSession(cookie);
  if (!sesi) return null;
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, peran, aktif FROM pengguna_admin WHERE id = ?',
    args: [sesi.pengguna_id],
  });
  const baris = res.rows[0] as Record<string, unknown> | undefined;
  if (!baris || Number(baris['aktif']) !== 1) return null;
  return {
    pengguna_id: Number(baris['id']),
    username: String(baris['username']),
    peran: String(baris['peran']) as Peran,
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesi = await sesiAdmin();
  if (!sesi) redirect('/login');

  const menu = menuUntukPeran(sesi.peran);

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div className="text-base font-bold">Arsaba</div>
          <div className="text-xs text-muted-foreground">
            {sesi.username} · {sesi.peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
          </div>
        </SidebarHeader>
        <SidebarContent>
          {menu.map((kelompok) => (
            <SidebarGroup key={kelompok.judul}>
              <SidebarGroupLabel>{kelompok.judul}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {kelompok.item.map((item) =>
                    item.label === 'Keluar' ? (
                      <SidebarMenuItem key={item.label}>
                        <TombolKeluar />
                      </SidebarMenuItem>
                    ) : (
                      <TautanMenu key={item.label} href={item.href ?? '#'} label={item.label} />
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <PengalihTema />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 p-3">
          <SidebarTrigger aria-label="Buka menu" />
        </header>
        <main className="px-6 pb-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
