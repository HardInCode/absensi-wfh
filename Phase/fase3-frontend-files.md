# Fase 3: Frontend React + Vite + Tailwind (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Buat setiap file pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya, lalu terapkan edit pada file Fase 1 dan 2. Buat folder yang belum ada. Fase 1 dan Fase 2 (backend) sudah terpasang.

Catatan penting: kode Fase 3 ini ditulis tanpa dijalankan di browser. Verifikasi dengan `npm run typecheck` dan `npm run build` di folder `frontend`, lalu uji manual memakai bagian "Cara mengetes" di akhir dokumen. Perbaiki error compile bila ada, tanpa mengubah perilaku yang dijelaskan di bagian keputusan desain.

---

## Keputusan desain & alasannya (penting dipahami sebelum mengimplementasikan)

**Revisi UI akan datang.** Pemilik proyek berencana merevisi tampilan nanti dengan plugin UI/UX dan antislop. Karena itu: implementasikan dulu apa adanya. Lapisan tampilan sengaja dipisah dari logika agar revisi mudah:
- Warna, radius, dan font dipusatkan di token CSS (`src/index.css`) dan `tailwind.config.ts`. Komponen hanya memakai nama token (`bg-accent`, `text-muted`, dst.), jangan menulis warna hex langsung.
- Logika (auth, API, hooks, format waktu) ada di `src/auth`, `src/lib`, `src/hooks` dan tidak bergantung pada gaya.
- Komponen dasar ada di `src/components/ui/`, komponen aplikasi di `src/components/`, halaman di `src/pages/`.

**Arah desain: "Warm Editorial Workspace".** Latar krem hangat, kartu putih, aksen terrakota, hijau sage untuk status hadir, serif Fraunces untuk judul, DM Sans untuk teks. Halaman karyawan memakai tata letak bento (empat kartu berukuran berbeda: jam, profil, absen, riwayat).

**Fungsi halaman:**
- Login dan routing per role: EMPLOYEE ke `/absensi`, ADMIN_HRD ke `/admin/karyawan`. Role guard lewat `ProtectedRoute`.
- Halaman karyawan: jam live, form absen dengan PhotoDropzone dan stempel pratinjau, status hari ini, riwayat.
- Halaman HRD: CRUD karyawan (tambah, ubah, nonaktifkan/aktifkan) dan monitoring absensi, keduanya berupa tabel dengan filter dan paginasi. Drawer detail HRD sengaja belum dibuat (Fase 4).

