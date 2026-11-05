import axios from "axios";
import { api } from "@/lib/api";
import { ymdWib } from "@/lib/format";
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

export interface AbsentEmployee {
  id: string;
  nik: string;
  fullName: string;
}

export interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  absentEmployees: AbsentEmployee[];
}

/** "" = semua status. */
export type StatusFilter = AttendanceStatus | "";

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

export function normalizeSummary(raw: unknown): AttendanceSummary {
  const root: Raw = isRecord(raw) ? raw : {};
  const absent = Array.isArray(root.absentEmployees) ? root.absentEmployees : [];
  return {
    date: pickStr(raw, "date"),
    totalEmployees: pickNum(raw, "totalEmployees") ?? 0,
    presentCount: pickNum(raw, "presentCount") ?? 0,
    onTimeCount: pickNum(raw, "onTimeCount") ?? 0,
    lateCount: pickNum(raw, "lateCount") ?? 0,
    absentCount: pickNum(raw, "absentCount") ?? 0,
    absentEmployees: absent.map((item) => ({
      id: pickStr(item, "id"),
      nik: pickStr(item, "nik"),
      fullName: pickStr(item, "fullName", "full_name"),
    })),
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

function messageFromBody(data: unknown): string | null {
  const message = isRecord(data) ? data.message : undefined;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === "string");
    if (parts.length > 0) return parts.join(". ");
  }
  if (typeof message === "string" && message !== "") return message;
  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return error.code === "ECONNABORTED"
        ? "Server terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
    }
    const fromBody = messageFromBody(error.response.data);
    if (fromBody) return fromBody;
    if (error.response.status === 403) return "Anda tidak memiliki akses ke data ini.";
    if (error.response.status >= 500) return "Terjadi kesalahan di server. Coba lagi nanti.";
  }
  return fallback;
}

/**
 * Pada request blob, body error juga berupa Blob, jadi dibaca dulu sebagai JSON
 * supaya pesan validasi dari server (400) tetap tampil.
 */
export async function getExportErrorMessage(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    if (status === 403) return "Anda tidak memiliki izin untuk mengekspor data absensi.";
    if (data instanceof Blob) {
      try {
        const fromBody = messageFromBody(JSON.parse(await data.text()));
        if (fromBody) return fromBody;
      } catch {
        /* body bukan JSON, lanjut ke pesan umum */
      }
    }
    if (status >= 500) return "Server gagal membuat file CSV. Coba lagi nanti.";
  }
  return getErrorMessage(error, "Gagal mengekspor CSV. Coba lagi.");
}

export type RoleFilter = Role | "";
export type ActiveStatusFilter = "all" | "active" | "inactive";

export interface EmployeeQuery {
  page: number;
  limit: number;
  search: string;
  role?: RoleFilter;
  status?: ActiveStatusFilter;
}

export async function fetchEmployees(query: EmployeeQuery, signal?: AbortSignal): Promise<Paged<Employee>> {
  const params: Record<string, unknown> = {
    page: query.page,
    limit: query.limit,
  };
  if (query.search) params.search = query.search;
  if (query.role) params.role = query.role;
  if (query.status === "active") params.isActive = true;
  if (query.status === "inactive") params.isActive = false;

  const res = await api.get("/employees", {
    params,
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
  status: StatusFilter;
}

function filterParams(query: { dateFrom: string; dateTo: string; employeeName: string; status: StatusFilter }) {
  return {
    ...(query.dateFrom ? { date_from: query.dateFrom } : {}),
    ...(query.dateTo ? { date_to: query.dateTo } : {}),
    ...(query.employeeName ? { employee_name: query.employeeName } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

export async function fetchAttendances(
  query: AttendanceQuery,
  signal?: AbortSignal,
): Promise<Paged<AttendanceRecord>> {
  const res = await api.get("/attendances", {
    params: { page: query.page, limit: query.limit, ...filterParams(query) },
    signal,
  });
  return normalizePaged(res.data, normalizeAttendance, query.limit);
}

export async function fetchAttendancePhoto(id: string, signal?: AbortSignal): Promise<Blob> {
  const res = await api.get<Blob>(`/attendances/${id}/photo`, { responseType: "blob", signal });
  return res.data;
}

/** `date` (YYYY-MM-DD) opsional; tanpa date, server memakai hari ini WIB. */
export async function fetchAttendanceSummary(date: string | undefined, signal?: AbortSignal): Promise<AttendanceSummary> {
  const res = await api.get("/attendances/summary", {
    params: date ? { date } : {},
    signal,
  });
  return normalizeSummary(res.data);
}

export interface ExportQuery {
  dateFrom: string;
  dateTo: string;
  employeeName: string;
  status: StatusFilter;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** true jika data yang cocok melebihi batas 5.000 baris. */
  truncated: boolean;
}

function parseFilename(disposition: string): string | null {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim()).replace(/[\\/]/g, "_");
    } catch {
      /* lanjut ke filename biasa */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim().replace(/[\\/]/g, "_") : null;
}

export async function exportAttendancesCsv(query: ExportQuery, signal?: AbortSignal): Promise<ExportResult> {
  const res = await api.get<Blob>("/attendances/export", {
    params: filterParams(query),
    responseType: "blob",
    signal,
    timeout: 120_000,
  });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const truncated = String(res.headers["x-export-truncated"] ?? "").toLowerCase() === "true";
  return {
    blob: res.data,
    filename: parseFilename(disposition) ?? `rekap-absensi-wfh-${ymdWib(new Date())}.csv`,
    truncated,
  };
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
