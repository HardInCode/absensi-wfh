import type { Role } from './types';

const TZ = 'Asia/Jakarta';

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

const dateLongFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateShortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** HH:mm:ss dalam WIB, selalu dengan titik dua (satu-satunya format jam di aplikasi). */
export function formatTime(value: Date | string): string {
  return timeFmt.format(toDate(value));
}

/** HH:mm dalam WIB */
export function formatTimeShort(value: Date | string): string {
  return formatTime(value).slice(0, 5);
}

/** "Selasa, 3 November 2026" dalam WIB */
export function formatDateLong(value: Date | string): string {
  return dateLongFmt.format(toDate(value));
}

/** "3 Nov 2026" dalam WIB */
export function formatDateShort(value: Date | string): string {
  return dateShortFmt.format(toDate(value));
}

/** Tanggal WIB sebagai YYYY-MM-DD */
export function ymdWib(value: Date): string {
  return ymdFmt.format(value);
}

/** Jam (0-23) dalam WIB */
export function hourWib(value: Date): number {
  return parseInt(hourFmt.format(value), 10);
}

/** Hari dalam seminggu menurut WIB: 0 = Minggu ... 6 = Sabtu. */
export function dayOfWeekWib(value: Date): number {
  return WEEKDAY_INDEX[weekdayFmt.format(value)] ?? 0;
}

/** Detik sejak 00:00:00 WIB. */
export function secondsOfDayWib(value: Date): number {
  const [h, m, s] = formatTime(value).split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Format string YYYY-MM-DD apa adanya tanpa new Date(), agar tidak bergeser zona waktu.
 */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

export function greeting(hour: number): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function roleLabel(role: Role): string {
  return role === 'ADMIN_HRD' ? 'Admin HRD' : 'Karyawan';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
