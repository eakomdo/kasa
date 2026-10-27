import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@/shared/api/schemas';
import { ButtonLink, EmptyState } from '@/shared/ui';
import { useRefreshMe } from './api';
import { useSession } from './session';

/** Signed-out visitors go to /welcome and come back after logging in. */
export function RequireAuth() {
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const location = useLocation();
  useRefreshMe();
  if (!token || !user)
    return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RequireOnboarded() {
  const user = useSession((s) => s.user);
  if (user && !user.onboarded) return <Navigate to="/onboarding/language" replace />;
  return <Outlet />;
}

/**
 * Sends signed-in users on. The destination comes from `location.state.from`,
 * set by <RequireAuth> (deep links) or by the Welcome page's sample sign-ins.
 */
export function GuestOnly() {
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const location = useLocation();
  if (token && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={user.onboarded ? (from ?? '/') : '/onboarding/language'} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const user = useSession((s) => s.user);
  if (!user || !roles.includes(user.role)) {
    return (
      <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px' }}>
        <EmptyState
          icon="shield"
          title="This area is for the Kasa team"
          action={
            <ButtonLink to="/" variant="ghost" size="sm">
              Back to learning
            </ButtonLink>
          }
        >
          Moderators and admins use it to keep the community safe. If you think you should have access, ask an
          admin.
        </EmptyState>
      </main>
    );
  }
  return children ?? <Outlet />;
}
