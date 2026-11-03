import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getErrorMessage, getStatus } from '@/lib/errors';
import type { Employee, Role } from '@/lib/types';

interface Props {
  /** null = mode tambah */
  employee: Employee | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  nik: string;
  fullName: string;
  email: string;
  password: string;
  position: string;
  role: Role;
  isActive: boolean;
}

const MIN_PASSWORD = 8;

export function EmployeeFormDialog({ employee, onClose, onSaved }: Props) {
  const isEdit = employee !== null;
  const [form, setForm] = useState<FormState>({
    nik: employee?.nik ?? '',
    fullName: employee?.fullName ?? '',
    email: employee?.email ?? '',
    password: '',
    position: employee?.position ?? '',
    role: employee?.role ?? 'EMPLOYEE',
    isActive: employee?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nik.trim() || !form.fullName.trim() || !form.email.trim() || !form.position.trim()) {
      setError('NIK, nama lengkap, email, dan jabatan wajib diisi.');
      return;
    }
    if (!isEdit && form.password.length < MIN_PASSWORD) {
      setError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`);
      return;
    }
    if (isEdit && form.password && form.password.length < MIN_PASSWORD) {
      setError(`Kata sandi baru minimal ${MIN_PASSWORD} karakter.`);
      return;
    }

    const payload: Record<string, unknown> = {
      nik: form.nik.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      position: form.position.trim(),
      role: form.role,
    };
    if (form.password) payload.password = form.password;

    setSubmitting(true);
    try {
      if (employee) {
        payload.isActive = form.isActive;
        await api.patch(`/employees/${employee.id}`, payload);
        onSaved('Data karyawan berhasil diperbarui.');
      } else {
        await api.post('/employees', payload);
        onSaved('Karyawan baru berhasil ditambahkan.');
      }
    } catch (err) {
      setError(
        getStatus(err) === 409
          ? 'NIK atau email sudah dipakai karyawan lain.'
          : getErrorMessage(err),
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>{isEdit ? 'Ubah data karyawan' : 'Tambah karyawan'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Perbarui data karyawan. Kosongkan kata sandi jika tidak ingin mengubahnya.'
            : 'Buat akun baru untuk karyawan. Kata sandi dapat diubah kemudian.'}
        </DialogDescription>

        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-nik">NIK</Label>
              <Input
                id="f-nik"
                value={form.nik}
                onChange={(e) => set('nik', e.target.value)}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-position">Jabatan</Label>
              <Input
                id="f-position"
                value={form.position}
                onChange={(e) => set('position', e.target.value)}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-name">Nama lengkap</Label>
            <Input
              id="f-name"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-email">Email</Label>
            <Input
              id="f-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-password">
                {isEdit ? 'Kata sandi baru (opsional)' : 'Kata sandi'}
              </Label>
              <Input
                id="f-password"
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="new-password"
                placeholder={isEdit ? 'Biarkan kosong' : `Min. ${MIN_PASSWORD} karakter`}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-role">Peran</Label>
              <Select
                id="f-role"
                value={form.role}
                onChange={(e) => set('role', e.target.value as Role)}
                disabled={submitting}
              >
                <option value="EMPLOYEE">Karyawan</option>
                <option value="ADMIN_HRD">Admin HRD</option>
              </Select>
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                disabled={submitting}
                className="size-4 accent-[rgb(var(--color-accent))]"
              />
              Akun aktif (dapat login)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

