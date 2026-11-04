/** Bentuk data antar-service. photoPath bersifat internal, tidak boleh bocor ke klien. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD (WIB)
  checkInAt: Date | string;
  createdAt: Date | string;
  photoPath: string;
  notes: string | null;
}

export interface CreateAttendancePayload {
  employeeId: string;
  photoPath: string;
  notes?: string | null;
}

/** Dipakai oleh /attendances (HRD) dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

