import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotFound from '../pages/NotFound.jsx';
import { Spinner } from './ui.jsx';

export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

// Marketplace pages are for members; administrators go to their dashboard.
export function RequireMember() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Navigate to="/admin" replace /> : <Outlet />;
}

// Non-admins see a plain 404, so the admin area is not advertised. The API enforces this independently.
export function RequireAdmin() {
  const { isAdmin, user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return isAdmin ? <Outlet /> : <NotFound />;
}

export function GuestOnly() {
  const { user, isAdmin, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (user) return <Navigate to={location.state?.from ?? (isAdmin ? '/admin' : '/dashboard')} replace />;
  return <Outlet />;
}
