import React, { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfViewer from '../components/PdfViewer'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { compressPdf, validateFile, downloadBlob } from '../utils/pdfUtils'

export default function Compress() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [compressionLevel, setCompressionLevel] = useState<number>(0.7)
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [compressedFile, setCompressedFile] = useState<{ url: string; size: number; originalSize: number } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (compressedFile) URL.revokeObjectURL(compressedFile.url)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [compressedFile, previewUrl])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement> | File | null) {
    const f = (e && (e as File).name ? e as File : (e as React.ChangeEvent<HTMLInputElement>)?.currentTarget?.files?.[0]) || null
    if (!f) return
    setFile(f)
    setCompressedFile(null)
    try { window.dispatchEvent(new CustomEvent('pdf-upload', { detail: f })) } catch (err) {}
    try { addToast('File loaded') } catch (err) {}
    if ((e as React.ChangeEvent<HTMLInputElement>)?.currentTarget) {
      (e as React.ChangeEvent<HTMLInputElement>).currentTarget.value = ''
    }
  }

  async function handleCompress() {
    if (!file) return

    const validation = validateFile(file)
    if (!validation.valid) {
      setStatus({ loading: false, message: validation.error || 'Invalid file' })
      addToast(validation.error || 'Invalid file')
      return
    }
    
    setStatus({ loading: true, message: 'Compressing PDF...' })
    
    try {
      // Map compression level to quality
      const quality = compressionLevel < 0.5 ? 'low' : compressionLevel < 0.8 ? 'medium' : 'high'
      const blob = await compressPdf(file, quality)

      if (!blob || blob.size < 100) {
        setStatus({ loading: false, message: 'Compression produced invalid result' })
        addToast('Compression failed')
        return
      }

      const originalSize = file.size
      const compressedSize = blob.size
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      
      const url = URL.createObjectURL(blob)
      setCompressedFile({ url, size: compressedSize, originalSize })
      setStatus({ loading: false, message: `Compressed successfully! Reduced by ${compressionRatio}%` })
      addToast(`Compressed successfully! Reduced by ${compressionRatio}%`)
      
    } catch (err: any) {
      console.error('Compression failed', err)
      const errorMsg = err?.message || 'Compression failed'
      setStatus({ loading: false, message: errorMsg })
      addToast(errorMsg)
    }
  }

  function downloadCompressed() {
    if (!compressedFile || !file) return
    try {
      fetch(compressedFile.url).then(res => res.blob()).then(blob => {
        const filename = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'
        downloadBlob(blob, filename)
      }).catch(() => {
        const a = document.createElement('a')
        a.href = compressedFile.url
        a.download = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      const a = document.createElement('a')
      a.href = compressedFile.url
      a.download = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="page-layout">
      {previewOpen && previewUrl && (
        <div className="pdf-preview-overlay" role="dialog" aria-label="PDF preview">
          <div className="pdf-preview-backdrop" onClick={() => { setPreviewOpen(false); setTimeout(()=>{ if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) } }, 80) }} />
          <div className="pdf-preview-popup" style={{ width: '86vw', maxWidth: 1100 }}>
            <div className="pdf-preview-header">
              <div className="pdf-preview-title">Preview</div>
              <div className="pdf-preview-meta">Previewing compressed file</div>
              <button className="btn small" onClick={() => { setPreviewOpen(false); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) } }} aria-label="Close preview">✕</button>
            </div>
            <div className="pdf-preview-body">
              <div style={{ width: '100%', height: '70vh' }}>
                <PdfViewer src={previewUrl} filename={file?.name} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Compress PDF</h1>
          <p className="page-subtitle">
            Reduce file size while keeping text readable — perfect for sharing.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('compress-upload') as HTMLInputElement | null)?.click()}
            >
              Upload PDF
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { setFile(null); setCompressedFile(null); setStatus({ loading: false }); }}>
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
            <h3>Upload a PDF to Compress</h3>
            <p>Drag and drop your PDF here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('compress-upload') as HTMLInputElement | null)?.click()}>
              Select File
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card className="card-padding">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <strong>{file.name}</strong>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                {formatFileSize(file.size)} • {file.type || 'application/pdf'}
              </div>
            </div>
          </Card>

          <div className="stepper">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-label">Upload</div>
            </div>
            <div className={`step ${compressedFile ? 'done' : 'active'}`}>
              <div className="step-icon">{compressedFile ? '✓' : '2'}</div>
              <div className="step-label">Compress</div>
            </div>
            <div className={`step ${compressedFile ? 'active' : ''}`}>
              <div className="step-icon">3</div>
              <div className="step-label">Download</div>
            </div>
          </div>

          <input 
            id="compress-upload" 
            className="sr-only" 
            type="file" 
            accept="application/pdf" 
            onChange={onFileChange} 
          />

          <Card className="card-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Compression Level</div>
                <div className="status-pill" style={{ fontSize: '0.85rem' }}>
                  {compressionLevel < 0.3 ? 'Low' : compressionLevel < 0.7 ? 'Medium' : 'High'}
                </div>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.1" 
                value={compressionLevel} 
                onChange={(e) => setCompressionLevel(parseFloat(e.target.value))}
                style={{ width: '100%', height: 8, borderRadius: 4 }}
                disabled={status.loading}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.8rem', color: 'var(--muted)' }}>
                <span>Better Quality</span>
                <span>Smaller Size</span>
              </div>
              
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button 
                  variant="primary" 
                  onClick={(e) => { e.preventDefault(); handleCompress() }} 
                  disabled={!file || status.loading}
                  style={{ 
                    position: 'relative',
                    overflow: 'hidden',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    padding: '12px 20px'
                  }}
                >
                  {status.loading ? (
                    <>
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⚙️</span>
                      Compressing…
                    </>
                  ) : (
                    <>
                      🗜️ Compress PDF
                    </>
                  )}
                </Button>
              </div>
              
              {status.message && (
                <div className={`status-message ${status.loading ? 'loading' : compressedFile ? 'success' : ''}`} style={{ marginTop: 12 }}>
                  {status.loading && (
                    <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                  )}
                  {compressedFile && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
                  <span>{status.message}</span>
                </div>
              )}

              {compressedFile && (
                <div className="results-card" style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--text), rgba(231, 238, 248, 0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      Compression Results
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Original Size</div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{formatFileSize(compressedFile.originalSize)}</div>
                      </div>
                      <div style={{ fontSize: '1.5rem', color: 'var(--muted)' }}>→</div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Compressed Size</div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--success)' }}>{formatFileSize(compressedFile.size)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Reduction</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>
                          {((1 - compressedFile.size / compressedFile.originalSize) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="primary" onClick={downloadCompressed} style={{ fontWeight: 600 }}>
                        ⬇️ Download Compressed PDF
                      </Button>
                      <Button variant="ghost" onClick={() => { 
                        if (compressedFile.url) {
                          setPreviewUrl(compressedFile.url)
                          setPreviewOpen(true)
                        }
                      }}>
                        👁️ Preview
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="page-info-section">
        <Card>
          <h3>How Compression Works</h3>
          <ul className="feature-list">
            <li><strong>Best for:</strong> Sharing large scans or presentations without losing readability</li>
            <li><strong>Quick tip:</strong> For photos-heavy PDFs, expect larger gains than for text-only files</li>
            <li><strong>Compression levels:</strong> Lower levels preserve more quality, higher levels reduce size more</li>
            <li><strong>Privacy:</strong> All processing happens in your browser — files never leave your device</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
