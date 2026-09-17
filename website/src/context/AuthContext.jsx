import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext, SESSION_STATUS } from './contexts.js'
import { ApiError, api, clearToken, getToken, setToken } from '../lib/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(SESSION_STATUS.loading)

  /** Restore the session from a stored token on first paint. */
  useEffect(() => {
    let active = true

    async function bootstrap() {
      if (!getToken()) {
        if (active) setStatus(SESSION_STATUS.anonymous)
        return
      }
      try {
        const { user: me } = await api.auth.me()
        if (!active) return
        setUser(me)
        setStatus(SESSION_STATUS.authenticated)
      } catch (error) {
        if (!active) return
        clearToken()
        setUser(null)
        setStatus(SESSION_STATUS.anonymous)
        if (error instanceof ApiError && error.status === 0) {
          console.warn('StreetMeet API unreachable during bootstrap:', error.message)
        }
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [])

  const adopt = useCallback(({ token, user: nextUser }) => {
    if (token) setToken(token)
    setUser(nextUser)
    setStatus(SESSION_STATUS.authenticated)
    return nextUser
  }, [])

  const login = useCallback(
    async (credentials) => adopt(await api.auth.login(credentials)),
    [adopt],
  )

  const register = useCallback(
    async (payload) => adopt(await api.auth.register(payload)),
    [adopt],
  )

  const reactivate = useCallback(
    async (payload) => adopt(await api.auth.reactivate(payload)),
    [adopt],
  )

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      /* signing out locally is what matters */
    }
    clearToken()
    setUser(null)
    setStatus(SESSION_STATUS.anonymous)
  }, [])

  /** Drop the local session without calling the API (token already revoked). */
  const endSession = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus(SESSION_STATUS.anonymous)
  }, [])

  const refresh = useCallback(async () => {
    const { user: me } = await api.auth.me()
    setUser(me)
    return me
  }, [])

  /** Replace the token after a password change (server rotates it). */
  const rotateToken = useCallback((token) => setToken(token), [])

  const patchUser = useCallback((changes) => {
    setUser((current) => (current ? { ...current, ...changes } : current))
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === SESSION_STATUS.loading,
      isAuthenticated: status === SESSION_STATUS.authenticated,
      isAnonymous: status === SESSION_STATUS.anonymous,
      profileComplete: Boolean(user?.profileComplete),
      missingFields: user?.missingFields ?? [],
      login,
      register,
      reactivate,
      logout,
      endSession,
      refresh,
      rotateToken,
      patchUser,
      setUser,
    }),
    [
      user,
      status,
      login,
      register,
      reactivate,
      logout,
      endSession,
      refresh,
      rotateToken,
      patchUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
