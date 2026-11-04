import { AttendanceSettingsRecord } from '../interfaces/attendance.interface';

/** HH:mm 24 jam, 00:00 - 23:59. */
export const HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Default longgar: tidak ada pembatasan jam mulai/hari, catatan tidak wajib. */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsRecord = {
  earliestCheckIn: '00:00',
  defaultCutoffTime: '08:00',
  toleranceMinutes: 15,
  requireNoteWhenLate: false,
  workingDays: [0, 1, 2, 3, 4, 5, 6],
};

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Urut Senin..Minggu agar mudah dibaca, mis. "Senin, Selasa, Rabu". */
export function formatWorkingDays(days: number[]): string {
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAY_NAMES_ID[d])
    .join(', ');
}

/** Mengembalikan daftar pesan galat (kosong = valid). Dipakai pada nilai GABUNGAN. */
export function validateAttendanceSettings(s: AttendanceSettingsRecord): string[] {
  const errors: string[] = [];

  const earliestOk = typeof s.earliestCheckIn === 'string' && HM_REGEX.test(s.earliestCheckIn);
  const cutoffOk = typeof s.defaultCutoffTime === 'string' && HM_REGEX.test(s.defaultCutoffTime);

  if (!earliestOk) errors.push('earliestCheckIn harus berformat HH:mm, contoh 06:00');
  if (!cutoffOk) errors.push('defaultCutoffTime harus berformat HH:mm, contoh 08:00');

  if (!Number.isInteger(s.toleranceMinutes) || s.toleranceMinutes < 0 || s.toleranceMinutes > 120) {
    errors.push('toleranceMinutes harus bilangan bulat 0 sampai 120');
  }

  if (typeof s.requireNoteWhenLate !== 'boolean') {
    errors.push('requireNoteWhenLate harus berupa true atau false');
  }

  const days = s.workingDays;
  const daysOk =
    Array.isArray(days) &&
    days.length >= 1 &&
    days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(days).size === days.length;
  if (!daysOk) {
    errors.push(
      'workingDays harus berisi minimal 1 hari, berupa angka 0 (Minggu) sampai 6 (Sabtu), tanpa duplikat',
    );
  }

  if (earliestOk && cutoffOk && hmToMinutes(s.earliestCheckIn) >= hmToMinutes(s.defaultCutoffTime)) {
    errors.push(
      'Jam mulai absen (earliestCheckIn) harus lebih awal dari batas jam masuk (defaultCutoffTime)',
    );
  }

  return errors;
}
