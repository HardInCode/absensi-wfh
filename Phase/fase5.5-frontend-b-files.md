# Kumpulan File Fase 5.5-B & C (Frontend Monitoring, Summary & Export)

Dokumen ini berisi kode lengkap tanpa ringkasan atau potongan untuk komponen, halaman, API client, design token frontend yang terkait dengan monitoring absensi, serta referensi kontrak DTO/controller backend API Gateway.

## Daftar Isi
1. [frontend/src/pages/hrd/MonitoringPage.tsx](#1-frontendsrchrdmonitoringpagetsx) - Halaman monitoring absensi HRD (tabel, filter, lightbox foto).
2. [frontend/src/lib/types.ts](#2-frontendsrctypests) - Definisi tipe TypeScript untuk Attendance, AttendanceStatus, Employee, dan Settings.
3. [frontend/src/lib/api.ts](#3-frontendsrclapits) - Axios instance utama (`baseURL`, token bearer interceptor, 401 handler).
4. [frontend/src/lib/hrdApi.ts](#4-frontendsrclibhrdapits) - API client untuk kebutuhan HRD (pemanggilan `/attendances`, photo blob, mapper, error handler).
5. [frontend/src/components/DataTable.tsx](#5-frontendsrccomponentsdatatabletsx) - Komponen tabel paginasi reusable dengan penanganan loading skeleton, error state, dan empty state.
6. [frontend/src/components/AttendanceStatusBadge.tsx](#6-frontendsrccomponentsattendancestatusbadgetsx) - Komponen badge status kehadiran (Tepat waktu vs Terlambat + menit).
7. [frontend/src/components/StatusBanner.tsx](#7-frontendsrccomponentsstatusbannertsx) - Komponen banner notifikasi / inline toast dengan auto-dismiss 6 detik.
8. [frontend/src/lib/hrdFormat.ts](#8-frontendsrclibhrdformatts) - Helper format tanggal dan jam WIB untuk tampilan HRD.
9. [frontend/src/lib/format.ts](#9-frontendsrclibformatts) - Format waktu standar aplikasi (`HH:mm:ss` dengan titik dua, zona waktu Asia/Jakarta).
10. [frontend/src/index.css](#10-frontendsrcindexcss) - Variabel design token CSS ("Warm Editorial Workspace", warna kanvas, garis, aksen, dan radius).
11. [frontend/tailwind.config.ts](#11-frontendtailwindconfigts) - Konfigurasi Tailwind CSS yang memetakan design token CSS ke utility classes.
12. [frontend/package.json](#12-frontendpackagejson) - Dependensi frontend (React 18, Vite, Lucide, Tailwind, Axios).
13. [backend/apps/api-gateway/src/attendances/attendances.controller.ts](#13-backendappsapi-gatewaysrcattendancesattendancescontrollerts) - Controller gateway endpoint absensi (`/summary`, `/export`, `/settings`, `GET /attendances`, photo stream).
14. [backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts](#14-backendappsapi-gatewaysrcattendancesdtoattendancedtots) - Seluruh DTO request & response absensi (query filter status, export query, summary DTO, list DTO).
15. [backend/libs/common/src/interfaces/attendance.interface.ts](#15-backendlibscommonsrcinterfacesattendanceinterfacets) - Interface kontrak absensi antar-layanan (AttendanceRecord, DailyStatsPayload, DailyStatsResult).
16. [backend/apps/api-gateway/src/main.ts (Bagian CORS)](#16-backendappsapi-gatewaysrcmaints-bagian-cors) - Konfigurasi CORS gateway (`exposedHeaders: ['Content-Disposition', 'X-Export-Truncated']`).

---

### 1. `frontend/src/pages/hrd/MonitoringPage.tsx`
```tsx
import { useState } from "react";
import { AttendanceStatusBadge } from "@/components/AttendanceStatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { ImageIcon, SearchIcon } from "@/components/icons";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/label";
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
      key: "status",
      header: "Status",
      cell: (a) => (
        <span className="whitespace-nowrap">
          <AttendanceStatusBadge status={a.status} lateMinutes={a.lateMinutes} />
        </span>
      ),
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

### 2. `frontend/src/lib/types.ts`
```ts
export type Role = 'EMPLOYEE' | 'ADMIN_HRD';

export type AttendanceStatus = 'ON_TIME' | 'LATE';

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
  status: AttendanceStatus;
  /** 0 jika tepat waktu. */
  lateMinutes: number;
}

export interface AttendanceWithEmployee extends Attendance {
  employee: Pick<Employee, 'id' | 'nik' | 'fullName' | 'email' | 'position'>;
}

/** Hari kerja memakai indeks JS: 0 = Minggu ... 6 = Sabtu. */
export interface AttendanceSettings {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: number;
  requireNoteWhenLate: boolean;
  workingDays: number[];
  /** Opsional: hanya terisi jika server mengirimnya. */
  updatedAt: string | null;
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

### 3. `frontend/src/lib/api.ts`
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

---

### 4. `frontend/src/lib/hrdApi.ts`
```ts
import axios from "axios";
import { api } from "@/lib/api";
import type { AttendanceSettings, AttendanceStatus } from "@/lib/types";

export type { AttendanceSettings, AttendanceStatus };

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
  status: AttendanceStatus;
  lateMinutes: number;
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
    status: pickStr(raw, "status") === "LATE" ? "LATE" : "ON_TIME",
    lateMinutes: pickNum(raw, "lateMinutes", "late_minutes") ?? 0,
    employee: {
      nik: pickStr(nested, "nik"),
      fullName: pickStr(nested, "fullName", "full_name", "employeeName", "employee_name"),
      position: pickStr(nested, "position"),
    },
  };
}

export function normalizeSettings(raw: unknown): AttendanceSettings {
  const root: Raw = isRecord(raw) ? raw : {};
  const days = Array.isArray(root.workingDays)
    ? root.workingDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  const updatedAt = pickStr(raw, "updatedAt", "updated_at");
  return {
    earliestCheckIn: pickStr(raw, "earliestCheckIn").slice(0, 5) || "00:00",
    defaultCutoffTime: pickStr(raw, "defaultCutoffTime").slice(0, 5) || "08:00",
    toleranceMinutes: pickNum(raw, "toleranceMinutes") ?? 0,
    requireNoteWhenLate: pickBool(raw, false, "requireNoteWhenLate"),
    workingDays: [...new Set(days)].sort((a, b) => a - b),
    updatedAt: updatedAt === "" ? null : updatedAt,
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

export type AttendanceSettingsInput = Partial<Omit<AttendanceSettings, "updatedAt">>;

export async function fetchAttendanceSettings(signal?: AbortSignal): Promise<AttendanceSettings> {
  const res = await api.get("/attendances/settings", { signal });
  return normalizeSettings(res.data);
}

export async function updateAttendanceSettings(input: AttendanceSettingsInput): Promise<AttendanceSettings> {
  const res = await api.patch("/attendances/settings", input);
  return normalizeSettings(res.data);
}
```

---

### 5. `frontend/src/components/DataTable.tsx`
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

### 6. `frontend/src/components/AttendanceStatusBadge.tsx`
```tsx
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AttendanceStatus } from '@/lib/types';

interface Props {
  status: AttendanceStatus;
  lateMinutes: number;
  className?: string;
}

export function AttendanceStatusBadge({ status, lateMinutes, className }: Props) {
  if (status === 'LATE') {
    return (
      <Badge variant="danger" className={className}>
        <Clock aria-hidden /> Terlambat (+{lateMinutes} mnt)
      </Badge>
    );
  }
  return (
    <Badge variant="present" className={className}>
      <CheckCircle2 aria-hidden /> Tepat waktu
    </Badge>
  );
}
```

---

### 7. `frontend/src/components/StatusBanner.tsx`
*(Komponen alert / toast notification bawaan proyek)*
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

### 8. `frontend/src/lib/hrdFormat.ts`
```ts
import { formatTime } from "@/lib/format";

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

/** ISO UTC -> "13:45:02" dalam WIB (titik dua, sama dengan halaman karyawan). */
export function formatTimeWib(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return formatTime(parsed);
}
```

---

### 9. `frontend/src/lib/format.ts`
```ts
import type { Role } from './types';

const TZ = 'Asia/Jakarta';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

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

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
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

/** HH:mm:ss dalam WIB, selalu dengan titik dua (satu-satunya format jam di aplikasi). */
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

/** Hari dalam seminggu menurut WIB: 0 = Minggu ... 6 = Sabtu. */
export function dayOfWeekWib(value: Date): number {
  return WEEKDAY_INDEX[weekdayFmt.format(value)] ?? 0;
}

/** Detik sejak 00:00:00 WIB. */
export function secondsOfDayWib(value: Date): number {
  const [h, m, s] = formatTime(value).split(':').map(Number);
  return h * 3600 + m * 60 + s;
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

### 10. `frontend/src/index.css`
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

### 11. `frontend/tailwind.config.ts`
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

### 12. `frontend/package.json`
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

### 13. `backend/apps/api-gateway/src/attendances/attendances.controller.ts`
```ts
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, Role } from '@app/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MAX_PHOTO_BYTES } from './attendances.constants';
import { AttendancesService } from './attendances.service';
import {
  AttendanceAdminListResponseDto,
  AttendanceListResponseDto,
  AttendanceResponseDto,
  AttendanceSettingsResponseDto,
  AttendanceSummaryResponseDto,
  CreateAttendanceDto,
  ExportAttendancesQueryDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  QuerySummaryDto,
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'jpg/png/webp, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 },
    }),
  )
  submit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendances.submit(user, photo, dto);
  }

  @Get('today')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceResponseDto, description: 'null jika belum absen' })
  today(@CurrentUser() user: AuthUser) {
    return this.attendances.today(user);
  }

  @Get(['my', 'me'])
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceListResponseDto })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryMyAttendancesDto) {
    return this.attendances.mine(user, query);
  }

  /** Tanpa @Roles: semua user login (EMPLOYEE dan ADMIN_HRD), sama seperti endpoint photo. */
  @Get('settings')
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  getSettings() {
    return this.attendances.getSettings();
  }

  @Patch('settings')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  updateSettings(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.attendances.updateSettings(dto);
  }

  @Get('summary')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSummaryResponseDto })
  summary(@Query() query: QuerySummaryDto) {
    return this.attendances.summary(query);
  }

  @Get('export')
  @Roles(Role.ADMIN_HRD)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description:
      'File CSV (UTF-8 dengan BOM), maks 5000 baris. Header X-Export-Truncated: true jika data terpotong.',
  })
  @Header('Cache-Control', 'private, no-store')
  async exportCsv(
    @Query() query: ExportAttendancesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { content, filename, truncated } = await this.attendances.exportCsv(query);
    res.setHeader('X-Export-Truncated', String(truncated));
    const body = Buffer.from(content, 'utf8');
    return new StreamableFile(body, {
      type: 'text/csv; charset=utf-8',
      length: body.length,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceAdminListResponseDto })
  list(@Query() query: QueryAttendancesDto) {
    return this.attendances.list(query);
  }

  @Get(':id/photo')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary image stream' })
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendances.openPhoto(user, id);
    return new StreamableFile(stream, { type: mime, length: size, disposition: 'inline' });
  }
}
```

---

### 14. `backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus, HM_REGEX } from '@app/common';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

const trimUpper = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAttendanceDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'WFH, mengerjakan modul laporan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryMyAttendancesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  // KOMPAT FRONTEND: alias snake_case dari frontend Fase 3/4.
  @ApiPropertyOptional({ description: 'Alias dari dateFrom', example: '2026-11-01' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_from must be in YYYY-MM-DD format' })
  date_from?: string;

  @ApiPropertyOptional({ description: 'Alias dari dateTo', example: '2026-11-30' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_to must be in YYYY-MM-DD format' })
  date_to?: string;
}

export class QueryAttendancesDto extends QueryMyAttendancesDto {
  @ApiPropertyOptional({ description: 'Filter satu karyawan' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Cari nama atau NIK karyawan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  // KOMPAT FRONTEND: alias dari search.
  @ApiPropertyOptional({ description: 'Alias dari search' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  employee_name?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  @IsOptional()
  @Transform(trimUpper)
  @IsEnum(AttendanceStatus, { message: 'status harus ON_TIME atau LATE' })
  status?: AttendanceStatus;
}

/** Filter export = filter daftar HRD tanpa paginasi (selalu halaman 1, maks 5000 baris). */
export class ExportAttendancesQueryDto extends OmitType(QueryAttendancesDto, [
  'page',
  'limit',
] as const) {}

export class QuerySummaryDto {
  @ApiPropertyOptional({
    example: '2026-11-04',
    description: 'YYYY-MM-DD (WIB). Default: hari ini WIB.',
  })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date harus berformat YYYY-MM-DD' })
  date?: string;
}

/** PATCH parsial: kirim hanya field yang ingin diubah. */
export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ example: '06:00', description: 'Jam mulai absen diperbolehkan (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  @Matches(HM_REGEX, { message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  earliestCheckIn?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Batas jam masuk (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  @Matches(HM_REGEX, { message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  defaultCutoffTime?: string;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt({ message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Min(0, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Max(120, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  toleranceMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'requireNoteWhenLate harus berupa true atau false' })
  requireNoteWhenLate?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0 = Minggu ... 6 = Sabtu, tanpa duplikat, minimal 1 hari',
  })
  @IsOptional()
  @IsArray({ message: 'workingDays harus berupa array angka 0 sampai 6' })
  @ArrayMinSize(1, { message: 'workingDays harus berisi minimal 1 hari' })
  @ArrayMaxSize(7, { message: 'workingDays maksimal 7 hari' })
  @ArrayUnique({ message: 'workingDays tidak boleh berisi hari yang sama dua kali' })
  @IsInt({ each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Min(0, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Max(6, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  workingDays?: number[];
}

export class AttendanceSettingsResponseDto {
  @ApiProperty({ example: '00:00' }) earliestCheckIn: string;
  @ApiProperty({ example: '08:00' }) defaultCutoffTime: string;
  @ApiProperty({ example: 15 }) toleranceMinutes: number;
  @ApiProperty({ example: false }) requireNoteWhenLate: boolean;
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 4, 5, 6] }) workingDays: number[];
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ example: '2026-11-04' }) attendanceDate: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() checkInAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  status: AttendanceStatus;
  @ApiProperty({ example: 0, description: 'Menit terlambat dari batas jam masuk dasar' })
  lateMinutes: number;
}

export class AttendanceEmployeeDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
}

export class AttendanceAdminResponseDto extends AttendanceResponseDto {
  @ApiProperty({ type: AttendanceEmployeeDto, nullable: true })
  employee: AttendanceEmployeeDto | null;
}

class AttendanceMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class AttendanceListResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] }) data: AttendanceResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}

