# Fase 4: Frontend ADMIN_HRD (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Buat setiap file baru pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya, lalu timpa file Fase 3 yang disebut di bagian 2, dan hapus file lama di bagian 3. Buat folder yang belum ada. Fase 1, 2, dan 3 sudah terpasang.

Catatan penting:
- Tidak ada dependensi npm baru. Tidak perlu `npm i`.
- Halaman baru hanya bergantung pada komponen `ui/*` dari Fase 3 (`Button`, `Input`, `Label`, `Select`, `Badge`, `Skeleton`, `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`; semuanya named export) dan `cn` dari `@/lib/utils`.
- Alias `@/` harus mengarah ke `frontend/src` (sudah dikonfigurasi di Fase 3).
- Token warna Tailwind yang dipakai: `canvas`, `card`, `ink`, `muted`, `line`, `accent`, `accent-soft`, `accent-ink`, `danger`. Varian `Button`: `secondary`, `ghost`, `danger`, `danger-ghost`, ukuran `sm`. Varian `Badge`: `neutral`, `accent`, `present`. Jika komponen Fase 3 tidak punya varian tersebut, sesuaikan di komponen `ui/*`, bukan di file di bawah.

Asumsi tentang backend (semuanya terpusat di `lib/hrdApi.ts`, jadi mudah diubah):
- Respons list: `{ data, meta: { page, limit, total, totalPages } }`. Normalizer juga menerima `items` dan nama snake_case.
- Body dan respons employee memakai camelCase (`fullName`, `isActive`). Normalizer respons menerima snake_case juga.
- `GET /employees` menerima `page`, `limit`, `search`.
- `GET /attendances` menerima `date_from`, `date_to`, `employee_name`, `page`, `limit`.
- `POST /auth/login` mengembalikan `accessToken` (atau `access_token` / `token`).
- `GET /auth/me` mengembalikan data user (atau `{ user: {...} }`).

---

## 0. Dependensi tambahan

Tidak ada.

---

## 1. File baru

### `absensi-wfh/frontend/src/lib/hrdApi.ts`
```ts
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

### `absensi-wfh/frontend/src/lib/hrdFormat.ts`
```ts
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

### `absensi-wfh/frontend/src/hooks/useDebouncedValue.ts`
```ts
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### `absensi-wfh/frontend/src/hooks/usePagedQuery.ts`
```ts
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

### `absensi-wfh/frontend/src/hooks/useProtectedImage.ts`
```ts
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

### `absensi-wfh/frontend/src/components/icons.tsx`
```tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

export const UserXIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m17 8 5 5M22 8l-5 5" />
  </Svg>
);

export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Svg>
);

export const InboxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </Svg>
);
```

### `absensi-wfh/frontend/src/components/PageSpinner.tsx`
```tsx
export function PageSpinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin"
      />
      {label}
    </div>
  );
}
```

### `absensi-wfh/frontend/src/components/StatusBanner.tsx`
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

### `absensi-wfh/frontend/src/components/DataTable.tsx`
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

### `absensi-wfh/frontend/src/components/PhotoLightbox.tsx`
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

### `absensi-wfh/frontend/src/components/EmployeeFormModal.tsx`
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

### `absensi-wfh/frontend/src/components/ConfirmDeactivateDialog.tsx`
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

### `absensi-wfh/frontend/src/pages/hrd/EmployeesPage.tsx`
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

### `absensi-wfh/frontend/src/pages/hrd/MonitoringPage.tsx`
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

### `absensi-wfh/frontend/src/pages/NotFoundPage.tsx`
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

## 2. Timpa file Fase 3 (ganti seluruh isi dengan kode di bawah)

### `absensi-wfh/frontend/src/lib/api.ts`
```ts
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

### `absensi-wfh/frontend/src/auth/ProtectedRoute.tsx`
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

### `absensi-wfh/frontend/src/layouts/AppShell.tsx`
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

### `absensi-wfh/frontend/src/App.tsx`
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

### `absensi-wfh/frontend/src/main.tsx`
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/fraunces";
import "./index.css";
import App from "./App";
import { AuthProvider } from "@/auth/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

---

## 3. Hapus file lama (digantikan halaman baru)

Hapus tiga file berikut (jika ada):
- `absensi-wfh/frontend/src/pages/admin/EmployeesPage.tsx`
- `absensi-wfh/frontend/src/pages/admin/EmployeeFormDialog.tsx`
- `absensi-wfh/frontend/src/pages/admin/AttendanceMonitorPage.tsx`

