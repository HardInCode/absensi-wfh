# Fase 5.5 Frontend-A: Pengaturan Absensi dan Status Keterlambatan (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Fase ini adalah sisi UI dari backend Fase 5.5-A (`fase5-5a-attendance-settings-files.md`). Prasyarat: Fase 3, audit Fase 3, Fase 4, Fase 5A, 5B, dan 5.5-A sudah terpasang dan lulus tes. Fase ini menambah halaman **Pengaturan absensi** untuk HRD (`/hrd/settings`), badge status Tepat waktu/Terlambat di halaman karyawan dan monitoring HRD, info batas jam masuk di bawah jam digital, dan penguncian tombol kirim absen berdasarkan aturan jam kerja. Buat setiap file baru pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. File yang ditandai "(diubah)" ditimpa penuh. Buat folder yang belum ada.

Catatan penting:
- Semua path relatif terhadap `absensi-wfh/frontend/src/` kecuali disebut lain.
- Tidak ada dependensi npm baru, token warna baru, atau komponen `ui/*` baru. Badge Terlambat memakai varian `danger`, Tepat waktu memakai `present`.
- Fase ini **tidak** mencakup filter status, Summary Cards, dan tombol Export CSV di halaman Monitoring. Itu menjadi Frontend-B, sesudah backend 5.5-B/C (`fase5-5bc-summary-export-files.md`) terpasang.
- Kode ditulis tanpa dijalankan di browser. Setelah semua file dibuat, jalankan `npm run typecheck` dan `npm run build`, perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji manual dengan bagian "Skenario uji".
- Komponen dan hook Fase 3/4 yang dipakai ulang dan **tidak boleh dihapus**: `components/ErrorState.tsx`, `EmptyState.tsx`, `PageHeader.tsx`, `Pagination.tsx`, `AuthedImage.tsx`, `PhotoDropzone.tsx`, `Stamp.tsx`, `StatusBanner.tsx`, `DataTable.tsx`, `hooks/useApiList.ts`, `hooks/useServerClock.ts`.

Tiga keputusan yang perlu diketahui sebelum membaca kodenya:
- `customDayCutoff` tidak ada di kontrak API 5.5, jadi tidak dipakai.
- Teks "Terakhir diubah" membaca `updatedAt` atau `updated_at` jika ada di respons settings. Backend 5.5-A tidak mengirim field itu, jadi teksnya tidak akan tampil sampai backend menambahkannya.
- `PATCH` hanya mengirim field yang berubah, sesuai kontrak (body parsial).

**Penyimpangan dari dokumen sumber:** `TOLERANCE_MAX` di `AttendanceSettingsPage.tsx` saya set **120**, bukan 240 seperti di sumber, karena backend 5.5-A menolak `toleranceMinutes` di atas 120 (pesan: "toleranceMinutes harus bilangan bulat 0 sampai 120"). Dengan 120, validasi klien dan server konsisten.

---

## 1. Lib

### `absensi-wfh/frontend/src/lib/types.ts` (diubah)
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

### `absensi-wfh/frontend/src/lib/format.ts` (diubah)
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

### `absensi-wfh/frontend/src/lib/hrdFormat.ts` (diubah)
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

### `absensi-wfh/frontend/src/lib/hrdApi.ts` (diubah)
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

