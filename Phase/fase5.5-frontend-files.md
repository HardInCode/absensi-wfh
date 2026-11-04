# Fase 5.5: Kumpulan File Frontend Lengkap

Dokumen ini mengumpulkan seluruh file kode frontend yang relevan untuk kebutuhan penambahan fitur Fase 5.5 (Summary Harian, Filter Status, Export CSV, dan Tab Pengaturan Absensi).

## Daftar Isi

1. `frontend/package.json` — Konfigurasi dependensi dan skrip frontend
2. `frontend/tailwind.config.ts` — Design token Tailwind (warna semantic, font, radius)
3. `frontend/src/index.css` — Definisi variabel CSS root (warna token, font Fraunces & DM Sans)
4. `frontend/src/App.tsx` — Router utama aplikasi (React Router DOM)
5. `frontend/src/lib/routes.ts` — Daftar konstanta path rute aplikasi
6. `frontend/src/layouts/AppShell.tsx` — Layout bersama, header, dan navigasi peran (HRD / Karyawan)
7. `frontend/src/auth/ProtectedRoute.tsx` — Komponen pelindung rute berdasarkan status login dan role
8. `frontend/src/auth/AuthContext.tsx` — Context & Provider autentikasi (token, user, login, logout)
9. `frontend/src/lib/api.ts` — Instance Axios utama dan fungsi pemanggil API absensi karyawan
10. `frontend/src/lib/hrdApi.ts` — Fungsi pemanggil API HRD (master karyawan & monitoring absensi)
11. `frontend/src/lib/types.ts` — Definisi tipe TypeScript data entitas dan response API
12. `frontend/src/lib/errors.ts` — Helper ekstraksi pesan error dari response Axios
13. `frontend/src/lib/format.ts` — Helper pemformatan tanggal dan waktu karyawan
14. `frontend/src/lib/hrdFormat.ts` — Helper pemformatan tanggal, waktu, dan role HRD
15. `frontend/src/lib/utils.ts` — Utility cn (clsx + tailwind-merge)
16. `frontend/src/pages/LoginPage.tsx` — Halaman login dengan tombol demo HRD / Karyawan
17. `frontend/src/pages/employee/AttendancePage.tsx` — Halaman absensi karyawan (live clock, kamera, upload, riwayat)
18. `frontend/src/pages/hrd/MonitoringPage.tsx` — Halaman monitoring absensi seluruh karyawan oleh HRD
19. `frontend/src/pages/hrd/EmployeesPage.tsx` — Halaman master data karyawan (CRUD karyawan)
20. `frontend/src/pages/NotFoundPage.tsx` — Halaman 404 Not Found
21. `frontend/src/components/DataTable.tsx` — Komponen reusable tabel data dengan sorting dan loading
22. `frontend/src/components/LiveClock.tsx` — Komponen reusable jam realtime tersinkronisasi waktu server
23. `frontend/src/components/PhotoDropzone.tsx` — Komponen upload foto bukti WFH dengan preview dan watermark
24. `frontend/src/components/PhotoLightbox.tsx` — Modal preview pembesaran foto absensi berotentikasi
25. `frontend/src/components/AuthedImage.tsx` — Komponen gambar yang memuat foto privat via token Bearer
26. `frontend/src/components/EmployeeFormModal.tsx` — Modal form tambah dan edit karyawan
27. `frontend/src/components/ConfirmDeactivateDialog.tsx` — Dialog konfirmasi penonaktifan karyawan
28. `frontend/src/components/StatusBanner.tsx` — Banner status feedback / pesan notifikasi
29. `frontend/src/components/Stamp.tsx` — Komponen visual watermark/stempel waktu dan lokasi pada foto
30. `frontend/src/components/EmptyState.tsx` — Komponen tampilan kosong ketika data tabel tidak ditemukan
31. `frontend/src/components/ErrorState.tsx` — Komponen tampilan error saat gagal memuat data
32. `frontend/src/components/PageHeader.tsx` — Komponen judul dan subjudul header halaman
33. `frontend/src/components/Pagination.tsx` — Komponen navigasi paginasi tabel
34. `frontend/src/components/ui/badge.tsx` — Komponen UI badge / tag status
35. `frontend/src/components/ui/button.tsx` — Komponen UI button dengan varian desain token
36. `frontend/src/components/ui/card.tsx` — Komponen UI container card
37. `frontend/src/components/ui/dialog.tsx` — Komponen UI dialog modal berbasis Radix
38. `frontend/src/components/ui/input.tsx` — Komponen UI input teks
39. `frontend/src/components/ui/label.tsx` — Komponen UI label form
40. `frontend/src/components/ui/select.tsx` — Komponen UI dropdown select
41. `frontend/src/components/ui/skeleton.tsx` — Komponen UI skeleton placeholder saat loading
42. `frontend/src/components/ui/textarea.tsx` — Komponen UI textarea untuk catatan absensi
43. `frontend/src/hooks/usePagedQuery.ts` — Hook pemanggilan data berpaginasi dengan debounce filter
44. `frontend/src/hooks/useServerClock.ts` — Hook sinkronisasi jam perangkat dengan jam server (/api/time)
45. `frontend/src/hooks/useProtectedImage.ts` — Hook untuk mengambil object URL gambar berotentikasi

---

### 1. `frontend/package.json`

*Peran: Konfigurasi dependensi dan skrip frontend*

```json
{
  "name": "absensi-wfh-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource-variable/dm-sans": "^5.1.0",
    "@fontsource-variable/fraunces": "^5.1.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "axios": "^1.7.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "~5.6.3",
    "vite": "^5.4.11"
  }
}
```

---

### 2. `frontend/tailwind.config.ts`

*Peran: Design token Tailwind (warna semantic, font, radius)*

