import { useEffect, useRef, useState } from 'react'
import './Navbar.css'
import { IconUpload, IconMoon, IconSun } from './icons'
import Button from './ui/Button'
import UploadDemo from './UploadDemo'

const LINKS = [
  { id: 'merge', label: 'Merge', href: '#merge' },
  { id: 'split', label: 'Split', href: '#split' },
  { id: 'compress', label: 'Compress', href: '#compress' },
  { id: 'convert', label: 'Convert', href: '#convert' },
  { id: 'secure', label: 'Secure', href: '#secure' },
  { id: 'view', label: 'View', href: '#view' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<string>(() =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark'
  )
  const [active, setActive] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.hash || 'home' : 'home'
  )
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClickOutside)
    }
  }, [])

  useEffect(() => {
    // close mobile menu when switching to larger screens
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    // prevent background scroll when mobile menu is open
    try {
      if (open) document.body.classList.add('no-scroll')
      else document.body.classList.remove('no-scroll')
    } catch (e) {}
    return () => {
      try {
        document.body.classList.remove('no-scroll')
      } catch (e) {}
    }
  }, [open])

  useEffect(() => {
    // Sync theme with saved preference or fallback to time-of-day (day => light, night => dark).
    // When no stored preference exists, schedule automatic switches at 7:00 and 19:00.
    let timer: number | undefined

    function getThemeByTime() {
      const hr = new Date().getHours()
      return hr >= 7 && hr < 19 ? 'light' : 'dark'
    }

    function scheduleNextSwitch() {
      try {
        // If user has set a preference, do not schedule automatic changes
        if (localStorage.getItem('theme')) return

        const now = new Date()
        const isDay = getThemeByTime() === 'light'
        const next = new Date(now)
        if (isDay) {
          // switch to night at 19:00 today
          next.setHours(19, 0, 0, 0)
        } else {
          // switch to day at 7:00 next (today or tomorrow)
          next.setHours(7, 0, 0, 0)
          if (next <= now) next.setDate(next.getDate() + 1)
        }
        const ms = next.getTime() - now.getTime()
        timer = window.setTimeout(() => {
          // before applying, ensure user still hasn't chosen a theme
          if (!localStorage.getItem('theme')) {
            const t = getThemeByTime()
            setTheme(t)
            document.documentElement.dataset.theme = t
            // schedule the next one
            scheduleNextSwitch()
          }
        }, ms + 1000) // +1s buffer
      } catch (e) {
        // ignore scheduling errors
      }
    }

    try {
      const stored = localStorage.getItem('theme')
      if (stored) {
        setTheme(stored)
        document.documentElement.dataset.theme = stored
      } else {
        const t = getThemeByTime()
        setTheme(t)
        document.documentElement.dataset.theme = t
        scheduleNextSwitch()
      }
    } catch (e) {}

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // Listen for uploads triggered elsewhere in the app (e.g., hero CTA)
    function onPdfUpload(e: Event) {
      const ce = e as CustomEvent<File>
      const f = ce?.detail
      if (f) setUploadingFile(f)
    }
    window.addEventListener('pdf-upload', onPdfUpload as EventListener)
    return () => window.removeEventListener('pdf-upload', onPdfUpload as EventListener)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('theme', next)
    } catch (e) {}
    document.documentElement.dataset.theme = next
  }

  return (
    <header className="navbar" ref={menuRef}>
      <div className="nav-inner">
        <a
          className="brand"
          href="#"
          aria-label="PDF app home"
          onClick={(e) => {
            // ensure we navigate home and update active state
            e.preventDefault()
            setActive('#')
            setOpen(false)
            window.location.hash = '#'
          }}
        >
          <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4z" fill="currentColor" />
          </svg>
          <span className="brand-text">PDF App</span>
        </a>

        {uploadingFile && (
          <UploadDemo file={uploadingFile} onClose={() => setUploadingFile(null)} />
        )}

        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main navigation">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={l.href}
              className={`nav-link ${active === l.href || active === `#${l.id}` ? 'active' : ''}`}
              aria-current={active === l.href || active === `#${l.id}` ? 'page' : undefined}
              onClick={() => {
                setActive(l.href || `#${l.id}`)
                setOpen(false)
              }}
            >
              {l.label}
            </a>
          ))}

          <div className="nav-actions">
            <label htmlFor="file-upload" className="upload-wrapper">
              <Button
                variant="ghost"
                className="upload-btn"
                aria-label="Upload PDF"
                aria-describedby="upload-tooltip"
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById('file-upload') as HTMLInputElement | null
                  el?.click()
                }}
              >
                <IconUpload className="icon" />
                <span className="visually-hidden">Upload</span>
              </Button>
              <span id="upload-tooltip" role="tooltip" className="tooltip">Upload PDF — Try example or drag a file</span>
            </label>
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setUploadingFile(f)
                // reset so selecting the same file again fires change
                e.currentTarget.value = ''
              }}
            />

            <button
              className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`}
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <IconMoon className="icon" /> : <IconSun className="icon" />}
            </button>
          </div>
        </nav>

        <button
          className={`menu-btn ${open ? 'open' : ''}`}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="hamburger" aria-hidden />
        </button>
      </div>
    </header>
  )
}