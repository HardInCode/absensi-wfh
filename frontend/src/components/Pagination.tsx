import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Meta } from '@/lib/types';

interface Props {
  meta: Meta | null;
  onPage: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ meta, onPage, disabled }: Props) {
  if (!meta || meta.total === 0) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const totalPages = Math.max(meta.totalPages, 1);

  return (
    <nav
      aria-label="Paginasi"
      className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:flex-row"
    >
      <p className="tabular-nums text-muted">
        Menampilkan {from}–{to} dari {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft /> Sebelumnya
        </Button>
        <span className="px-1 tabular-nums text-muted">
          {meta.page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || meta.page >= totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          Berikutnya <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

