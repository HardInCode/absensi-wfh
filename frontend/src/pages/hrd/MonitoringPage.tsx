import { useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { ImageIcon, SearchIcon } from "@/components/icons";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { useProtectedImage } from "@/hooks/useProtectedImage";
import { fetchAttendances, type AttendanceRecord } from "@/lib/hrdApi";
import { formatAttendanceDate, formatTimeWib } from "@/lib/hrdFormat";

const PAGE_SIZE = 10;

interface LightboxTarget {
  id: string;
  title: string;
  subtitle: string;
}

function AttendanceThumb({
  attendanceId,
  label,
  onOpen,
}: {
  attendanceId: string;
  label: string;
  onOpen: () => void;
}) {
  const { src, status } = useProtectedImage(attendanceId);

  if (status === "loading") return <Skeleton className="h-14 w-14 rounded-md" />;

  if (status === "error" || !src) {
    return (
      <span
        className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-line text-muted"
        title="Foto tidak dapat dimuat"
      >
        <ImageIcon className="h-5 w-5" />
        <span className="sr-only">Foto tidak dapat dimuat</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Perbesar foto absensi ${label}`}
      className="group block h-14 w-14 cursor-pointer overflow-hidden rounded-md border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

export function MonitoringPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nameInput, setNameInput] = useState("");
  const employeeName = useDebouncedValue(nameInput.trim(), 400);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const hasFilters = Boolean(dateFrom || dateTo || nameInput);

  const filterKey = `${dateFrom}|${dateTo}|${employeeName}`;
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const { data, isLoading, error, reload } = usePagedQuery(
    fetchAttendances,
    { page, limit: PAGE_SIZE, dateFrom, dateTo, employeeName },
    !rangeInvalid,
  );

  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setNameInput("");
  }

  const columns: Column<AttendanceRecord>[] = [
    {
      key: "nik",
      header: "NIK",
      cell: (a) => <span className="font-mono text-sm tabular-nums">{a.employee.nik || "-"}</span>,
    },
    {
      key: "name",
      header: "Nama",
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{a.employee.fullName || "-"}</p>
          {a.employee.position && <p className="truncate text-xs text-muted">{a.employee.position}</p>}
        </div>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      cell: (a) => <span className="whitespace-nowrap">{formatAttendanceDate(a.attendanceDate, a.checkInAt)}</span>,
    },
    {
      key: "time",
      header: "Jam (WIB)",
      cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatTimeWib(a.checkInAt)} WIB</span>,
    },
    {
      key: "notes",
      header: "Catatan",
      className: "hidden md:table-cell",
      cell: (a) =>
        a.notes ? (
          <p className="max-w-xs truncate" title={a.notes}>
            {a.notes}
          </p>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
    {
      key: "photo",
      header: "Foto",
      cell: (a) => {
        const date = formatAttendanceDate(a.attendanceDate, a.checkInAt);
        return (
          <AttendanceThumb
            attendanceId={a.id}
            label={a.employee.fullName}
            onOpen={() =>
              setLightbox({
                id: a.id,
                title: a.employee.fullName || "Karyawan",
                subtitle: `${date}, ${formatTimeWib(a.checkInAt)} WIB${a.notes ? `. Catatan: ${a.notes}` : ""}`,
              })
            }
          />
        );
      },
    },
  ];

  const emptyContent = hasFilters
    ? {
        title: "Tidak ada absensi yang cocok",
        description: "Ubah rentang tanggal atau nama, atau reset filter untuk melihat semua data.",
        action: (
          <Button variant="secondary" onClick={resetFilters} className="min-h-11 sm:min-h-0">
            Reset filter
          </Button>
        ),
      }
    : {
        title: "Belum ada absensi",
        description: "Data akan muncul di sini setelah karyawan melakukan absen.",
      };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Monitoring absensi</h1>
        <p className="mt-1 text-sm text-muted">Hanya untuk dilihat. Data absensi tidak dapat diubah atau dihapus.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="date-from">Dari tanggal</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid ? "range-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-to">Sampai tanggal</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid ? "range-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-name">Nama karyawan</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="employee-name"
              type="search"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Cari nama"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="min-h-11 w-full sm:min-h-0 lg:w-auto"
          >
            Reset filter
          </Button>
        </div>
      </div>

      {rangeInvalid && (
        <p id="range-error" role="alert" className="text-sm text-danger">
          Tanggal awal tidak boleh lebih besar dari tanggal akhir.
        </p>
      )}

      <DataTable
        caption="Daftar absensi karyawan"
        columns={columns}
        rows={data?.items ?? null}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        meta={data?.meta ?? null}
        onPage={(next) => setPageState({ key: filterKey, page: next })}
        empty={emptyContent}
      />

      <PhotoLightbox
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        attendanceId={lightbox?.id ?? null}
        title={lightbox?.title ?? ""}
        subtitle={lightbox?.subtitle}
      />
    </div>
  );
}

