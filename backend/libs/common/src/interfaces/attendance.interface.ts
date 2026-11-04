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
