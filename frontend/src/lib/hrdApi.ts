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

