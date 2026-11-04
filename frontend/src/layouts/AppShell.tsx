import { Suspense, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { LogOutIcon } from "@/components/icons";
import { PageSpinner } from "@/components/PageSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type Role } from "@/lib/hrdApi";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Record<Role, { to: string; label: string }[]> = {
  EMPLOYEE: [{ to: "/absensi", label: "Absensi" }],
  ADMIN_HRD: [
    { to: "/hrd/employees", label: "Master karyawan" },
    { to: "/hrd/monitoring", label: "Monitoring absensi" },
    { to: "/hrd/settings", label: "Pengaturan absensi" },
  ],
};

export function AppShell({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const items = user ? NAV_ITEMS[user.role] : [];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Lewati ke konten
      </a>

      <header className="border-b border-line bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex min-h-14 items-center justify-between gap-4 py-2">
            <span className="font-display text-lg font-semibold tracking-tight">Absensi WFH</span>

            {user && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end leading-tight sm:flex-row sm:items-center sm:gap-2">
                  <span className="max-w-[9rem] truncate text-sm font-medium sm:max-w-[16rem]">{user.fullName}</span>
                  <Badge variant="neutral">{ROLE_LABEL[user.role]}</Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={logout} className="min-h-11 sm:min-h-0">
                  <LogOutIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Keluar</span>
                  <span className="sr-only sm:hidden">Keluar</span>
                </Button>
              </div>
            )}
          </div>

          <nav aria-label="Navigasi utama" className="-mx-1 flex gap-1 overflow-x-auto pb-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm transition-colors",
                    isActive ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:text-ink",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Suspense fallback={<PageSpinner />}>{children ?? <Outlet />}</Suspense>
      </main>
    </div>
  );
}
