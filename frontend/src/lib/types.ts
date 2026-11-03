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

