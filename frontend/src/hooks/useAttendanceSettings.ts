import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { fetchAttendanceSettings, getErrorMessage, type AttendanceSettings } from "@/lib/hrdApi";

export function useAttendanceSettings() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchAttendanceSettings(controller.signal)
      .then((result) => setSettings(result))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(getErrorMessage(err, "Gagal memuat pengaturan absensi."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { settings, setSettings, isLoading, error, reload };
}
