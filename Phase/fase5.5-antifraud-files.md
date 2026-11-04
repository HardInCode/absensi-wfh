# Kumpulan File Fase 5.5 - Anti-Fraud & Perbaikan Alur Absensi

Dokumen ini berisi kode lengkap tanpa potongan atau ringkasan untuk seluruh file frontend (komponen kamera/dropzone, stempel, halaman absensi karyawan, aturan validasi, banner toast) dan backend (upload & penyimpanan foto di gateway, rollback file, entity, controller, service, rpc constants/interfaces, serta konfigurasi pembuatan tabel database).

## Daftar Isi
### Frontend
1. [frontend/src/components/PhotoDropzone.tsx](#1-frontendsrccomponentsphotodropzonetsx) - Komponen input foto bukti kerja (drag-and-drop, validasi tipe/ukuran, pratinjau stempel).
2. [frontend/src/pages/employee/AttendancePage.tsx](#2-frontendsrcpagesemployeeattendancepagetsx) - Halaman absensi karyawan (live clock, evaluasi aturan cutoff, submit multipart foto, riwayat & ringkasan bulanan).
3. [frontend/src/lib/api.ts](#3-frontendsrclibapits) - Axios instance utama (dipakai untuk request `/attendances`, interceptor bearer token, event 401).
4. [frontend/src/lib/types.ts](#4-frontendsrclibtypests) - Definisi tipe data absensi, setting, employee, dan response paginasi.
5. [frontend/src/lib/attendanceRules.ts](#5-frontendsrclibattendancerulests) - Evaluasi aturan jam kerja, cut-off jam masuk, toleransi keterlambatan, dan keharusan catatan.
6. [frontend/src/components/Stamp.tsx](#6-frontendsrccomponentsstamptsx) - Komponen stempel identitas visual (Pratinjau / Tercatat, jam WIB, tanggal, nama karyawan).
7. [frontend/src/components/StatusBanner.tsx](#7-frontendsrccomponentsstatusbannertsx) - Komponen toast / inline alert banner dengan variasi tone ("info", "warning", "danger").

### Backend (API Gateway)
8. [backend/apps/api-gateway/src/attendances/attendances.controller.ts](#8-backendappsapi-gatewaysrcattendancesattendancescontrollerts) - Controller gateway penerima upload multipart photo (`@UploadedFile()`, limits, Swagger schema).
9. [backend/apps/api-gateway/src/attendances/attendances.service.ts](#9-backendappsapi-gatewaysrcattendancesattendancesservicets) - Logika submit absensi gateway, pemanggilan storage, serta rollback penghapusan file jika ditolak service.
10. [backend/apps/api-gateway/src/attendances/photo-storage.service.ts](#10-backendappsapi-gatewaysrcattendancesphoto-storageservicets) - Manajemen penyimpanan file fisik foto (UUID rename, save wx, open stream, safe delete unlink).
11. [backend/apps/api-gateway/src/attendances/attendance.mapper.ts](#11-backendappsapi-gatewaysrcattendancesattendancemapperts) - Mapper record database ke view response klien (`photoUrl`, `checkInAt`, status).
12. [backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts](#12-backendappsapi-gatewaysrcattendancesdtoattendancedtots) - Seluruh DTO absensi (CreateAttendanceDto, Query, Settings, Summary, Export).

### Backend (Attendance Service)
13. [backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts](#13-backendappsattendance-servicesrcattendancesentitiesattendanceentityts) - Entity TypeORM tabel `attendances` (uuid, employee_id, check_in_at, attendance_date, photo_path, status, late_minutes).
14. [backend/apps/attendance-service/src/attendances/attendances.service.ts](#14-backendappsattendance-servicesrcattendancesattendancesservicets) - Logika bisnis pencatatan absensi, penolakan jika sudah absen (409), perhitungan keterlambatan, dan pencegahan balapan balapan query.
15. [backend/apps/attendance-service/src/attendances/attendances.controller.ts](#15-backendappsattendance-servicesrcattendancesattendancescontrollerts) - Controller message pattern RPC untuk attendance service (`attendances.create`, `findToday`, `findAll`, dll.).

### Common & Skema Database
16. [backend/libs/common/src/constants/rpc.constants.ts](#16-backendlibscommonsrcconstantsrpcconstantsts) - Konstanta pola pesan RPC (`AttendancePattern`, `EmployeePattern`).
17. [backend/libs/common/src/interfaces/attendance.interface.ts](#17-backendlibscommonsrcinterfacesattendanceinterfacets) - Kontrak interface antarlayanan (`CreateAttendancePayload`, `AttendanceRecord`, `DailyStatsPayload`).
18. [backend/libs/common/src/database/typeorm.config.ts](#18-backendlibscommonsrcdatabasetypeormconfigts) - Konfigurasi sinkronisasi TypeORM (`synchronize: DB_SYNCHRONIZE`).
19. [backend/apps/attendance-service/src/attendance-service.module.ts](#19-backendappsattendance-servicesrcattendance-servicemodulets) - Modul attendance service dengan koneksi TypeORM entitas `Attendance` & `AttendanceSettings`.
20. [backend/apps/attendance-service/src/attendances/attendance-settings.service.ts](#20-backendappsattendance-servicesrcattendancesattendance-settingsservicets) - Mekanisme auto-seeder idempoten saat startup service (`onModuleInit`).

---

### 1. `frontend/src/components/PhotoDropzone.tsx`
```tsx
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/Stamp';
import { formatDateShort, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024;

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  stampName: string;
  /** Waktu (sinkron server) untuk stempel pratinjau */
  now: Date;
  disabled?: boolean;
}

export function PhotoDropzone({ file, onChange, stampName, now, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(list: FileList | null) {
    const candidate = list?.[0];
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setLocalError('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setLocalError('Ukuran foto maksimal 3 MB.');
      return;
    }
    setLocalError(null);
    onChange(candidate);
  }

  function clear() {
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pick(e.dataTransfer.files);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => pick(e.target.files)}
      />

      {!file || !previewUrl ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Pilih foto bukti kerja"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent active:bg-accent-soft/40',
            dragging && 'border-accent bg-accent-soft',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <ImagePlus className="size-7 text-accent" aria-hidden />
          <p className="text-sm font-medium text-ink">
            Tarik foto ke sini atau pilih dari perangkat
          </p>
          <p className="text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB</p>
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          <Stamp
            label="Pratinjau"
            time={formatTime(now)}
            date={formatDateShort(now)}
            name={stampName}
            className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
          />

          <div className="absolute right-3 top-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw /> Ganti
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={clear}
              aria-label="Hapus foto"
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {file && (
        <p className="mt-2 text-xs text-muted">
          Stempel di atas hanya pratinjau. Waktu absen resmi dicatat server saat kamu menekan
          kirim.
        </p>
      )}
      {localError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {localError}
        </p>
      )}
    </div>
  );
}
```

---

### 2. `frontend/src/pages/employee/AttendancePage.tsx`
```tsx
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
```

---

### 3. `frontend/src/lib/api.ts`
```ts
import axios, { type AxiosError } from "axios";

export const TOKEN_KEY = "absensi.token";
export const AUTH_EXPIRED_EVENT = "auth:expired";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default api;
```

---

### 4. `frontend/src/lib/types.ts`
```ts
export type Role = 'EMPLOYEE' | 'ADMIN_HRD';

export type AttendanceStatus = 'ON_TIME' | 'LATE';

export interface Employee {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  /** ISO 8601 UTC (akhiran Z). Tampilkan dengan timeZone Asia/Jakarta. */
  checkInAt: string;
  /** YYYY-MM-DD menurut WIB. Tampilkan apa adanya, jangan lewat new Date(). */
  attendanceDate: string;
  notes: string | null;
  createdAt: string;
  photoUrl: string;
  status: AttendanceStatus;
  /** 0 jika tepat waktu. */
  lateMinutes: number;
}

export interface AttendanceWithEmployee extends Attendance {
  employee: Pick<Employee, 'id' | 'nik' | 'fullName' | 'email' | 'position'>;
}

/** Hari kerja memakai indeks JS: 0 = Minggu ... 6 = Sabtu. */
export interface AttendanceSettings {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: number;
  requireNoteWhenLate: boolean;
  workingDays: number[];
  /** Opsional: hanya terisi jika server mengirimnya. */
  updatedAt: string | null;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: Meta;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: Employee;
}
```

---

### 5. `frontend/src/lib/attendanceRules.ts`
```ts
import { dayOfWeekWib, secondsOfDayWib } from "@/lib/format";
import type { AttendanceSettings } from "@/lib/types";

/** Indeks hari mengikuti JS (0 = Minggu). */
export const DAY_LABEL_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_LABEL_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
/** Urutan tampil Senin sampai Minggu. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export interface CheckInEvaluation {
  canSubmit: boolean;
  /** Alasan tombol kirim nonaktif; null jika boleh kirim. */
  blockReason: string | null;
  /** Waktu sekarang sudah melewati jam masuk + toleransi. */
  isLate: boolean;
  /** Catatan wajib: pengaturan mewajibkan DAN sudah melewati batas. */
  noteRequired: boolean;
  /** Jam masuk dasar "HH:mm". */
  cutoff: string;
  /** Jam masuk + toleransi "HH:mm". Setelah ini dihitung terlambat. */
  deadline: string;
}

/**
 * Cermin aturan server untuk tampilan saja. Keputusan resmi tetap di server,
 * yang memakai waktunya sendiri saat absen dikirim.
 */
export function evaluateCheckIn(settings: AttendanceSettings, now: Date): CheckInEvaluation {
  const cutoffMin = toMinutes(settings.defaultCutoffTime);
  const deadlineMin = cutoffMin + settings.toleranceMinutes;
  const base = { cutoff: settings.defaultCutoffTime, deadline: minutesToHhmm(deadlineMin) };

  const blocked = (reason: string): CheckInEvaluation => ({
    ...base,
    canSubmit: false,
    blockReason: reason,
    isLate: false,
    noteRequired: false,
  });

  const dow = dayOfWeekWib(now);
  if (settings.workingDays.length === 0) {
    return blocked("Belum ada hari kerja yang diatur. Hubungi HRD.");
  }
  if (!settings.workingDays.includes(dow)) {
    const allowed = DAY_ORDER.filter((d) => settings.workingDays.includes(d))
      .map((d) => DAY_LABEL_LONG[d])
      .join(", ");
    return blocked(`Hari ${DAY_LABEL_LONG[dow]} bukan hari kerja. Absen hanya bisa dikirim pada ${allowed}.`);
  }

  const nowSec = secondsOfDayWib(now);
  if (nowSec < toMinutes(settings.earliestCheckIn) * 60) {
    return blocked(`Absen baru dibuka pukul ${settings.earliestCheckIn} WIB.`);
  }

  const isLate = nowSec > deadlineMin * 60;
  return {
    ...base,
    canSubmit: true,
    blockReason: null,
    isLate,
    noteRequired: settings.requireNoteWhenLate && isLate,
  };
}
```

---

### 6. `frontend/src/components/Stamp.tsx`
```tsx
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  time: string;
  date: string;
  name?: string;
  className?: string;
}

/**
 * Stempel tinta: motif identitas aplikasi.
 * "Pratinjau" = hanya tampilan di perangkat. "Tercatat" = waktu resmi dari server.
 */
export function Stamp({ label, time, date, name, className }: Props) {
  return (
    <div
      className={cn(
        'inline-block -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent-ink',
        className,
      )}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="font-display text-lg leading-tight tabular-nums">{time} WIB</p>
      <p className="text-xs tabular-nums">{date}</p>
      {name && <p className="truncate text-xs font-medium">{name}</p>}
    </div>
  );
}
```

---

### 7. `frontend/src/components/StatusBanner.tsx`
```tsx
import { useEffect } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warning" | "danger";

interface StatusBannerProps {
  message: string | null;
  onDismiss: () => void;
  /** Default "info" (tampilan lama, dipakai halaman Master karyawan). */
  tone?: BannerTone;
}

const TONE_CLASS: Record<BannerTone, string> = {
  info: "bg-accent-soft text-accent-ink",
  warning: "border border-danger/40 bg-card text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger",
};

export function StatusBanner({ message, onDismiss, tone = "info" }: StatusBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn("flex items-start justify-between gap-3 rounded-md px-4 py-3 text-sm", TONE_CLASS[tone])}
    >
      <div className="flex min-w-0 items-start gap-2">
        {tone === "warning" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
        {tone === "danger" && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-my-2 -mr-2 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium underline-offset-2 hover:underline"
      >
        Tutup
      </button>
    </div>
  );
}
```

---

### 8. `backend/apps/api-gateway/src/attendances/attendances.controller.ts`
```ts
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, Role } from '@app/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MAX_PHOTO_BYTES } from './attendances.constants';
import { AttendancesService } from './attendances.service';
import {
  AttendanceAdminListResponseDto,
  AttendanceListResponseDto,
  AttendanceResponseDto,
  AttendanceSettingsResponseDto,
  AttendanceSummaryResponseDto,
  CreateAttendanceDto,
  ExportAttendancesQueryDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  QuerySummaryDto,
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'jpg/png/webp, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 },
    }),
  )
  submit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendances.submit(user, photo, dto);
  }

  @Get('today')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceResponseDto, description: 'null jika belum absen' })
  today(@CurrentUser() user: AuthUser) {
    return this.attendances.today(user);
  }

  @Get(['my', 'me'])
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceListResponseDto })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryMyAttendancesDto) {
    return this.attendances.mine(user, query);
  }

  /** Tanpa @Roles: semua user login (EMPLOYEE dan ADMIN_HRD), sama seperti endpoint photo. */
  @Get('settings')
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  getSettings() {
    return this.attendances.getSettings();
  }

  @Patch('settings')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  updateSettings(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.attendances.updateSettings(dto);
  }

  @Get('summary')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSummaryResponseDto })
  summary(@Query() query: QuerySummaryDto) {
    return this.attendances.summary(query);
  }

  @Get('export')
  @Roles(Role.ADMIN_HRD)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description:
      'File CSV (UTF-8 dengan BOM), maks 5000 baris. Header X-Export-Truncated: true jika data terpotong.',
  })
  @Header('Cache-Control', 'private, no-store')
  async exportCsv(
    @Query() query: ExportAttendancesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { content, filename, truncated } = await this.attendances.exportCsv(query);
    res.setHeader('X-Export-Truncated', String(truncated));
    const body = Buffer.from(content, 'utf8');
    return new StreamableFile(body, {
      type: 'text/csv; charset=utf-8',
      length: body.length,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceAdminListResponseDto })
  list(@Query() query: QueryAttendancesDto) {
    return this.attendances.list(query);
  }

  @Get(':id/photo')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary image stream' })
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendances.openPhoto(user, id);
    return new StreamableFile(stream, { type: mime, length: size, disposition: 'inline' });
  }
}
```

---

### 9. `backend/apps/api-gateway/src/attendances/attendances.service.ts`
```ts
import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ReadStream } from 'fs';
import {
  AttendanceRecord,
  AttendanceSettingsRecord,
  AttendanceStatus,
  AuthUser,
  EmployeeBrief,
  PaginatedResult,
  Role,
  UpdateAttendanceSettingsPayload,
  formatWibIso,
  wibDateString,
} from '@app/common';
import { AttendanceServiceClient } from '../clients/attendance-service.client';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { EXPORT_MAX_ROWS } from './attendances.export.constants';
import { SEARCH_ID_LIMIT } from './attendances.constants';
import {
  AttendanceAdminView,
  AttendanceView,
  toAttendanceAdminView,
  toAttendanceView,
} from './attendance.mapper';
import {
  CreateAttendanceDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  QuerySummaryDto,
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';
import { PhotoStorageService } from './photo-storage.service';
import { buildCsv } from './utils/csv.util';
import { detectImageType } from './utils/image-type.util';

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};

function assertDateRange(from?: string, to?: string) {
  if (from && !isRealDate(from)) throw new BadRequestException('dateFrom is not a valid date');
  if (to && !isRealDate(to)) throw new BadRequestException('dateTo is not a valid date');
  if (from && to && from > to) {
    throw new BadRequestException('dateFrom must not be after dateTo');
  }
}

export interface AttendanceSummaryView {
  date: string;
  totalEmployees: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  absentEmployees: { id: string; fullName: string; nik: string }[];
}

type AttendanceFilterInput = Pick<
  QueryAttendancesDto,
  'dateFrom' | 'dateTo' | 'date_from' | 'date_to' | 'search' | 'employee_name' | 'employeeId' | 'status'
>;

interface ResolvedFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  employeeIds?: string[];
  /** true jika pencarian nama/NIK tidak cocok dengan siapa pun: hasil pasti kosong. */
  noMatch: boolean;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.ON_TIME]: 'Tepat Waktu',
  [AttendanceStatus.LATE]: 'Terlambat',
};

const CSV_HEADER = [
  'NIK',
  'Nama Karyawan',
  'Tanggal',
  'Jam (WIB)',
  'Status',
  'Keterlambatan (Menit)',
  'Catatan',
];

@Injectable()
export class AttendancesService {
  private readonly logger = new Logger(AttendancesService.name);

  constructor(
    private readonly attendances: AttendanceServiceClient,
    private readonly employees: EmployeeServiceClient,
    private readonly storage: PhotoStorageService,
  ) {}

  async submit(
    user: AuthUser,
    file: Express.Multer.File | undefined,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceView> {
    if (!file) throw new BadRequestException('Photo is required (field "photo")');

    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Photo must be a JPEG, PNG, or WEBP image');

    const filename = await this.storage.save(file.buffer, type.ext);
    try {
      // employeeId SELALU dari token, tidak pernah dari body.
      const record = await this.attendances.create({
        employeeId: user.id,
        photoPath: filename,
        notes: dto.notes,
      });
      return toAttendanceView(record);
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        this.logger.warn(`Timeout saat menyimpan absensi; file ${filename} dipertahankan`);
      } else {
        await this.storage.remove(filename); // rollback file (termasuk saat 400 aturan jam kerja)
      }
      throw err;
    }
  }

  async today(user: AuthUser): Promise<AttendanceView | null> {
    const record = await this.attendances.findToday(user.id);
    return record ? toAttendanceView(record) : null;
  }

  async mine(user: AuthUser, q: QueryMyAttendancesDto): Promise<PaginatedResult<AttendanceView>> {
    const dateFrom = q.dateFrom ?? q.date_from;
    const dateTo = q.dateTo ?? q.date_to;
    assertDateRange(dateFrom, dateTo);
    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds: [user.id],
      dateFrom,
      dateTo,
    });
    return { data: result.data.map(toAttendanceView), meta: result.meta };
  }

  /** Filter bersama untuk daftar HRD dan export, supaya perilakunya selalu sama. */
  private async resolveFilter(q: AttendanceFilterInput): Promise<ResolvedFilter> {
    const dateFrom = q.dateFrom ?? q.date_from;
    const dateTo = q.dateTo ?? q.date_to;
    const search = q.search ?? q.employee_name;
    assertDateRange(dateFrom, dateTo);

    let employeeIds: string[] | undefined;
    if (search) {
      const matched = await this.employees.searchIds(search, SEARCH_ID_LIMIT);
      if (matched.length >= SEARCH_ID_LIMIT) {
        this.logger.warn(`Pencarian "${search}" menyentuh batas ${SEARCH_ID_LIMIT} karyawan`);
      }
      employeeIds = q.employeeId ? matched.filter((id) => id === q.employeeId) : matched;
      if (employeeIds.length === 0) {
        return { dateFrom, dateTo, status: q.status, employeeIds, noMatch: true };
      }
    } else if (q.employeeId) {
      employeeIds = [q.employeeId];
    }
    return { dateFrom, dateTo, status: q.status, employeeIds, noMatch: false };
  }

  /** Satu query batch untuk profil karyawan (bukan N+1). */
  private async briefsById(records: AttendanceRecord[]): Promise<Map<string, EmployeeBrief>> {
    const ids = [...new Set(records.map((r) => r.employeeId))];
    const briefs = ids.length ? await this.employees.findBriefsByIds(ids) : [];
    return new Map(briefs.map((b) => [b.id, b]));
  }

  async list(q: QueryAttendancesDto): Promise<PaginatedResult<AttendanceAdminView>> {
    const f = await this.resolveFilter(q);
    if (f.noMatch) {
      return {
        data: [],
        meta: { total: 0, page: q.page, limit: q.limit, totalPages: 0 },
      };
    }

    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds: f.employeeIds,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
      status: f.status,
    });

    const byId = await this.briefsById(result.data);
    return {
      data: result.data.map((r) => toAttendanceAdminView(r, byId.get(r.employeeId) ?? null)),
      meta: result.meta,
    };
  }

  /**
   * Ringkasan harian. Populasi = karyawan aktif ber-role EMPLOYEE (ADMIN_HRD tidak dihitung),
   * diambil SEKALI dari employee-service. Urutannya sekuensial karena getDailyStats
   * membutuhkan daftar ID tersebut; total tetap dua panggilan RPC.
   */
  async summary(q: QuerySummaryDto): Promise<AttendanceSummaryView> {
    const date = q.date ?? wibDateString();
    if (!isRealDate(date)) {
      throw new BadRequestException('Tanggal tidak valid. Gunakan format YYYY-MM-DD, contoh 2026-11-04.');
    }

    const staff = await this.employees.findActiveStaff();
    const stats = await this.attendances.getDailyStats({
      date,
      employeeIds: staff.map((s) => s.id),
    });

    const present = new Set(stats.presentEmployeeIds);
    const absentEmployees = staff
      .filter((s) => !present.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.fullName, nik: s.nik }));

    return {
      date,
      totalEmployees: staff.length,
      presentCount: stats.presentCount,
      onTimeCount: stats.onTimeCount,
      lateCount: stats.lateCount,
      absentCount: absentEmployees.length,
      absentEmployees,
    };
  }

  /** CSV sesuai filter daftar HRD. Maksimum EXPORT_MAX_ROWS baris; `truncated` menandai data terpotong. */
  async exportCsv(
    q: AttendanceFilterInput,
  ): Promise<{ content: string; filename: string; truncated: boolean }> {
    const f = await this.resolveFilter(q);

    let records: AttendanceRecord[] = [];
    let total = 0;
    if (!f.noMatch) {
      const result = await this.attendances.findAll({
        page: 1,
        limit: EXPORT_MAX_ROWS,
        employeeIds: f.employeeIds,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        status: f.status,
      });
      records = result.data;
      total = result.meta.total;
    }

    const truncated = total > EXPORT_MAX_ROWS;
    if (truncated) {
      this.logger.warn(`Export dipotong: ${total} baris cocok, hanya ${EXPORT_MAX_ROWS} diekspor`);
    }

    const byId = await this.briefsById(records);
    const rows = records.map((r) => {
      const emp = byId.get(r.employeeId);
      // checkInAt tiba sebagai ISO UTC lewat TCP; ubah ke jam dinding WIB (HH:mm:ss).
      const jam = formatWibIso(new Date(r.checkInAt)).slice(11, 19);
      return [
        emp?.nik ?? '',
        emp?.fullName ?? '',
        r.attendanceDate,
        jam,
        STATUS_LABEL[r.status] ?? r.status,
        r.lateMinutes,
        r.notes ?? '',
      ];
    });

    return {
      // BOM agar Excel membaca UTF-8 dengan benar.
      content: '\uFEFF' + buildCsv(CSV_HEADER, rows),
      filename: `rekap-absensi-wfh-${wibDateString()}.csv`,
      truncated,
    };
  }

  async openPhoto(
    user: AuthUser,
    id: string,
  ): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const record = await this.attendances.findOne(id);
    if (user.role !== Role.ADMIN_HRD && record.employeeId !== user.id) {
      throw new ForbiddenException('You are not allowed to view this photo');
    }
    return this.storage.open(record.photoPath);
  }

  getSettings(): Promise<AttendanceSettingsRecord> {
    return this.attendances.getSettings();
  }

  /** Hanya field yang dikirim diteruskan; validasi lintas field di attendance-service. */
  updateSettings(dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettingsRecord> {
    const patch: UpdateAttendanceSettingsPayload = {};
    if (dto.earliestCheckIn !== undefined) patch.earliestCheckIn = dto.earliestCheckIn;
    if (dto.defaultCutoffTime !== undefined) patch.defaultCutoffTime = dto.defaultCutoffTime;
    if (dto.toleranceMinutes !== undefined) patch.toleranceMinutes = dto.toleranceMinutes;
    if (dto.requireNoteWhenLate !== undefined) patch.requireNoteWhenLate = dto.requireNoteWhenLate;
    if (dto.workingDays !== undefined) patch.workingDays = dto.workingDays;
    return this.attendances.updateSettings(patch);
  }
}
```

---

### 10. `backend/apps/api-gateway/src/attendances/photo-storage.service.ts`
```ts
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MIME_BY_EXT } from './utils/image-type.util';

@Injectable()
export class PhotoStorageService implements OnModuleInit {
  private readonly logger = new Logger(PhotoStorageService.name);
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = path.resolve(process.cwd(), config.getOrThrow<string>('UPLOAD_DIR'));
  }

  async onModuleInit() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** Nama file di-generate ulang (UUID). Nama dari klien tidak dipakai. Mengembalikan nama file. */
  async save(buffer: Buffer, ext: string): Promise<string> {
    const filename = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, filename), buffer, { flag: 'wx', mode: 0o640 });
    return filename;
  }

  async remove(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, path.basename(filename)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Gagal menghapus ${filename}: ${(e as Error).message}`);
      }
    }
  }

  async open(photoPath: string): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const filename = path.basename(photoPath); // cegah path traversal
    const mime = MIME_BY_EXT[path.extname(filename).slice(1).toLowerCase()];
    const full = path.join(this.dir, filename);
    if (!mime || !full.startsWith(this.dir + path.sep)) {
      throw new NotFoundException('Photo file not found');
    }
    try {
      const stat = await fs.stat(full);
      return { stream: createReadStream(full), mime, size: stat.size };
    } catch {
      throw new NotFoundException('Photo file not found');
    }
  }
}
```

---

### 11. `backend/apps/api-gateway/src/attendances/attendance.mapper.ts`
```ts
import { AttendanceRecord, AttendanceStatus, EmployeeBrief } from '@app/common';

export interface AttendanceView {
  id: string;
  employeeId: string;
  attendanceDate: string;
  createdAt: Date | string;
  /** KOMPAT FRONTEND: frontend membaca checkInAt (sama dengan createdAt). */
  checkInAt: Date | string;
  photoUrl: string;
  notes: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
}

export interface AttendanceAdminView extends AttendanceView {
  employee: EmployeeBrief | null;
}

export const photoUrlFor = (id: string) => `/api/attendances/${id}/photo`;

export function toAttendanceView(r: AttendanceRecord): AttendanceView {
  return {
    id: r.id,
    employeeId: r.employeeId,
    attendanceDate: r.attendanceDate,
    createdAt: r.createdAt,
    checkInAt: r.checkInAt, // KOMPAT FRONTEND
    photoUrl: photoUrlFor(r.id),
    notes: r.notes,
    status: r.status,
    lateMinutes: r.lateMinutes,
  };
}

export function toAttendanceAdminView(
  r: AttendanceRecord,
  employee: EmployeeBrief | null,
): AttendanceAdminView {
  return { ...toAttendanceView(r), employee };
}
```

---

### 12. `backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus, HM_REGEX } from '@app/common';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

const trimUpper = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAttendanceDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'WFH, mengerjakan modul laporan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryMyAttendancesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  // KOMPAT FRONTEND: alias snake_case dari frontend Fase 3/4.
  @ApiPropertyOptional({ description: 'Alias dari dateFrom', example: '2026-11-01' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_from must be in YYYY-MM-DD format' })
  date_from?: string;

  @ApiPropertyOptional({ description: 'Alias dari dateTo', example: '2026-11-30' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_to must be in YYYY-MM-DD format' })
  date_to?: string;
}

export class QueryAttendancesDto extends QueryMyAttendancesDto {
  @ApiPropertyOptional({ description: 'Filter satu karyawan' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Cari nama atau NIK karyawan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  // KOMPAT FRONTEND: alias dari search.
  @ApiPropertyOptional({ description: 'Alias dari search' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  employee_name?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  @IsOptional()
  @Transform(trimUpper)
  @IsEnum(AttendanceStatus, { message: 'status harus ON_TIME atau LATE' })
  status?: AttendanceStatus;
}

/** Filter export = filter daftar HRD tanpa paginasi (selalu halaman 1, maks 5000 baris). */
export class ExportAttendancesQueryDto extends OmitType(QueryAttendancesDto, [
  'page',
  'limit',
] as const) {}

export class QuerySummaryDto {
  @ApiPropertyOptional({
    example: '2026-11-04',
    description: 'YYYY-MM-DD (WIB). Default: hari ini WIB.',
  })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date harus berformat YYYY-MM-DD' })
  date?: string;
}

/** PATCH parsial: kirim hanya field yang ingin diubah. */
export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ example: '06:00', description: 'Jam mulai absen diperbolehkan (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  @Matches(HM_REGEX, { message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  earliestCheckIn?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Batas jam masuk (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  @Matches(HM_REGEX, { message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  defaultCutoffTime?: string;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt({ message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Min(0, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Max(120, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  toleranceMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'requireNoteWhenLate harus berupa true atau false' })
  requireNoteWhenLate?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0 = Minggu ... 6 = Sabtu, tanpa duplikat, minimal 1 hari',
  })
  @IsOptional()
  @IsArray({ message: 'workingDays harus berupa array angka 0 sampai 6' })
  @ArrayMinSize(1, { message: 'workingDays harus berisi minimal 1 hari' })
  @ArrayMaxSize(7, { message: 'workingDays maksimal 7 hari' })
  @ArrayUnique({ message: 'workingDays tidak boleh berisi hari yang sama dua kali' })
  @IsInt({ each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Min(0, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Max(6, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  workingDays?: number[];
}

export class AttendanceSettingsResponseDto {
  @ApiProperty({ example: '00:00' }) earliestCheckIn: string;
  @ApiProperty({ example: '08:00' }) defaultCutoffTime: string;
  @ApiProperty({ example: 15 }) toleranceMinutes: number;
  @ApiProperty({ example: false }) requireNoteWhenLate: boolean;
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 4, 5, 6] }) workingDays: number[];
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ example: '2026-11-04' }) attendanceDate: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() checkInAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  status: AttendanceStatus;
  @ApiProperty({ example: 0, description: 'Menit terlambat dari batas jam masuk dasar' })
  lateMinutes: number;
}

export class AttendanceEmployeeDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
}

export class AttendanceAdminResponseDto extends AttendanceResponseDto {
  @ApiProperty({ type: AttendanceEmployeeDto, nullable: true })
  employee: AttendanceEmployeeDto | null;
}

class AttendanceMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class AttendanceListResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] }) data: AttendanceResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}

export class AttendanceAdminListResponseDto {
  @ApiProperty({ type: [AttendanceAdminResponseDto] }) data: AttendanceAdminResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}

export class AttendanceSummaryResponseDto {
  @ApiProperty({ example: '2026-11-04' }) date: string;
  @ApiProperty({ description: 'Karyawan aktif ber-role EMPLOYEE' }) totalEmployees: number;
  @ApiProperty() presentCount: number;
  @ApiProperty() onTimeCount: number;
  @ApiProperty() lateCount: number;
  @ApiProperty() absentCount: number;
  @ApiProperty({ type: [AttendanceEmployeeDto] }) absentEmployees: AttendanceEmployeeDto[];
}
```

---

### 13. `backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts`
```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from '@app/common';

@Entity({ name: 'attendances' })
@Unique('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'])
@Index('IDX_attendance_date', ['attendanceDate'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referensi lunak ke employees.id (tanpa FK fisik lintas service). */
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  /** Tanggal kalender WIB, diturunkan dari checkInAt di server. */
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  /** Dihitung & disimpan saat absen. Tidak dihitung ulang saat pengaturan berubah. */
  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.ON_TIME,
  })
  status: AttendanceStatus;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
```

---

### 14. `backend/apps/attendance-service/src/attendances/attendances.service.ts`
```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  AttendanceRecord,
  AttendanceStatus,
  CreateAttendancePayload,
  DAY_NAMES_ID,
  DailyStatsPayload,
  DailyStatsResult,
  formatWorkingDays,
  hmToMinutes,
  ListAttendancesPayload,
  PaginatedResult,
  wibDateString,
  wibDayOfWeek,
  wibMinutesOfDay,
} from '@app/common';
import { AttendanceSettingsService } from './attendance-settings.service';
import { Attendance } from './entities/attendance.entity';

const toRecord = (a: Attendance): AttendanceRecord => ({
  id: a.id,
  employeeId: a.employeeId,
  attendanceDate: a.attendanceDate,
  checkInAt: a.checkInAt,
  createdAt: a.createdAt,
  photoPath: a.photoPath,
  notes: a.notes,
  status: a.status,
  lateMinutes: a.lateMinutes,
});

const ALREADY_SUBMITTED = 'Attendance already submitted today';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    private readonly settings: AttendanceSettingsService,
  ) {}

  /** Waktu dan tanggal absen SELALU dibuat di sini. Payload tidak membawa waktu. */
  async create(p: CreateAttendancePayload): Promise<AttendanceRecord> {
    const now = new Date();
    const attendanceDate = wibDateString(now);

    const existing = await this.repo.findOne({
      select: { id: true },
      where: { employeeId: p.employeeId, attendanceDate },
    });
    if (existing) throw new ConflictException(ALREADY_SUBMITTED);

    // ---- Aturan jam kerja (dibaca dari pengaturan saat ini) ----
    const s = await this.settings.get();
    const minutesNow = wibMinutesOfDay(now);
    const dayOfWeek = wibDayOfWeek(now);

    if (!s.workingDays.includes(dayOfWeek)) {
      throw new BadRequestException(
        `Hari ini (${DAY_NAMES_ID[dayOfWeek]}) bukan hari kerja. ` +
          `Absensi hanya dapat dilakukan pada hari: ${formatWorkingDays(s.workingDays)}.`,
      );
    }
    if (minutesNow < hmToMinutes(s.earliestCheckIn)) {
      throw new BadRequestException(
        `Absensi belum dibuka. Absen dapat dilakukan mulai pukul ${s.earliestCheckIn} WIB.`,
      );
    }

    const cutoff = hmToMinutes(s.defaultCutoffTime);
    const isLate = minutesNow > cutoff + s.toleranceMinutes;
    const lateMinutes = isLate ? minutesNow - cutoff : 0; // dari cut-off dasar, bukan batas toleransi
    const notes = p.notes?.trim() || null;

    if (isLate && s.requireNoteWhenLate && !notes) {
      throw new BadRequestException(
        `Anda terlambat ${lateMinutes} menit (batas masuk ${s.defaultCutoffTime} WIB, ` +
          `toleransi ${s.toleranceMinutes} menit). Catatan wajib diisi untuk absen terlambat.`,
      );
    }

    try {
      const saved = await this.repo.save(
        this.repo.create({
          employeeId: p.employeeId,
          checkInAt: now,
          attendanceDate,
          photoPath: p.photoPath,
          notes,
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
          lateMinutes,
          createdAt: now,
        }),
      );
      return toRecord(saved);
    } catch (e) {
      // Balapan dua request bersamaan: constraint UNIK yang menang.
      if (
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(ALREADY_SUBMITTED);
      }
      throw e;
    }
  }

  async findToday(employeeId: string): Promise<AttendanceRecord | null> {
    const row = await this.repo.findOneBy({
      employeeId,
      attendanceDate: wibDateString(),
    });
    return row ? toRecord(row) : null;
  }

  async findOne(id: string): Promise<AttendanceRecord> {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Attendance not found');
    return toRecord(row);
  }

  /** Semua filter masuk satu WHERE, sehingga COUNT dan LIMIT/OFFSET konsisten. */
  async findAll(p: ListAttendancesPayload): Promise<PaginatedResult<AttendanceRecord>> {
    const page = Number(p.page) || 1;
    const limit = Number(p.limit) || 10;

    if (p.employeeIds && p.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const qb = this.repo.createQueryBuilder('a');
    if (p.employeeIds) {
      qb.andWhere('a.employeeId IN (:...employeeIds)', { employeeIds: p.employeeIds });
    }
    if (p.dateFrom) qb.andWhere('a.attendanceDate >= :dateFrom', { dateFrom: p.dateFrom });
    if (p.dateTo) qb.andWhere('a.attendanceDate <= :dateTo', { dateTo: p.dateTo });
    if (p.status) qb.andWhere('a.status = :status', { status: p.status });

    const [rows, total] = await qb
      .orderBy('a.checkInAt', 'DESC')
      .addOrderBy('a.id', 'ASC') // tie-breaker: urutan stabil antar halaman
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map(toRecord),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Statistik satu hari, HANYA untuk employeeIds yang dikirim gateway
   * (aktif + role EMPLOYEE). Satu query; UNIK (employee_id, attendance_date)
   * menjamin satu baris per karyawan, jadi jumlah baris = jumlah hadir.
   */
  async getDailyStats(p: DailyStatsPayload): Promise<DailyStatsResult> {
    const ids = p.employeeIds ?? [];
    if (ids.length === 0) {
      return { presentCount: 0, onTimeCount: 0, lateCount: 0, presentEmployeeIds: [] };
    }

    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.employeeId', 'employeeId')
      .addSelect('a.status', 'status')
      .where('a.attendanceDate = :date', { date: p.date })
      .andWhere('a.employeeId IN (:...ids)', { ids })
      .getRawMany<{ employeeId: string; status: AttendanceStatus }>();

    const lateCount = rows.filter((r) => r.status === AttendanceStatus.LATE).length;
    return {
      presentCount: rows.length,
      onTimeCount: rows.length - lateCount,
      lateCount,
      presentEmployeeIds: rows.map((r) => r.employeeId),
    };
  }
}
```

---

### 15. `backend/apps/attendance-service/src/attendances/attendances.controller.ts`
```ts
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  AttendancePattern,
  CreateAttendancePayload,
  DailyStatsPayload,
  ListAttendancesPayload,
  UpdateAttendanceSettingsPayload,
} from '@app/common';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendancesService } from './attendances.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class AttendancesController {
  constructor(
    private readonly attendances: AttendancesService,
    private readonly settings: AttendanceSettingsService,
  ) {}

  @MessagePattern(AttendancePattern.CREATE)
  create(@Payload() payload: CreateAttendancePayload) {
    return this.attendances.create(payload);
  }

  @MessagePattern(AttendancePattern.FIND_TODAY)
  findToday(@Payload() payload: { employeeId: string }) {
    return this.attendances.findToday(payload.employeeId);
  }

  @MessagePattern(AttendancePattern.FIND_ALL)
  findAll(@Payload() payload: ListAttendancesPayload) {
    return this.attendances.findAll(payload);
  }

  @MessagePattern(AttendancePattern.FIND_ONE)
  findOne(@Payload() payload: { id: string }) {
    return this.attendances.findOne(payload.id);
  }

  @MessagePattern(AttendancePattern.GET_SETTINGS)
  getSettings() {
    return this.settings.get();
  }

  @MessagePattern(AttendancePattern.UPDATE_SETTINGS)
  updateSettings(@Payload() payload: UpdateAttendanceSettingsPayload) {
    return this.settings.update(payload);
  }

  @MessagePattern(AttendancePattern.GET_DAILY_STATS)
  getDailyStats(@Payload() payload: DailyStatsPayload) {
    return this.attendances.getDailyStats(payload);
  }
}
```

---

### 16. `backend/libs/common/src/constants/rpc.constants.ts`
```ts
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';

export const EmployeePattern = {
  AUTH_LOGIN: 'auth.login',
  AUTH_VALIDATE: 'auth.validate',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_FIND_ALL: 'employees.findAll',
  EMPLOYEES_FIND_ONE: 'employees.findOne',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_REMOVE: 'employees.remove',
  EMPLOYEES_SEARCH_IDS: 'employees.searchIds',
  EMPLOYEES_FIND_BRIEFS: 'employees.findBriefs',
  EMPLOYEES_FIND_ACTIVE_STAFF: 'employees.findActiveStaff',
} as const;

export const AttendancePattern = {
  CREATE: 'attendances.create',
  FIND_TODAY: 'attendances.findToday',
  FIND_ALL: 'attendances.findAll',
  FIND_ONE: 'attendances.findOne',
  GET_SETTINGS: 'attendances.getSettings',
  UPDATE_SETTINGS: 'attendances.updateSettings',
  GET_DAILY_STATS: 'attendances.getDailyStats',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
```

---

### 17. `backend/libs/common/src/interfaces/attendance.interface.ts`
```ts
import { AttendanceStatus } from '../enums/attendance-status.enum';

/** Bentuk data antar-service. photoPath bersifat internal, tidak boleh bocor ke klien. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD (WIB)
  checkInAt: Date | string;
  createdAt: Date | string;
  photoPath: string;
  notes: string | null;
  /** Disimpan saat absen; tidak berubah walau pengaturan diubah kemudian. */
  status: AttendanceStatus;
  /** Menit dari batas jam masuk dasar (defaultCutoffTime). 0 jika tepat waktu. */
  lateMinutes: number;
}

export interface CreateAttendancePayload {
  employeeId: string;
  photoPath: string;
  notes?: string | null;
}

/** Dipakai oleh /attendances (HRD), /attendances/export, dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
}

/** Pengaturan jam kerja (satu baris global). Waktu berformat HH:mm (WIB). */
export interface AttendanceSettingsRecord {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: number;
  requireNoteWhenLate: boolean;
  /** 0 = Minggu ... 6 = Sabtu */
  workingDays: number[];
}

/** PATCH parsial: hanya field yang dikirim yang diubah. */
export type UpdateAttendanceSettingsPayload = Partial<AttendanceSettingsRecord>;

/** Statistik harian, dihitung hanya untuk employeeIds yang dikirim gateway. */
export interface DailyStatsPayload {
  /** YYYY-MM-DD (WIB) */
  date: string;
  employeeIds: string[];
}

export interface DailyStatsResult {
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  /** Sudah absen pada tanggal itu; gateway memakainya untuk menentukan yang belum absen. */
  presentEmployeeIds: string[];
}
```

---

### 18. `backend/libs/common/src/database/typeorm.config.ts`
*(Mekanisme pembuatan/sinkronisasi tabel otomatis TypeORM)*
```ts
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(
  config: ConfigService,
  entities: NonNullable<TypeOrmModuleOptions['entities']>,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    entities,
    synchronize: config.getOrThrow<boolean>('DB_SYNCHRONIZE'),
    timezone: '+07:00',
    charset: 'utf8mb4',
  };
}
```

---

### 19. `backend/apps/attendance-service/src/attendance-service.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateAttendanceServiceEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { AttendanceSettings } from './attendances/entities/attendance-settings.entity';
import { Attendance } from './attendances/entities/attendance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateAttendanceServiceEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions(config, [Attendance, AttendanceSettings]),
    }),
    AttendancesModule,
  ],
})
export class AttendanceServiceModule {}
```

---

### 20. `backend/apps/attendance-service/src/attendances/attendance-settings.service.ts`
*(Auto-seed idempoten saat startup service `onModuleInit`)*
```ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AttendanceSettingsRecord,
  DEFAULT_ATTENDANCE_SETTINGS,
  hmToMinutes,
  UpdateAttendanceSettingsPayload,
  validateAttendanceSettings,
} from '@app/common';
import {
  ATTENDANCE_SETTINGS_ID,
  AttendanceSettings,
} from './entities/attendance-settings.entity';

