import { useContext } from 'react'

import { ToastContext } from '../context/contexts.js'

/** Toast queue published by <ToastProvider>: success/error/info + dismiss. */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
