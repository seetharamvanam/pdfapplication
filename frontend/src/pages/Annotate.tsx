/**
 * Annotate PDF Page
 * Add comments, highlights, shapes, drawings, and freehand markup
 * Note: Full annotation implementation would require canvas-based PDF editing
 */

import React, { useState, useEffect } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfViewer from '../components/PdfViewer'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { validateFile } from '../utils/pdfUtils'

export default function Annotate() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [annotationMode, setAnnotationMode] = useState<'highlight' | 'comment' | 'shape' | 'draw'>('highlight')
  const [annotations, setAnnotations] = useState<Array<{ type: string; data: any }>>([])

  useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    }
  }, [viewerUrl])

  function loadFile(file: File) {
    if (!file) return
    
    const validation = validateFile(file)
    if (!validation.valid) {
      addToast(validation.error || 'Invalid file')
      return
    }

    if (viewerUrl) {
      try { URL.revokeObjectURL(viewerUrl) } catch (e) {}
    }
    
    const url = URL.createObjectURL(file)
    setViewerUrl(url)
    setFile(file)
    setAnnotations([])
    addToast('PDF loaded for annotation')
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
    e.target.value = ''
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Annotate PDF</h1>
          <p className="page-subtitle">
            Add comments, highlights, shapes, and drawings to your PDF documents.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('annotate-upload') as HTMLInputElement | null)?.click()}
            >
              Upload PDF
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { 
              if (viewerUrl) URL.revokeObjectURL(viewerUrl)
              setViewerUrl(null)
              setFile(null)
              setAnnotations([])
            }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {!file ? (
        <Card className="upload-zone">
          <div className="upload-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Upload a PDF to Annotate</h3>
            <p>Drag and drop a PDF file here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('annotate-upload') as HTMLInputElement | null)?.click()}>
              Select File
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Annotation Toolbar */}
          <Card className="card-padding">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 600, marginRight: 8 }}>Tools:</div>
              {(['highlight', 'comment', 'shape', 'draw'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={annotationMode === mode ? 'primary' : 'ghost'}
                  onClick={() => setAnnotationMode(mode)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {mode === 'highlight' && '🖍️ Highlight'}
                  {mode === 'comment' && '💬 Comment'}
                  {mode === 'shape' && '🔷 Shape'}
                  {mode === 'draw' && '✏️ Draw'}
                </Button>
              ))}
            </div>
            <div className="card-lift" style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.08))',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.85rem',
              color: 'var(--muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>💡</span>
                <span>Note: Full annotation features require canvas-based PDF editing. Basic viewer is shown below. For production use, integrate with pdf-lib for annotation layers.</span>
              </div>
            </div>
          </Card>

          {/* PDF Viewer */}
          {viewerUrl && (
            <Card className="card-padding" style={{ padding: 0, overflow: 'hidden' }}>
              <PdfViewer src={viewerUrl} filename={file.name} />
            </Card>
          )}

          {annotations.length > 0 && (
            <Card className="card-padding">
              <h3 style={{ marginBottom: 16 }}>Annotations ({annotations.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {annotations.map((annotation, index) => (
                  <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{annotation.type}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {JSON.stringify(annotation.data)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <input
        id="annotate-upload"
        className="sr-only"
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
      />
    </div>
  )
}