const toRecord = (s: AttendanceSettings): AttendanceSettingsRecord => ({
  earliestCheckIn: s.earliestCheckIn,
  defaultCutoffTime: s.defaultCutoffTime,
  toleranceMinutes: s.toleranceMinutes,
  requireNoteWhenLate: s.requireNoteWhenLate,
  workingDays: s.workingDays,
});

@Injectable()
export class AttendanceSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceSettingsService.name);

  constructor(
    @InjectRepository(AttendanceSettings)
    private readonly repo: Repository<AttendanceSettings>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Seed idempoten. Backfill status absensi lama HANYA berjalan saat baris
   * pengaturan dibuat pertama kali (satu transaksi), jadi restart service
   * tidak pernah menimpa status yang sudah tersimpan.
   * check_in_at disimpan sebagai jam dinding WIB (TypeORM timezone +07:00),
   * sehingga HOUR()/MINUTE() langsung berisi waktu WIB.
   */
  async onModuleInit(): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(AttendanceSettings);
      const exists = await repo.findOneBy({ id: ATTENDANCE_SETTINGS_ID });
      if (exists) return;

      const created = repo.create({
        id: ATTENDANCE_SETTINGS_ID,
        ...DEFAULT_ATTENDANCE_SETTINGS,
      });
      await repo.save(created);
      this.logger.log('attendance_settings baris awal berhasil dibuat');

      // Backfill status & late_minutes untuk data lama (Fase 1-5B)
      const cutoff = hmToMinutes(DEFAULT_ATTENDANCE_SETTINGS.defaultCutoffTime);
      const tolerance = DEFAULT_ATTENDANCE_SETTINGS.toleranceMinutes;
      const deadline = cutoff + tolerance;

      const result = await em.query(`
        UPDATE attendances
        SET
          status = CASE
            WHEN (HOUR(check_in_at) * 60 + MINUTE(check_in_at)) > ${deadline} THEN 'LATE'
            ELSE 'ON_TIME'
          END,
          late_minutes = CASE
            WHEN (HOUR(check_in_at) * 60 + MINUTE(check_in_at)) > ${deadline}
              THEN (HOUR(check_in_at) * 60 + MINUTE(check_in_at)) - ${cutoff}
            ELSE 0
          END
      `);
      const changed = (result as { affectedRows?: number })?.affectedRows ?? 0;
      this.logger.log(`Backfill status absensi lama selesai: ${changed} baris diperbarui`);
    });
  }

  async get(): Promise<AttendanceSettingsRecord> {
    const row = await this.repo.findOneBy({ id: ATTENDANCE_SETTINGS_ID });
    if (!row) {
      throw new InternalServerErrorException('attendance_settings row not found');
    }
    return toRecord(row);
  }

  async update(patch: UpdateAttendanceSettingsPayload): Promise<AttendanceSettingsRecord> {
    const current = await this.get();
    const merged: AttendanceSettingsRecord = {
      earliestCheckIn: patch.earliestCheckIn ?? current.earliestCheckIn,
      defaultCutoffTime: patch.defaultCutoffTime ?? current.defaultCutoffTime,
      toleranceMinutes: patch.toleranceMinutes ?? current.toleranceMinutes,
      requireNoteWhenLate: patch.requireNoteWhenLate ?? current.requireNoteWhenLate,
      workingDays: patch.workingDays ?? current.workingDays,
    };

    const err = validateAttendanceSettings(merged);
    if (err) throw new BadRequestException(err);

    await this.repo.update(ATTENDANCE_SETTINGS_ID, merged);
    return merged;
  }
}
```

