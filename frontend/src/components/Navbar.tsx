import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './Navbar.css'
import { IconUpload } from './icons'
import Button from './ui/Button'
import UploadDemo from './UploadDemo'

interface NavbarProps {
  onMenuClick?: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onPdfUpload(e: Event) {
      const ce = e as CustomEvent<File>
      const f = ce?.detail
      if (f) setUploadingFile(f)
    }
    window.addEventListener('pdf-upload', onPdfUpload as EventListener)
    return () => window.removeEventListener('pdf-upload', onPdfUpload as EventListener)
  }, [])


  return (
    <header className="navbar glass" ref={menuRef}>
      <div className="nav-inner">
        <button
          className="menu-toggle"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-expanded={false}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <a
          className="brand"
          href="#"
          aria-label="PDF app home"
          onClick={(e) => {
            e.preventDefault()
            window.location.hash = '#'
          }}
        >
          <motion.div
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={{ duration: 0.3 }}
            className="brand-icon-container"
          >
            <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden>
              <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4z" fill="currentColor" />
            </svg>
          </motion.div>
          <div className="brand-text-container">
            <span className="brand-text">Velo</span>
            <span className="brand-text-accent">PDF</span>
          </div>
        </a>

        {uploadingFile && (
          <UploadDemo file={uploadingFile} onClose={() => setUploadingFile(null)} />
        )}

        <div className="nav-actions">
          <label htmlFor="file-upload" className="upload-wrapper">
            <Button
              variant="ghost"
              className="upload-btn"
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById('file-upload') as HTMLInputElement | null
                el?.click()
              }}
            >
              <IconUpload className="icon" />
              <span className="upload-text desktop-only-text">Upload</span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setUploadingFile(f)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}
