import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './Sidebar.css'
import {
  IconPdf,
  IconMerge,
  IconSplit,
  IconCompress,
  IconConvert,
  IconSecure,
  IconEdit,
  IconView,
  IconAdvanced,
  IconHome,
  IconMoon,
  IconSun,
  IconCreate,
  IconAnnotate,
  IconOrganize,
  IconForms,
  IconOCR,
  IconUtilities,
} from './icons'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  badge?: string
  category?: string
}

// Organized navigation with categories
const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', href: '#', icon: IconHome, category: 'general' },
  
  // Reading & Viewing
  { id: 'view', label: 'View PDF', href: '#view', icon: IconView, category: 'viewing' },
  
  // Creating
  { id: 'create', label: 'Create PDF', href: '#create', icon: IconCreate, category: 'creating' },
  
  // Editing
  { id: 'edit', label: 'Edit PDF', href: '#edit', icon: IconEdit, category: 'editing' },
  { id: 'annotate', label: 'Annotate', href: '#annotate', icon: IconAnnotate, category: 'editing' },
  
  // Converting
  { id: 'convert', label: 'Convert', href: '#convert', icon: IconConvert, category: 'converting' },
  { id: 'ocr', label: 'OCR (Scan to Text)', href: '#ocr', icon: IconOCR, category: 'converting', badge: 'New' },
  
  // Organizing
  { id: 'merge', label: 'Merge PDFs', href: '#merge', icon: IconMerge, category: 'organizing' },
  { id: 'split', label: 'Split PDF', href: '#split', icon: IconSplit, category: 'organizing' },
  { id: 'organize', label: 'Organize Pages', href: '#organize', icon: IconOrganize, category: 'organizing' },
  
  // Securing
  { id: 'secure', label: 'Secure & Protect', href: '#secure', icon: IconSecure, category: 'securing' },
  
  // Forms
  { id: 'forms', label: 'Forms', href: '#forms', icon: IconForms, category: 'forms' },
  
  // Utilities
  { id: 'compress', label: 'Compress PDF', href: '#compress', icon: IconCompress, category: 'utilities' },
  { id: 'utilities', label: 'Utilities', href: '#utilities', icon: IconUtilities, category: 'utilities' },
  
  // Advanced
  { id: 'advanced', label: 'Advanced', href: '#advanced', icon: IconAdvanced, category: 'advanced' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [active, setActive] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash || '#'
    }
    return '#'
  })
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'light'
    }
    return 'light'
  })

  // Sync with system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('theme')
      if (!stored) {
        const newTheme = e.matches ? 'dark' : 'light'
        setTheme(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
        document.documentElement.style.colorScheme = newTheme
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    function onHash() {
      setActive(window.location.hash || '#')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('theme', next)
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', next)
    document.documentElement.style.colorScheme = next
  }

  function handleNavClick(href: string) {
    setActive(href)
    onClose()
    window.location.hash = href
  }

  const isActive = (href: string) => {
    if (href === '#') return active === '#' || active === ''
    return active === href
  }

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : '-100%',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`sidebar ${isOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-wrapper">
              <IconPdf className="brand-icon" />
            </div>
            <div className="brand-text">
              <span className="brand-title">PDF Suite</span>
              <span className="brand-subtitle">Enterprise Tools</span>
            </div>
          </div>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <motion.a
                key={item.id}
                href={item.href}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  handleNavClick(item.href)
                }}
                aria-current={active ? 'page' : undefined}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="nav-item-icon">
                  <Icon className="icon" />
                </div>
                <span className="nav-item-label">{item.label}</span>
                {item.badge && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
                {active && (
                  <motion.div
                    layoutId="activeSidebarNav"
                    className="active-indicator"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.a>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? (
              <IconSun className="theme-icon" />
            ) : (
              <IconMoon className="theme-icon" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </motion.aside>
    </>
  )
}
