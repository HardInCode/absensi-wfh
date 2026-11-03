import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Plus, Search, UserX, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiList } from '@/hooks/useApiList';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { roleLabel } from '@/lib/format';
import type { Employee } from '@/lib/types';
import { EmployeeFormDialog } from './EmployeeFormDialog';

type DialogState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
const TD = 'px-4 py-2.5 align-middle';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const search = useDebounce(searchInput.trim(), 400);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [target, setTarget] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useApiList<Employee>('/employees', {
    page,
    limit: 10,
    search: search || undefined,
    role: role || undefined,
    is_active: active || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  async function confirmDeactivate() {
    if (!target) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await api.delete(`/employees/${target.id}`);
      setNotice(`${target.fullName} dinonaktifkan.`);
      setTarget(null);
      list.refetch();
    } catch (err) {
      setDeactivateError(getErrorMessage(err));
    } finally {
      setDeactivating(false);
    }
  }

  const hasFilter = Boolean(searchInput || role || active);

  return (
    <>
      <PageHeader
        title="Data Karyawan"
        description="Kelola akun karyawan: tambah, ubah, atau nonaktifkan. Karyawan nonaktif tidak bisa login."
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus /> Tambah karyawan
          </Button>
        }
      />

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-md border border-present/30 bg-present-soft px-3 py-2 text-sm text-present"
        >
          <CheckCircle2 className="size-4" aria-hidden /> {notice}
        </div>
      )}

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_180px_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="q">Cari</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                id="q"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nama, NIK, atau email"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Peran</Label>
            <Select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua peran</option>
              <option value="EMPLOYEE">Karyawan</option>
              <option value="ADMIN_HRD">Admin HRD</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </div>
        </div>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th scope="col" className={TH}>NIK</th>
                  <th scope="col" className={TH}>Karyawan</th>
                  <th scope="col" className={TH}>Jabatan</th>
                  <th scope="col" className={TH}>Peran</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={`${TH} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.loading && list.data.length === 0
                  ? [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        {[0, 1, 2, 3, 4, 5].map((c) => (
                          <td key={c} className={TD}>
                            <Skeleton className="h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : list.data.map((emp) => (
                      <tr key={emp.id} className="hover:bg-canvas/70">
                        <td className={`${TD} tabular-nums`}>{emp.nik}</td>
                        <td className={TD}>
                          <p className="font-medium">{emp.fullName}</p>
                          <p className="text-xs text-muted">{emp.email}</p>
                        </td>
                        <td className={TD}>{emp.position}</td>
                        <td className={TD}>
                          <Badge variant={emp.role === 'ADMIN_HRD' ? 'accent' : 'neutral'}>
                            {roleLabel(emp.role)}
                          </Badge>
                        </td>
                        <td className={TD}>
                          <Badge variant={emp.isActive ? 'present' : 'neutral'}>
                            {emp.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className={`${TD} text-right`}>
                          <div className="inline-flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDialog({ mode: 'edit', employee: emp })}
                            >
                              <Pencil /> Ubah
                            </Button>
                            {emp.isActive && (
                              <Button
                                variant="danger-ghost"
                                size="sm"
                                disabled={emp.id === user?.id}
                                title={
                                  emp.id === user?.id
                                    ? 'Kamu tidak dapat menonaktifkan akunmu sendiri'
                                    : undefined
                                }
                                onClick={() => {
                                  setDeactivateError(null);
                                  setTarget(emp);
                                }}
                              >
                                <UserX /> Nonaktifkan
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!list.loading && list.data.length === 0 && (
              <EmptyState
                icon={Users}
                title={hasFilter ? 'Tidak ada karyawan yang cocok' : 'Belum ada data karyawan'}
                description={
                  hasFilter
                    ? 'Coba ubah kata kunci atau hapus filter.'
                    : 'Tambahkan karyawan pertama untuk mulai memakai aplikasi.'
                }
                action={
                  !hasFilter && (
                    <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
                      <Plus /> Tambah karyawan
                    </Button>
                  )
                }
              />
            )}
          </div>
        )}

        {!list.error && <Pagination meta={list.meta} onPage={setPage} disabled={list.loading} />}
      </Card>

      {dialog && (
        <EmployeeFormDialog
          key={dialog.mode === 'edit' ? dialog.employee.id : 'new'}
          employee={dialog.mode === 'edit' ? dialog.employee : null}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            setNotice(message);
            list.refetch();
          }}
        />
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deactivating) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Nonaktifkan karyawan?</DialogTitle>
          <DialogDescription>
            {target?.fullName} tidak akan bisa login lagi. Riwayat absensinya tetap tersimpan, dan
            akun bisa diaktifkan kembali lewat menu Ubah.
          </DialogDescription>
          {deactivateError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {deactivateError}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={deactivating}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDeactivate} disabled={deactivating}>
              {deactivating && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Nonaktifkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

