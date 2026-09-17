import { createContext } from 'react'

/**
 * Raw React contexts live in this module on purpose: provider files then
 * export only components and hook files only hooks, which keeps Fast Refresh
 * working (react/only-export-components).
 */
export const AuthContext = createContext(null)
export const ToastContext = createContext(null)

/** Session lifecycle reported by <AuthProvider> while it restores a token. */
export const SESSION_STATUS = {
  loading: 'loading',
  anonymous: 'anonymous',
  authenticated: 'authenticated',
}