**Alasan teknis utama:**
- **Satu-satunya perubahan backend** adalah endpoint publik `GET /api/time` (waktu server dan tanggal WIB) sebagai acuan jam di frontend.
- **Jam di UI hanya tampilan.** `useServerClock` menyinkronkan offset terhadap `/api/time` (dikoreksi setengah RTT, resync tiap 5 menit). Waktu absen resmi tetap dibuat server saat POST. Stempel di pratinjau foto diberi label "Pratinjau" untuk menegaskan hal ini.
- **Semua format waktu memakai `Asia/Jakarta`** lewat `Intl.DateTimeFormat`. `attendanceDate` (string `YYYY-MM-DD`) ditampilkan lewat `formatYmd` tanpa `new Date()` agar tidak bergeser zona waktu.
- **Foto absensi diambil sebagai blob** lewat Axios (`AuthedImage`), karena endpoint foto butuh header Authorization sehingga `<img src>` langsung tidak bisa. Object URL dibebaskan saat unmount.
- **Token JWT disimpan di localStorage** (`absensi.token`). Interceptor Axios menambahkan header Bearer, dan pada respons 401 (selain `/auth/login`) menghapus token lalu memicu event `auth:expired` sehingga `AuthContext` mengosongkan user dan router mengarahkan ke `/login`.
- **Status hari ini** ditentukan dari `GET /attendances/me?page=1&limit=1` (data terbaru) dibandingkan dengan tanggal WIB dari jam server (`ymdWib(now)`).
- **Error 409 saat absen** (sudah absen hari ini) ditangani dengan pesan khusus lalu memuat ulang status dan riwayat.
- **`useApiList`** adalah hook daftar berpaginasi dengan `AbortController`; kirim `params = null` untuk menahan request (dipakai saat rentang tanggal tidak valid).
- **Pencarian memakai debounce 400 ms.** Param query memakai snake_case (`is_active`, `date_from`, `date_to`, `employee_name`) sesuai backend.
- **Validasi klien** (format foto JPG/PNG/WebP, maks 3 MB, password minimal 8 karakter, `date_from` <= `date_to`) hanya untuk kenyamanan. Server tetap penentu, dan pesan errornya ditampilkan apa adanya. Hanya status 401, 403 (login), 409, dan 413 yang diterjemahkan.
- **Admin tidak bisa menonaktifkan akunnya sendiri** lewat UI (tombol dinonaktifkan), sejalan dengan aturan backend.
- **Tailwind v3.4** (bukan v4), token sebagai kanal RGB di CSS variables agar mendukung modifier opasitas (`bg-accent/90`).
- **Komponen gaya shadcn ditulis manual** (cva, Radix, `cn`), bukan lewat CLI, agar repo tidak butuh langkah tambahan.
- **Font lokal** lewat `@fontsource-variable`, tanpa request ke Google Fonts.
- **Blok "Akun demo" di halaman login** hanya untuk development; hapus di produksi.
- **Setelah login, tujuan selalu halaman utama per role**, tanpa mengingat halaman sebelumnya.
- **Thumbnail foto di tabel HRD** memuat foto penuh per baris (maks. 10 per halaman). Cukup untuk tes teknis; untuk produksi sebaiknya ada endpoint thumbnail.
- **Aksesibilitas dasar:** link "Lewati ke konten", `:focus-visible` yang jelas, label pada semua input, `prefers-reduced-motion` dihormati, border input memakai token `edge` (kontras 3:1), dan target klik tombol minimal 32 px.

**Larangan desain yang dijaga** (pertahankan saat revisi UI): tanpa gradasi ungu-biru, tanpa tiga kartu identik berderet, tanpa emoji sebagai ikon UI (pakai Lucide), tanpa glassmorphism, tanpa bayangan berat (pemisahan lewat border 1px), tanpa lorem ipsum, kontras teks WCAG AA, dan tampilan harus responsif di layar HP 360 px.

---

## A. Backend: tambahan `GET /api/time`

### `absensi-wfh/backend/src/time/time.controller.ts`
```ts
import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

const APP_TIME_ZONE = 'Asia/Jakarta';

@ApiTags('time')
@Controller('time')
export class TimeController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Waktu server saat ini (acuan jam di frontend)' })
  @ApiOkResponse({
    description: 'now = ISO 8601 UTC, date = tanggal WIB (YYYY-MM-DD)',
    schema: {
      example: {
        now: '2026-11-03T01:15:30.000Z',
        timeZone: 'Asia/Jakarta',
        date: '2026-11-03',
      },
    },
  })
  getTime() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    return { now: now.toISOString(), timeZone: APP_TIME_ZONE, date };
  }
}
```

### `absensi-wfh/backend/src/time/time.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';

@Module({
  controllers: [TimeController],
})
export class TimeModule {}
```

### `absensi-wfh/backend/src/app.module.ts` (ganti seluruh isi dengan ini)
Endpoint `/api/time` sengaja publik (tanpa guard) dan hanya mengembalikan jam server.
```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { AttendancesModule } from './attendances/attendances.module';
import { TimeModule } from './time/time.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    EmployeesModule,
    AuthModule,
    AttendancesModule,
    TimeModule,
  ],
})
export class AppModule {}
```

---

## B. Frontend

### Konfigurasi proyek

### `absensi-wfh/frontend/package.json`
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

### `absensi-wfh/frontend/.env`
```
VITE_API_URL=http://localhost:3000/api
```

### `absensi-wfh/frontend/.env.example`
```
VITE_API_URL=http://localhost:3000/api
```

### `absensi-wfh/frontend/index.html`
```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#F7F5F0" />
    <title>Absensi WFH</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `absensi-wfh/frontend/vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
});
```

### `absensi-wfh/frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vite.config.ts", "tailwind.config.ts"]
}
```

### `absensi-wfh/frontend/postcss.config.js`
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### `absensi-wfh/frontend/tailwind.config.ts`
```ts
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

