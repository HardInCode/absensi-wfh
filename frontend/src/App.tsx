import { Suspense, lazy, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { homePathFor, ProtectedRoute } from "@/auth/ProtectedRoute";
import { useAuth } from "@/auth/AuthContext";
import { PageSpinner } from "@/components/PageSpinner";
import { AppShell } from "@/layouts/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";

/** Mendukung named export maupun default export agar aman terhadap gaya ekspor Fase 3. */
function lazyPage(loader: () => Promise<Record<string, unknown>>, exportName: string) {
  return lazy(async () => {
    const mod = await loader();
    const component = (mod[exportName] ?? mod.default) as ComponentType | undefined;
    if (!component) throw new Error(`Halaman ${exportName} tidak ditemukan.`);
    return { default: component };
  });
}

const LoginPage = lazyPage(() => import("@/pages/LoginPage"), "LoginPage");
const AttendancePage = lazyPage(() => import("@/pages/employee/AttendancePage"), "AttendancePage");
const EmployeesPage = lazyPage(() => import("@/pages/hrd/EmployeesPage"), "EmployeesPage");
const MonitoringPage = lazyPage(() => import("@/pages/hrd/MonitoringPage"), "MonitoringPage");
const AttendanceSettingsPage = lazyPage(
  () => import("@/pages/hrd/AttendanceSettingsPage"),
  "AttendanceSettingsPage",
);

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<RootRedirect />} />

            <Route element={<ProtectedRoute roles={["EMPLOYEE"]} />}>
              <Route path="absensi" element={<AttendancePage />} />
            </Route>

            <Route element={<ProtectedRoute roles={["ADMIN_HRD"]} />}>
              <Route path="hrd" element={<Navigate to="/hrd/employees" replace />} />
              <Route path="hrd/employees" element={<EmployeesPage />} />
              <Route path="hrd/monitoring" element={<MonitoringPage />} />
              <Route path="hrd/settings" element={<AttendanceSettingsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Rute lama Fase 3 */}
        <Route path="/admin/karyawan" element={<Navigate to="/hrd/employees" replace />} />
        <Route path="/admin/absensi" element={<Navigate to="/hrd/monitoring" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
