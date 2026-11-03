import { cn } from '@/lib/utils';

interface StampProps {
  label: 'Pratinjau' | 'Tercatat' | string;
  time: string;
  date: string;
  name?: string;
  className?: string;
}

export function Stamp({ label, time, date, name, className }: StampProps) {
  return (
    <div
      className={cn(
        'max-w-[calc(100%-1.5rem)] -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent',
        className,
      )}
    >
      <p className="text-xs font-semibold text-accent-ink">{label}</p>
      <p className="font-display text-base leading-tight tabular-nums sm:text-lg">
        <span>{date}</span> <span className="font-normal text-muted">pukul</span> <span>{time}</span>
      </p>
      {name && <p className="truncate text-xs font-medium text-ink/80">{name}</p>}
    </div>
  );
}

