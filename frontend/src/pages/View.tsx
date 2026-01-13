import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfViewer from '../components/PdfViewer'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'

export default function View() {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const { addToast } = useToast()

  function loadFile(file: File) {
    if (!file) return
    // Basic validation
    if (file.type && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file.')
      return
    }

    if (viewerUrl) {
      try { URL.revokeObjectURL(viewerUrl) } catch (e) {}
    }
    const u = URL.createObjectURL(file)
    setViewerUrl(u)
    setFilename(file.name)
    try { addToast('File opened') } catch (err) {}
  }

  useEffect(() => {
    function onPdfUpload(e: Event) {
      const ce = e as CustomEvent<File>
      const f = ce?.detail
      if (f) loadFile(f)
    }
    window.addEventListener('pdf-upload', onPdfUpload as EventListener)
    return () => {
      window.removeEventListener('pdf-upload', onPdfUpload as EventListener)
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    }
  }, [viewerUrl])

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">View PDF</h1>
          <p className="page-subtitle">
            Open and inspect PDFs with a fast in-browser viewer. Use the sample files or upload your own.
          </p>
        </div>
        <div className="page-actions">
          {!viewerUrl ? (
            <>
              <Button
                variant="primary"
                onClick={() => (document.getElementById('view-upload') as HTMLInputElement | null)?.click()}
              >
                Open PDF
              </Button>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  import('../utils/sample').then(m => m.createSamplePdf('viewer-sample.pdf', 'Viewer sample')).then(f => loadFile(f))
                }}
              >
                Try Sample
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => { if (viewerUrl) URL.revokeObjectURL(viewerUrl); setViewerUrl(null); setFilename(null); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <input 
        id="view-upload" 
        className="sr-only" 
        type="file" 
        accept="application/pdf" 
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          if (f) loadFile(f)
          e.currentTarget.value = ''
        }} 
      />

      {!viewerUrl ? (
        <Card className="upload-zone">
          <div className="upload-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Upload a PDF to View</h3>
            <p>Drag and drop your PDF here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('view-upload') as HTMLInputElement | null)?.click()}>
              Select File
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <strong>{filename}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" onClick={() => window.open(viewerUrl, '_blank')}>
                  Open in New Tab
                </Button>
                <Button variant="primary" onClick={() => {
                  const a = document.createElement('a')
                  a.href = viewerUrl
                  a.download = filename ?? 'file.pdf'
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                }}>
                  Download
                </Button>
              </div>
            </div>
            <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', minHeight: '600px' }}>
              <PdfViewer src={viewerUrl} filename={filename ?? undefined} />
            </div>
          </div>
        </Card>
      )}

      <div className="page-info-section">
        <Card>
          <h3>Viewer Basics</h3>
          <ul className="feature-list">
            <li><strong>Open files:</strong> Local files only — we never upload them</li>
            <li><strong>Quick tips:</strong> Use the browser's print/save-as options to export pages</li>
            <li><strong>Privacy:</strong> Viewing happens entirely client-side</li>
            <li><strong>Best for:</strong> Inspecting pages, layouts, and annotations without leaving your browser</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
