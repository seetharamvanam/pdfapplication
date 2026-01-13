import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider'

// Initialize theme before rendering to prevent flash
function initializeTheme() {
  const html = document.documentElement
  let theme = 'light'
  
  try {
    // Check localStorage first
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') {
      theme = stored
    } else {
      // Fallback to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme = prefersDark ? 'dark' : 'light'
    }
  } catch (e) {
    // Fallback to system preference if localStorage fails
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme = prefersDark ? 'dark' : 'light'
  }
  
  html.setAttribute('data-theme', theme)
  html.style.colorScheme = theme
}

// Initialize theme synchronously before render
initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
