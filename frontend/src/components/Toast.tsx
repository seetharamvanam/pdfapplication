import { useEffect } from 'react'
import './Toast.css'

export default function Toast({ id, message, onClose }: { id: string; message: string; onClose: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onClose(id), 3500)
    return () => clearTimeout(t)
  }, [id, onClose])

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close">
        ✕
      </button>
    </div>
  )
}
