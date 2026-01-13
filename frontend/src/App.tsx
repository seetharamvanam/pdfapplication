import './App.css'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Router from './pages/Router'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])
  
  // On desktop, sidebar should always be visible
  const sidebarVisible = isDesktop ? true : sidebarOpen

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header role="banner" className="app-header">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
      </header>
      <div className="app-layout">
        <Sidebar isOpen={sidebarVisible} onClose={() => setSidebarOpen(false)} />
        <main id="main-content" role="main" className="main-landmark">
          <Router />
        </main>
      </div>
    </div>
  )
}

export default App
