import { Skeleton } from '@/components/ui/skeleton';
import type { CheckInEvaluation } from '@/lib/attendanceRules';
import type { AttendanceSettings } from '@/lib/types';

interface Props {
  settings: AttendanceSettings | null;
  evaluation: CheckInEvaluation | null;
  loading: boolean;
  error: string | null;
}

export function CheckInWindowInfo({ settings, evaluation, loading, error }: Props) {
  if (loading) return <Skeleton className="h-10 w-full max-w-sm" />;

  if (error || !settings || !evaluation) {
    return (
      <p className="text-sm text-muted">
        Info batas jam masuk tidak dapat dimuat. Server tetap memeriksa aturan saat kamu mengirim.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      <p className="text-ink">
        Batas jam masuk <span className="font-medium tabular-nums">{evaluation.cutoff} WIB</span>
        {settings.toleranceMinutes > 0 && (
          <>
            , toleransi {settings.toleranceMinutes} menit. Terlambat dihitung setelah{' '}
            <span className="font-medium tabular-nums">{evaluation.deadline} WIB</span>.
          </>
        )}
        {settings.toleranceMinutes === 0 && '. Tanpa toleransi.'}
      </p>
      <p className="text-muted">
        Absen dibuka mulai <span className="tabular-nums">{settings.earliestCheckIn} WIB</span>.
      </p>
      {evaluation.canSubmit && evaluation.isLate && (
        <p role="status" className="font-medium text-danger">
          Batas sudah lewat. Absenmu akan tercatat terlambat.
        </p>
      )}
    </div>
  );
}

