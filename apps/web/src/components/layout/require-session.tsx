import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/routes';

export function RequireSession() {
  const { session } = useAuth();
  if (session !== null) return <Outlet />;

  // `replace` so browser-Back after a logout does not restore an authenticated screen.
  return <Navigate to={ROUTES.login} replace />;
}
