import { useContext } from 'react'

import { AuthContext } from '../context/contexts.js'

/** Session state and auth actions published by <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
