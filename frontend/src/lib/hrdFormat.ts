const TIME_ZONE = "Asia/Jakarta";

/** "2026-11-03" -> "Sel, 3 Nov 2026". Memakai UTC agar tanggal tidak bergeser. */
export function formatAttendanceDate(dateValue: string, fallbackIso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateValue);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (fallbackIso) {
    const parsed = new Date(fallbackIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("id-ID", {
        timeZone: TIME_ZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }
  return "-";
}

/** ISO UTC -> "13.45.02" dalam WIB. */
export function formatTimeWib(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

