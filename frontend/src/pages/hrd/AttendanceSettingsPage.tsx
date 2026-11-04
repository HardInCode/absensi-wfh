import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { StatusBanner } from "@/components/StatusBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSettings } from "@/hooks/useAttendanceSettings";
import { DAY_LABEL_LONG, DAY_LABEL_SHORT, DAY_ORDER, minutesToHhmm, toMinutes } from "@/lib/attendanceRules";
import { formatDateShort, formatTime } from "@/lib/format";
import {
  getErrorMessage,
  updateAttendanceSettings,
  type AttendanceSettings,
  type AttendanceSettingsInput,
} from "@/lib/hrdApi";
import { cn } from "@/lib/utils";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Selaras dengan validasi backend (0 sampai 120); server tetap menjadi penentu akhir. */
const TOLERANCE_MAX = 120;

interface FormState {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: string;
  requireNoteWhenLate: boolean;
  workingDays: number[];
}

type FieldName = "earliestCheckIn" | "defaultCutoffTime" | "toleranceMinutes" | "workingDays";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ["earliestCheckIn", "defaultCutoffTime", "toleranceMinutes", "workingDays"];
const FIELD_DOM_ID: Record<FieldName, string> = {
  earliestCheckIn: "set-earliest",
  defaultCutoffTime: "set-cutoff",
  toleranceMinutes: "set-tolerance",
  workingDays: "set-day-1",
};

function toForm(s: AttendanceSettings): FormState {
  return {
    earliestCheckIn: s.earliestCheckIn,
    defaultCutoffTime: s.defaultCutoffTime,
    toleranceMinutes: String(s.toleranceMinutes),
    requireNoteWhenLate: s.requireNoteWhenLate,
    workingDays: [...s.workingDays].sort((a, b) => a - b),
  };
}

function validate(f: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const earliestOk = TIME_PATTERN.test(f.earliestCheckIn);
  const cutoffOk = TIME_PATTERN.test(f.defaultCutoffTime);

  if (!earliestOk) errors.earliestCheckIn = "Isi jam dengan format JJ:MM, mis. 06:00.";
  if (!cutoffOk) errors.defaultCutoffTime = "Isi jam dengan format JJ:MM, mis. 08:00.";
  if (earliestOk && cutoffOk && toMinutes(f.earliestCheckIn) >= toMinutes(f.defaultCutoffTime)) {
    errors.defaultCutoffTime = "Jam masuk harus setelah jam paling awal absen.";
  }

  const tol = f.toleranceMinutes.trim();
  if (tol === "") errors.toleranceMinutes = "Toleransi wajib diisi. Isi 0 jika tanpa toleransi.";
  else if (!/^\d+$/.test(tol)) errors.toleranceMinutes = "Toleransi harus bilangan bulat, tanpa tanda minus atau koma.";
  else if (Number(tol) > TOLERANCE_MAX) errors.toleranceMinutes = `Toleransi maksimal ${TOLERANCE_MAX} menit.`;

  if (f.workingDays.length === 0) errors.workingDays = "Pilih minimal satu hari kerja.";
  return errors;
}