### Entry & styling

### `absensi-wfh/frontend/src/vite-env.d.ts`
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### `absensi-wfh/frontend/src/index.css`
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
    --color-accent: 176 74 34; /* #B04A22 terrakota */
    --color-accent-soft: 246 231 223; /* #F6E7DF */
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

  body {
    @apply bg-canvas font-sans text-ink antialiased;
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

### `absensi-wfh/frontend/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

### `absensi-wfh/frontend/src/App.tsx`
```tsx
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppShell } from '@/layouts/AppShell';
import { FullPageLoader } from '@/components/FullPageLoader';
import { homeFor } from '@/lib/routes';
import LoginPage from '@/pages/LoginPage';
import AttendancePage from '@/pages/employee/AttendancePage';
import EmployeesPage from '@/pages/admin/EmployeesPage';
import AttendanceMonitorPage from '@/pages/admin/AttendanceMonitorPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
        <p className="mt-1 text-sm text-muted">
          Alamat yang kamu buka tidak ada atau sudah dipindahkan.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route path="/absensi" element={<AttendancePage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN_HRD']} />}>
            <Route path="/admin/karyawan" element={<EmployeesPage />} />
            <Route path="/admin/absensi" element={<AttendanceMonitorPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

### Lib

### `absensi-wfh/frontend/src/lib/utils.ts`
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `absensi-wfh/frontend/src/lib/types.ts`
```ts
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

### `absensi-wfh/frontend/src/lib/api.ts`
```ts
import axios from 'axios';

export const TOKEN_KEY = 'absensi.token';
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
```

### `absensi-wfh/frontend/src/lib/errors.ts`
```ts
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

### `absensi-wfh/frontend/src/lib/format.ts`
```ts
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

### `absensi-wfh/frontend/src/lib/routes.ts`
```ts
import type { Role } from './types';

export function homeFor(role: Role): string {
  return role === 'ADMIN_HRD' ? '/admin/karyawan' : '/absensi';
}
```

### Auth

### `absensi-wfh/frontend/src/auth/AuthContext.tsx`
```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY } from '@/lib/api';
import type { Employee, LoginResponse } from '@/lib/types';

interface AuthState {
  user: Employee | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Employee>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  // Pulihkan sesi dari token yang tersimpan.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get<Employee>('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Token kedaluwarsa / ditolak server.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
```

### `absensi-wfh/frontend/src/auth/ProtectedRoute.tsx`
```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '@/components/FullPageLoader';
import { homeFor } from '@/lib/routes';
import type { Role } from '@/lib/types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <Outlet />;
}
```

### Hooks

### `absensi-wfh/frontend/src/hooks/useDebounce.ts`
```ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
```

### `absensi-wfh/frontend/src/hooks/useApiList.ts`
```ts
import { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Meta, Paginated } from '@/lib/types';

type Params = Record<string, string | number | boolean | undefined | null>;

interface State<T> {
  data: T[];
  meta: Meta | null;
  loading: boolean;
  error: string | null;
}

function clean(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

/**
 * Mengambil daftar berpaginasi. Kirim `params = null` untuk menahan request.
 */
export function useApiList<T>(path: string, params: Params | null) {
  const key = JSON.stringify(params);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({
    data: [],
    meta: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (params === null) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    api
      .get<Paginated<T>>(path, { params: clean(params), signal: controller.signal })
      .then(({ data }) => {
        setState({ data: data.data, meta: data.meta, loading: false, error: null });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
```

### `absensi-wfh/frontend/src/hooks/useServerClock.ts`
```ts
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

### Komponen UI dasar (gaya shadcn, token disesuaikan)

### `absensi-wfh/frontend/src/components/ui/button.tsx`
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
        primary: 'bg-accent text-white hover:bg-accent/90',
        secondary: 'border border-edge bg-card text-ink hover:bg-canvas',
        ghost: 'text-muted hover:bg-line/60 hover:text-ink',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
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

### `absensi-wfh/frontend/src/components/ui/input.tsx`
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

### `absensi-wfh/frontend/src/components/ui/textarea.tsx`
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

### `absensi-wfh/frontend/src/components/ui/label.tsx`
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

### `absensi-wfh/frontend/src/components/ui/select.tsx`
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

### `absensi-wfh/frontend/src/components/ui/badge.tsx`
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
        accent: 'bg-accent-soft text-accent',
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

### `absensi-wfh/frontend/src/components/ui/card.tsx`
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

### `absensi-wfh/frontend/src/components/ui/skeleton.tsx`
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

### `absensi-wfh/frontend/src/components/ui/dialog.tsx`
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
        className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-ink"
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

### Komponen aplikasi

### `absensi-wfh/frontend/src/components/FullPageLoader.tsx`
```tsx
import { Loader2 } from 'lucide-react';

export function FullPageLoader() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Memuat…
      </div>
    </div>
  );
}
```

### `absensi-wfh/frontend/src/components/PageHeader.tsx`
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

### `absensi-wfh/frontend/src/components/EmptyState.tsx`
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

### `absensi-wfh/frontend/src/components/ErrorState.tsx`
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

### `absensi-wfh/frontend/src/components/Pagination.tsx`
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

### `absensi-wfh/frontend/src/components/AuthedImage.tsx`
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

### `absensi-wfh/frontend/src/components/LiveClock.tsx`
```tsx
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
    <Card className={cn('flex flex-col justify-between p-6', className)}>
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
    </Card>
  );
}
```

### `absensi-wfh/frontend/src/components/PhotoDropzone.tsx`
```tsx
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
            'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent',
            dragging && 'border-accent bg-accent-soft',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <ImagePlus className="size-7 text-accent" aria-hidden />
          <p className="text-sm font-medium text-ink">
            Tarik foto ke sini atau pilih dari perangkat
          </p>
          <p className="text-xs text-muted">JPG, PNG, atau WebP · maksimal 3 MB</p>
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          {/* Stempel pratinjau: waktu resmi tetap dari server */}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Pratinjau</p>
            <p className="font-display text-base leading-tight tabular-nums sm:text-lg">
              {formatDateShort(now)} · {formatTime(now)}
            </p>
            <p className="truncate text-xs font-medium">{stampName}</p>
          </div>

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

