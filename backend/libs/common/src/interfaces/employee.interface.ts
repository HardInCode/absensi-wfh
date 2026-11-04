import { Role } from '../enums/role.enum';

export interface EmployeeView {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Data ringkas untuk memperkaya daftar absensi. */
export interface EmployeeBrief {
  id: string;
  nik: string;
  fullName: string;
}
