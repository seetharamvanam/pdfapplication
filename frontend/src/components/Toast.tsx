import { useEffect } from 'react'
import './Toast.css'

type ToastType = 'success' | 'error' | 'warning' | 'info'

export default function Toast({ 
  id, 
  message, 
  type = 'info',
  onClose 
}: { 
  id: string
  message: string
  type?: ToastType
  onClose: (id: string) => void 
}) {
  useEffect(() => {
    const t = setTimeout(() => onClose(id), 3500)
    return () => clearTimeout(t)
  }, [id, onClose])

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {message}
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close">
        ✕
      </button>
    </div>
  )
}