```tsx
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        edge: 'rgb(var(--color-edge) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        'accent-ink': 'rgb(var(--color-accent-ink) / <alpha-value>)',
        present: 'rgb(var(--color-present) / <alpha-value>)',
        'present-soft': 'rgb(var(--color-present-soft) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"DM Sans Variable"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

### 3. `frontend/src/index.css`

*Peran: Definisi variabel CSS root (warna token, font Fraunces & DM Sans)*

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
  Design token "Warm Editorial Workspace".
  Nilai berupa kanal RGB agar bisa dipakai dengan modifier opasitas Tailwind.
*/
@layer base {
  :root {
    --color-canvas: 247 245 240; /* #F7F5F0 latar */
    --color-card: 255 255 255; /* #FFFFFF kartu */
    --color-ink: 31 29 26; /* #1F1D1A teks */
    --color-muted: 107 102 94; /* #6B665E teks sekunder */
    --color-line: 228 223 213; /* #E4DFD5 garis dekoratif */
    --color-edge: 143 137 126; /* #8F897E batas kontrol input (kontras 3:1) */
    --color-accent: 30 77 140; /* #1E4D8C biru tinta */
    --color-accent-soft: 228 235 245; /* #E4EBF5 */
    --color-accent-ink: 23 57 107; /* #17396B teks aksen di atas latar lembut */
    --color-present: 47 111 94; /* #2F6F5E hijau sage */
    --color-present-soft: 227 239 234; /* #E3EFEA */
    --color-danger: 161 43 43; /* #A12B2B */
    --color-danger-soft: 248 228 225; /* #F8E4E1 */

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
  }

  html {
    color-scheme: light;
  }

  html,
  body {
    overflow-x: clip;
  }

  body {
    @apply bg-canvas font-sans text-ink antialiased;
  }

  button:not(:disabled),
  [role='button']:not([aria-disabled='true']),
  select:not(:disabled),
  label[for],
  summary {
    cursor: pointer;
  }

  @media (pointer: coarse) {
    button,
    [role='button'],
    select,
    input:not([type='checkbox']):not([type='file']) {
      min-height: 44px;
    }
    button {
      min-width: 44px;
    }
  }

  :focus-visible {
    outline: 2px solid rgb(var(--color-accent));
    outline-offset: 2px;
  }

  ::selection {
    background: rgb(var(--color-accent-soft));
    color: rgb(var(--color-ink));
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 4. `frontend/src/App.tsx`

*Peran: Router utama aplikasi (React Router DOM)*

```tsx
import { Suspense, lazy, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { homePathFor, ProtectedRoute } from "@/auth/ProtectedRoute";
import { useAuth } from "@/auth/AuthContext";
import { PageSpinner } from "@/components/PageSpinner";
import { AppShell } from "@/layouts/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";

/** Mendukung named export maupun default export agar aman terhadap gaya ekspor Fase 3. */
function lazyPage(loader: () => Promise<Record<string, unknown>>, exportName: string) {
  return lazy(async () => {
    const mod = await loader();
    const component = (mod[exportName] ?? mod.default) as ComponentType | undefined;
    if (!component) throw new Error(`Halaman ${exportName} tidak ditemukan.`);
    return { default: component };
  });
}

const LoginPage = lazyPage(() => import("@/pages/LoginPage"), "LoginPage");
const AttendancePage = lazyPage(() => import("@/pages/employee/AttendancePage"), "AttendancePage");
const EmployeesPage = lazyPage(() => import("@/pages/hrd/EmployeesPage"), "EmployeesPage");
const MonitoringPage = lazyPage(() => import("@/pages/hrd/MonitoringPage"), "MonitoringPage");

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<RootRedirect />} />

            <Route element={<ProtectedRoute roles={["EMPLOYEE"]} />}>
              <Route path="absensi" element={<AttendancePage />} />
            </Route>

            <Route element={<ProtectedRoute roles={["ADMIN_HRD"]} />}>
              <Route path="hrd" element={<Navigate to="/hrd/employees" replace />} />
              <Route path="hrd/employees" element={<EmployeesPage />} />
              <Route path="hrd/monitoring" element={<MonitoringPage />} />
            </Route>
          </Route>
        </Route>

        {/* Rute lama Fase 3 */}
        <Route path="/admin/karyawan" element={<Navigate to="/hrd/employees" replace />} />
        <Route path="/admin/absensi" element={<Navigate to="/hrd/monitoring" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
```

---

### 5. `frontend/src/lib/routes.ts`

*Peran: Daftar konstanta path rute aplikasi*

```tsx
import type { Role } from './types';

export function homeFor(role: Role): string {
  return role === 'ADMIN_HRD' ? '/admin/karyawan' : '/absensi';
}
```

---

### 6. `frontend/src/layouts/AppShell.tsx`

*Peran: Layout bersama, header, dan navigasi peran (HRD / Karyawan)*

```tsx
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
```

---

### 7. `frontend/src/auth/ProtectedRoute.tsx`

*Peran: Komponen pelindung rute berdasarkan status login dan role*

```tsx
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { PageSpinner } from "@/components/PageSpinner";
import type { Role } from "@/lib/hrdApi";

export function homePathFor(role: Role): string {
  return role === "ADMIN_HRD" ? "/hrd/employees" : "/absensi";
}

interface ProtectedRouteProps {
  roles?: Role[];
  children?: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
```

---

### 8. `frontend/src/auth/AuthContext.tsx`

*Peran: Context & Provider autentikasi (token, user, login, logout)*

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY } from "@/lib/api";
import { normalizeEmployee, pickStr, type Employee } from "@/lib/hrdApi";

export type AuthUser = Employee;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseMe(data: unknown): AuthUser {
  const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return normalizeEmployee(root.user ?? root);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    api
      .get("/auth/me", { signal: controller.signal })
      .then((res) => setUser(parseMe(res.data)))
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const token = pickStr(res.data, "accessToken", "access_token", "token");
    if (!token) throw new Error("Respons login tidak berisi token.");
    localStorage.setItem(TOKEN_KEY, token);
    try {
      const me = await api.get("/auth/me");
      const nextUser = parseMe(me.data);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  return ctx;
}
```

---

### 9. `frontend/src/lib/api.ts`

*Peran: Instance Axios utama dan fungsi pemanggil API absensi karyawan*

```tsx
import axios, { type AxiosError } from "axios";

export const TOKEN_KEY = "absensi.token";
export const AUTH_EXPIRED_EVENT = "auth:expired";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default api;
```

---

### 10. `frontend/src/lib/hrdApi.ts`

*Peran: Fungsi pemanggil API HRD (master karyawan & monitoring absensi)*

```tsx
import axios from "axios";
import { api } from "@/lib/api";

export type Role = "EMPLOYEE" | "ADMIN_HRD";

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Karyawan",
  ADMIN_HRD: "Admin HRD",
};

export interface Employee {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  checkInAt: string;
  attendanceDate: string;
  notes: string | null;
  employee: { nik: string; fullName: string; position: string };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pickStr(obj: unknown, ...keys: string[]): string {
  if (!isRecord(obj)) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function pickNum(obj: unknown, ...keys: string[]): number | undefined {
  if (!isRecord(obj)) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function pickBool(obj: unknown, fallback: boolean, ...keys: string[]): boolean {
  if (!isRecord(obj)) return fallback;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
  }
  return fallback;
}

export function normalizeEmployee(raw: unknown): Employee {
  return {
    id: pickStr(raw, "id"),
    nik: pickStr(raw, "nik"),
    fullName: pickStr(raw, "fullName", "full_name"),
    email: pickStr(raw, "email"),
    position: pickStr(raw, "position"),
    role: pickStr(raw, "role") === "ADMIN_HRD" ? "ADMIN_HRD" : "EMPLOYEE",
    isActive: pickBool(raw, true, "isActive", "is_active"),
  };
}

export function normalizeAttendance(raw: unknown): AttendanceRecord {
  const nested = isRecord(raw) && isRecord(raw.employee) ? raw.employee : raw;
  const notes = pickStr(raw, "notes");
  return {
    id: pickStr(raw, "id"),
    checkInAt: pickStr(raw, "checkInAt", "check_in_at"),
    attendanceDate: pickStr(raw, "attendanceDate", "attendance_date"),
    notes: notes === "" ? null : notes,
    employee: {
      nik: pickStr(nested, "nik"),
      fullName: pickStr(nested, "fullName", "full_name", "employeeName", "employee_name"),
      position: pickStr(nested, "position"),
    },
  };
}

function normalizePaged<T>(raw: unknown, mapItem: (item: unknown) => T, fallbackLimit: number): Paged<T> {
  const root: Raw = isRecord(raw) ? raw : {};
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.items)
        ? root.items
        : [];
  const meta = isRecord(root.meta) ? root.meta : root;
  const total = pickNum(meta, "total", "totalItems", "total_items") ?? list.length;
  const limit = pickNum(meta, "limit", "perPage", "per_page", "pageSize") ?? fallbackLimit;
  const page = pickNum(meta, "page", "currentPage", "current_page") ?? 1;
  const totalPages =
    pickNum(meta, "totalPages", "total_pages", "lastPage", "last_page") ??
    Math.max(1, Math.ceil(total / limit));
  return { items: list.map(mapItem), meta: { page, limit, total, totalPages } };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return error.code === "ECONNABORTED"
        ? "Server terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
    }
    const data: unknown = error.response.data;
    const message = isRecord(data) ? data.message : undefined;
    if (Array.isArray(message)) {
      const parts = message.filter((m): m is string => typeof m === "string");
      if (parts.length > 0) return parts.join(". ");
    }
    if (typeof message === "string" && message !== "") return message;
    if (error.response.status === 403) return "Anda tidak memiliki akses ke data ini.";
    if (error.response.status >= 500) return "Terjadi kesalahan di server. Coba lagi nanti.";
  }
  return fallback;
}

export interface EmployeeQuery {
  page: number;
  limit: number;
  search: string;
}

export async function fetchEmployees(query: EmployeeQuery, signal?: AbortSignal): Promise<Paged<Employee>> {
  const res = await api.get("/employees", {
    params: {
      page: query.page,
      limit: query.limit,
      ...(query.search ? { search: query.search } : {}),
    },
    signal,
  });
  return normalizePaged(res.data, normalizeEmployee, query.limit);
}

export interface EmployeeInput {
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  password?: string;
  isActive?: boolean;
}

export async function createEmployee(input: EmployeeInput): Promise<void> {
  await api.post("/employees", input);
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>): Promise<void> {
  await api.patch(`/employees/${id}`, input);
}

export async function deactivateEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}

export interface AttendanceQuery {
  page: number;
  limit: number;
  dateFrom: string;
  dateTo: string;
  employeeName: string;
}

export async function fetchAttendances(
  query: AttendanceQuery,
  signal?: AbortSignal,
): Promise<Paged<AttendanceRecord>> {
  const res = await api.get("/attendances", {
    params: {
      page: query.page,
      limit: query.limit,
      ...(query.dateFrom ? { date_from: query.dateFrom } : {}),
      ...(query.dateTo ? { date_to: query.dateTo } : {}),
      ...(query.employeeName ? { employee_name: query.employeeName } : {}),
    },
    signal,
  });
  return normalizePaged(res.data, normalizeAttendance, query.limit);
}

export async function fetchAttendancePhoto(id: string, signal?: AbortSignal): Promise<Blob> {
  const res = await api.get<Blob>(`/attendances/${id}/photo`, { responseType: "blob", signal });
  return res.data;
}
```

---

### 11. `frontend/src/lib/types.ts`

*Peran: Definisi tipe TypeScript data entitas dan response API*

```tsx
export type Role = 'EMPLOYEE' | 'ADMIN_HRD';

export interface Employee {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  /** ISO 8601 UTC (akhiran Z). Tampilkan dengan timeZone Asia/Jakarta. */
  checkInAt: string;
  /** YYYY-MM-DD menurut WIB. Tampilkan apa adanya, jangan lewat new Date(). */
  attendanceDate: string;
  notes: string | null;
  createdAt: string;
  photoUrl: string;
}

export interface AttendanceWithEmployee extends Attendance {
  employee: Pick<Employee, 'id' | 'nik' | 'fullName' | 'email' | 'position'>;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: Meta;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: Employee;
}
```

---

### 12. `frontend/src/lib/errors.ts`

*Peran: Helper ekstraksi pesan error dari response Axios*

```tsx
import axios from 'axios';

export function getStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export function getErrorMessage(
  err: unknown,
  fallback = 'Terjadi kesalahan. Silakan coba lagi.',
): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === 'ECONNABORTED'
        ? 'Permintaan terlalu lama. Periksa koneksi lalu coba lagi.'
        : 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.';
    }
    const { status, data } = err.response;
    if (status === 413) return 'Ukuran foto melebihi batas 3 MB.';

    const message = (data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
    if (typeof message === 'string' && message) return message;

    if (status === 403) return 'Kamu tidak memiliki akses untuk tindakan ini.';
    if (status >= 500) return 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
  }
  return fallback;
}
```

---

### 13. `frontend/src/lib/format.ts`

*Peran: Helper pemformatan tanggal dan waktu karyawan*

```tsx
import type { Role } from './types';

const TZ = 'Asia/Jakarta';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
});

const dateLongFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateShortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** HH:mm:ss dalam WIB */
export function formatTime(value: Date | string): string {
  return timeFmt.format(toDate(value));
}

/** HH:mm dalam WIB */
export function formatTimeShort(value: Date | string): string {
  return formatTime(value).slice(0, 5);
}

/** "Selasa, 3 November 2026" dalam WIB */
export function formatDateLong(value: Date | string): string {
  return dateLongFmt.format(toDate(value));
}

/** "3 Nov 2026" dalam WIB */
export function formatDateShort(value: Date | string): string {
  return dateShortFmt.format(toDate(value));
}

/** Tanggal WIB sebagai YYYY-MM-DD */
export function ymdWib(value: Date): string {
  return ymdFmt.format(value);
}

/** Jam (0-23) dalam WIB */
export function hourWib(value: Date): number {
  return parseInt(hourFmt.format(value), 10);
}

/**
 * Format string YYYY-MM-DD apa adanya tanpa new Date(), agar tidak bergeser zona waktu.
 */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

export function greeting(hour: number): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function roleLabel(role: Role): string {
  return role === 'ADMIN_HRD' ? 'Admin HRD' : 'Karyawan';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
```

---

### 14. `frontend/src/lib/hrdFormat.ts`

*Peran: Helper pemformatan tanggal, waktu, dan role HRD*

```tsx
const TIME_ZONE = "Asia/Jakarta";

/** "2026-11-03" -> "Sel, 3 Nov 2026". Memakai UTC agar tanggal tidak bergeser. */
export function formatAttendanceDate(dateValue: string, fallbackIso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateValue);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (fallbackIso) {
    const parsed = new Date(fallbackIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("id-ID", {
        timeZone: TIME_ZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }
  return "-";
}

/** ISO UTC -> "13.45.02" dalam WIB. */
export function formatTimeWib(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
```

---

### 15. `frontend/src/lib/utils.ts`

*Peran: Utility cn (clsx + tailwind-merge)*

```tsx
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

### 16. `frontend/src/pages/LoginPage.tsx`

*Peran: Halaman login dengan tombol demo HRD / Karyawan*

```tsx
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Camera,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, getStatus } from '@/lib/errors';
import { homeFor } from '@/lib/routes';

const HIGHLIGHTS = [
  { icon: Camera, text: 'Unggah satu foto sebagai bukti kamu bekerja dari rumah.' },
  { icon: Clock, text: 'Tanggal dan jam dicatat server, bukan perangkatmu.' },
  { icon: ShieldCheck, text: 'Foto hanya bisa dilihat oleh kamu dan tim HRD.' },
];

const DEMO_ACCOUNTS = [
  { label: 'Admin HRD', email: 'admin@company.test', password: 'Admin123!' },
  { label: 'Karyawan', email: 'budi@company.test', password: 'Karyawan123!' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const status = getStatus(err);
      if (status === 401) setError('Email atau kata sandi salah.');
      else if (status === 403) setError('Akun kamu nonaktif. Hubungi tim HRD.');
      else setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line bg-card p-12 lg:flex">
        <div>
          <span className="font-display text-2xl">Absensi WFH</span>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-5xl leading-[1.1] text-ink">
            Kerja dari rumah, kehadiran tetap tercatat rapi.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted">
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted">Alat internal HRD. Zona waktu WIB (Asia/Jakarta).</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <span className="mb-8 block font-display text-2xl lg:hidden">Absensi WFH</span>

          <h1 className="font-display text-4xl text-ink">Masuk</h1>
          <p className="mt-1 text-sm text-muted">Gunakan akun yang diberikan oleh HRD.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink active:bg-line/60"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              {submitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-sm font-medium text-muted">
              Akun demo (hapus di produksi)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.email}
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError(null);
                  }}
                >
                  Isi sebagai {acc.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

---

### 17. `frontend/src/pages/employee/AttendancePage.tsx`

*Peran: Halaman absensi karyawan (live clock, kamera, upload, riwayat)*

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, History, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AuthedImage } from '@/components/AuthedImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LiveClock } from '@/components/LiveClock';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { PhotoDropzone } from '@/components/PhotoDropzone';
import { Stamp } from '@/components/Stamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiList } from '@/hooks/useApiList';
import { useServerClock } from '@/hooks/useServerClock';
import { api } from '@/lib/api';
import { getErrorMessage, getStatus } from '@/lib/errors';
import {
  formatTime,
  formatTimeShort,
  formatYmd,
  greeting,
  hourWib,
  initials,
  ymdWib,
} from '@/lib/format';
import type { Attendance, Paginated } from '@/lib/types';

