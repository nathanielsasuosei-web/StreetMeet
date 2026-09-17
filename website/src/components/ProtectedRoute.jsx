import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { SESSION_STATUS } from '../context/contexts.js'
import { useAuth } from '../hooks/useAuth'

export function PageLoading({ label = 'Loading…' }) {
  return (
    <div className="page-loading">
      <span className="spinner" style={{ width: 22, height: 22 }} />
      <span>{label}</span>
    </div>
  )
}

/**
 * Gate for authenticated areas. Remembers where the member was heading so
 * login can send them straight back.
 */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === SESSION_STATUS.loading) return <PageLoading label="Checking your session…" />

  if (status === SESSION_STATUS.anonymous) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}

/**
 * Sends anyone already signed in away from the login/register screens - to
 * where they were heading, or to the sign-up wizard when their profile is not
 * finished yet.
 */
export function GuestRoute() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === SESSION_STATUS.loading) return <PageLoading label="Checking your session…" />

  if (status === SESSION_STATUS.authenticated) {
    const target =
      location.state?.from || (user?.profileComplete ? '/profile' : '/onboarding')
    return <Navigate to={target} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
