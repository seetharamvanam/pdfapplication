import { useState, useRef, useEffect } from 'react'
import * as pdfLib from 'pdf-lib'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfEditorCanvas from '../components/PdfEditorCanvas'
import './PageLayout.css'
import { useToast } from '../components/ToastProvider'

type DrawingTool = 'pen' | 'highlight' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser' | 'select'
type DrawingAction = {
  tool: DrawingTool
  points: Array<{ x: number; y: number }>
  color: string
  strokeWidth: number
  fill?: boolean
  text?: string
  fontSize?: number
}

export default function Edit() {
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfLib.PDFDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [toolColor, setToolColor] = useState('#000000')
  const [toolStrokeWidth, setToolStrokeWidth] = useState(2)
  const [drawings, setDrawings] = useState<DrawingAction[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    try {
      setLoading(true)
      const arrayBuffer = await selectedFile.arrayBuffer()
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setFile(selectedFile)
      setPageNum(1)
      
      // Create object URL for PdfViewer
      const url = URL.createObjectURL(selectedFile)
      setFileUrl(url)
      
      showToast('PDF loaded successfully', 'success')
    } catch (error) {
      showToast('Failed to load PDF', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  
  // Cleanup URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl)
      }
    }
  }, [fileUrl])

  async function handleDownload() {
    if (!pdfDoc || !file) return

    try {
      setLoading(true)
      const pdfBytes = await pdfDoc.save()
      // Convert to regular Uint8Array to avoid SharedArrayBuffer type issues
      const bytes = new Uint8Array(pdfBytes)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited-${file.name}`
      a.click()
      URL.revokeObjectURL(url)
      showToast('PDF downloaded successfully', 'success')
    } catch (error) {
      showToast('Failed to download PDF', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit PDF</h1>
          <p className="page-subtitle">
            Edit text, add annotations, rotate pages, crop, and redact content with professional tools.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Upload PDF
            </Button>
          ) : (
            <Button variant="primary" onClick={handleDownload} disabled={loading}>
              Download Edited PDF
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handleFileSelect}
          />
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
            <h3>Upload a PDF to Edit</h3>
            <p>Drag and drop your PDF here, or click to browse</p>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Select File
            </Button>
          </div>
        </Card>
      ) : (
        <div className="editor-container">
          <div className="editor-toolbar">
            <div className="toolbar-group">
              <Button
                variant={selectedTool === 'pen' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'pen' ? 'select' : 'pen')}
                title="Pen - Draw freehand"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
                Pen
              </Button>
              <Button
                variant={selectedTool === 'highlight' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'highlight' ? 'select' : 'highlight')}
                title="Highlight - Highlight text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 12h18M6 8h12M6 16h12" strokeWidth="2" />
                </svg>
                Highlight
              </Button>
              <Button
                variant={selectedTool === 'rectangle' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'rectangle' ? 'select' : 'rectangle')}
                title="Rectangle - Draw rectangle"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Rectangle
              </Button>
              <Button
                variant={selectedTool === 'circle' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'circle' ? 'select' : 'circle')}
                title="Circle - Draw circle"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Circle
              </Button>
              <Button
                variant={selectedTool === 'arrow' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'arrow' ? 'select' : 'arrow')}
                title="Arrow - Draw arrow"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Arrow
              </Button>
              <Button
                variant={selectedTool === 'text' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'text' ? 'select' : 'text')}
                title="Text - Add text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 20h16M6 16V4h4a4 4 0 0 1 4 4v8" />
                  <path d="M18 16V8h-4" />
                </svg>
                Text
              </Button>
              <Button
                variant={selectedTool === 'eraser' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'eraser' ? 'select' : 'eraser')}
                title="Eraser - Erase drawings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
                Eraser
              </Button>
            </div>

            <div className="toolbar-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Color:
                <input
                  type="color"
                  value={toolColor}
                  onChange={(e) => setToolColor(e.target.value)}
                  style={{ width: '40px', height: '32px', border: '1px solid var(--border-primary)', borderRadius: '4px', cursor: 'pointer' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Size:
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={toolStrokeWidth}
                  onChange={(e) => setToolStrokeWidth(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ minWidth: '30px', textAlign: 'center' }}>{toolStrokeWidth}</span>
              </label>
            </div>
          </div>

          <div className="editor-viewer">
            {fileUrl && (
              <PdfEditorCanvas
                pdfSrc={fileUrl}
                currentPage={pageNum}
                onPageChange={setPageNum}
                selectedTool={selectedTool}
                toolColor={toolColor}
                toolStrokeWidth={toolStrokeWidth}
                drawings={drawings}
                onDrawingChange={setDrawings}
              />
            )}
            {!fileUrl && file && (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading PDF viewer...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="page-info-section">
        <Card>
          <h3>Editing Features</h3>
          <ul className="feature-list">
            <li><strong>Text Editing:</strong> Add and modify text in your PDF documents</li>
            <li><strong>Annotations:</strong> Add comments, highlights, and notes</li>
            <li><strong>Page Rotation:</strong> Rotate pages left or right by 90 degrees</li>
            <li><strong>Crop Pages:</strong> Remove unwanted margins and areas</li>
            <li><strong>Redaction:</strong> Permanently remove sensitive information</li>
            <li><strong>Form Filling:</strong> Fill out PDF forms and save changes</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