### Layout

### `absensi-wfh/frontend/src/layouts/AppShell.tsx`
```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarCheck, ClipboardList, LogOut, Users } from 'lucide-react';
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
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-md bg-accent text-white">
                <CalendarCheck className="size-4" aria-hidden />
              </div>
              <span className="font-display text-lg leading-none">Absensi WFH</span>
            </div>

            {user.role === 'ADMIN_HRD' && (
              <nav aria-label="Navigasi utama" className="flex items-center gap-1">
                {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent-soft text-accent'
                          : 'text-muted hover:bg-line/60 hover:text-ink',
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
```

### Halaman

### `absensi-wfh/frontend/src/pages/LoginPage.tsx`
```tsx
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CalendarCheck,
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
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-accent text-white">
            <CalendarCheck className="size-5" aria-hidden />
          </div>
          <span className="font-display text-xl">Absensi WFH</span>
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

        <p className="text-xs text-muted">Alat internal HRD · zona waktu WIB (Asia/Jakarta)</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-9 place-items-center rounded-md bg-accent text-white">
              <CalendarCheck className="size-5" aria-hidden />
            </div>
            <span className="font-display text-xl">Absensi WFH</span>
          </div>

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
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
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
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
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

### `absensi-wfh/frontend/src/pages/employee/AttendancePage.tsx`
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
        <LiveClock now={now} status={status} className="lg:col-span-7" />

        {/* Profil singkat */}
        <Card className="p-6 lg:col-span-5">
          <div className="flex items-start gap-4">
            <div
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent"
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
                    <CheckCircle2 aria-hidden /> Hadir · {formatTimeShort(todayRecord.checkInAt)}
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
        <Card className="p-6 lg:col-span-7">
          <CardTitle>Absen hari ini</CardTitle>

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
              <AuthedImage
                attendanceId={todayRecord.id}
                alt="Foto bukti kerja hari ini"
                className="mt-4 aspect-[4/3] w-full rounded-lg border border-line"
              />
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
        <Card className="lg:col-span-5">
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

### `absensi-wfh/frontend/src/pages/admin/EmployeeFormDialog.tsx`
```tsx
import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getErrorMessage, getStatus } from '@/lib/errors';
import type { Employee, Role } from '@/lib/types';

