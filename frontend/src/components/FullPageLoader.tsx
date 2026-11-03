import { Loader2 } from 'lucide-react';

export function FullPageLoader() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Memuat…
      </div>
    </div>
  );
}

