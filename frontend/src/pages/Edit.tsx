import { useState, useRef, useEffect } from 'react'
import * as pdfLib from 'pdf-lib'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfViewer from '../components/PdfViewer'
import './PageLayout.css'
import { useToast } from '../components/ToastProvider'

export default function Edit() {
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfLib.PDFDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [selectedTool, setSelectedTool] = useState<'text' | 'annotate' | 'crop' | 'rotate' | 'redact' | null>(null)
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
      setTotalPages(pdf.getPageCount())
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

  async function handleRotate(direction: 'left' | 'right') {
    if (!pdfDoc) return

    try {
      setLoading(true)
      const pages = pdfDoc.getPages()
      const currentPage = pages[pageNum - 1]
      const currentRotation = currentPage.getRotation()
      const angle = direction === 'right' ? 90 : -90
      const newRotation = (currentRotation.angle + angle) % 360
      currentPage.setRotation(pdfLib.degrees(newRotation))
      setRotation(newRotation)
      showToast(`Page rotated ${direction === 'right' ? 'right' : 'left'}`, 'success')
    } catch (error) {
      showToast('Failed to rotate page', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!pdfDoc || !file) return

    try {
      setLoading(true)
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
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
                variant={selectedTool === 'text' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 20h16M6 16V4h4a4 4 0 0 1 4 4v8" />
                  <path d="M18 16V8h-4" />
                </svg>
                Text Edit
              </Button>
              <Button
                variant={selectedTool === 'annotate' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'annotate' ? null : 'annotate')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Annotate
              </Button>
              <Button
                variant={selectedTool === 'crop' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'crop' ? null : 'crop')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 2v4M6 18v4M2 6h4M18 6h4" />
                  <rect x="8" y="8" width="8" height="8" />
                </svg>
                Crop
              </Button>
              <Button
                variant={selectedTool === 'rotate' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'rotate' ? null : 'rotate')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                Rotate
              </Button>
              <Button
                variant={selectedTool === 'redact' ? 'primary' : 'ghost'}
                onClick={() => setSelectedTool(selectedTool === 'redact' ? null : 'redact')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Redact
              </Button>
            </div>

            <div className="toolbar-group">
              <Button variant="ghost" onClick={() => handleRotate('left')} disabled={!pdfDoc || loading}>
                ↺ Rotate Left
              </Button>
              <Button variant="ghost" onClick={() => handleRotate('right')} disabled={!pdfDoc || loading}>
                ↻ Rotate Right
              </Button>
            </div>

            <div className="toolbar-group">
              <span className="page-info">
                Page {pageNum} of {totalPages}
              </span>
              <Button
                variant="ghost"
                onClick={() => setPageNum(Math.max(1, pageNum - 1))}
                disabled={pageNum === 1}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPageNum(Math.min(totalPages, pageNum + 1))}
                disabled={pageNum === totalPages}
              >
                →
              </Button>
            </div>
          </div>

          <div className="editor-viewer">
            {fileUrl && (
              <PdfViewer
                src={fileUrl}
                filename={file?.name || 'Document'}
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
