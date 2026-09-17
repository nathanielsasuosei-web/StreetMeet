import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const POLL_MS = 30_000

/** Navbar bell with the unread notification count. Polls gently. */
export function NotificationBell() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const data = await api.notifications.list(1)
      setUnread(data.unread)
    } catch {
      /* offline or signed out - the badge simply stays as it was */
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return undefined
    }
    refresh() // also re-checks on every navigation (location dep below)
    const timer = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    const onChanged = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('streetmeet:notifications', onChanged)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('streetmeet:notifications', onChanged)
    }
  }, [isAuthenticated, refresh, location.pathname])

  if (!isAuthenticated) return null

  return (
    <Link to="/notifications" className="nav-bell" aria-label={`Notifications (${unread} unread)`}>
      <span aria-hidden="true">🔔</span>
      {unread > 0 ? <span className="nav-bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  )
}

export default NotificationBell
