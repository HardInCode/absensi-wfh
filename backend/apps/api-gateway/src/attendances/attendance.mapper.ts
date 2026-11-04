import { AttendanceRecord, AttendanceStatus, EmployeeBrief } from '@app/common';

export interface AttendanceView {
  id: string;
  employeeId: string;
  attendanceDate: string;
  createdAt: Date | string;
  /** KOMPAT FRONTEND: frontend membaca checkInAt (sama dengan createdAt). */
  checkInAt: Date | string;
  photoUrl: string;
  notes: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
}

export interface AttendanceAdminView extends AttendanceView {
  employee: EmployeeBrief | null;
}

export const photoUrlFor = (id: string) => `/api/attendances/${id}/photo`;

export function toAttendanceView(r: AttendanceRecord): AttendanceView {
  return {
    id: r.id,
    employeeId: r.employeeId,
    attendanceDate: r.attendanceDate,
    createdAt: r.createdAt,
    checkInAt: r.checkInAt, // KOMPAT FRONTEND
    photoUrl: photoUrlFor(r.id),
    notes: r.notes,
    status: r.status,
    lateMinutes: r.lateMinutes,
  };
}

export function toAttendanceAdminView(
  r: AttendanceRecord,
  employee: EmployeeBrief | null,
): AttendanceAdminView {
  return { ...toAttendanceView(r), employee };
}
