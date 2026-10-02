import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../server/db';
import { getSession } from '../../server/auth';
import type { Peran } from '../../server/izin';
import { menuUntukPeran } from './menu';
import TombolKeluar from './tombol-keluar';

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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <aside style={{ width: 240, background: '#111827', color: '#e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Arsaba</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {sesi.username} · {sesi.peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {menu.map((kelompok) => (
            <div key={kelompok.judul}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{kelompok.judul}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {kelompok.item.map((item) => (
                  <li key={item.label}>
                    {item.segera ? (
                      <span style={{ color: '#6b7280', fontSize: 14 }}>
                        {item.label} <em style={{ fontSize: 12 }}>(Segera)</em>
                      </span>
                    ) : item.label === 'Keluar' ? (
                      <TombolKeluar />
                    ) : (
                      <Link href={item.href ?? '#'} style={{ color: '#e5e7eb', fontSize: 14 }}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f5f5f5' }}>{children}</main>
    </div>
  );
}