/** PATCH bersifat parsial, jadi hanya field yang berubah yang dikirim. */
function buildChanges(f: FormState, saved: AttendanceSettings): AttendanceSettingsInput {
  const changes: AttendanceSettingsInput = {};
  if (f.earliestCheckIn !== saved.earliestCheckIn) changes.earliestCheckIn = f.earliestCheckIn;
  if (f.defaultCutoffTime !== saved.defaultCutoffTime) changes.defaultCutoffTime = f.defaultCutoffTime;
  const tol = f.toleranceMinutes.trim();
  if (tol !== String(saved.toleranceMinutes)) changes.toleranceMinutes = Number(tol);
  if (f.requireNoteWhenLate !== saved.requireNoteWhenLate) changes.requireNoteWhenLate = f.requireNoteWhenLate;
  const days = [...f.workingDays].sort((a, b) => a - b);
  if (days.join(",") !== [...saved.workingDays].sort((a, b) => a - b).join(",")) changes.workingDays = days;
  return changes;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AttendanceSettingsPage() {
  const { settings, setSettings, isLoading, error, reload } = useAttendanceSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const dismissBanner = useCallback(() => setBanner(null), []);

  useEffect(() => {
    if (settings) setForm(toForm(settings));
  }, [settings]);

  const changes = useMemo(
    () => (settings && form ? buildChanges(form, settings) : {}),
    [settings, form],
  );
  const dirty = Object.keys(changes).length > 0;

  const preview = useMemo(() => {
    if (!form) return null;
    const tol = form.toleranceMinutes.trim();
    if (!TIME_PATTERN.test(form.defaultCutoffTime) || !/^\d+$/.test(tol)) return null;
    const deadline = minutesToHhmm(toMinutes(form.defaultCutoffTime) + Number(tol));
    return `Absen setelah ${deadline} WIB dicatat Terlambat (jam masuk ${form.defaultCutoffTime} + toleransi ${Number(tol)} menit).`;
  }, [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
  }

  function toggleDay(day: number) {
    if (!form) return;
    const next = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day];
    setField("workingDays", next);
  }

  function describe(field: FieldName, hasHint = false): string | undefined {
    const id = FIELD_DOM_ID[field];
    if (errors[field]) return `${id}-error`;
    return hasHint ? `${id}-hint` : undefined;
  }

  function discard() {
    if (!settings) return;
    setForm(toForm(settings));
    setErrors({});
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !form || !settings) return;

    const next = validate(form);
    setErrors(next);
    const firstInvalid = FIELD_ORDER.find((field) => next[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_DOM_ID[firstInvalid])?.focus();
      return;
    }
    if (!dirty) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await updateAttendanceSettings(changes);
      setSettings(updated);
      setBanner("Pengaturan absensi berhasil disimpan. Berlaku untuk absen berikutnya.");
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Gagal menyimpan pengaturan absensi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pengaturan absensi</h1>
        <p className="mt-1 text-sm text-muted">
          Atur jam masuk, toleransi, dan hari kerja. Waktu yang dipakai selalu waktu server (WIB).
        </p>
        {settings?.updatedAt && (
          <p className="mt-1 text-xs text-muted">
            Terakhir diubah{" "}
            <span className="tabular-nums">
              {formatDateShort(settings.updatedAt)}, {formatTime(settings.updatedAt)} WIB
            </span>
          </p>
        )}
      </div>

      <StatusBanner message={banner} onDismiss={dismissBanner} />

      <Card className="max-w-2xl p-6 sm:p-8">
        {isLoading && !form ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : error && !form ? (
          <ErrorState message={error} onRetry={reload} />
        ) : form ? (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="set-earliest"
                label="Jam paling awal absen (WIB)"
                error={errors.earliestCheckIn}
                hint="Sebelum jam ini tombol kirim karyawan terkunci."
              >
                <Input
                  id="set-earliest"
                  type="time"
                  value={form.earliestCheckIn}
                  onChange={(e) => setField("earliestCheckIn", e.target.value)}
                  aria-invalid={Boolean(errors.earliestCheckIn)}
                  aria-describedby={describe("earliestCheckIn", true)}
                  disabled={submitting}
                />
              </Field>
              <Field
                id="set-cutoff"
                label="Jam masuk (WIB)"
                error={errors.defaultCutoffTime}
                hint="Batas jam masuk dasar untuk semua hari kerja."
              >
                <Input
                  id="set-cutoff"
                  type="time"
                  value={form.defaultCutoffTime}
                  onChange={(e) => setField("defaultCutoffTime", e.target.value)}
                  aria-invalid={Boolean(errors.defaultCutoffTime)}
                  aria-describedby={describe("defaultCutoffTime", true)}
                  disabled={submitting}
                />
              </Field>
              <Field
                id="set-tolerance"
                label="Toleransi (menit)"
                error={errors.toleranceMinutes}
                hint={`Bilangan bulat 0 sampai ${TOLERANCE_MAX}.`}
              >
                <Input
                  id="set-tolerance"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={TOLERANCE_MAX}
                  step={1}
                  value={form.toleranceMinutes}
                  onChange={(e) => setField("toleranceMinutes", e.target.value)}
                  aria-invalid={Boolean(errors.toleranceMinutes)}
                  aria-describedby={describe("toleranceMinutes", true)}
                  disabled={submitting}
                />
              </Field>
            </div>

            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.requireNoteWhenLate}
                onChange={(e) => setField("requireNoteWhenLate", e.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-5 w-5 cursor-pointer accent-accent"
              />
              <span>
                Wajib isi catatan saat terlambat
                <span className="block text-xs text-muted">
                  Berlaku jika absen dikirim setelah jam masuk ditambah toleransi.
                </span>
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Hari kerja</legend>
              <div className="flex flex-wrap gap-2">
                {DAY_ORDER.map((day) => {
                  const on = form.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      id={`set-day-${day}`}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_LABEL_LONG[day]}
                      disabled={submitting}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "inline-flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50",
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-edge bg-card text-ink hover:bg-canvas",
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                      {DAY_LABEL_SHORT[day]}
                    </button>
                  );
                })}
              </div>
              {errors.workingDays && (
                <p id="set-day-1-error" role="alert" className="text-xs text-danger">
                  {errors.workingDays}
                </p>
              )}
            </fieldset>

            {preview && <p className="rounded-md bg-canvas px-3 py-2 text-sm text-ink">{preview}</p>}

            {submitError && (
              <div role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
                {submitError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={discard}
                disabled={submitting || !dirty}
                className="min-h-11 sm:min-h-0"
              >
                Batalkan perubahan
              </Button>
              <Button type="submit" disabled={submitting || !dirty} className="min-h-11 sm:min-h-0">
                {submitting ? "Menyimpan..." : "Simpan pengaturan"}
              </Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
