import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
  { to: '/admin/karyawan', label: 'Karyawan', icon: Users },
  { to: '/admin/absensi', label: 'Absensi', icon: ClipboardList },
];

export function AppShell() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-dvh">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Lewati ke konten
      </a>

      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="font-display text-xl tracking-tight text-ink font-semibold">
              Absensi WFH
            </span>

            {user.role === 'ADMIN_HRD' && (
              <nav aria-label="Navigasi utama" className="flex items-center gap-1">
                {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors cursor-pointer active:scale-[0.98]',
                        isActive
                          ? 'bg-accent-soft text-accent-ink font-semibold'
                          : 'text-muted hover:bg-line/60 hover:text-ink active:bg-line/80',
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.fullName}</p>
              <p className="text-xs text-muted">{roleLabel(user.role)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut />
              <span className="hidden sm:inline">Keluar</span>
              <span className="sr-only sm:hidden">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="konten" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