export class AttendanceAdminListResponseDto {
  @ApiProperty({ type: [AttendanceAdminResponseDto] }) data: AttendanceAdminResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}

export class AttendanceSummaryResponseDto {
  @ApiProperty({ example: '2026-11-04' }) date: string;
  @ApiProperty({ description: 'Karyawan aktif ber-role EMPLOYEE' }) totalEmployees: number;
  @ApiProperty() presentCount: number;
  @ApiProperty() onTimeCount: number;
  @ApiProperty() lateCount: number;
  @ApiProperty() absentCount: number;
  @ApiProperty({ type: [AttendanceEmployeeDto] }) absentEmployees: AttendanceEmployeeDto[];
}
```

---

### 15. `backend/libs/common/src/interfaces/attendance.interface.ts`
```ts
import { AttendanceStatus } from '../enums/attendance-status.enum';

/** Bentuk data antar-service. photoPath bersifat internal, tidak boleh bocor ke klien. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD (WIB)
  checkInAt: Date | string;
  createdAt: Date | string;
  photoPath: string;
  notes: string | null;
  /** Disimpan saat absen; tidak berubah walau pengaturan diubah kemudian. */
  status: AttendanceStatus;
  /** Menit dari batas jam masuk dasar (defaultCutoffTime). 0 jika tepat waktu. */
  lateMinutes: number;
}