### `absensi-wfh/frontend/src/lib/attendanceRules.ts` (baru)
```ts
import { dayOfWeekWib, secondsOfDayWib } from "@/lib/format";
import type { AttendanceSettings } from "@/lib/types";

/** Indeks hari mengikuti JS (0 = Minggu). */
export const DAY_LABEL_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_LABEL_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
/** Urutan tampil Senin sampai Minggu. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export interface CheckInEvaluation {
  canSubmit: boolean;
  /** Alasan tombol kirim nonaktif; null jika boleh kirim. */
  blockReason: string | null;
  /** Waktu sekarang sudah melewati jam masuk + toleransi. */
  isLate: boolean;
  /** Catatan wajib: pengaturan mewajibkan DAN sudah melewati batas. */
  noteRequired: boolean;
  /** Jam masuk dasar "HH:mm". */
  cutoff: string;
  /** Jam masuk + toleransi "HH:mm". Setelah ini dihitung terlambat. */
  deadline: string;
}

/**
 * Cermin aturan server untuk tampilan saja. Keputusan resmi tetap di server,
 * yang memakai waktunya sendiri saat absen dikirim.
 */
export function evaluateCheckIn(settings: AttendanceSettings, now: Date): CheckInEvaluation {
  const cutoffMin = toMinutes(settings.defaultCutoffTime);
  const deadlineMin = cutoffMin + settings.toleranceMinutes;
  const base = { cutoff: settings.defaultCutoffTime, deadline: minutesToHhmm(deadlineMin) };

  const blocked = (reason: string): CheckInEvaluation => ({
    ...base,
    canSubmit: false,
    blockReason: reason,
    isLate: false,
    noteRequired: false,
  });

  const dow = dayOfWeekWib(now);
  if (settings.workingDays.length === 0) {
    return blocked("Belum ada hari kerja yang diatur. Hubungi HRD.");
  }
  if (!settings.workingDays.includes(dow)) {
    const allowed = DAY_ORDER.filter((d) => settings.workingDays.includes(d))
      .map((d) => DAY_LABEL_LONG[d])
      .join(", ");
    return blocked(`Hari ${DAY_LABEL_LONG[dow]} bukan hari kerja. Absen hanya bisa dikirim pada ${allowed}.`);
  }

  const nowSec = secondsOfDayWib(now);
  if (nowSec < toMinutes(settings.earliestCheckIn) * 60) {
    return blocked(`Absen baru dibuka pukul ${settings.earliestCheckIn} WIB.`);
  }

  const isLate = nowSec > deadlineMin * 60;
  return {
    ...base,
    canSubmit: true,
    blockReason: null,
    isLate,
    noteRequired: settings.requireNoteWhenLate && isLate,
  };
}
```

---

## 2. Hook

### `absensi-wfh/frontend/src/hooks/useAttendanceSettings.ts` (baru)
```ts
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { fetchAttendanceSettings, getErrorMessage, type AttendanceSettings } from "@/lib/hrdApi";

export function useAttendanceSettings() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchAttendanceSettings(controller.signal)
      .then((result) => setSettings(result))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(getErrorMessage(err, "Gagal memuat pengaturan absensi."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { settings, setSettings, isLoading, error, reload };
}
```

---

## 3. Komponen

### `absensi-wfh/frontend/src/components/AttendanceStatusBadge.tsx` (baru)
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

### `absensi-wfh/frontend/src/components/CheckInWindowInfo.tsx` (baru)
```tsx
import { Skeleton } from '@/components/ui/skeleton';
import type { CheckInEvaluation } from '@/lib/attendanceRules';
import type { AttendanceSettings } from '@/lib/types';

interface Props {
  settings: AttendanceSettings | null;
  evaluation: CheckInEvaluation | null;
  loading: boolean;
  error: string | null;
}

export function CheckInWindowInfo({ settings, evaluation, loading, error }: Props) {
  if (loading) return <Skeleton className="h-10 w-full max-w-sm" />;

  if (error || !settings || !evaluation) {
    return (
      <p className="text-sm text-muted">
        Info batas jam masuk tidak dapat dimuat. Server tetap memeriksa aturan saat kamu mengirim.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      <p className="text-ink">
        Batas jam masuk <span className="font-medium tabular-nums">{evaluation.cutoff} WIB</span>
        {settings.toleranceMinutes > 0 && (
          <>
            , toleransi {settings.toleranceMinutes} menit. Terlambat dihitung setelah{' '}
            <span className="font-medium tabular-nums">{evaluation.deadline} WIB</span>.
          </>
        )}
        {settings.toleranceMinutes === 0 && '. Tanpa toleransi.'}
      </p>
      <p className="text-muted">
        Absen dibuka mulai <span className="tabular-nums">{settings.earliestCheckIn} WIB</span>.
      </p>
      {evaluation.canSubmit && evaluation.isLate && (
        <p role="status" className="font-medium text-danger">
          Batas sudah lewat. Absenmu akan tercatat terlambat.
        </p>
      )}
    </div>
  );
}
```

