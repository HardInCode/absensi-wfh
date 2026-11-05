import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ConfirmDeactivateDialog } from "@/components/ConfirmDeactivateDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { EmployeeFormModal } from "@/components/EmployeeFormModal";
import { PencilIcon, PlusIcon, SearchIcon, UserXIcon } from "@/components/icons";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import {
  fetchEmployees,
  ROLE_LABEL,
  type ActiveStatusFilter,
  type Employee,
  type RoleFilter,
} from "@/lib/hrdApi";

const PAGE_SIZE = 10;

export function EmployeesPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [statusFilter, setStatusFilter] = useState<ActiveStatusFilter>("all");
  const search = useDebouncedValue(searchInput.trim(), 400);

  const hasFilters = Boolean(searchInput || roleFilter || statusFilter !== "all");
  const filterKey = `${search}|${roleFilter}|${statusFilter}`;

  // Halaman otomatis kembali ke 1 saat filter berubah, tanpa fetch ganda.
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const { data, isLoading, error, reload } = usePagedQuery(fetchEmployees, {
    page,
    limit: PAGE_SIZE,
    search,
    role: roleFilter,
    status: statusFilter,
  });

  const [formTarget, setFormTarget] = useState<{ employee: Employee | null } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const dismissBanner = useCallback(() => setBanner(null), []);

  function resetFilters() {
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("all");
  }

  const columns: Column<Employee>[] = [
    {
      key: "nik",
      header: "NIK",
      cell: (e) => <span className="font-mono text-sm tabular-nums">{e.nik}</span>,
    },
    {
      key: "name",
      header: "Nama",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{e.fullName}</p>
          <p className="truncate text-xs text-muted">{e.email}</p>
        </div>
      ),
    },
    {
      key: "position",
      header: "Jabatan",
      className: "hidden md:table-cell",
      cell: (e) => e.position,
    },
    {
      key: "role",
      header: "Peran",
      className: "hidden sm:table-cell",
      cell: (e) => <Badge variant={e.role === "ADMIN_HRD" ? "accent" : "neutral"}>{ROLE_LABEL[e.role]}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => <Badge variant={e.isActive ? "present" : "neutral"}>{e.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      key: "actions",
      header: "Aksi",
      className: "text-right",
      cell: (e) => {
        const isSelf = e.id === user?.id;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={`Ubah ${e.fullName}`}
              onClick={() => setFormTarget({ employee: e })}
            >
              <PencilIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Ubah</span>
            </Button>
            <Button
              variant="danger-ghost"
              size="sm"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label={`Nonaktifkan ${e.fullName}`}
              title={isSelf ? "Akun Anda sendiri tidak dapat dinonaktifkan" : undefined}
              disabled={!e.isActive || isSelf}
              onClick={() => setDeactivateTarget(e)}
            >
              <UserXIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Nonaktifkan</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const emptyContent = hasFilters
    ? {
        title: "Tidak ada karyawan yang cocok",
        description: "Ubah kata kunci pencarian, sesuaikan filter peran atau status, atau reset filter untuk melihat semua data.",
        action: (
          <Button variant="secondary" onClick={resetFilters} className="min-h-11 sm:min-h-0">
            Reset filter
          </Button>
        ),
      }
    : {
        title: "Belum ada data karyawan",
        description: "Tambahkan karyawan pertama agar mereka bisa login dan absen.",
        action: (
          <Button onClick={() => setFormTarget({ employee: null })} className="min-h-11 sm:min-h-0">
            <PlusIcon className="h-4 w-4" />
            Tambah karyawan
          </Button>
        ),
      };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Master karyawan</h1>
          <p className="mt-1 text-sm text-muted">Kelola akun karyawan dan admin HRD.</p>
        </div>
        <Button onClick={() => setFormTarget({ employee: null })} className="min-h-11 sm:min-h-0">
          <PlusIcon className="h-4 w-4" />
          Tambah karyawan
        </Button>
      </div>

      <StatusBanner message={banner} onDismiss={dismissBanner} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="employee-search">Cari karyawan</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="employee-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nama, NIK, atau email"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role-filter">Peran</Label>
          <Select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="">Semua peran</option>
            <option value="EMPLOYEE">Karyawan</option>
            <option value="ADMIN_HRD">Admin HRD</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ActiveStatusFilter)}
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
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

      <DataTable
        caption="Daftar karyawan"
        columns={columns}
        rows={data?.items ?? null}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        meta={data?.meta ?? null}
        onPage={(next) => setPageState({ key: filterKey, page: next })}
        empty={emptyContent}
      />

      <EmployeeFormModal
        open={formTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
        employee={formTarget?.employee ?? null}
        onSaved={(message) => {
          setBanner(message);
          reload();
        }}
      />

      <ConfirmDeactivateDialog
        employee={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onDone={(message) => {
          setBanner(message);
          reload();
        }}
      />
    </div>
  );
}

