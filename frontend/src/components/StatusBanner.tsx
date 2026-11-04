import { useEffect } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warning" | "danger";

interface StatusBannerProps {
  message: string | null;
  onDismiss: () => void;
  /** Default "info" (tampilan lama, dipakai halaman Master karyawan). */
  tone?: BannerTone;
}

const TONE_CLASS: Record<BannerTone, string> = {
  info: "bg-accent-soft text-accent-ink",
  warning: "border border-danger/40 bg-card text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger",
};

export function StatusBanner({ message, onDismiss, tone = "info" }: StatusBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn("flex items-start justify-between gap-3 rounded-md px-4 py-3 text-sm", TONE_CLASS[tone])}
    >
      <div className="flex min-w-0 items-start gap-2">
        {tone === "warning" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
        {tone === "danger" && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-my-2 -mr-2 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium underline-offset-2 hover:underline"
      >
        Tutup
      </button>
    </div>
  );
}