export interface CreateAttendancePayload {
  employeeId: string;
  photoPath: string;
  notes?: string | null;
}

/** Dipakai oleh /attendances (HRD), /attendances/export, dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
}

/** Pengaturan jam kerja (satu baris global). Waktu berformat HH:mm (WIB). */
export interface AttendanceSettingsRecord {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: number;
  requireNoteWhenLate: boolean;
  /** 0 = Minggu ... 6 = Sabtu */
  workingDays: number[];
}

/** PATCH parsial: hanya field yang dikirim yang diubah. */
export type UpdateAttendanceSettingsPayload = Partial<AttendanceSettingsRecord>;

/** Statistik harian, dihitung hanya untuk employeeIds yang dikirim gateway. */
export interface DailyStatsPayload {
  /** YYYY-MM-DD (WIB) */
  date: string;
  employeeIds: string[];
}

export interface DailyStatsResult {
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  /** Sudah absen pada tanggal itu; gateway memakainya untuk menentukan yang belum absen. */
  presentEmployeeIds: string[];
}
```

---

### 16. `backend/apps/api-gateway/src/main.ts` (Bagian CORS)
```ts
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // Agar frontend (Axios) bisa membaca nama file dan penanda export terpotong.
    exposedHeaders: ['Content-Disposition', 'X-Export-Truncated'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Absensi WFH API')
      .setDescription('API Gateway: satu-satunya pintu masuk publik')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.getOrThrow<number>('GATEWAY_PORT');
  await app.listen(port);
  Logger.log(`api-gateway listening on :${port} (Swagger: /api/docs)`, 'Bootstrap');
}

bootstrap();
```

