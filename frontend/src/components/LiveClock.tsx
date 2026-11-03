import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import type { ClockStatus } from '@/hooks/useServerClock';
import { formatDateLong, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  now: Date;
  status: ClockStatus;
  className?: string;
}

function SyncLabel({ status }: { status: ClockStatus }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-present">
        <CheckCircle2 className="size-3.5" aria-hidden /> Sinkron dengan server
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <WifiOff className="size-3.5" aria-hidden /> Memakai jam perangkat
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      Menyinkronkan…
    </span>
  );
}

export function LiveClock({ now, status, className }: Props) {
  return (
    <div className={cn('flex flex-col justify-between py-2 lg:pr-8', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{formatDateLong(now)}</p>
        <SyncLabel status={status} />
      </div>

      <p
        role="timer"
        aria-live="off"
        className="mt-8 font-display text-5xl leading-none tabular-nums tracking-tight text-ink sm:text-7xl"
      >
        {formatTime(now)}
        <span className="ml-2 font-sans text-sm font-medium tracking-normal text-muted sm:text-base">
          WIB
        </span>
      </p>

      <p className="mt-6 text-sm text-muted">
        Jam ini hanya tampilan. Waktu absen resmi dicatat oleh server saat kamu mengirim.
      </p>
    </div>
  );
}
