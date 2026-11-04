import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AttendanceStatus } from '@/lib/types';

interface Props {
  status: AttendanceStatus;
  lateMinutes: number;
  className?: string;
}

export function AttendanceStatusBadge({ status, lateMinutes, className }: Props) {
  if (status === 'LATE') {
    return (
      <Badge variant="danger" className={className}>
        <Clock aria-hidden /> Terlambat (+{lateMinutes} mnt)
      </Badge>
    );
  }
  return (
    <Badge variant="present" className={className}>
      <CheckCircle2 aria-hidden /> Tepat waktu
    </Badge>
  );
}