interface Props {
  /** null = mode tambah */
  employee: Employee | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  nik: string;
  fullName: string;
  email: string;
  password: string;
  position: string;
  role: Role;
  isActive: boolean;
}

const MIN_PASSWORD = 8;

export function EmployeeFormDialog({ employee, onClose, onSaved }: Props) {
  const isEdit = employee !== null;
  const [form, setForm] = useState<FormState>({
    nik: employee?.nik ?? '',
    fullName: employee?.fullName ?? '',
    email: employee?.email ?? '',
    password: '',
    position: employee?.position ?? '',
    role: employee?.role ?? 'EMPLOYEE',
    isActive: employee?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nik.trim() || !form.fullName.trim() || !form.email.trim() || !form.position.trim()) {
      setError('NIK, nama lengkap, email, dan jabatan wajib diisi.');
      return;
    }
    if (!isEdit && form.password.length < MIN_PASSWORD) {
      setError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`);
      return;
    }
    if (isEdit && form.password && form.password.length < MIN_PASSWORD) {
      setError(`Kata sandi baru minimal ${MIN_PASSWORD} karakter.`);
      return;
    }

    const payload: Record<string, unknown> = {
      nik: form.nik.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      position: form.position.trim(),
      role: form.role,
    };
    if (form.password) payload.password = form.password;

    setSubmitting(true);
    try {
      if (employee) {
        payload.isActive = form.isActive;
        await api.patch(`/employees/${employee.id}`, payload);
        onSaved('Data karyawan berhasil diperbarui.');
      } else {
        await api.post('/employees', payload);
        onSaved('Karyawan baru berhasil ditambahkan.');
      }
    } catch (err) {
      setError(
        getStatus(err) === 409
          ? 'NIK atau email sudah dipakai karyawan lain.'
          : getErrorMessage(err),
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{isEdit ? 'Ubah data karyawan' : 'Tambah karyawan'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Perbarui data karyawan. Kosongkan kata sandi jika tidak ingin mengubahnya.'
            : 'Buat akun baru untuk karyawan. Kata sandi dapat diubah kemudian.'}
        </DialogDescription>

        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-nik">NIK</Label>
              <Input
                id="f-nik"
                value={form.nik}
                onChange={(e) => set('nik', e.target.value)}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-position">Jabatan</Label>
              <Input
                id="f-position"
                value={form.position}
                onChange={(e) => set('position', e.target.value)}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-name">Nama lengkap</Label>
            <Input
              id="f-name"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-email">Email</Label>
            <Input
              id="f-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-password">
                {isEdit ? 'Kata sandi baru (opsional)' : 'Kata sandi'}
              </Label>
              <Input
                id="f-password"
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="new-password"
                placeholder={isEdit ? 'Biarkan kosong' : `Min. ${MIN_PASSWORD} karakter`}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-role">Peran</Label>
              <Select
                id="f-role"
                value={form.role}
                onChange={(e) => set('role', e.target.value as Role)}
                disabled={submitting}
              >
                <option value="EMPLOYEE">Karyawan</option>
                <option value="ADMIN_HRD">Admin HRD</option>
              </Select>
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                disabled={submitting}
                className="size-4 accent-[rgb(var(--color-accent))]"
              />
              Akun aktif (dapat login)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### `absensi-wfh/frontend/src/pages/admin/EmployeesPage.tsx`
```tsx
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Plus, Search, UserX, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiList } from '@/hooks/useApiList';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { roleLabel } from '@/lib/format';
import type { Employee } from '@/lib/types';
import { EmployeeFormDialog } from './EmployeeFormDialog';

type DialogState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
const TD = 'px-4 py-2.5 align-middle';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const search = useDebounce(searchInput.trim(), 400);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [target, setTarget] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useApiList<Employee>('/employees', {
    page,
    limit: 10,
    search: search || undefined,
    role: role || undefined,
    is_active: active || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  async function confirmDeactivate() {
    if (!target) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await api.delete(`/employees/${target.id}`);
      setNotice(`${target.fullName} dinonaktifkan.`);
      setTarget(null);
      list.refetch();
    } catch (err) {
      setDeactivateError(getErrorMessage(err));
    } finally {
      setDeactivating(false);
    }
  }

  const hasFilter = Boolean(searchInput || role || active);

  return (
    <>
      <PageHeader
        title="Data Karyawan"
        description="Kelola akun karyawan: tambah, ubah, atau nonaktifkan. Karyawan nonaktif tidak bisa login."
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus /> Tambah karyawan
          </Button>
        }
      />

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-md border border-present/30 bg-present-soft px-3 py-2 text-sm text-present"
        >
          <CheckCircle2 className="size-4" aria-hidden /> {notice}
        </div>
      )}

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_180px_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="q">Cari</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                id="q"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nama, NIK, atau email"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Peran</Label>
            <Select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua peran</option>
              <option value="EMPLOYEE">Karyawan</option>
              <option value="ADMIN_HRD">Admin HRD</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </div>
        </div>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th scope="col" className={TH}>NIK</th>
                  <th scope="col" className={TH}>Karyawan</th>
                  <th scope="col" className={TH}>Jabatan</th>
                  <th scope="col" className={TH}>Peran</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={`${TH} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.loading && list.data.length === 0
                  ? [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        {[0, 1, 2, 3, 4, 5].map((c) => (
                          <td key={c} className={TD}>
                            <Skeleton className="h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : list.data.map((emp) => (
                      <tr key={emp.id} className="hover:bg-canvas/70">
                        <td className={`${TD} tabular-nums`}>{emp.nik}</td>
                        <td className={TD}>
                          <p className="font-medium">{emp.fullName}</p>
                          <p className="text-xs text-muted">{emp.email}</p>
                        </td>
                        <td className={TD}>{emp.position}</td>
                        <td className={TD}>
                          <Badge variant={emp.role === 'ADMIN_HRD' ? 'accent' : 'neutral'}>
                            {roleLabel(emp.role)}
                          </Badge>
                        </td>
                        <td className={TD}>
                          <Badge variant={emp.isActive ? 'present' : 'neutral'}>
                            {emp.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className={`${TD} text-right`}>
                          <div className="inline-flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDialog({ mode: 'edit', employee: emp })}
                            >
                              <Pencil /> Ubah
                            </Button>
                            {emp.isActive && (
                              <Button
                                variant="danger-ghost"
                                size="sm"
                                disabled={emp.id === user?.id}
                                title={
                                  emp.id === user?.id
                                    ? 'Kamu tidak dapat menonaktifkan akunmu sendiri'
                                    : undefined
                                }
                                onClick={() => {
                                  setDeactivateError(null);
                                  setTarget(emp);
                                }}
                              >
                                <UserX /> Nonaktifkan
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!list.loading && list.data.length === 0 && (
              <EmptyState
                icon={Users}
                title={hasFilter ? 'Tidak ada karyawan yang cocok' : 'Belum ada data karyawan'}
                description={
                  hasFilter
                    ? 'Coba ubah kata kunci atau hapus filter.'
                    : 'Tambahkan karyawan pertama untuk mulai memakai aplikasi.'
                }
                action={
                  !hasFilter && (
                    <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
                      <Plus /> Tambah karyawan
                    </Button>
                  )
                }
              />
            )}
          </div>
        )}

        {!list.error && <Pagination meta={list.meta} onPage={setPage} disabled={list.loading} />}
      </Card>

      {dialog && (
        <EmployeeFormDialog
          key={dialog.mode === 'edit' ? dialog.employee.id : 'new'}
          employee={dialog.mode === 'edit' ? dialog.employee : null}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            setNotice(message);
            list.refetch();
          }}
        />
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deactivating) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Nonaktifkan karyawan?</DialogTitle>
          <DialogDescription>
            {target?.fullName} tidak akan bisa login lagi. Riwayat absensinya tetap tersimpan, dan
            akun bisa diaktifkan kembali lewat menu Ubah.
          </DialogDescription>
          {deactivateError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {deactivateError}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={deactivating}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDeactivate} disabled={deactivating}>
              {deactivating && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Nonaktifkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### `absensi-wfh/frontend/src/pages/admin/AttendanceMonitorPage.tsx`
```tsx
import { useEffect, useState } from 'react';
import { ClipboardList, RotateCcw, Search } from 'lucide-react';
import { AuthedImage } from '@/components/AuthedImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiList } from '@/hooks/useApiList';
import { useDebounce } from '@/hooks/useDebounce';
import { formatTime, formatYmd } from '@/lib/format';
import type { AttendanceWithEmployee } from '@/lib/types';

const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
const TD = 'px-4 py-2.5 align-middle';

export default function AttendanceMonitorPage() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameInput, setNameInput] = useState('');
  const name = useDebounce(nameInput.trim(), 400);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const list = useApiList<AttendanceWithEmployee>(
    '/attendances',
    rangeInvalid
      ? null
      : {
          page,
          limit: 10,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          employee_name: name || undefined,
        },
  );

  useEffect(() => {
    setPage(1);
  }, [name]);

  const hasFilter = Boolean(dateFrom || dateTo || nameInput);

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setNameInput('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Absensi Karyawan"
        description="Pantau absensi WFH yang sudah dikirim karyawan. Data hanya untuk dilihat."
      />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto] lg:items-end">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="name">Nama karyawan</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                id="name"
                type="search"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Cari nama karyawan"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">Dari tanggal</Label>
            <Input
              id="from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              aria-invalid={rangeInvalid}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Sampai tanggal</Label>
            <Input
              id="to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              aria-invalid={rangeInvalid}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="secondary" onClick={resetFilters} disabled={!hasFilter}>
            <RotateCcw /> Atur ulang
          </Button>
        </div>

        {rangeInvalid ? (
          <div role="alert" className="px-6 py-10 text-center text-sm text-danger">
            Tanggal awal tidak boleh lebih besar dari tanggal akhir.
          </div>
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th scope="col" className={TH}>Tanggal</th>
                  <th scope="col" className={TH}>Jam masuk</th>
                  <th scope="col" className={TH}>Karyawan</th>
                  <th scope="col" className={TH}>Catatan</th>
                  <th scope="col" className={TH}>Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.loading && list.data.length === 0
                  ? [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        {[0, 1, 2, 3, 4].map((c) => (
                          <td key={c} className={TD}>
                            <Skeleton className="h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : list.data.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas/70">
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>
                          {formatYmd(row.attendanceDate)}
                        </td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>
                          {formatTime(row.checkInAt)}
                          <span className="ml-1 text-xs text-muted">WIB</span>
                        </td>
                        <td className={TD}>
                          <p className="font-medium">{row.employee.fullName}</p>
                          <p className="text-xs text-muted">
                            <span className="tabular-nums">{row.employee.nik}</span> ·{' '}
                            {row.employee.position}
                          </p>
                        </td>
                        <td className={`${TD} max-w-[260px]`}>
                          {row.notes ? (
                            <span className="line-clamp-2" title={row.notes}>
                              {row.notes}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className={TD}>
                          <AuthedImage
                            attendanceId={row.id}
                            alt={`Foto absen ${row.employee.fullName}, ${formatYmd(row.attendanceDate)}`}
                            className="size-11 rounded-md border border-line"
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!list.loading && list.data.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title={hasFilter ? 'Tidak ada absensi yang cocok' : 'Belum ada absensi'}
                description={
                  hasFilter
                    ? 'Coba perluas rentang tanggal atau ubah nama yang dicari.'
                    : 'Absensi akan muncul di sini setelah karyawan mengirimnya.'
                }
              />
            )}
          </div>
        )}

        {!rangeInvalid && !list.error && (
          <Pagination meta={list.meta} onPage={setPage} disabled={list.loading} />
        )}
      </Card>
    </>
  );
}
```

---

## Review terhadap larangan desain (hasil membaca ulang kode, bukan uji di browser)

Catat ini sebagai acuan saat revisi UI dengan plugin UI/UX dan antislop nanti.

| Larangan | Hasil | Catatan |
|---|---|---|
| Gradasi ungu-biru | Tidak ada. Semua latar warna solid dari token. | – |
| Tiga kartu identik | Bento memakai empat kartu dengan isi dan lebar berbeda (7/5/7/5). Login memakai daftar teks biasa, bukan kartu. | – |
| Emoji sebagai ikon UI | Semua ikon dari Lucide. Karakter `·` hanya pemisah teks. | – |
| Glassmorphism | Tidak ada blur atau transparansi bertumpuk. Overlay dialog berupa warna solid `ink/40`. Stempel foto memakai latar putih solid. | – |
| Bayangan berat | Tidak ada `shadow-*`. Pemisahan lewat border 1px. | – |
| Lorem ipsum | Tidak ada. | – |
| Kontras WCAG AA | Dihitung manual, belum diuji dengan alat. Teks sekunder `#6B665E` di atas `#F7F5F0` sekitar 5,2:1. Putih di atas terrakota sekitar 5,4:1. Hijau sage dan merah `danger` di atas latar lembutnya ≥ 4,5:1. | Border `#E4DFD5` terlalu pucat untuk batas kontrol input (butuh 3:1), jadi ada token `edge` `#8F897E` untuk Input, Select, Textarea, dan dropzone. Token `line` hanya untuk pemisah dekoratif. |
| Responsif HP | Jam memakai `text-5xl` di HP agar tidak meluber, lalu membesar di `sm`. Tabel HRD dibungkus `overflow-x-auto`. | Awalnya jam `text-6xl` dan melebihi lebar kartu 360 px, sudah diperkecil. |
| Gaya default shadcn | CLI shadcn tidak dipakai. Komponen ditulis ulang dengan pola yang sama (cva, Radix, `cn`) dan token sendiri. | – |

---

## Cara menjalankan

```bash
# dari root repo
docker compose up -d

# terminal 1: backend (setelah menambah TimeModule)
cd backend
npm run start:dev

# terminal 2: frontend
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. Swagger ada di http://localhost:3000/api/docs. Akun demo: `admin@company.test` / `Admin123!` dan `budi@company.test` / `Karyawan123!`.

Cek kompilasi frontend sebelum uji manual:

```bash
cd frontend
npm run typecheck
npm run build
```

## Cara mengetes

1. **Waktu server:** buka `GET http://localhost:3000/api/time` di browser. Hasilnya harus `{now, timeZone:"Asia/Jakarta", date}`.
2. **Login karyawan:** klik "Isi sebagai Karyawan", lalu Masuk. Anda diarahkan ke `/absensi`. Jam harus berlabel "Sinkron dengan server".
3. **Absen:**
   - Pilih atau tarik foto. Stempel "Pratinjau" muncul dengan tanggal, jam, dan nama.
   - Coba file `.pdf` atau file >3 MB; harus ditolak dengan pesan merah.
   - Kirim absen. Kartu berubah menjadi "Absen hari ini sudah tercatat" dengan foto, dan badge profil menjadi "Hadir".
   - Muat ulang halaman; status tetap "Hadir". Riwayat menampilkan thumbnail.
4. **Satu absen per hari:** untuk menguji 409 lewat UI, hapus baris absen hari ini di DB lalu coba lagi, atau uji langsung via Swagger.
5. **Role guard:** saat login sebagai karyawan, buka `/admin/karyawan`; harus dialihkan ke `/absensi`.
6. **Login HRD:** keluar, lalu masuk dengan akun admin. Anda diarahkan ke `/admin/karyawan`.
   - Tambah karyawan dengan NIK atau email yang sudah ada; harus muncul pesan duplikat (409).
   - Ubah data, nonaktifkan, dan aktifkan kembali lewat Ubah.
   - Uji filter, pencarian, dan paginasi.
7. **Monitoring HRD:** buka `/admin/absensi`.
   - Filter tanggal dan nama harus bekerja.
   - Isi "Dari" lebih besar dari "Sampai"; harus muncul pesan error, bukan request.
8. **Akun nonaktif:** nonaktifkan `budi@company.test`, lalu coba login; harus muncul "Akun kamu nonaktif".
9. **Token kedaluwarsa:** hapus `absensi.token` dari localStorage atau ubah nilainya, lalu muat ulang. Anda kembali ke `/login`.
