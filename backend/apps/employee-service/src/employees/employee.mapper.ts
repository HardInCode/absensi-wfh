import { EmployeeView } from '@app/common';
import { Employee } from './entities/employee.entity';

/** Satu-satunya pintu keluar data karyawan. passwordHash tidak pernah ikut. */
export function toEmployeeView(e: Employee): EmployeeView {
  return {
    id: e.id,
    nik: e.nik,
    fullName: e.fullName,
    email: e.email,
    position: e.position,
    role: e.role,
    isActive: e.isActive,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

