import { TIMEZONE } from '../constants/rpc.constants';

function wibParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Waktu WIB ISO 8601 dengan offset, mis. 2026-11-04T10:15:30+07:00. */
export function formatWibIso(date: Date = new Date()): string {
  const p = wibParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`;
}

/** Tanggal kalender WIB (YYYY-MM-DD). Dasar untuk attendance_date. */
export function wibDateString(date: Date = new Date()): string {
  const p = wibParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Menit sejak 00:00 WIB (0-1439). Detik diabaikan, sama dengan yang tampil di jam HH:mm. */
export function wibMinutesOfDay(date: Date = new Date()): number {
  const p = wibParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Hari dalam seminggu menurut kalender WIB: 0 = Minggu ... 6 = Sabtu. */
export function wibDayOfWeek(date: Date = new Date()): number {
  return new Date(`${wibDateString(date)}T00:00:00Z`).getUTCDay();
}
