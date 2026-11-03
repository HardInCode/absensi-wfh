import { useEffect, useState } from "react";
import axios from "axios";
import { fetchAttendancePhoto } from "@/lib/hrdApi";

type Status = "loading" | "ready" | "error";

/** Mengambil foto lewat endpoint terproteksi (Bearer token) lalu menjadikannya blob URL. */
export function useProtectedImage(attendanceId: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    setSrc(null);
    setStatus("loading");
    if (!attendanceId) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;

    fetchAttendancePhoto(attendanceId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        setStatus("error");
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attendanceId]);

  return { src, status };
}