### `absensi-wfh/frontend/src/components/LiveClock.tsx` (diubah)
```tsx
import type { ReactNode } from 'react';
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import type { ClockStatus } from '@/hooks/useServerClock';
import { formatDateLong, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  now: Date;
  status: ClockStatus;
  className?: string;
  /** Konten tambahan di bawah jam (mis. info batas jam masuk). */
  children?: ReactNode;
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

export function LiveClock({ now, status, className, children }: Props) {
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

      {children && <div className="mt-5">{children}</div>}

      <p className="mt-6 text-sm text-muted">
        Jam ini hanya tampilan. Waktu absen resmi dicatat oleh server saat kamu mengirim.
      </p>
    </div>
  );
}
```

---

## 4. Layout dan routing

### `absensi-wfh/frontend/src/layouts/AppShell.tsx` (diubah)
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
```

### `absensi-wfh/frontend/src/App.tsx` (diubah)
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
const AttendanceSettingsPage = lazyPage(
  () => import("@/pages/hrd/AttendanceSettingsPage"),
  "AttendanceSettingsPage",
);

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
              <Route path="hrd/settings" element={<AttendanceSettingsPage />} />
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

## 5. Halaman

### `absensi-wfh/frontend/src/pages/hrd/AttendanceSettingsPage.tsx` (baru)
`TOLERANCE_MAX = 120` (penyimpangan dari sumber, selaras dengan validasi backend 5.5-A).
```tsx
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { StatusBanner } from "@/components/StatusBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSettings } from "@/hooks/useAttendanceSettings";
import { DAY_LABEL_LONG, DAY_LABEL_SHORT, DAY_ORDER, minutesToHhmm, toMinutes } from "@/lib/attendanceRules";
import { formatDateShort, formatTime } from "@/lib/format";
import {
  getErrorMessage,
  updateAttendanceSettings,
  type AttendanceSettings,
  type AttendanceSettingsInput,
} from "@/lib/hrdApi";
import { cn } from "@/lib/utils";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Selaras dengan validasi backend (0 sampai 120); server tetap menjadi penentu akhir. */
const TOLERANCE_MAX = 120;

interface FormState {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: string;
  requireNoteWhenLate: boolean;
  workingDays: number[];
}

type FieldName = "earliestCheckIn" | "defaultCutoffTime" | "toleranceMinutes" | "workingDays";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ["earliestCheckIn", "defaultCutoffTime", "toleranceMinutes", "workingDays"];
const FIELD_DOM_ID: Record<FieldName, string> = {
  earliestCheckIn: "set-earliest",
  defaultCutoffTime: "set-cutoff",
  toleranceMinutes: "set-tolerance",
  workingDays: "set-day-1",
};

function toForm(s: AttendanceSettings): FormState {
  return {
    earliestCheckIn: s.earliestCheckIn,
    defaultCutoffTime: s.defaultCutoffTime,
    toleranceMinutes: String(s.toleranceMinutes),
    requireNoteWhenLate: s.requireNoteWhenLate,
    workingDays: [...s.workingDays].sort((a, b) => a - b),
  };
}

function validate(f: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const earliestOk = TIME_PATTERN.test(f.earliestCheckIn);
  const cutoffOk = TIME_PATTERN.test(f.defaultCutoffTime);

  if (!earliestOk) errors.earliestCheckIn = "Isi jam dengan format JJ:MM, mis. 06:00.";
  if (!cutoffOk) errors.defaultCutoffTime = "Isi jam dengan format JJ:MM, mis. 08:00.";
  if (earliestOk && cutoffOk && toMinutes(f.earliestCheckIn) >= toMinutes(f.defaultCutoffTime)) {
    errors.defaultCutoffTime = "Jam masuk harus setelah jam paling awal absen.";
  }

  const tol = f.toleranceMinutes.trim();
  if (tol === "") errors.toleranceMinutes = "Toleransi wajib diisi. Isi 0 jika tanpa toleransi.";
  else if (!/^\d+$/.test(tol)) errors.toleranceMinutes = "Toleransi harus bilangan bulat, tanpa tanda minus atau koma.";
  else if (Number(tol) > TOLERANCE_MAX) errors.toleranceMinutes = `Toleransi maksimal ${TOLERANCE_MAX} menit.`;

  if (f.workingDays.length === 0) errors.workingDays = "Pilih minimal satu hari kerja.";
  return errors;
}

