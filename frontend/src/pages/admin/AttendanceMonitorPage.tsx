import { useEffect, useState } from 'react';
import { ClipboardList, RotateCcw, Search } from 'lucide-react';
import { AuthedImage } from '@/components/AuthedImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiList } from '@/hooks/useApiList';
import { useDebounce } from '@/hooks/useDebounce';
import { formatTime, formatYmd } from '@/lib/format';
import type { AttendanceWithEmployee } from '@/lib/types';

const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
const TD = 'px-4 py-2.5 align-middle';

export default function AttendanceMonitorPage() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameInput, setNameInput] = useState('');
  const name = useDebounce(nameInput.trim(), 400);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const list = useApiList<AttendanceWithEmployee>(
    '/attendances',
    rangeInvalid
      ? null
      : {
          page,
          limit: 10,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          employee_name: name || undefined,
        },
  );

  useEffect(() => {
    setPage(1);
  }, [name]);

  const hasFilter = Boolean(dateFrom || dateTo || nameInput);

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setNameInput('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Absensi Karyawan"
        description="Pantau absensi WFH yang sudah dikirim karyawan. Data hanya untuk dilihat."
      />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto] lg:items-end">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="name">Nama karyawan</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                id="name"
                type="search"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Cari nama karyawan"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">Dari tanggal</Label>
            <Input
              id="from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              aria-invalid={rangeInvalid}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Sampai tanggal</Label>
            <Input
              id="to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              aria-invalid={rangeInvalid}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="secondary" onClick={resetFilters} disabled={!hasFilter}>
            <RotateCcw /> Atur ulang
          </Button>
        </div>

        {rangeInvalid ? (
          <div role="alert" className="px-6 py-10 text-center text-sm text-danger">
            Tanggal awal tidak boleh lebih besar dari tanggal akhir.
          </div>
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th scope="col" className={TH}>Tanggal</th>
                  <th scope="col" className={TH}>Jam masuk</th>
                  <th scope="col" className={TH}>Karyawan</th>
                  <th scope="col" className={TH}>Catatan</th>
                  <th scope="col" className={TH}>Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.loading && list.data.length === 0
                  ? [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        {[0, 1, 2, 3, 4].map((c) => (
                          <td key={c} className={TD}>
                            <Skeleton className="h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : list.data.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas/70">
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>
                          {formatYmd(row.attendanceDate)}
                        </td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>
                          {formatTime(row.checkInAt)}
                          <span className="ml-1 text-xs text-muted">WIB</span>
                        </td>
                        <td className={TD}>
                          <p className="font-medium">{row.employee.fullName}</p>
                          <p className="text-xs text-muted">
                            <span className="tabular-nums">{row.employee.nik}</span> ·{' '}
                            {row.employee.position}
                          </p>
                        </td>
                        <td className={`${TD} max-w-[260px]`}>
                          {row.notes ? (
                            <span className="line-clamp-2" title={row.notes}>
                              {row.notes}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className={TD}>
                          <AuthedImage
                            attendanceId={row.id}
                            alt={`Foto absen ${row.employee.fullName}, ${formatYmd(row.attendanceDate)}`}
                            className="size-11 rounded-md border border-line"
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!list.loading && list.data.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title={hasFilter ? 'Tidak ada absensi yang cocok' : 'Belum ada absensi'}
                description={
                  hasFilter
                    ? 'Coba perluas rentang tanggal atau ubah nama yang dicari.'
                    : 'Absensi akan muncul di sini setelah karyawan mengirimnya.'
                }
              />
            )}
          </div>
        )}

        {!rangeInvalid && !list.error && (
          <Pagination meta={list.meta} onPage={setPage} disabled={list.loading} />
        )}
      </Card>
    </>
  );
}

