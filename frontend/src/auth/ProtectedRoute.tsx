import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { PageSpinner } from "@/components/PageSpinner";
import type { Role } from "@/lib/hrdApi";

export function homePathFor(role: Role): string {
  return role === "ADMIN_HRD" ? "/hrd/employees" : "/absensi";
}

interface ProtectedRouteProps {
  roles?: Role[];
  children?: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
