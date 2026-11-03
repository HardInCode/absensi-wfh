import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertIcon, InboxIcon, RefreshIcon } from "@/components/icons";
import type { PageMeta } from "@/lib/hrdApi";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Dipakai di <th> dan <td>, mis. "hidden md:table-cell" atau "text-right". */
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  meta: PageMeta | null;
  onPage: (page: number) => void;
  empty: { title: string; description?: string; action?: ReactNode };
}

const SKELETON_ROWS = 5;

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  meta,
  onPage,
  empty,
}: DataTableProps<T>) {
  const hasError = error !== null;
  const showSkeleton = !hasError && isLoading && rows === null;
  const showEmpty = !hasError && !showSkeleton && rows !== null && rows.length === 0;
  const showRows = !hasError && !showSkeleton && !showEmpty && rows !== null;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      {hasError && (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <AlertIcon className="h-8 w-8 text-danger" />
          <div>
            <p className="font-medium text-ink">Data tidak dapat dimuat</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
          <Button variant="secondary" onClick={onRetry} className="min-h-11 sm:min-h-0">
            <RefreshIcon className="h-4 w-4" />
            Coba lagi
          </Button>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <InboxIcon className="h-8 w-8 text-muted" />
          <div>
            <p className="font-medium text-ink">{empty.title}</p>
            {empty.description && <p className="mt-1 text-sm text-muted">{empty.description}</p>}
          </div>
          {empty.action}
        </div>
      )}

      {(showSkeleton || showRows) && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm" aria-busy={isLoading}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted",
                      col.className,
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn("transition-opacity", showRows && isLoading && "opacity-60")}>
              {showSkeleton &&
                Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {showRows &&
                rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-line align-middle last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {showRows && meta && meta.total > 0 && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Menampilkan {(meta.page - 1) * meta.limit + 1}-{(meta.page - 1) * meta.limit + rows.length} dari{" "}
            {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 sm:min-h-0"
              disabled={isLoading || meta.page <= 1}
              onClick={() => onPage(meta.page - 1)}
            >
              Sebelumnya
            </Button>
            <span className="px-1 text-sm tabular-nums text-muted">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 sm:min-h-0"
              disabled={isLoading || meta.page >= meta.totalPages}
              onClick={() => onPage(meta.page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

