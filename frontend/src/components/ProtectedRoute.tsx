import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui/Spinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireCompany() {
  const { memberships, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (memberships.length === 0) return <Navigate to="/companies/new" replace />;
  return <Outlet />;
}
