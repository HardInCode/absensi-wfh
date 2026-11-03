import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '@/components/FullPageLoader';
import { homeFor } from '@/lib/routes';
import type { Role } from '@/lib/types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <Outlet />;
}

