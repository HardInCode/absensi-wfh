import { dayOfWeekWib, secondsOfDayWib } from "@/lib/format";
import type { AttendanceSettings } from "@/lib/types";

/** Indeks hari mengikuti JS (0 = Minggu). */
export const DAY_LABEL_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_LABEL_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
/** Urutan tampil Senin sampai Minggu. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export interface CheckInEvaluation {
  canSubmit: boolean;
  /** Alasan tombol kirim nonaktif; null jika boleh kirim. */
  blockReason: string | null;
  /** Waktu sekarang sudah melewati jam masuk + toleransi. */
  isLate: boolean;
  /** Catatan wajib: pengaturan mewajibkan DAN sudah melewati batas. */
  noteRequired: boolean;
  /** Jam masuk dasar "HH:mm". */
  cutoff: string;
  /** Jam masuk + toleransi "HH:mm". Setelah ini dihitung terlambat. */
  deadline: string;
}

/**
 * Cermin aturan server untuk tampilan saja. Keputusan resmi tetap di server,
 * yang memakai waktunya sendiri saat absen dikirim.
 */
export function evaluateCheckIn(settings: AttendanceSettings, now: Date): CheckInEvaluation {
  const cutoffMin = toMinutes(settings.defaultCutoffTime);
  const deadlineMin = cutoffMin + settings.toleranceMinutes;
  const base = { cutoff: settings.defaultCutoffTime, deadline: minutesToHhmm(deadlineMin) };

  const blocked = (reason: string): CheckInEvaluation => ({
    ...base,
    canSubmit: false,
    blockReason: reason,
    isLate: false,
    noteRequired: false,
  });

  const dow = dayOfWeekWib(now);
  if (settings.workingDays.length === 0) {
    return blocked("Belum ada hari kerja yang diatur. Hubungi HRD.");
  }
  if (!settings.workingDays.includes(dow)) {
    const allowed = DAY_ORDER.filter((d) => settings.workingDays.includes(d))
      .map((d) => DAY_LABEL_LONG[d])
      .join(", ");
    return blocked(`Hari ${DAY_LABEL_LONG[dow]} bukan hari kerja. Absen hanya bisa dikirim pada ${allowed}.`);
  }

  const nowSec = secondsOfDayWib(now);
  if (nowSec < toMinutes(settings.earliestCheckIn) * 60) {
    return blocked(`Absen baru dibuka pukul ${settings.earliestCheckIn} WIB.`);
  }

  const isLate = nowSec > deadlineMin * 60;
  return {
    ...base,
    canSubmit: true,
    blockReason: null,
    isLate,
    noteRequired: settings.requireNoteWhenLate && isLate,
  };
}

