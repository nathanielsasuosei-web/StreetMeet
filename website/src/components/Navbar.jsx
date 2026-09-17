import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { usePlan } from '../hooks/usePlan'
import { NotificationBell } from './NotificationBell'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

const PUBLIC_LINKS = [{ to: '/', label: 'Home', end: true }]

const APP_LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/matches', label: 'Matches' },
  { to: '/status', label: 'Status' },
  { to: '/premium', label: 'Premium' },
]

export function Navbar() {
  const { isAuthenticated, user, logout, profileComplete } = useAuth()
  const { plan } = usePlan()
  const [menuOpen, setMenuOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return undefined
    const onClickAway = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onEscape = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onEscape)
    }
  }, [menuOpen])

  const links = isAuthenticated
    ? [
        ...PUBLIC_LINKS,
        ...APP_LINKS,
        ...(user?.role === 'ADMIN' || user?.role === 'MODERATOR'
          ? [{ to: '/admin', label: 'Admin' }]
          : []),
      ]
    : PUBLIC_LINKS

  async function signOut() {
    setMenuOpen(false)
    // Leave the protected area first - otherwise the route guard bounces the
    // member to /login before the sign-out navigation lands.
    navigate('/', { replace: true })
    await logout()
  }

  function go(path) {
    setMenuOpen(false)
    setLinksOpen(false)
    navigate(path)
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={() => setLinksOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            ♥
          </span>
          StreetMeet
        </Link>

        <nav className="nav-links" data-open={linksOpen} aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setLinksOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              {plan && plan !== 'FREE' ? <span className={`plan-chip plan-chip-${plan.toLowerCase()}`}>{plan}</span> : null}
              <NotificationBell />
              {!profileComplete ? (
                <Button size="sm" variant="accent" onClick={() => go('/onboarding')}>
                  Finish profile
                </Button>
              ) : null}

              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  style={{ padding: 4, borderRadius: 999 }}
                >
                  <Avatar src={user?.profileImage} name={user?.fullName} size="sm" />
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="card"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      minWidth: 230,
                      padding: 8,
                      zIndex: 50,
                      boxShadow: 'var(--sh-2)',
                    }}
                  >
                    <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid var(--line)' }}>
                      <strong className="strong" style={{ display: 'block' }}>
                        {user?.fullName}
                      </strong>
                      <span className="tiny muted">{user?.email}</span>
                    </div>

                    {[
                      { label: 'My profile', path: '/profile' },
                      { label: 'Edit profile', path: '/profile/edit' },
                      { label: 'Account settings', path: '/settings' },
                    ].map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        role="menuitem"
                        className="tab"
                        style={{ width: '100%' }}
                        onClick={() => go(item.path)}
                      >
                        {item.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      role="menuitem"
                      className="tab"
                      style={{ width: '100%', color: 'var(--danger)' }}
                      onClick={signOut}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => go('/login')}>
                Log in
              </Button>
              <Button size="sm" onClick={() => go('/register')}>
                Create account
              </Button>
            </>
          )}

          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={linksOpen}
            onClick={() => setLinksOpen((open) => !open)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
