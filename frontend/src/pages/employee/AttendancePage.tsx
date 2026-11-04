import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar, CheckCircle2, Clock, History, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AttendanceStatusBadge } from '@/components/AttendanceStatusBadge';
import { AuthedImage } from '@/components/AuthedImage';
import { CheckInWindowInfo } from '@/components/CheckInWindowInfo';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LiveClock } from '@/components/LiveClock';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { PhotoDropzone } from '@/components/PhotoDropzone';
import { Stamp } from '@/components/Stamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiList } from '@/hooks/useApiList';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { useServerClock } from '@/hooks/useServerClock';
import { api } from '@/lib/api';
import { evaluateCheckIn } from '@/lib/attendanceRules';
import { getErrorMessage, getStatus } from '@/lib/errors';
import {
  formatTime,
  formatYmd,
  greeting,
  hourWib,
  initials,
  ymdWib,
} from '@/lib/format';
import type { Attendance, Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const NOTES_MAX = 500;

export default function AttendancePage() {
  const { user } = useAuth();
  const { now, status } = useServerClock();
  const today = ymdWib(now);

  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useAttendanceSettings();

  const [page, setPage] = useState(1);
  const history = useApiList<Attendance>('/attendances/me', { page, limit: 5 });

  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [noteMissing, setNoteMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    setTodayError(null);
    try {
      const { data } = await api.get<Paginated<Attendance>>('/attendances/me', {
        params: { page: 1, limit: 1 },
      });
      setTodayRecord(data.data[0] ?? null);
    } catch (err) {
      setTodayError(getErrorMessage(err));
    } finally {
      setTodayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const currentMonthPrefix = today.slice(0, 7); // e.g. "2026-11"

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(now);
  }, [now]);

  // Hitung ringkasan bulan berjalan dari data riwayat yang dimuat
  const monthStats = useMemo(() => {
    const currentMonthRecords = history.data.filter((item) =>
      item.attendanceDate.startsWith(currentMonthPrefix),
    );

    const presentCount = currentMonthRecords.length;
    const lateRecords = currentMonthRecords.filter((item) => item.status === 'LATE');
    const lateCount = lateRecords.length;
    const totalLateMinutes = lateRecords.reduce(
      (acc, item) => acc + (item.lateMinutes || 0),
      0,
    );

    const isPaginated = (history.meta?.totalPages ?? 1) > 1;

    return {
      presentCount,
      lateCount,
      totalLateMinutes,
      isPaginated,
    };
  }, [history.data, history.meta?.totalPages, currentMonthPrefix]);

  if (!user) return null;

  const checkedIn =
    todayRecord !== null && todayRecord.attendanceDate.slice(0, 10) === today;
  const firstName = user.fullName.trim().split(/\s+/)[0];

  const rule = settings ? evaluateCheckIn(settings, now) : null;
  const blockReason = rule && !rule.canSubmit ? rule.blockReason : null;
  const noteRequired = rule?.noteRequired ?? false;

  function refreshHistory() {
    if (page === 1) history.refetch();
    else setPage(1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setNoteMissing(false);
    if (blockReason) {
      setSubmitError(blockReason);
      return;
    }
    if (!file) {
      setSubmitError('Pilih foto bukti kerja terlebih dahulu.');
      return;
    }
    if (noteRequired && !notes.trim()) {
      setNoteMissing(true);
      setSubmitError('Catatan wajib diisi karena kamu absen setelah batas jam masuk.');
      return;
    }

    const body = new FormData();
    body.append('photo', file);
    if (notes.trim()) body.append('notes', notes.trim());

    setSubmitting(true);
    try {
      const { data } = await api.post<Attendance>('/attendances', body);
      setTodayRecord(data);
      setFile(null);
      setNotes('');
      refreshHistory();
    } catch (err) {
      if (getStatus(err) === 409) {
        setSubmitError('Kamu sudah absen hari ini. Satu karyawan hanya bisa absen sekali per hari.');
        loadToday();
        refreshHistory();
      } else {
        setSubmitError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`${greeting(hourWib(now))}, ${firstName}`}
        description="Kirim foto bukti kerja dari rumah untuk mencatat kehadiranmu hari ini."
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* Kolom Kiri: Jam Digital & Kartu Absen Hari Ini */}
        <div className="space-y-5 lg:col-span-7">
          <LiveClock now={now} status={status}>
            <CheckInWindowInfo
              settings={settings}
              evaluation={rule}
              loading={settingsLoading}
              error={settingsError}
            />
          </LiveClock>

          {/* Area Foto / Absen Hari Ini */}
          <Card className="p-6 sm:p-8">
            <CardTitle className="font-display text-2xl font-normal">Absen hari ini</CardTitle>

            {todayLoading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="aspect-video max-h-[320px] w-full rounded-lg" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : todayError ? (
              <ErrorState message={todayError} onRetry={loadToday} />
            ) : checkedIn && todayRecord ? (
              <div role="status" className="mt-4">
                <div className="flex items-center gap-2 text-present">
                  <CheckCircle2 className="size-5" aria-hidden />
                  <p className="font-semibold">Absen hari ini sudah tercatat</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Tercatat pukul{' '}
                  <span className="font-medium tabular-nums text-ink">
                    {formatTime(todayRecord.checkInAt)} WIB
                  </span>
                  . Sampai jumpa besok.
                </p>
                <AttendanceStatusBadge
                  status={todayRecord.status}
                  lateMinutes={todayRecord.lateMinutes}
                  className="mt-2"
                />
                <div className="relative mt-4 aspect-video max-h-[320px] w-full overflow-hidden rounded-lg border border-line bg-line/50">
                  <AuthedImage
                    attendanceId={todayRecord.id}
                    alt="Foto bukti kerja hari ini"
                    className="h-full w-full"
                  />
                  <Stamp
                    label="Tercatat"
                    time={formatTime(todayRecord.checkInAt)}
                    date={formatYmd(todayRecord.attendanceDate)}
                    name={user.fullName}
                    className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)]"
                  />
                </div>
                {todayRecord.notes && (
                  <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-ink">
                    <span className="text-muted">Catatan: </span>
                    {todayRecord.notes}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
                <PhotoDropzone
                  file={file}
                  onChange={(f) => {
                    setFile(f);
                    setSubmitError(null);
                  }}
                  stampName={user.fullName}
                  now={now}
                  disabled={submitting}
                />

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="notes">
                      {noteRequired ? 'Catatan (wajib)' : 'Catatan (opsional)'}
                    </Label>
                    <span className="text-xs tabular-nums text-muted">
                      {notes.length}/{NOTES_MAX}
                    </span>
                  </div>
                  <Textarea
                    id="notes"
                    value={notes}
                    maxLength={NOTES_MAX}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNoteMissing(false);
                    }}
                    placeholder={
                      noteRequired
                        ? 'Jelaskan alasan kamu absen setelah batas jam masuk.'
                        : 'Contoh: mengerjakan laporan bulanan dari ruang kerja di rumah.'
                    }
                    required={noteRequired}
                    aria-required={noteRequired}
                    aria-invalid={noteMissing}
                    aria-describedby={noteRequired ? 'notes-hint' : undefined}
                    disabled={submitting}
                    className={noteMissing ? 'border-danger' : undefined}
                  />
                  {noteRequired && rule && (
                    <p id="notes-hint" className="text-xs text-muted">
                      Wajib diisi karena sudah melewati batas {rule.deadline} WIB.
                    </p>
                  )}
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    {submitError}
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={submitting || blockReason !== null}
                    aria-describedby={blockReason ? 'submit-block' : undefined}
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Send />
                    )}
                    {submitting ? 'Mengirim…' : 'Kirim absen'}
                  </Button>
                  {blockReason && (
                    <p id="submit-block" role="status" className="text-sm text-muted">
                      {blockReason}
                    </p>
                  )}
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* Kolom Kanan: Profil Singkat, Riwayat Absen, & Ringkasan Bulan Ini */}
        <div className="space-y-5 lg:col-span-5 lg:sticky lg:top-6">
          {/* Profil singkat */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-ink"
              >
                {initials(user.fullName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.fullName}</p>
                <p className="truncate text-sm text-muted">{user.position}</p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-muted">NIK</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{user.nik}</dd>
              </div>
              <div>
                <dt className="text-muted">Status hari ini</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1.5">
                  {todayLoading ? (
                    <Skeleton className="h-6 w-28 rounded-full" />
                  ) : todayError ? (
                    <Badge variant="danger">Gagal dimuat</Badge>
                  ) : checkedIn && todayRecord ? (
                    <>
                      <Badge variant="present">
                        <CheckCircle2 aria-hidden /> Hadir pukul {formatTime(todayRecord.checkInAt)}
                      </Badge>
                      <AttendanceStatusBadge
                        status={todayRecord.status}
                        lateMinutes={todayRecord.lateMinutes}
                      />
                    </>
                  ) : (
                    <Badge variant="neutral">Belum absen</Badge>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Email</dt>
                <dd className="mt-0.5 truncate font-medium">{user.email}</dd>
              </div>
            </dl>
          </Card>

          {/* Riwayat Absen */}
          <Card>
            <div className="p-6 pb-3">
              <CardTitle>Riwayat absen</CardTitle>
            </div>

            {history.loading && history.data.length === 0 ? (
              <ul className="space-y-3 px-6 pb-6">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Skeleton className="size-12" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : history.error ? (
              <ErrorState message={history.error} onRetry={history.refetch} />
            ) : history.data.length === 0 ? (
              <EmptyState
                icon={History}
                title="Belum ada riwayat absen"
                description="Absen pertamamu akan muncul di sini setelah kamu mengirimnya."
              />
            ) : (
              <>
                <ul className="divide-y divide-line px-6">
                  {history.data.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <AuthedImage
                        attendanceId={item.id}
                        alt={`Foto absen ${formatYmd(item.attendanceDate)}`}
                        className="size-12 shrink-0 rounded-md border border-line"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {formatYmd(item.attendanceDate)}
                          <span className="ml-2 font-normal text-muted">
                            {formatTime(item.checkInAt)} WIB
                          </span>
                        </p>
                        <AttendanceStatusBadge
                          status={item.status}
                          lateMinutes={item.lateMinutes}
                          className="mt-1"
                        />
                        <p className="mt-1 truncate text-sm text-muted">
                          {item.notes ?? 'Tanpa catatan'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination meta={history.meta} onPage={setPage} disabled={history.loading} />
              </>
            )}
          </Card>

          {/* Ringkasan Bulan Ini */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted" aria-hidden />
                <CardTitle className="text-base font-semibold">Ringkasan bulan ini</CardTitle>
              </div>
              <span className="text-xs font-medium text-muted">
                {monthName}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-canvas p-3 text-center">
                <p className="text-xs text-muted">Hadir</p>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {monthStats.presentCount}
                  <span className="ml-0.5 text-xs font-normal text-muted"> hr</span>
                </p>
              </div>

              <div className="rounded-lg bg-canvas p-3 text-center">
                <p className="text-xs text-muted">Terlambat</p>
                <p
                  className={cn(
                    'mt-1 font-display text-xl font-semibold tabular-nums',
                    monthStats.lateCount > 0 ? 'text-danger' : 'text-ink',
                  )}
                >
                  {monthStats.lateCount}
                  <span className="ml-0.5 text-xs font-normal text-muted"> hr</span>
                </p>
              </div>

              <div className="rounded-lg bg-canvas p-3 text-center">
                <p className="text-xs text-muted">Total telat</p>
                <p
                  className={cn(
                    'mt-1 font-display text-xl font-semibold tabular-nums',
                    monthStats.totalLateMinutes > 0 ? 'text-danger' : 'text-ink',
                  )}
                >
                  {monthStats.totalLateMinutes}
                  <span className="ml-0.5 text-xs font-normal text-muted"> mnt</span>
                </p>
              </div>
            </div>

            {monthStats.isPaginated && (
              <p className="mt-3 text-xs text-muted">
                * Dihitung dari {history.data.length} data riwayat yang tampil di halaman ini.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
