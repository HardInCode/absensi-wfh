export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';

export const EmployeePattern = {
  AUTH_LOGIN: 'auth.login',
  AUTH_VALIDATE: 'auth.validate',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_FIND_ALL: 'employees.findAll',
  EMPLOYEES_FIND_ONE: 'employees.findOne',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_REMOVE: 'employees.remove',
  EMPLOYEES_SEARCH_IDS: 'employees.searchIds',
  EMPLOYEES_FIND_BRIEFS: 'employees.findBriefs',
} as const;

export const AttendancePattern = {
  CREATE: 'attendances.create',
  FIND_TODAY: 'attendances.findToday',
  FIND_ALL: 'attendances.findAll',
  FIND_ONE: 'attendances.findOne',
  GET_SETTINGS: 'attendances.getSettings',
  UPDATE_SETTINGS: 'attendances.updateSettings',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
