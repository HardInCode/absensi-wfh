import { cn } from '@/lib/utils';

interface Props {
  label: string;
  time: string;
  date: string;
  name?: string;
  className?: string;
}

/**
 * Stempel tinta: motif identitas aplikasi.
 * "Pratinjau" = hanya tampilan di perangkat. "Tercatat" = waktu resmi dari server.
 */
export function Stamp({ label, time, date, name, className }: Props) {
  return (
    <div
      className={cn(
        'inline-block -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent-ink',
        className,
      )}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="font-display text-lg leading-tight tabular-nums">{time} WIB</p>
      <p className="text-xs tabular-nums">{date}</p>
      {name && <p className="truncate text-xs font-medium">{name}</p>}
    </div>
  );
}
