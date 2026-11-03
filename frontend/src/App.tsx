import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppShell } from '@/layouts/AppShell';
import { FullPageLoader } from '@/components/FullPageLoader';
import { homeFor } from '@/lib/routes';
import LoginPage from '@/pages/LoginPage';
import AttendancePage from '@/pages/employee/AttendancePage';
import EmployeesPage from '@/pages/admin/EmployeesPage';
import AttendanceMonitorPage from '@/pages/admin/AttendanceMonitorPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
        <p className="mt-1 text-sm text-muted">
          Alamat yang kamu buka tidak ada atau sudah dipindahkan.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route path="/absensi" element={<AttendancePage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN_HRD']} />}>
            <Route path="/admin/karyawan" element={<EmployeesPage />} />
            <Route path="/admin/absensi" element={<AttendanceMonitorPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
