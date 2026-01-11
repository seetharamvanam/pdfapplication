import { useEffect, useState } from 'react'
import './Home.css'
import './ops.css'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { IconPdf, IconMerge, IconSplit, IconCompress, IconConvert, IconSecure } from '../components/icons' 

export default function Home() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <main className="page page-ops home-page">
      <section className="ops-hero">
        <div className="ops-hero-inner">
          <div className="hero-copy">
            <h1 className="fade-up">All PDF Tools — Completely Free</h1>
            <p className="lead fade-up">
              Merge, split, compress, convert, and rotate PDF files quickly and securely — no signup required.
            </p>

            <div className="hero-ctas fade-up">
              <label htmlFor="hero-upload">
                <Button variant="primary" onClick={(e) => { e.preventDefault(); const el = document.getElementById('hero-upload') as HTMLInputElement | null; el?.click() }}>Get Started — Upload PDF</Button>
              </label>
              <a className="btn ghost" href="#features">Explore Tools</a>
            </div>

            <input id="hero-upload" className="sr-only" type="file" accept="application/pdf" onChange={(e)=>{
              const file = e.target.files?.[0];
              if (file) {
                // Dispatch a global event so other components (Navbar) can handle the file
                try {
                  window.dispatchEvent(new CustomEvent('pdf-upload', { detail: file }))
                } catch (err) {
                  // Fallback for very old browsers
                  alert(`Selected: ${file.name}`)
                }
                // reset input so selecting the same file again will fire change
                e.currentTarget.value = ''
              }
            }} />

            <ul className="hero-quick">
              <li>Fast & private — files processed in your browser</li>
              <li>No login — free forever</li>
              <li>Supports large PDFs & batch operations</li>
            </ul>
          </div>

          <div className="hero-visual" aria-hidden>
            <div className="pdf-card">
              <IconPdf style={{ width: 160, height: 160 }} />
              <div className="badge">Free • No Signup</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <h2>Powerful PDF Tools</h2>
        <p className="sub">Everything you need to manage PDFs in one place.</p>

        <div className={`cards ${mounted ? 'stagger fade-in' : ''}`} style={{ ['--stagger' as any]: '0s' } as React.CSSProperties}>
          <Card>
            <div className="icon"><IconMerge /></div>
            <h3>Merge PDFs</h3>
            <p>Combine multiple PDFs into a single document in seconds.</p>
          </Card>

          <Card>
            <div className="icon"><IconSplit /></div>
            <h3>Split & Extract</h3>
            <p>Split a large PDF into smaller files or extract specific pages.</p>
          </Card>

          <Card>
            <div className="icon"><IconCompress /></div>
            <h3>Compress</h3>
            <p>Reduce PDF size while preserving readability.</p>
          </Card>

          <Card>
            <div className="icon"><IconConvert /></div>
            <h3>Convert</h3>
            <p>Convert PDF to Word, PNG, JPG or create PDFs from other formats.</p>
          </Card>

          <Card>
            <div className="icon"><IconSecure /></div>
            <h3>Secure</h3>
            <p>Process files locally for privacy; optional encryption when needed.</p>
          </Card>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <div className="step-number">1</div>
            <div>
              <h4>Choose a tool</h4>
              <p>Pick the task you need — merge, split, compress, convert, etc.</p>
            </div>
          </li>
          <li>
            <div className="step-number">2</div>
            <div>
              <h4>Upload your file</h4>
              <p>Upload from your device — we accept large PDFs and multiple files.</p>
            </div>
          </li>
          <li>
            <div className="step-number">3</div>
            <div>
              <h4>Download result</h4>
              <p>Get your processed PDF immediately — no watermarks and no fees.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer className="home-footer">
        <div>
          <strong>PDF App</strong> — Free PDF tools. Built for speed and privacy.
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </main>
  )
}
