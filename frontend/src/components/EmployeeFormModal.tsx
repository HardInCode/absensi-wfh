import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createEmployee,
  getErrorMessage,
  ROLE_LABEL,
  updateEmployee,
  type Employee,
  type Role,
} from "@/lib/hrdApi";

interface FormValues {
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  password: string;
  isActive: boolean;
}

type FieldName = "nik" | "fullName" | "email" | "position" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ["nik", "fullName", "email", "position", "password"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toValues(employee: Employee | null): FormValues {
  return {
    nik: employee?.nik ?? "",
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    position: employee?.position ?? "",
    role: employee?.role ?? "EMPLOYEE",
    password: "",
    isActive: employee?.isActive ?? true,
  };
}

function validate(values: FormValues, isEdit: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const nik = values.nik.trim();
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const position = values.position.trim();

  if (!nik) errors.nik = "NIK wajib diisi.";
  else if (nik.length > 30) errors.nik = "NIK maksimal 30 karakter.";

  if (!fullName) errors.fullName = "Nama lengkap wajib diisi.";
  else if (fullName.length > 100) errors.fullName = "Nama maksimal 100 karakter.";

  if (!email) errors.email = "Email wajib diisi.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Format email tidak valid.";

  if (!position) errors.position = "Jabatan wajib diisi.";
  else if (position.length > 100) errors.position = "Jabatan maksimal 100 karakter.";

  if (!isEdit && !values.password) errors.password = "Password wajib diisi untuk karyawan baru.";
  else if (values.password && values.password.length < 8) errors.password = "Password minimal 8 karakter.";

  return errors;
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

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode tambah. */
  employee: Employee | null;
  onSaved: (message: string) => void;
}

export function EmployeeFormModal({ open, onOpenChange, employee, onSaved }: EmployeeFormModalProps) {
  const { user } = useAuth();
  const isEdit = employee !== null;
  const isSelf = employee !== null && employee.id === user?.id;

  const [values, setValues] = useState<FormValues>(() => toValues(employee));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(toValues(employee));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, employee]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function describe(field: FieldName, hasHint = false): string | undefined {
    if (errors[field]) return `emp-${field}-error`;
    return hasHint ? `emp-${field}-hint` : undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(values, isEdit);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`emp-${firstInvalid}`)?.focus();
      return;
    }

    const base = {
      nik: values.nik.trim(),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      position: values.position.trim(),
      role: values.role,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          ...base,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        });
        onSaved(`Data ${base.fullName} berhasil diperbarui.`);
      } else {
        await createEmployee({ ...base, password: values.password });
        onSaved(`Karyawan ${base.fullName} berhasil ditambahkan.`);
      }
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Gagal menyimpan data karyawan."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{isEdit ? "Ubah data karyawan" : "Tambah karyawan"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Kosongkan password jika tidak ingin menggantinya."
            : "Karyawan baru dapat langsung login setelah disimpan."}
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {submitError && (
            <div role="alert" className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
              {submitError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="emp-nik" label="NIK" error={errors.nik}>
              <Input
                id="emp-nik"
                value={values.nik}
                onChange={(e) => setField("nik", e.target.value)}
                aria-invalid={Boolean(errors.nik)}
                aria-describedby={describe("nik")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-fullName" label="Nama lengkap" error={errors.fullName}>
              <Input
                id="emp-fullName"
                value={values.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={describe("fullName")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-email" label="Email" error={errors.email}>
              <Input
                id="emp-email"
                type="email"
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describe("email")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field id="emp-position" label="Jabatan" error={errors.position}>
              <Input
                id="emp-position"
                value={values.position}
                onChange={(e) => setField("position", e.target.value)}
                aria-invalid={Boolean(errors.position)}
                aria-describedby={describe("position")}
                autoComplete="off"
                disabled={submitting}
              />
            </Field>
            <Field
              id="emp-role"
              label="Peran"
              hint={isSelf ? "Peran akun Anda sendiri tidak dapat diubah." : undefined}
            >
              <Select
                id="emp-role"
                value={values.role}
                onChange={(e) => setField("role", e.target.value as Role)}
                disabled={submitting || isSelf}
              >
                <option value="EMPLOYEE">{ROLE_LABEL.EMPLOYEE}</option>
                <option value="ADMIN_HRD">{ROLE_LABEL.ADMIN_HRD}</option>
              </Select>
            </Field>
            <Field
              id="emp-password"
              label={isEdit ? "Password baru (opsional)" : "Password"}
              error={errors.password}
              hint="Minimal 8 karakter."
            >
              <Input
                id="emp-password"
                type="password"
                value={values.password}
                onChange={(e) => setField("password", e.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={describe("password", true)}
                autoComplete="new-password"
                disabled={submitting}
              />
            </Field>
          </div>

          {isEdit && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                disabled={submitting || isSelf}
                className="h-5 w-5 cursor-pointer accent-accent"
              />
              <span>
                Akun aktif
                {isSelf && <span className="ml-2 text-xs text-muted">(akun Anda sendiri tidak dapat dinonaktifkan)</span>}
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="min-h-11 sm:min-h-0"
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-11 sm:min-h-0">
              {submitting ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah karyawan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