const NOTES_MAX = 500;

export default function AttendancePage() {
  const { user } = useAuth();
  const { now, status } = useServerClock();
  const today = ymdWib(now);

  const [page, setPage] = useState(1);
  const history = useApiList<Attendance>('/attendances/me', { page, limit: 5 });

  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    setTodayError(null);
    try {
      const { data } = await api.get<Paginated<Attendance>>('/attendances/me', {
        params: { page: 1, limit: 1 },
      });
      setTodayRecord(data.data[0] ?? null);
    } catch (err) {
      setTodayError(getErrorMessage(err));
    } finally {
      setTodayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  if (!user) return null;

  const checkedIn =
    todayRecord !== null && todayRecord.attendanceDate.slice(0, 10) === today;
  const firstName = user.fullName.trim().split(/\s+/)[0];

  function refreshHistory() {
    if (page === 1) history.refetch();
    else setPage(1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!file) {
      setSubmitError('Pilih foto bukti kerja terlebih dahulu.');
      return;
    }

    const body = new FormData();
    body.append('photo', file);
    if (notes.trim()) body.append('notes', notes.trim());

    setSubmitting(true);
    try {
      const { data } = await api.post<Attendance>('/attendances', body);
      setTodayRecord(data);
      setFile(null);
      setNotes('');
      refreshHistory();
    } catch (err) {
      if (getStatus(err) === 409) {
        setSubmitError('Kamu sudah absen hari ini. Satu karyawan hanya bisa absen sekali per hari.');
        loadToday();
        refreshHistory();
      } else {
        setSubmitError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`${greeting(hourWib(now))}, ${firstName}`}
        description="Kirim foto bukti kerja dari rumah untuk mencatat kehadiranmu hari ini."
      />

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <LiveClock now={now} status={status} className="order-1 lg:col-span-7" />

        {/* Profil singkat */}
        <Card className="order-3 p-6 lg:order-2 lg:col-span-5">
          <div className="flex items-start gap-4">
            <div
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-ink"
            >
              {initials(user.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.fullName}</p>
              <p className="truncate text-sm text-muted">{user.position}</p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            <div>
              <dt className="text-muted">NIK</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{user.nik}</dd>
            </div>
            <div>
              <dt className="text-muted">Status hari ini</dt>
              <dd className="mt-0.5">
                {todayLoading ? (
                  <Skeleton className="h-6 w-28 rounded-full" />
                ) : todayError ? (
                  <Badge variant="danger">Gagal dimuat</Badge>
                ) : checkedIn && todayRecord ? (
                  <Badge variant="present">
                    <CheckCircle2 aria-hidden /> Hadir pukul {formatTimeShort(todayRecord.checkInAt)}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Belum absen</Badge>
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Email</dt>
              <dd className="mt-0.5 truncate font-medium">{user.email}</dd>
            </div>
          </dl>
        </Card>

        {/* Area foto / absen */}
        <Card className="order-2 p-6 sm:p-8 lg:order-3 lg:col-span-7">
          <CardTitle className="font-display text-2xl font-normal">Absen hari ini</CardTitle>

          {todayLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : todayError ? (
            <ErrorState message={todayError} onRetry={loadToday} />
          ) : checkedIn && todayRecord ? (
            <div role="status" className="mt-4">
              <div className="flex items-center gap-2 text-present">
                <CheckCircle2 className="size-5" aria-hidden />
                <p className="font-semibold">Absen hari ini sudah tercatat</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                Tercatat pukul{' '}
                <span className="font-medium tabular-nums text-ink">
                  {formatTime(todayRecord.checkInAt)} WIB
                </span>
                . Sampai jumpa besok.
              </p>
              <div className="relative mt-4">
                <AuthedImage
                  attendanceId={todayRecord.id}
                  alt="Foto bukti kerja hari ini"
                  className="aspect-[4/3] w-full rounded-lg border border-line"
                />
                <Stamp
                  label="Tercatat"
                  time={formatTime(todayRecord.checkInAt)}
                  date={formatYmd(todayRecord.attendanceDate)}
                  name={user.fullName}
                  className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
                />
              </div>
              {todayRecord.notes && (
                <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-ink">
                  <span className="text-muted">Catatan: </span>
                  {todayRecord.notes}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
              <PhotoDropzone
                file={file}
                onChange={(f) => {
                  setFile(f);
                  setSubmitError(null);
                }}
                stampName={user.fullName}
                now={now}
                disabled={submitting}
              />

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="notes">Catatan (opsional)</Label>
                  <span className="text-xs tabular-nums text-muted">
                    {notes.length}/{NOTES_MAX}
                  </span>
                </div>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={NOTES_MAX}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: mengerjakan laporan bulanan dari ruang kerja di rumah."
                  disabled={submitting}
                />
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {submitError}
                </div>
              )}

              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Send />
                )}
                {submitting ? 'Mengirim…' : 'Kirim absen'}
              </Button>
            </form>
          )}
        </Card>

        {/* Riwayat */}
        <Card className="order-4 lg:col-span-5">
          <div className="p-6 pb-3">
            <CardTitle>Riwayat absen</CardTitle>
          </div>

          {history.loading && history.data.length === 0 ? (
            <ul className="space-y-3 px-6 pb-6">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3">
                  <Skeleton className="size-12" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </li>
              ))}
            </ul>
          ) : history.error ? (
            <ErrorState message={history.error} onRetry={history.refetch} />
          ) : history.data.length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum ada riwayat absen"
              description="Absen pertamamu akan muncul di sini setelah kamu mengirimnya."
            />
          ) : (
            <>
              <ul className="divide-y divide-line px-6">
                {history.data.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <AuthedImage
                      attendanceId={item.id}
                      alt={`Foto absen ${formatYmd(item.attendanceDate)}`}
                      className="size-12 shrink-0 rounded-md border border-line"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">
                        {formatYmd(item.attendanceDate)}
                        <span className="ml-2 font-normal text-muted">
                          {formatTimeShort(item.checkInAt)} WIB
                        </span>
                      </p>
                      <p className="truncate text-sm text-muted">
                        {item.notes ?? 'Tanpa catatan'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination meta={history.meta} onPage={setPage} disabled={history.loading} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
```

---

### 18. `frontend/src/pages/hrd/MonitoringPage.tsx`

*Peran: Halaman monitoring absensi seluruh karyawan oleh HRD*

```tsx
import { useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { ImageIcon, SearchIcon } from "@/components/icons";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { useProtectedImage } from "@/hooks/useProtectedImage";
import { fetchAttendances, type AttendanceRecord } from "@/lib/hrdApi";
import { formatAttendanceDate, formatTimeWib } from "@/lib/hrdFormat";

const PAGE_SIZE = 10;

interface LightboxTarget {
  id: string;
  title: string;
  subtitle: string;
}

function AttendanceThumb({
  attendanceId,
  label,
  onOpen,
}: {
  attendanceId: string;
  label: string;
  onOpen: () => void;
}) {
  const { src, status } = useProtectedImage(attendanceId);

  if (status === "loading") return <Skeleton className="h-14 w-14 rounded-md" />;

  if (status === "error" || !src) {
    return (
      <span
        className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-line text-muted"
        title="Foto tidak dapat dimuat"
      >
        <ImageIcon className="h-5 w-5" />
        <span className="sr-only">Foto tidak dapat dimuat</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Perbesar foto absensi ${label}`}
      className="group block h-14 w-14 cursor-pointer overflow-hidden rounded-md border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

export function MonitoringPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nameInput, setNameInput] = useState("");
  const employeeName = useDebouncedValue(nameInput.trim(), 400);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const hasFilters = Boolean(dateFrom || dateTo || nameInput);

  const filterKey = `${dateFrom}|${dateTo}|${employeeName}`;
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const { data, isLoading, error, reload } = usePagedQuery(
    fetchAttendances,
    { page, limit: PAGE_SIZE, dateFrom, dateTo, employeeName },
    !rangeInvalid,
  );

  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setNameInput("");
  }

  const columns: Column<AttendanceRecord>[] = [
    {
      key: "nik",
      header: "NIK",
      cell: (a) => <span className="font-mono text-sm tabular-nums">{a.employee.nik || "-"}</span>,
    },
    {
      key: "name",
      header: "Nama",
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{a.employee.fullName || "-"}</p>
          {a.employee.position && <p className="truncate text-xs text-muted">{a.employee.position}</p>}
        </div>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      cell: (a) => <span className="whitespace-nowrap">{formatAttendanceDate(a.attendanceDate, a.checkInAt)}</span>,
    },
    {
      key: "time",
      header: "Jam (WIB)",
      cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatTimeWib(a.checkInAt)} WIB</span>,
    },
    {
      key: "notes",
      header: "Catatan",
      className: "hidden md:table-cell",
      cell: (a) =>
        a.notes ? (
          <p className="max-w-xs truncate" title={a.notes}>
            {a.notes}
          </p>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
    {
      key: "photo",
      header: "Foto",
      cell: (a) => {
        const date = formatAttendanceDate(a.attendanceDate, a.checkInAt);
        return (
          <AttendanceThumb
            attendanceId={a.id}
            label={a.employee.fullName}
            onOpen={() =>
              setLightbox({
                id: a.id,
                title: a.employee.fullName || "Karyawan",
                subtitle: `${date}, ${formatTimeWib(a.checkInAt)} WIB${a.notes ? `. Catatan: ${a.notes}` : ""}`,
              })
            }
          />
        );
      },
    },
  ];

  const emptyContent = hasFilters
    ? {
        title: "Tidak ada absensi yang cocok",
        description: "Ubah rentang tanggal atau nama, atau reset filter untuk melihat semua data.",
        action: (
          <Button variant="secondary" onClick={resetFilters} className="min-h-11 sm:min-h-0">
            Reset filter
          </Button>
        ),
      }
    : {
        title: "Belum ada absensi",
        description: "Data akan muncul di sini setelah karyawan melakukan absen.",
      };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Monitoring absensi</h1>
        <p className="mt-1 text-sm text-muted">Hanya untuk dilihat. Data absensi tidak dapat diubah atau dihapus.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="date-from">Dari tanggal</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid ? "range-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-to">Sampai tanggal</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid ? "range-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-name">Nama karyawan</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="employee-name"
              type="search"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Cari nama"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="min-h-11 w-full sm:min-h-0 lg:w-auto"
          >
            Reset filter
          </Button>
        </div>
      </div>

      {rangeInvalid && (
        <p id="range-error" role="alert" className="text-sm text-danger">
          Tanggal awal tidak boleh lebih besar dari tanggal akhir.
        </p>
      )}

      <DataTable
        caption="Daftar absensi karyawan"
        columns={columns}
        rows={data?.items ?? null}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        meta={data?.meta ?? null}
        onPage={(next) => setPageState({ key: filterKey, page: next })}
        empty={emptyContent}
      />

      <PhotoLightbox
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        attendanceId={lightbox?.id ?? null}
        title={lightbox?.title ?? ""}
        subtitle={lightbox?.subtitle}
      />
    </div>
  );
}
```

---

### 19. `frontend/src/pages/hrd/EmployeesPage.tsx`

*Peran: Halaman master data karyawan (CRUD karyawan)*

```tsx
import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ConfirmDeactivateDialog } from "@/components/ConfirmDeactivateDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { EmployeeFormModal } from "@/components/EmployeeFormModal";
import { PencilIcon, PlusIcon, SearchIcon, UserXIcon } from "@/components/icons";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { fetchEmployees, ROLE_LABEL, type Employee } from "@/lib/hrdApi";

const PAGE_SIZE = 10;

export function EmployeesPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 400);

  // Halaman otomatis kembali ke 1 saat kata kunci berubah, tanpa fetch ganda.
  const [pageState, setPageState] = useState({ search: "", page: 1 });
  const page = pageState.search === search ? pageState.page : 1;

  const { data, isLoading, error, reload } = usePagedQuery(fetchEmployees, {
    page,
    limit: PAGE_SIZE,
    search,
  });

  const [formTarget, setFormTarget] = useState<{ employee: Employee | null } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const dismissBanner = useCallback(() => setBanner(null), []);

  const columns: Column<Employee>[] = [
    {
      key: "nik",
      header: "NIK",
      cell: (e) => <span className="font-mono text-sm tabular-nums">{e.nik}</span>,
    },
    {
      key: "name",
      header: "Nama",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{e.fullName}</p>
          <p className="truncate text-xs text-muted">{e.email}</p>
        </div>
      ),
    },
    {
      key: "position",
      header: "Jabatan",
      className: "hidden md:table-cell",
      cell: (e) => e.position,
    },
    {
      key: "role",
      header: "Peran",
      className: "hidden sm:table-cell",
      cell: (e) => <Badge variant={e.role === "ADMIN_HRD" ? "accent" : "neutral"}>{ROLE_LABEL[e.role]}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => <Badge variant={e.isActive ? "present" : "neutral"}>{e.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      key: "actions",
      header: "Aksi",
      className: "text-right",
      cell: (e) => {
        const isSelf = e.id === user?.id;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={`Ubah ${e.fullName}`}
              onClick={() => setFormTarget({ employee: e })}
            >
              <PencilIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Ubah</span>
            </Button>
            <Button
              variant="danger-ghost"
              size="sm"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={`Nonaktifkan ${e.fullName}`}
              title={isSelf ? "Akun Anda sendiri tidak dapat dinonaktifkan" : undefined}
              disabled={!e.isActive || isSelf}
              onClick={() => setDeactivateTarget(e)}
            >
              <UserXIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Nonaktifkan</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const emptyContent = search
    ? {
        title: "Tidak ada karyawan yang cocok",
        description: `Tidak ada hasil untuk "${search}". Periksa ejaan atau coba kata kunci lain.`,
        action: (
          <Button variant="secondary" onClick={() => setSearchInput("")} className="min-h-11 sm:min-h-0">
            Hapus pencarian
          </Button>
        ),
      }
    : {
        title: "Belum ada data karyawan",
        description: "Tambahkan karyawan pertama agar mereka bisa login dan absen.",
        action: (
          <Button onClick={() => setFormTarget({ employee: null })} className="min-h-11 sm:min-h-0">
            <PlusIcon className="h-4 w-4" />
            Tambah karyawan
          </Button>
        ),
      };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Master karyawan</h1>
          <p className="mt-1 text-sm text-muted">Kelola akun karyawan dan admin HRD.</p>
        </div>
        <Button onClick={() => setFormTarget({ employee: null })} className="min-h-11 sm:min-h-0">
          <PlusIcon className="h-4 w-4" />
          Tambah karyawan
        </Button>
      </div>

      <StatusBanner message={banner} onDismiss={dismissBanner} />

      <div className="max-w-md space-y-1.5">
        <Label htmlFor="employee-search">Cari karyawan</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="employee-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nama, NIK, atau email"
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      <DataTable
        caption="Daftar karyawan"
        columns={columns}
        rows={data?.items ?? null}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        meta={data?.meta ?? null}
        onPage={(next) => setPageState({ search, page: next })}
        empty={emptyContent}
      />

      <EmployeeFormModal
        open={formTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
        employee={formTarget?.employee ?? null}
        onSaved={(message) => {
          setBanner(message);
          reload();
        }}
      />

      <ConfirmDeactivateDialog
        employee={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onDone={(message) => {
          setBanner(message);
          reload();
        }}
      />
    </div>
  );
}
```

---

### 20. `frontend/src/pages/NotFoundPage.tsx`

*Peran: Halaman 404 Not Found*

```tsx
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center text-ink">
      <p className="font-display text-5xl font-semibold">404</p>
      <p className="text-muted">Halaman yang Anda cari tidak ditemukan.</p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}
```

---

### 21. `frontend/src/components/DataTable.tsx`

*Peran: Komponen reusable tabel data dengan sorting dan loading*

```tsx
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertIcon, InboxIcon, RefreshIcon } from "@/components/icons";
import type { PageMeta } from "@/lib/hrdApi";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Dipakai di <th> dan <td>, mis. "hidden md:table-cell" atau "text-right". */
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  meta: PageMeta | null;
  onPage: (page: number) => void;
  empty: { title: string; description?: string; action?: ReactNode };
}

const SKELETON_ROWS = 5;

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  meta,
  onPage,
  empty,
}: DataTableProps<T>) {
  const hasError = error !== null;
  const showSkeleton = !hasError && isLoading && rows === null;
  const showEmpty = !hasError && !showSkeleton && rows !== null && rows.length === 0;
  const showRows = !hasError && !showSkeleton && !showEmpty && rows !== null;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      {hasError && (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <AlertIcon className="h-8 w-8 text-danger" />
          <div>
            <p className="font-medium text-ink">Data tidak dapat dimuat</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
          <Button variant="secondary" onClick={onRetry} className="min-h-11 sm:min-h-0">
            <RefreshIcon className="h-4 w-4" />
            Coba lagi
          </Button>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <InboxIcon className="h-8 w-8 text-muted" />
          <div>
            <p className="font-medium text-ink">{empty.title}</p>
            {empty.description && <p className="mt-1 text-sm text-muted">{empty.description}</p>}
          </div>
          {empty.action}
        </div>
      )}

      {(showSkeleton || showRows) && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm" aria-busy={isLoading}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted",
                      col.className,
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn("transition-opacity", showRows && isLoading && "opacity-60")}>
              {showSkeleton &&
                Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {showRows &&
                rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-line align-middle last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {showRows && meta && meta.total > 0 && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Menampilkan {(meta.page - 1) * meta.limit + 1}-{(meta.page - 1) * meta.limit + rows.length} dari{" "}
            {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 sm:min-h-0"
              disabled={isLoading || meta.page <= 1}
              onClick={() => onPage(meta.page - 1)}
            >
              Sebelumnya
            </Button>
            <span className="px-1 text-sm tabular-nums text-muted">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 sm:min-h-0"
              disabled={isLoading || meta.page >= meta.totalPages}
              onClick={() => onPage(meta.page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 22. `frontend/src/components/LiveClock.tsx`

*Peran: Komponen reusable jam realtime tersinkronisasi waktu server*

```tsx
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import type { ClockStatus } from '@/hooks/useServerClock';
import { formatDateLong, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  now: Date;
  status: ClockStatus;
  className?: string;
}

function SyncLabel({ status }: { status: ClockStatus }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-present">
        <CheckCircle2 className="size-3.5" aria-hidden /> Sinkron dengan server
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <WifiOff className="size-3.5" aria-hidden /> Memakai jam perangkat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      Menyinkronkan…
    </span>
  );
}

export function LiveClock({ now, status, className }: Props) {
  return (
    <div className={cn('flex flex-col justify-between py-2 lg:pr-8', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{formatDateLong(now)}</p>
        <SyncLabel status={status} />
      </div>

      <p
        role="timer"
        aria-live="off"
        className="mt-8 font-display text-5xl leading-none tabular-nums tracking-tight text-ink sm:text-7xl"
      >
        {formatTime(now)}
        <span className="ml-2 font-sans text-sm font-medium tracking-normal text-muted sm:text-base">
          WIB
        </span>
      </p>

      <p className="mt-6 text-sm text-muted">
        Jam ini hanya tampilan. Waktu absen resmi dicatat oleh server saat kamu mengirim.
      </p>
    </div>
  );
}
```

---

### 23. `frontend/src/components/PhotoDropzone.tsx`

*Peran: Komponen upload foto bukti WFH dengan preview dan watermark*

```tsx
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/Stamp';
import { formatDateShort, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024;

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  stampName: string;
  /** Waktu (sinkron server) untuk stempel pratinjau */
  now: Date;
  disabled?: boolean;
}

export function PhotoDropzone({ file, onChange, stampName, now, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(list: FileList | null) {
    const candidate = list?.[0];
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setLocalError('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setLocalError('Ukuran foto maksimal 3 MB.');
      return;
    }
    setLocalError(null);
    onChange(candidate);
  }

  function clear() {
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pick(e.dataTransfer.files);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => pick(e.target.files)}
      />

      {!file || !previewUrl ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Pilih foto bukti kerja"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent active:bg-accent-soft/40',
            dragging && 'border-accent bg-accent-soft',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <ImagePlus className="size-7 text-accent" aria-hidden />
          <p className="text-sm font-medium text-ink">
            Tarik foto ke sini atau pilih dari perangkat
          </p>
          <p className="text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB</p>
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          <Stamp
            label="Pratinjau"
            time={formatTime(now)}
            date={formatDateShort(now)}
            name={stampName}
            className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
          />

          <div className="absolute right-3 top-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw /> Ganti
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={clear}
              aria-label="Hapus foto"
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {file && (
        <p className="mt-2 text-xs text-muted">
          Stempel di atas hanya pratinjau. Waktu absen resmi dicatat server saat kamu menekan
          kirim.
        </p>
      )}
      {localError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {localError}
        </p>
      )}
    </div>
  );
}
```

---

### 24. `frontend/src/components/PhotoLightbox.tsx`

*Peran: Modal preview pembesaran foto absensi berotentikasi*

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertIcon } from "@/components/icons";
import { useProtectedImage } from "@/hooks/useProtectedImage";

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendanceId: string | null;
  title: string;
  subtitle?: string;
}

export function PhotoLightbox({ open, onOpenChange, attendanceId, title, subtitle }: PhotoLightboxProps) {
  const { src, status } = useProtectedImage(open ? attendanceId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{subtitle ?? "Foto bukti absensi"}</DialogDescription>

        <div className="mt-4 overflow-hidden rounded-md bg-canvas">
          {status === "loading" && <Skeleton className="h-72 w-full" />}
          {status === "error" && (
            <div role="alert" className="flex h-72 flex-col items-center justify-center gap-2 text-center">
              <AlertIcon className="h-7 w-7 text-danger" />
              <p className="text-sm text-muted">Foto tidak dapat dimuat. Tutup dan coba lagi.</p>
            </div>
          )}
          {status === "ready" && src && (
            <img src={src} alt={`Foto bukti absensi ${title}`} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="min-h-11 sm:min-h-0">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 25. `frontend/src/components/AuthedImage.tsx`

*Peran: Komponen gambar yang memuat foto privat via token Bearer*

```tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ImageOff } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  attendanceId: string;
  alt: string;
  className?: string;
}

/**
 * Foto absensi butuh header Authorization, jadi diambil sebagai blob lalu
 * ditampilkan lewat object URL (dibebaskan saat unmount).
 */
export function AuthedImage({ attendanceId, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState('loading');
    setSrc(null);

    api
      .get<Blob>(`/attendances/${attendanceId}/photo`, {
        responseType: 'blob',
        signal: controller.signal,
      })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
        setState('ready');
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setState('error');
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attendanceId]);

  return (
    <div className={cn('relative overflow-hidden bg-line/50', className)}>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      {state === 'error' && (
        <div
          role="img"
          aria-label="Foto tidak dapat dimuat"
          className="grid h-full w-full place-items-center text-muted"
        >
          <ImageOff className="size-4" aria-hidden />
        </div>
      )}
      {state === 'ready' && src && (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      )}
    </div>
  );
}
```

---

### 26. `frontend/src/components/EmployeeFormModal.tsx`

*Peran: Modal form tambah dan edit karyawan*

```tsx
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createEmployee,
  getErrorMessage,
  ROLE_LABEL,
  updateEmployee,
  type Employee,
  type Role,
} from "@/lib/hrdApi";

interface FormValues {
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  password: string;
  isActive: boolean;
}

type FieldName = "nik" | "fullName" | "email" | "position" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ["nik", "fullName", "email", "position", "password"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toValues(employee: Employee | null): FormValues {
  return {
    nik: employee?.nik ?? "",
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    position: employee?.position ?? "",
    role: employee?.role ?? "EMPLOYEE",
    password: "",
    isActive: employee?.isActive ?? true,
  };
}

function validate(values: FormValues, isEdit: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const nik = values.nik.trim();
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const position = values.position.trim();

  if (!nik) errors.nik = "NIK wajib diisi.";
  else if (nik.length > 30) errors.nik = "NIK maksimal 30 karakter.";

  if (!fullName) errors.fullName = "Nama lengkap wajib diisi.";
  else if (fullName.length > 100) errors.fullName = "Nama maksimal 100 karakter.";

  if (!email) errors.email = "Email wajib diisi.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Format email tidak valid.";

  if (!position) errors.position = "Jabatan wajib diisi.";
  else if (position.length > 100) errors.position = "Jabatan maksimal 100 karakter.";

  if (!isEdit && !values.password) errors.password = "Password wajib diisi untuk karyawan baru.";
  else if (values.password && values.password.length < 8) errors.password = "Password minimal 8 karakter.";

  return errors;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode tambah. */
  employee: Employee | null;
  onSaved: (message: string) => void;
}

export function EmployeeFormModal({ open, onOpenChange, employee, onSaved }: EmployeeFormModalProps) {
  const { user } = useAuth();
  const isEdit = employee !== null;
  const isSelf = employee !== null && employee.id === user?.id;

  const [values, setValues] = useState<FormValues>(() => toValues(employee));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(toValues(employee));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, employee]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function describe(field: FieldName, hasHint = false): string | undefined {
    if (errors[field]) return `emp-${field}-error`;
    return hasHint ? `emp-${field}-hint` : undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(values, isEdit);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`emp-${firstInvalid}`)?.focus();
      return;
    }

    const base = {
      nik: values.nik.trim(),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      position: values.position.trim(),
      role: values.role,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          ...base,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        });
        onSaved(`Data ${base.fullName} berhasil diperbarui.`);
      } else {
        await createEmployee({ ...base, password: values.password });
        onSaved(`Karyawan ${base.fullName} berhasil ditambahkan.`);
      }
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Gagal menyimpan data karyawan."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{isEdit ? "Ubah data karyawan" : "Tambah karyawan"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Kosongkan password jika tidak ingin menggantinya."
            : "Karyawan baru dapat langsung login setelah disimpan."}
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {submitError && (
            <div role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
              {submitError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="emp-nik" label="NIK" error={errors.nik}>
              <Input
                id="emp-nik"
                value={values.nik}
                onChange={(e) => setField("nik", e.target.value)}
                aria-invalid={Boolean(errors.nik)}
                aria-describedby={describe("nik")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-fullName" label="Nama lengkap" error={errors.fullName}>
              <Input
                id="emp-fullName"
                value={values.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={describe("fullName")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-email" label="Email" error={errors.email}>
              <Input
                id="emp-email"
                type="email"
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describe("email")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-position" label="Jabatan" error={errors.position}>
              <Input
                id="emp-position"
                value={values.position}
                onChange={(e) => setField("position", e.target.value)}
                aria-invalid={Boolean(errors.position)}
                aria-describedby={describe("position")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field
              id="emp-role"
              label="Peran"
              hint={isSelf ? "Peran akun Anda sendiri tidak dapat diubah." : undefined}
            >
              <Select
                id="emp-role"
                value={values.role}
                onChange={(e) => setField("role", e.target.value as Role)}
                disabled={submitting || isSelf}
              >
                <option value="EMPLOYEE">{ROLE_LABEL.EMPLOYEE}</option>
                <option value="ADMIN_HRD">{ROLE_LABEL.ADMIN_HRD}</option>
              </Select>
            </Field>
            <Field
              id="emp-password"
              label={isEdit ? "Password baru (opsional)" : "Password"}
              error={errors.password}
              hint="Minimal 8 karakter."
            >
              <Input
                id="emp-password"
                type="password"
                value={values.password}
                onChange={(e) => setField("password", e.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={describe("password", true)}
                autoComplete="new-password"
                disabled={submitting}
              />
            </Field>
          </div>

          {isEdit && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                disabled={submitting || isSelf}
                className="h-5 w-5 cursor-pointer accent-accent"
              />
              <span>
                Akun aktif
                {isSelf && <span className="ml-2 text-xs text-muted">(akun Anda sendiri tidak dapat dinonaktifkan)</span>}
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="min-h-11 sm:min-h-0"
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-11 sm:min-h-0">
              {submitting ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah karyawan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 27. `frontend/src/components/ConfirmDeactivateDialog.tsx`

*Peran: Dialog konfirmasi penonaktifan karyawan*

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deactivateEmployee, getErrorMessage, type Employee } from "@/lib/hrdApi";

interface ConfirmDeactivateDialogProps {
  /** null = dialog tertutup. */
  employee: Employee | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ConfirmDeactivateDialog({ employee, onClose, onDone }: ConfirmDeactivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSubmitting(false);
  }, [employee]);

  async function handleConfirm() {
    if (!employee || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deactivateEmployee(employee.id);
      onDone(`${employee.fullName} dinonaktifkan. Akun ini tidak dapat login lagi.`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menonaktifkan karyawan."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => (!open && !submitting ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogTitle>Nonaktifkan karyawan?</DialogTitle>
        <DialogDescription>
          {employee?.fullName} tidak akan bisa login. Riwayat absensinya tetap tersimpan, dan akun bisa diaktifkan
          kembali lewat menu ubah.
        </DialogDescription>

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="min-h-11 sm:min-h-0">
            Batal
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={submitting} className="min-h-11 sm:min-h-0">
            {submitting ? "Memproses..." : "Nonaktifkan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 28. `frontend/src/components/StatusBanner.tsx`

*Peran: Banner status feedback / pesan notifikasi*

```tsx
import { useEffect } from "react";

interface StatusBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function StatusBanner({ message, onDismiss }: StatusBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-accent-ink"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="-my-2 -mr-2 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium underline-offset-2 hover:underline"
      >
        Tutup
      </button>
    </div>
  );
}
```

---

### 29. `frontend/src/components/Stamp.tsx`

*Peran: Komponen visual watermark/stempel waktu dan lokasi pada foto*

```tsx
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  time: string;
  date: string;
  name?: string;
  className?: string;
}

/**
 * Stempel tinta: motif identitas aplikasi.
 * "Pratinjau" = hanya tampilan di perangkat. "Tercatat" = waktu resmi dari server.
 */
export function Stamp({ label, time, date, name, className }: Props) {
  return (
    <div
      className={cn(
        'inline-block -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent-ink',
        className,
      )}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="font-display text-lg leading-tight tabular-nums">{time} WIB</p>
      <p className="text-xs tabular-nums">{date}</p>
      {name && <p className="truncate text-xs font-medium">{name}</p>}
    </div>
  );
}
```

---

### 30. `frontend/src/components/EmptyState.tsx`

*Peran: Komponen tampilan kosong ketika data tabel tidak ditemukan*

```tsx
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-canvas text-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

---

### 31. `frontend/src/components/ErrorState.tsx`

*Peran: Komponen tampilan error saat gagal memuat data*

```tsx
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">Data tidak dapat dimuat</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Coba lagi
        </Button>
      )}
    </div>
  );
}
```

---

### 32. `frontend/src/components/PageHeader.tsx`

*Peran: Komponen judul dan subjudul header halaman*

```tsx
import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
```

---

### 33. `frontend/src/components/Pagination.tsx`

*Peran: Komponen navigasi paginasi tabel*

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Meta } from '@/lib/types';

interface Props {
  meta: Meta | null;
  onPage: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ meta, onPage, disabled }: Props) {
  if (!meta || meta.total === 0) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const totalPages = Math.max(meta.totalPages, 1);

  return (
    <nav
      aria-label="Paginasi"
      className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:flex-row"
    >
      <p className="tabular-nums text-muted">
        Menampilkan {from}–{to} dari {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft /> Sebelumnya
        </Button>
        <span className="px-1 tabular-nums text-muted">
          {meta.page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || meta.page >= totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          Berikutnya <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
```

---

### 34. `frontend/src/components/ui/badge.tsx`

*Peran: Komponen UI badge / tag status*

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        neutral: 'bg-line/70 text-muted',
        present: 'bg-present-soft text-present',
        accent: 'bg-accent-soft text-accent-ink',
        danger: 'bg-danger-soft text-danger',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

---

### 35. `frontend/src/components/ui/button.tsx`

*Peran: Komponen UI button dengan varian desain token*

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent/90 active:bg-accent/80',
        secondary: 'border border-edge bg-card text-ink hover:bg-canvas active:bg-line',
        ghost: 'text-muted hover:bg-line/60 hover:text-ink active:bg-line',
        danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
        'danger-ghost': 'text-danger hover:bg-danger-soft active:bg-danger/15',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-[13px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
```

---

### 36. `frontend/src/components/ui/card.tsx`

*Peran: Komponen UI container card*

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border border-line bg-card', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-ink', className)} {...props} />;
}
```

---

### 37. `frontend/src/components/ui/dialog.tsx`

*Peran: Komponen UI dialog modal berbasis Radix*

```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-card p-6',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Tutup"
        className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-ink active:bg-line/60"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-xl text-ink', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-sm text-muted', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';
```

---

### 38. `frontend/src/components/ui/input.tsx`

*Peran: Komponen UI input teks*

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-10 w-full rounded-md border border-edge bg-card px-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-60 aria-[invalid=true]:border-danger',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
```

---

### 39. `frontend/src/components/ui/label.tsx`

*Peran: Komponen UI label form*

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium text-ink', className)} {...props} />
));
Label.displayName = 'Label';
```

---

### 40. `frontend/src/components/ui/select.tsx`

*Peran: Komponen UI dropdown select*

```tsx
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'h-10 w-full appearance-none rounded-md border border-edge bg-card pl-3 pr-9 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
    />
  </div>
));
Select.displayName = 'Select';
```

---

### 41. `frontend/src/components/ui/skeleton.tsx`

*Peran: Komponen UI skeleton placeholder saat loading*

```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-line/70 motion-reduce:animate-none', className)}
    />
  );
}
```

---

### 42. `frontend/src/components/ui/textarea.tsx`

*Peran: Komponen UI textarea untuk catatan absensi*

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-[88px] w-full resize-y rounded-md border border-edge bg-card px-3 py-2 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
```

---

### 43. `frontend/src/hooks/usePagedQuery.ts`

*Peran: Hook pemanggilan data berpaginasi dengan debounce filter*

```tsx
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getErrorMessage, type Paged } from "@/lib/hrdApi";

/**
 * `fetcher` harus fungsi stabil (level modul). `params` harus bisa di-JSON-kan.
 */
export function usePagedQuery<T, P>(
  fetcher: (params: P, signal: AbortSignal) => Promise<Paged<T>>,
  params: P,
  enabled = true,
) {
  const key = JSON.stringify(params);
  const [data, setData] = useState<Paged<T> | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetcher(JSON.parse(key) as P, controller.signal)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(getErrorMessage(err, "Gagal memuat data."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [fetcher, key, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, isLoading, error, reload };
}
```

---

### 44. `frontend/src/hooks/useServerClock.ts`

*Peran: Hook sinkronisasi jam perangkat dengan jam server (/api/time)*

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type ClockStatus = 'syncing' | 'synced' | 'offline';

const RESYNC_MS = 5 * 60 * 1000;

/**
 * Jam yang disinkronkan ke GET /api/time.
 * offset = waktu server (dikoreksi setengah RTT) - waktu perangkat.
 * Ini hanya tampilan; waktu absen resmi tetap dibuat server.
 */
export function useServerClock() {
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<ClockStatus>('syncing');

  const sync = useCallback(async () => {
    const started = performance.now();
    try {
      const { data } = await api.get<{ now: string }>('/time');
      const rtt = performance.now() - started;
      offsetRef.current = new Date(data.now).getTime() + rtt / 2 - Date.now();
      setNow(new Date(Date.now() + offsetRef.current));
      setStatus('synced');
    } catch {
      setStatus((s) => (s === 'synced' ? 'synced' : 'offline'));
    }
  }, []);

  useEffect(() => {
    sync();
    const id = setInterval(sync, RESYNC_MS);
    return () => clearInterval(id);
  }, [sync]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { now, status };
}
```

---

### 45. `frontend/src/hooks/useProtectedImage.ts`

*Peran: Hook untuk mengambil object URL gambar berotentikasi*

```tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { fetchAttendancePhoto } from "@/lib/hrdApi";

type Status = "loading" | "ready" | "error";

/** Mengambil foto lewat endpoint terproteksi (Bearer token) lalu menjadikannya blob URL. */
export function useProtectedImage(attendanceId: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    setSrc(null);
    setStatus("loading");
    if (!attendanceId) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;

    fetchAttendancePhoto(attendanceId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        setStatus("error");
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attendanceId]);

  return { src, status };
}
```

---

