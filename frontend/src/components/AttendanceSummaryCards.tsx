import { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircle2, Clock, UserCheck, UserX, Users, type LucideIcon } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAttendanceSummary,
  getErrorMessage,
  type AttendanceSummary,
} from "@/lib/hrdApi";
import { formatAttendanceDate } from "@/lib/hrdFormat";
import { cn } from "@/lib/utils";

interface Props {
  /** Tanggal dari filter (satu hari). undefined = hari ini WIB. */
  date: string | undefined;
  /** Tanggal yang ditampilkan selama data belum datang (YYYY-MM-DD). */
  displayDate: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  chipClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  chipClass: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-card p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", chipClass)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 font-display text-3xl leading-none tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-line bg-card p-4">
            <Skeleton className="size-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function AttendanceSummaryCards({ date, displayDate }: Props) {
  const [data, setData] = useState<AttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    setIsLoading(true);
    fetchAttendanceSummary(date, controller.signal)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(getErrorMessage(err, "Gagal memuat ringkasan."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [date, reloadToken]);

  const shownDate = data?.date || displayDate;

  return (
    <section aria-labelledby="summary-title" className="space-y-3">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="summary-title" className="text-base font-semibold text-ink">
          Ringkasan kehadiran
        </h2>
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{formatAttendanceDate(shownDate)}</span>
          {" · "}
          {date ? "mengikuti filter tanggal" : "hari ini (WIB)"}
        </p>
      </div>

      {isLoading && <SummarySkeleton />}

      {error && !isLoading && (
        <Card>
          <ErrorState
            message={`Ringkasan kehadiran belum bisa ditampilkan. ${error}`}
            onRetry={() => setReloadToken((n) => n + 1)}
          />
        </Card>
      )}

      {data && !isLoading && !error && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total karyawan aktif"
              value={data.totalEmployees}
              chipClass="bg-accent-soft text-accent-ink"
            />
            <StatCard
              icon={UserCheck}
              label="Sudah absen"
              value={data.presentCount}
              hint={`${data.onTimeCount} tepat waktu`}
              chipClass="bg-present-soft text-present"
            />
            <StatCard
              icon={Clock}
              label="Terlambat"
              value={data.lateCount}
              chipClass="bg-danger-soft text-danger"
            />
            <StatCard
              icon={UserX}
              label="Belum absen"
              value={data.absentCount}
              chipClass="bg-line/70 text-muted"
            />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">Belum absen</h3>
              <Badge variant="neutral">{data.absentEmployees.length} orang</Badge>
            </div>

            {data.absentEmployees.length === 0 ? (
              <p role="status" className="mt-3 flex items-center gap-2 text-sm text-present">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {data.totalEmployees === 0
                  ? "Belum ada karyawan aktif pada tanggal ini."
                  : "Semua karyawan aktif sudah absen. Kerja bagus!"}
              </p>
            ) : (
              <div
                role="region"
                aria-label="Daftar karyawan yang belum absen"
                tabIndex={0}
                className="mt-3 max-h-48 overflow-y-auto"
              >
                <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data.absentEmployees.map((e) => (
                    <li
                      key={e.id}
                      className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-ink">{e.fullName || "-"}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{e.nik || "-"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

