import type { Role } from './types';

export function homeFor(role: Role): string {
  return role === 'ADMIN_HRD' ? '/admin/karyawan' : '/absensi';
}

