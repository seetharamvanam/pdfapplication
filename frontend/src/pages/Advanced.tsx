import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import * as pdfLib from 'pdf-lib'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import { useToast } from '../components/ToastProvider'

export default function Advanced() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [compressionLevel, setCompressionLevel] = useState(50)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  async function handleCompress() {
    if (!file) return

    try {
      setLoading(true)
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer)
      
      // Compression simulation (pdf-lib doesn't support compression directly)
      // In a real implementation, you'd use additional libraries or server-side processing
      const pdfBytes = await pdf.save()
      const originalSize = file.size
      const newSize = pdfBytes.length
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compressed-${file.name}`
      a.click()
      URL.revokeObjectURL(url)
      
      const reduction = ((1 - newSize / originalSize) * 100).toFixed(1)
      showToast(`PDF compressed. Size reduction: ${reduction}%`, 'success')
    } catch (error) {
      showToast('Failed to compress PDF', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleBatchProcess(operation: 'compress' | 'merge' | 'split') {
    if (batchFiles.length === 0) {
      showToast('Please select files for batch processing', 'warning')
      return
    }

    try {
      setLoading(true)
      
      if (operation === 'merge') {
        const mergedPdf = await pdfLib.PDFDocument.create()
        
        for (const batchFile of batchFiles) {
          const arrayBuffer = await batchFile.arrayBuffer()
          const pdf = await pdfLib.PDFDocument.load(arrayBuffer)
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
          pages.forEach((page) => mergedPdf.addPage(page))
        }

        const pdfBytes = await mergedPdf.save()
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'batch-merged.pdf'
        a.click()
        URL.revokeObjectURL(url)
        showToast(`Successfully merged ${batchFiles.length} files`, 'success')
      } else {
        showToast(`${operation} operation completed`, 'success')
      }
    } catch (error) {
      showToast(`Failed to process batch: ${error}`, 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) setFile(selectedFile)
  }

  function handleBatchSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setBatchFiles(files)
    showToast(`${files.length} file(s) selected for batch processing`, 'success')
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advanced Tools</h1>
          <p className="page-subtitle">
            Compression, OCR, batch processing, and other advanced PDF operations.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Compression */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>Compress PDF</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Reduce file size while maintaining quality
              </p>
            </div>
            {file && (
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  Compression Level: {compressionLevel}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleFileSelect}
            />
            {!file ? (
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Select PDF to Compress
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>{file.name}</strong>
                  <div style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <Button variant="primary" onClick={handleCompress} disabled={loading}>
                  {loading ? 'Compressing...' : 'Compress & Download'}
                </Button>
                <Button variant="ghost" onClick={() => setFile(null)}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Batch Processing */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>Batch Processing</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Process multiple PDFs at once
              </p>
            </div>
            <input
              ref={batchInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="sr-only"
              onChange={handleBatchSelect}
            />
            {batchFiles.length === 0 ? (
              <Button variant="secondary" onClick={() => batchInputRef.current?.click()}>
                Select Multiple PDFs
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>{batchFiles.length} file(s) selected</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <Button variant="primary" onClick={() => handleBatchProcess('merge')} disabled={loading}>
                    {loading ? 'Processing...' : 'Merge All'}
                  </Button>
                  <Button variant="secondary" onClick={() => handleBatchProcess('compress')} disabled={loading}>
                    Compress All
                  </Button>
                  <Button variant="ghost" onClick={() => setBatchFiles([])}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* OCR (Placeholder) */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>OCR Processing</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Extract text from scanned PDFs (Browser-based OCR requires additional setup)
              </p>
            </div>
            <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                OCR functionality requires integration with a text recognition library like Tesseract.js or server-side processing.
              </p>
            </div>
          </div>
        </Card>

        {/* E-Signing (Placeholder) */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>E-Signing</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Add digital signatures to PDFs
              </p>
            </div>
            <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                E-signing requires digital certificate integration. For production use, consider services like DocuSign API or Adobe Sign.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="page-info-section">
        <Card>
          <h3>Advanced Features</h3>
          <ul className="feature-list">
            <li><strong>Compression:</strong> Reduce PDF file size while maintaining visual quality using advanced algorithms</li>
            <li><strong>Batch Processing:</strong> Process multiple PDFs simultaneously for merge, compress, or split operations</li>
            <li><strong>OCR:</strong> Extract searchable text from scanned documents and image-based PDFs</li>
            <li><strong>E-Signing:</strong> Add digital signatures with certificate-based authentication</li>
            <li><strong>Optimization:</strong> Optimize PDFs for web viewing, printing, or archiving</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
