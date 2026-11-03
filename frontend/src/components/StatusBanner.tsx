import { useEffect } from "react";

interface StatusBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function StatusBanner({ message, onDismiss }: StatusBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-accent-ink"
    >
      <p>{message}</p>
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