/** PATCH bersifat parsial, jadi hanya field yang berubah yang dikirim. */
function buildChanges(f: FormState, saved: AttendanceSettings): AttendanceSettingsInput {
  const changes: AttendanceSettingsInput = {};
  if (f.earliestCheckIn !== saved.earliestCheckIn) changes.earliestCheckIn = f.earliestCheckIn;
  if (f.defaultCutoffTime !== saved.defaultCutoffTime) changes.defaultCutoffTime = f.defaultCutoffTime;
  const tol = f.toleranceMinutes.trim();
  if (tol !== String(saved.toleranceMinutes)) changes.toleranceMinutes = Number(tol);
  if (f.requireNoteWhenLate !== saved.requireNoteWhenLate) changes.requireNoteWhenLate = f.requireNoteWhenLate;
  const days = [...f.workingDays].sort((a, b) => a - b);
  if (days.join(",") !== [...saved.workingDays].sort((a, b) => a - b).join(",")) changes.workingDays = days;
  return changes;
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

export function AttendanceSettingsPage() {
  const { settings, setSettings, isLoading, error, reload } = useAttendanceSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const dismissBanner = useCallback(() => setBanner(null), []);

  useEffect(() => {
    if (settings) setForm(toForm(settings));
  }, [settings]);

  const changes = useMemo(
    () => (settings && form ? buildChanges(form, settings) : {}),
    [settings, form],
  );
  const dirty = Object.keys(changes).length > 0;

  const preview = useMemo(() => {
    if (!form) return null;
    const tol = form.toleranceMinutes.trim();
    if (!TIME_PATTERN.test(form.defaultCutoffTime) || !/^\d+$/.test(tol)) return null;
    const deadline = minutesToHhmm(toMinutes(form.defaultCutoffTime) + Number(tol));
    return `Absen setelah ${deadline} WIB dicatat Terlambat (jam masuk ${form.defaultCutoffTime} + toleransi ${Number(tol)} menit).`;
  }, [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
  }

  function toggleDay(day: number) {
    if (!form) return;
    const next = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day];
    setField("workingDays", next);
  }

  function describe(field: FieldName, hasHint = false): string | undefined {
    const id = FIELD_DOM_ID[field];
    if (errors[field]) return `${id}-error`;
    return hasHint ? `${id}-hint` : undefined;
  }

  function discard() {
    if (!settings) return;
    setForm(toForm(settings));
    setErrors({});
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !form || !settings) return;

    const next = validate(form);
    setErrors(next);
    const firstInvalid = FIELD_ORDER.find((field) => next[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_DOM_ID[firstInvalid])?.focus();
      return;
    }
    if (!dirty) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await updateAttendanceSettings(changes);
      setSettings(updated);
      setBanner("Pengaturan absensi berhasil disimpan. Berlaku untuk absen berikutnya.");
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Gagal menyimpan pengaturan absensi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pengaturan absensi</h1>
        <p className="mt-1 text-sm text-muted">
          Atur jam masuk, toleransi, dan hari kerja. Waktu yang dipakai selalu waktu server (WIB).
        </p>
        {settings?.updatedAt && (
          <p className="mt-1 text-xs text-muted">
            Terakhir diubah{" "}
            <span className="tabular-nums">
              {formatDateShort(settings.updatedAt)}, {formatTime(settings.updatedAt)} WIB
            </span>
          </p>
        )}
      </div>

      <StatusBanner message={banner} onDismiss={dismissBanner} />

      <Card className="max-w-2xl p-6 sm:p-8">
        {isLoading && !form ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : error && !form ? (
          <ErrorState message={error} onRetry={reload} />
        ) : form ? (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="set-earliest"
                label="Jam paling awal absen (WIB)"
                error={errors.earliestCheckIn}
                hint="Sebelum jam ini tombol kirim karyawan terkunci."
              >
                <Input
                  id="set-earliest"
                  type="time"
                  value={form.earliestCheckIn}
                  onChange={(e) => setField("earliestCheckIn", e.target.value)}
                  aria-invalid={Boolean(errors.earliestCheckIn)}
                  aria-describedby={describe("earliestCheckIn", true)}
                  disabled={submitting}
                />
              </Field>
              <Field
                id="set-cutoff"
                label="Jam masuk (WIB)"
                error={errors.defaultCutoffTime}
                hint="Batas jam masuk dasar untuk semua hari kerja."
              >
                <Input
                  id="set-cutoff"
                  type="time"
                  value={form.defaultCutoffTime}
                  onChange={(e) => setField("defaultCutoffTime", e.target.value)}
                  aria-invalid={Boolean(errors.defaultCutoffTime)}
                  aria-describedby={describe("defaultCutoffTime", true)}
                  disabled={submitting}
                />
              </Field>
              <Field
                id="set-tolerance"
                label="Toleransi (menit)"
                error={errors.toleranceMinutes}
                hint={`Bilangan bulat 0 sampai ${TOLERANCE_MAX}.`}
              >
                <Input
                  id="set-tolerance"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={TOLERANCE_MAX}
                  step={1}
                  value={form.toleranceMinutes}
                  onChange={(e) => setField("toleranceMinutes", e.target.value)}
                  aria-invalid={Boolean(errors.toleranceMinutes)}
                  aria-describedby={describe("toleranceMinutes", true)}
                  disabled={submitting}
                />
              </Field>
            </div>

            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.requireNoteWhenLate}
                onChange={(e) => setField("requireNoteWhenLate", e.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-5 w-5 cursor-pointer accent-accent"
              />
              <span>
                Wajib isi catatan saat terlambat
                <span className="block text-xs text-muted">
                  Berlaku jika absen dikirim setelah jam masuk ditambah toleransi.
                </span>
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Hari kerja</legend>
              <div className="flex flex-wrap gap-2">
                {DAY_ORDER.map((day) => {
                  const on = form.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      id={`set-day-${day}`}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_LABEL_LONG[day]}
                      disabled={submitting}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "inline-flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50",
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-edge bg-card text-ink hover:bg-canvas",
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                      {DAY_LABEL_SHORT[day]}
                    </button>
                  );
                })}
              </div>
              {errors.workingDays && (
                <p id="set-day-1-error" role="alert" className="text-xs text-danger">
                  {errors.workingDays}
                </p>
              )}
            </fieldset>

            {preview && <p className="rounded-md bg-canvas px-3 py-2 text-sm text-ink">{preview}</p>}

            {submitError && (
              <div role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
                {submitError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={discard}
                disabled={submitting || !dirty}
                className="min-h-11 sm:min-h-0"
              >
                Batalkan perubahan
              </Button>
              <Button type="submit" disabled={submitting || !dirty} className="min-h-11 sm:min-h-0">
                {submitting ? "Menyimpan..." : "Simpan pengaturan"}
              </Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
```

### `absensi-wfh/frontend/src/pages/employee/AttendancePage.tsx` (diubah)
```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, History, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AttendanceStatusBadge } from '@/components/AttendanceStatusBadge';
import { AuthedImage } from '@/components/AuthedImage';
import { CheckInWindowInfo } from '@/components/CheckInWindowInfo';
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
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { useServerClock } from '@/hooks/useServerClock';
import { api } from '@/lib/api';
import { evaluateCheckIn } from '@/lib/attendanceRules';
import { getErrorMessage, getStatus } from '@/lib/errors';
import {
  formatTime,
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

  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useAttendanceSettings();

  const [page, setPage] = useState(1);
  const history = useApiList<Attendance>('/attendances/me', { page, limit: 5 });

  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [noteMissing, setNoteMissing] = useState(false);
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

  const rule = settings ? evaluateCheckIn(settings, now) : null;
  const blockReason = rule && !rule.canSubmit ? rule.blockReason : null;
  const noteRequired = rule?.noteRequired ?? false;

  function refreshHistory() {
    if (page === 1) history.refetch();
    else setPage(1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setNoteMissing(false);
    if (blockReason) {
      setSubmitError(blockReason);
      return;
    }
    if (!file) {
      setSubmitError('Pilih foto bukti kerja terlebih dahulu.');
      return;
    }
    if (noteRequired && !notes.trim()) {
      setNoteMissing(true);
      setSubmitError('Catatan wajib diisi karena kamu absen setelah batas jam masuk.');
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
        <LiveClock now={now} status={status} className="order-1 lg:col-span-7">
          <CheckInWindowInfo
            settings={settings}
            evaluation={rule}
            loading={settingsLoading}
            error={settingsError}
          />
        </LiveClock>

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
              <dd className="mt-0.5 flex flex-wrap gap-1.5">
                {todayLoading ? (
                  <Skeleton className="h-6 w-28 rounded-full" />
                ) : todayError ? (
                  <Badge variant="danger">Gagal dimuat</Badge>
                ) : checkedIn && todayRecord ? (
                  <>
                    <Badge variant="present">
                      <CheckCircle2 aria-hidden /> Hadir pukul {formatTime(todayRecord.checkInAt)}
                    </Badge>
                    <AttendanceStatusBadge
                      status={todayRecord.status}
                      lateMinutes={todayRecord.lateMinutes}
                    />
                  </>
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
              <AttendanceStatusBadge
                status={todayRecord.status}
                lateMinutes={todayRecord.lateMinutes}
                className="mt-2"
              />
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
                  <Label htmlFor="notes">
                    {noteRequired ? 'Catatan (wajib)' : 'Catatan (opsional)'}
                  </Label>
                  <span className="text-xs tabular-nums text-muted">
                    {notes.length}/{NOTES_MAX}
                  </span>
                </div>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={NOTES_MAX}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNoteMissing(false);
                  }}
                  placeholder={
                    noteRequired
                      ? 'Jelaskan alasan kamu absen setelah batas jam masuk.'
                      : 'Contoh: mengerjakan laporan bulanan dari ruang kerja di rumah.'
                  }
                  required={noteRequired}
                  aria-required={noteRequired}
                  aria-invalid={noteMissing}
                  aria-describedby={noteRequired ? 'notes-hint' : undefined}
                  disabled={submitting}
                  className={noteMissing ? 'border-danger' : undefined}
                />
                {noteRequired && rule && (
                  <p id="notes-hint" className="text-xs text-muted">
                    Wajib diisi karena sudah melewati batas {rule.deadline} WIB.
                  </p>
                )}
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {submitError}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={submitting || blockReason !== null}
                  aria-describedby={blockReason ? 'submit-block' : undefined}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Send />
                  )}
                  {submitting ? 'Mengirim…' : 'Kirim absen'}
                </Button>
                {blockReason && (
                  <p id="submit-block" role="status" className="text-sm text-muted">
                    {blockReason}
                  </p>
                )}
              </div>
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
                          {formatTime(item.checkInAt)} WIB
                        </span>
                      </p>
                      <AttendanceStatusBadge
                        status={item.status}
                        lateMinutes={item.lateMinutes}
                        className="mt-1"
                      />
                      <p className="mt-1 truncate text-sm text-muted">
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

### `absensi-wfh/frontend/src/pages/hrd/MonitoringPage.tsx` (diubah)
Perubahan dari Fase 4: kolom Status dengan `AttendanceStatusBadge`.
```tsx
import { useState } from "react";
import { AttendanceStatusBadge } from "@/components/AttendanceStatusBadge";
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

## 6. Menjalankan

```bash
cd absensi-wfh/frontend
npm run typecheck && npm run build   # harus 0 error
npm run dev                          # http://localhost:5173
```
Tidak ada dependensi baru. Backend dan MySQL tetap seperti sebelumnya (Fase 5.5-A sudah berjalan).

---

## 7. Skenario uji

Untuk mengubah pengaturan dengan cepat saat menguji sisi karyawan, pakai halaman Pengaturan absensi sebagai admin (jendela biasa) dan halaman karyawan di jendela incognito.

**HRD (`admin@company.test`)**
1. Tab ketiga **Pengaturan absensi** muncul dan aktif di `/hrd/settings`. Form terisi dari `GET /attendances/settings`. Tombol Simpan dan Batalkan nonaktif selama belum ada perubahan.
2. Kosongkan jam, isi toleransi `-5`, `1.5`, atau `300`, atau matikan semua hari. Pesan error tampil per field dan fokus pindah ke field pertama yang salah. Tidak ada request yang terkirim.
3. Isi jam masuk lebih awal dari atau sama dengan jam paling awal. Muncul error "Jam masuk harus setelah jam paling awal absen."
4. Ubah satu field saja, mis. toleransi. Di tab Network, body `PATCH` hanya berisi `toleranceMinutes`. Banner sukses muncul dan hilang sendiri setelah 6 detik.
5. Matikan backend lalu simpan. Muncul alert merah "Tidak dapat terhubung ke server…", dan nilai form tidak hilang.
6. Teks "Terakhir diubah" muncul hanya jika respons membawa `updatedAt` atau `updated_at` (dengan backend 5.5-A saat ini, teks ini tidak tampil).
7. Di tab **Monitoring absensi**, kolom Status menampilkan Tepat waktu (hijau) atau Terlambat (+X mnt) (merah). Jam tampil `13:45:02` dengan titik dua.

**Karyawan (`budi@company.test`)**
1. Info "Batas jam masuk 08:00 WIB, toleransi 15 menit…" muncul di bawah jam digital.
2. Set jam paling awal ke jam di masa depan. Tombol Kirim nonaktif dengan alasan "Absen baru dibuka pukul HH:mm WIB." dan terhubung via `aria-describedby`.
3. Keluarkan hari ini dari hari kerja. Alasannya berubah menjadi "Hari … bukan hari kerja. Absen hanya bisa dikirim pada …".
4. Aktifkan "wajib catatan" dan set batas supaya sudah lewat. Label berubah menjadi "Catatan (wajib)", dan kirim tanpa catatan ditolak di klien. Set batas ke masa depan, dan catatan kembali opsional.
5. Kirim absen. Kartu status menampilkan "Hadir pukul HH:mm:ss" ditambah badge status. Riwayat menampilkan badge dan jam `HH:mm:ss`.
6. Matikan endpoint settings. Info menampilkan "tidak dapat dimuat", tombol tidak terkunci, dan server tetap memvalidasi.

Catatan: setelah HRD mengubah pengaturan, halaman karyawan yang sudah terbuka baru membaca pengaturan baru saat dimuat ulang. Muat ulang halaman karyawan untuk melihat efeknya.

---

## 8. Daftar file

**Diubah / ditimpa penuh (9):**
```
lib/types.ts
lib/format.ts
lib/hrdFormat.ts
lib/hrdApi.ts
components/LiveClock.tsx
layouts/AppShell.tsx
App.tsx
pages/employee/AttendancePage.tsx
pages/hrd/MonitoringPage.tsx
```

**Baru (5):**
```
lib/attendanceRules.ts
hooks/useAttendanceSettings.ts
components/AttendanceStatusBadge.tsx
components/CheckInWindowInfo.tsx
pages/hrd/AttendanceSettingsPage.tsx
```

(Semua path relatif terhadap `absensi-wfh/frontend/src/`.)

---

## 9. Keputusan default

- Batas toleransi 0 sampai 120 menit di klien, selaras dengan backend 5.5-A. (Sumber memakai 240; diubah supaya tidak ada nilai yang lolos klien tetapi ditolak server.)
- Validasi "jam masuk harus setelah jam paling awal" adalah aturan logis yang juga ditegakkan backend 5.5-A.
- Hari kerja memakai indeks 0 = Minggu, mengikuti kontrak.
- Peringatan kuning belum ada di token, jadi Terlambat memakai `danger`. Tambahkan token `warning` jika ingin kuning.
- Aturan keterlambatan di klien hanya tampilan. Keputusan resmi tetap di server, yang juga membalas 400 berbahasa Indonesia jika aturan dilanggar (ditampilkan apa adanya lewat `getErrorMessage`).
- Filter Status, Summary Cards, dan Export CSV sengaja tidak disentuh (Frontend-B).
