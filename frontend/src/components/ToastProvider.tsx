import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Toast from './Toast'
import './Toast.css'

type ToastType = 'success' | 'error' | 'warning' | 'info'
type ToastItem = { id: string; message: string; type?: ToastType }

const ToastContext = createContext<{
  addToast: (msg: string, type?: ToastType) => void
  showToast: (msg: string, type?: ToastType) => void
  announce: (msg: string) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = String(Math.random()).slice(2, 9)
    setToasts((s) => [...s, { id, message, type }])
  }, [])

  const showToast = addToast

  const removeToast = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id))
  }, [])

  const announce = useCallback((msg: string) => {
    setAnnouncement(msg)
    setTimeout(() => setAnnouncement(null), 3000)
  }, [])

  const value = useMemo(() => ({ addToast, showToast, announce }), [addToast, showToast, announce])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} id={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
      <div className="sr-only" aria-live="polite">{announcement || ''}</div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return { addToast: ctx.addToast, showToast: ctx.showToast }
}

export function useAnnounce() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useAnnounce must be used within ToastProvider')
  return { announce: ctx.announce }
}
