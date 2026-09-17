import { useCallback, useMemo, useRef, useState } from 'react'

import { ToastContext } from './contexts.js'

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, { variant = 'success', title = null, duration = 4200 } = {}) => {
      if (!message) return null
      const id = nextId++
      setToasts((current) => [...current.slice(-3), { id, message, variant, title }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      success: (message, options) => push(message, { ...options, variant: 'success' }),
      error: (message, options) => push(message, { ...options, variant: 'error', duration: 6000 }),
      info: (message, options) => push(message, { ...options, variant: 'info' }),
    }),
    [toasts, dismiss, push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.variant}`}>
            <span className="toast-icon" aria-hidden="true">
              {toast.variant === 'success' ? '✓' : toast.variant === 'error' ? '!' : 'i'}
            </span>
            <span>
              {toast.title ? <strong className="strong">{toast.title} </strong> : null}
              {toast.message}
            </span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