Setelah itu, jika folder `absensi-wfh/frontend/src/pages/admin/` kosong, hapus juga foldernya. Cari sisa import ke file-file tersebut dengan `grep -rn "pages/admin" absensi-wfh/frontend/src` dan pastikan hasilnya kosong.

---

## 4. Verifikasi build

```bash
cd absensi-wfh/frontend
npm run typecheck && npm run build   # harus 0 error
```

Jika `typecheck` mengeluh soal:
- nama export atau prop komponen `ui/*` (mis. varian `danger-ghost`, `present`), sesuaikan di komponen `ui/*` Fase 3;
- signature `login`/`useAuth` di `LoginPage`, sesuaikan `LoginPage` agar memakai `{ user, isLoading, login, logout }` dengan `login(email, password): Promise<AuthUser>`;
- nama field API yang berbeda (mis. `meta`), perbaiki di `lib/hrdApi.ts` saja.

---

## 5. Perintah menjalankan

```bash
# dari root repo
docker compose up -d                 # MySQL

cd backend
npm install
npm run start:dev                    # API di http://localhost:3000/api (Swagger: /api/docs)

# terminal lain
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

---

## 6. Cara mengetes: skenario end-to-end

Akun demo: `admin@company.test / Admin123!` dan `budi@company.test / Karyawan123!`. Gunakan satu jendela biasa dan satu jendela incognito agar bisa berganti peran dengan cepat.

**A. Login dan pengalihan per role**
1. Login sebagai budi. Diarahkan ke `/absensi`, navigasi hanya berisi "Absensi".
2. Logout, lalu login sebagai admin. Diarahkan ke `/hrd/employees`, navigasi berisi "Master karyawan" dan "Monitoring absensi".
3. Header menampilkan nama user dan badge peran pada kedua akun. Tombol "Keluar" mengembalikan ke `/login`.

**B. Karyawan absen**
1. Login sebagai budi, pilih foto JPG/PNG/WebP (< 3 MB), isi catatan, lalu submit. Absen tercatat dengan jam server.
2. Submit absen kedua di hari yang sama. Harus ditolak dengan pesan dari server (409).
3. Ubah jam laptop. Jam yang tercatat tetap jam server (WIB).
4. Untuk mengulang tes di hari yang sama, hapus baris budi di tabel `attendances` lewat MySQL client.

**C. HRD melihat hasilnya**
1. Login sebagai admin, buka `/hrd/monitoring`. Baris budi muncul dengan NIK, nama, tanggal, jam berakhiran WIB, catatan, dan thumbnail.
2. Klik thumbnail. Lightbox terbuka dan foto tampil (di tab Network, request `/attendances/:id/photo` membawa header Authorization). Esc dan tombol "Tutup" menutupnya.
3. Buka URL foto langsung di tab baru tanpa token. Hasilnya 401, bukan gambar.
4. Tidak ada tombol ubah atau hapus di halaman ini.

**D. Karyawan tidak bisa membuka halaman HRD**
1. Login sebagai budi, ketik `/hrd/employees` dan `/hrd/monitoring` di address bar. Keduanya langsung diarahkan ke `/absensi`.
2. Rute lama `/admin/karyawan` juga mengarah ke `/absensi` untuk budi.
3. Cek lapisan API (kontrol sebenarnya ada di backend):
   ```bash
   TOKEN_BUDI=$(curl -s -X POST localhost:3000/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"budi@company.test","password":"Karyawan123!"}' | jq -r '.accessToken // .access_token')
   curl -i -H "Authorization: Bearer $TOKEN_BUDI" localhost:3000/api/employees     # 403
   curl -i -H "Authorization: Bearer $TOKEN_BUDI" localhost:3000/api/attendances   # 403
   ```
4. Login sebagai admin lalu buka `/absensi`. Admin diarahkan ke `/hrd/employees`.
5. Tanpa login, buka `/hrd/monitoring`. Diarahkan ke `/login`.

**E. CRUD master karyawan (admin)**
1. Klik "Tambah karyawan" lalu submit kosong. Pesan validasi per field muncul dan fokus pindah ke field pertama yang salah. Password wajib saat tambah dan minimal 8 karakter.
2. Isi data valid. Karyawan muncul di tabel dan banner sukses tampil.
3. Tambah dengan NIK atau email yang sudah ada. Banner error dari server muncul di dalam modal.
4. Ubah karyawan tanpa mengisi password. Tersimpan, dan password lama tetap berlaku.
5. Cari dengan nama, NIK, atau email. Hasil terfilter setelah jeda sekitar 0,4 detik. Kata kunci ngawur menampilkan state kosong dengan tombol "Hapus pencarian".
6. Klik "Nonaktifkan" lalu "Batal". Tidak terjadi apa-apa. Klik lagi lalu "Nonaktifkan". Status menjadi Nonaktif dan tombol nonaktif disabled.
7. Coba login dengan akun yang dinonaktifkan. Harus ditolak.
8. Ubah akun itu, centang "Akun aktif", simpan. Akun bisa login lagi.
9. Baris admin sendiri: tombol Nonaktifkan disabled, peran dan status aktif di form ubah terkunci.
10. Tambah lebih dari 10 karyawan untuk mencoba paginasi (Sebelumnya, Berikutnya, teks "Menampilkan x-y dari n").

**F. Filter monitoring**
1. Filter nama "budi". Hanya baris budi yang tampil dan paginasi kembali ke halaman 1.
2. Filter rentang tanggal yang mencakup dan yang tidak mencakup hari ini. Yang kedua menampilkan state kosong dengan tombol "Reset filter".
3. Isi "Dari" lebih besar dari "Sampai". Pesan error muncul dan tidak ada request baru.

**G. State error dan sesi**
1. Hentikan backend lalu muat ulang atau ganti filter. Panel error "Tidak dapat terhubung ke server" muncul dengan tombol "Coba lagi". Jalankan backend lagi dan klik "Coba lagi", data muncul.
2. Di DevTools, ubah nilai `absensi.token` di localStorage menjadi sembarang string lalu klik menu lain. Response 401 membuat otomatis kembali ke `/login`.

**H. Responsif dan aksesibilitas**
1. Lebar 375 px: navigasi bisa digeser horizontal, kolom Jabatan, Peran, dan Catatan tersembunyi, tombol aksi berupa ikon dengan target sentuh 44 px, halaman tidak scroll ke samping.
2. Tab dengan keyboard: link "Lewati ke konten" muncul, thumbnail bisa difokus dan dibuka dengan Enter, fokus dialog terkunci di dalam modal.

---

## 7. Ringkasan file

**Baru:**
`lib/hrdApi.ts`, `lib/hrdFormat.ts`, `hooks/useDebouncedValue.ts`, `hooks/usePagedQuery.ts`, `hooks/useProtectedImage.ts`, `components/icons.tsx`, `components/PageSpinner.tsx`, `components/StatusBanner.tsx`, `components/DataTable.tsx`, `components/PhotoLightbox.tsx`, `components/EmployeeFormModal.tsx`, `components/ConfirmDeactivateDialog.tsx`, `pages/hrd/EmployeesPage.tsx`, `pages/hrd/MonitoringPage.tsx`, `pages/NotFoundPage.tsx`

**Ditimpa:**
`lib/api.ts`, `auth/AuthContext.tsx`, `auth/ProtectedRoute.tsx`, `layouts/AppShell.tsx`, `App.tsx`, `main.tsx`

**Dihapus:**
`pages/admin/EmployeesPage.tsx`, `pages/admin/EmployeeFormDialog.tsx`, `pages/admin/AttendanceMonitorPage.tsx`

(Semua path relatif terhadap `absensi-wfh/frontend/src/`.)

---

## 8. Keputusan default

- **Aset Fase 3 tidak dipakai ulang:** `PageHeader`, `EmptyState`, `ErrorState`, `Pagination`, dan `AuthedImage` tidak dipakai. `DataTable` membawa state kosong, error, dan paginasinya sendiri. Ikon berupa SVG inline, tidak bergantung pada lucide-react.
- **Kontrak `AuthContext`:** `useAuth()` mengembalikan `{ user, isLoading, login, logout }`.
- **Pagination:** ukuran halaman 10, tanpa pilihan ukuran.
- **Thumbnail:** dimuat dalam ukuran penuh (maks 3 MB per foto, 10 per halaman). Jika terasa berat, solusi bersihnya adalah endpoint thumbnail di backend (di luar scope fase ini).
- **Akun admin sendiri:** tidak bisa menonaktifkan akun sendiri atau mengubah peran dan status akun sendiri. Aturan ini hanya di frontend, tambahkan juga di backend bila perlu.
- **Rute lama** `/admin/*` diarahkan ke `/hrd/*`.
