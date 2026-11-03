import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">Data tidak dapat dimuat</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Coba lagi
        </Button>
      )}
    </div>
  );
}

