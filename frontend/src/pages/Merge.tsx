import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import React from 'react'
import './PageLayout.css'
import './ops.css'
import MergeBoard from '../components/MergeBoard'
import { useToast } from '../components/ToastProvider'

export default function Merge() {
  const [files, setFiles] = React.useState<File[]>([])
  const [merged, setMerged] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  function handleFilesChange(next: File[]) {
    setFiles(next)
    // reset merged flag when new files are added
    if (merged) setMerged(false)
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Merge PDF</h1>
          <p className="page-subtitle">
            Combine multiple PDF documents into a single file quickly and securely in your browser with enterprise-grade processing.
          </p>
        </div>
        <div className="page-actions">
          {files.length === 0 ? (
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload PDFs to Merge
            </Button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              const added = Array.from(e.currentTarget.files || [])
              if (added.length) {
                handleFilesChange([...(files || []), ...added])
                showToast(`${added.length} file(s) added`, 'success')
                e.currentTarget.value = ''
              }
            }}
          />
        </div>
      </div>

      {files.length === 0 ? (
        <Card className="upload-zone">
          <div className="upload-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Upload PDFs to Merge</h3>
            <p>Drag and drop your PDF files here, or click to browse</p>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Select Files
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="merge-helper">
            Reorder thumbnails to set the merge order, then click Merge to download.
          </div>

          <div className="stepper">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-label">Upload</div>
            </div>
            <div className={`step ${files.length ? 'active' : ''}`}>
              <div className="step-icon">2</div>
              <div className="step-label">Arrange</div>
            </div>
            <div className={`step ${merged ? 'done' : ''}`}>
              <div className="step-icon">{merged ? '✓' : '3'}</div>
              <div className="step-label">Merge</div>
            </div>
            {files.length > 0 && (
              <div className="status-pill">{files.length} file{files.length > 1 ? 's' : ''} ready</div>
            )}
          </div>

          <MergeBoard 
            files={files} 
            onFilesChange={handleFilesChange} 
            onMergeComplete={(f) => { 
              try { 
                window.dispatchEvent(new CustomEvent('pdf-upload', { detail: f })) 
              } catch (err) {} 
              try { 
                setMerged(true)
                showToast('PDFs merged successfully!', 'success')
              } catch(err){} 
            }} 
          />
        </div>
      )}

      <div className="page-info-section">
        <Card>
          <h3>How Merge Works</h3>
          <ul className="feature-list">
            <li><strong>Multiple Files:</strong> Upload multiple PDFs and merge them into a single document</li>
            <li><strong>Reorder:</strong> Drag and drop thumbnails to set the order in which PDFs are merged</li>
            <li><strong>Privacy:</strong> All processing happens in your browser — files never leave your device</li>
            <li><strong>Best for:</strong> Combining reports, chapters, or scans into a single file</li>
            <li><strong>Quick tip:</strong> Upload files in the desired order; we'll preserve that order in the merged result</li>
          </ul>
        </Card>
      </div>
    </div>
  )
} 