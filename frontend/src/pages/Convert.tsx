import React, { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { convertPdfToImages, convertPdfToText, convertImagesToPdf, convertTextToPdf } from '../utils/pdfConvert'
import { downloadBlob, validateFile } from '../utils/pdfUtils'
import JSZip from 'jszip'

type ConversionFormat = 'png' | 'jpg' | 'txt' | 'docx'
type ConversionMode = 'pdf-to-other' | 'other-to-pdf'

export default function Convert() {
  const { addToast } = useToast()
  const [mode, setMode] = useState<ConversionMode>('pdf-to-other')
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ConversionFormat>('png')
  const [dpi, setDpi] = useState<number>(150)
  const [quality, setQuality] = useState<number>(0.9)
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [convertedFile, setConvertedFile] = useState<{ url: string; name: string; size: number } | null>(null)

  useEffect(() => {
    return () => {
      if (convertedFile) URL.revokeObjectURL(convertedFile.url)
    }
  }, [convertedFile])

  // Reset file when mode changes
  useEffect(() => {
    setFile(null)
    setConvertedFile(null)
    setStatus({ loading: false })
  }, [mode])

  function getAcceptTypes(): string {
    if (mode === 'pdf-to-other') {
      return 'application/pdf'
    } else {
      return 'image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,application/zip'
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement> | File | null) {
    const f = (e && (e as File).name ? e as File : (e as React.ChangeEvent<HTMLInputElement>)?.currentTarget?.files?.[0]) || null
    if (!f) return
    setFile(f)
    setConvertedFile(null)
    try { 
      if (mode === 'pdf-to-other') {
        window.dispatchEvent(new CustomEvent('pdf-upload', { detail: f })) 
      }
    } catch (err) {}
    try { addToast('File loaded') } catch (err) {}
    if ((e as React.ChangeEvent<HTMLInputElement>)?.currentTarget) {
      (e as React.ChangeEvent<HTMLInputElement>).currentTarget.value = ''
    }
  }

  async function handleConvert() {
    if (!file) return
    
    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      setStatus({ loading: false, message: validation.error || 'Invalid file' })
      try { addToast(validation.error || 'Invalid file') } catch (err) {}
      return
    }
    
    setStatus({ loading: true, message: mode === 'pdf-to-other' 
      ? `Converting to ${format.toUpperCase()}...` 
      : `Converting to PDF...` })
    
    try {
      let blob: Blob
      let filename: string

      if (mode === 'pdf-to-other') {
        // PDF to Other formats
        if (format === 'png' || format === 'jpg') {
          blob = await convertPdfToImages(
            file,
            format as 'png' | 'jpg',
            dpi,
            quality,
            (current, total) => setStatus({ loading: true, message: `Processing page ${current}/${total}...` })
          )
          filename = file.name.replace(/\.pdf$/i, '') + '.zip'
        } else if (format === 'txt') {
          const text = await convertPdfToText(
            file,
            (current, total) => setStatus({ loading: true, message: `Extracting text from page ${current}/${total}...` })
          )
          blob = new Blob([text], { type: 'text/plain' })
          filename = file.name.replace(/\.pdf$/i, '') + '.txt'
        } else if (format === 'docx') {
          // For DOCX, extract text first and note that full Word formatting requires additional libraries
          const text = await convertPdfToText(
            file,
            (current, total) => setStatus({ loading: true, message: `Converting page ${current}/${total}...` })
          )
          // Note: Full DOCX conversion with formatting requires docx library
          // For now, create a simple text-based conversion
          blob = new Blob([text], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          filename = file.name.replace(/\.pdf$/i, '') + '.txt'
          setStatus({ loading: false, message: 'Note: DOCX conversion is simplified. Full formatting requires advanced processing.' })
        } else {
          throw new Error(`Unsupported format: ${format}`)
        }
      } else {
        // Other to PDF
        if (format === 'png' || format === 'jpg') {
          // Check if it's a ZIP file (multiple images) or single image
          const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')
          
          if (isZip) {
            // Extract images from ZIP
            const zip = new JSZip()
            const zipData = await file.arrayBuffer()
            const zipFile = await zip.loadAsync(zipData)
            const imageFiles: File[] = []
            
            for (const [filename, fileData] of Object.entries(zipFile.files)) {
              if (!fileData.dir && /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(filename)) {
                const blob = await fileData.async('blob')
                const imageFile = new File([blob], filename, { type: blob.type })
                imageFiles.push(imageFile)
              }
            }
            
            if (imageFiles.length === 0) {
              throw new Error('No valid images found in ZIP file')
            }
            
            blob = await convertImagesToPdf(
              imageFiles,
              (current, total) => setStatus({ loading: true, message: `Converting image ${current}/${total}...` })
            )
          } else {
            // Single image
            blob = await convertImagesToPdf([file])
          }
          
          filename = file.name.replace(/\.[^.]+$/, '') + '.pdf'
        } else if (format === 'txt') {
          const text = await file.text()
          blob = await convertTextToPdf(text)
          filename = file.name.replace(/\.txt$/i, '') + '.pdf'
        } else if (format === 'docx') {
          // Note: Full DOCX to PDF conversion with formatting requires additional processing
          // For now, extract text and convert
          const text = await file.text()
          blob = await convertTextToPdf(text)
          filename = file.name.replace(/\.docx$/i, '') + '.pdf'
          setStatus({ loading: false, message: 'Note: DOCX conversion is simplified. Full formatting requires advanced processing.' })
        } else {
          throw new Error(`Unsupported format: ${format}`)
        }
      }

      if (!blob || blob.size < 10) {
        setStatus({ loading: false, message: 'Conversion produced invalid result' })
        try { addToast('Conversion failed: Invalid result') } catch (err) {}
        return
      }
      
      const url = URL.createObjectURL(blob)
      setConvertedFile({ url, name: filename, size: blob.size })
      setStatus({ loading: false, message: mode === 'pdf-to-other'
        ? `Converted successfully to ${format.toUpperCase()}!`
        : 'Converted successfully to PDF!' })
      try { addToast(mode === 'pdf-to-other' 
        ? `Converted successfully to ${format.toUpperCase()}!`
        : 'Converted successfully to PDF!') } catch (err) {}
      
    } catch (err: any) {
      console.error('Conversion failed', err)
      const errorMsg = err?.message || 'Conversion failed'
      setStatus({ loading: false, message: errorMsg })
      try { addToast(errorMsg) } catch (e) {}
    }
  }

  function downloadConverted() {
    if (!convertedFile) return
    try {
      fetch(convertedFile.url).then(res => res.blob()).then(blob => {
        downloadBlob(blob, convertedFile.name)
      }).catch(() => {
        // Fallback
        const a = document.createElement('a')
        a.href = convertedFile.url
        a.download = convertedFile.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      // Fallback
      const a = document.createElement('a')
      a.href = convertedFile.url
      a.download = convertedFile.name
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

  const isImageFormat = format === 'png' || format === 'jpg'
  const isPdfToOther = mode === 'pdf-to-other'

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Convert PDF</h1>
          <p className="page-subtitle">
            Convert PDFs to other formats or convert other formats to PDF — choose your conversion direction.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('convert-upload') as HTMLInputElement | null)?.click()}
            >
              Upload File
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { setFile(null); setConvertedFile(null); setStatus({ loading: false }); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="card-padding">
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-secondary)', padding: 6, borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
          <Button
            variant={isPdfToOther ? 'primary' : 'ghost'}
            onClick={() => setMode('pdf-to-other')}
            style={{ flex: 1, fontWeight: isPdfToOther ? 700 : 600 }}
          >
            PDF → Other
          </Button>
          <Button
            variant={!isPdfToOther ? 'primary' : 'ghost'}
            onClick={() => setMode('other-to-pdf')}
            style={{ flex: 1, fontWeight: !isPdfToOther ? 700 : 600 }}
          >
            Other → PDF
          </Button>
        </div>
      </Card>

      {!file ? (
        <Card className="upload-zone">
          <div className="upload-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Upload {isPdfToOther ? 'a PDF' : 'files'} to Convert</h3>
            <p>Drag and drop {isPdfToOther ? 'a PDF' : 'files'} here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('convert-upload') as HTMLInputElement | null)?.click()}>
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
                {formatFileSize(file.size)} • {file.type || 'Unknown type'}
              </div>
            </div>
          </Card>

          <div className="stepper">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-label">Upload</div>
            </div>
            <div className={`step ${convertedFile ? 'done' : 'active'}`}>
              <div className="step-icon">{convertedFile ? '✓' : '2'}</div>
              <div className="step-label">Convert</div>
            </div>
            <div className={`step ${convertedFile ? 'active' : ''}`}>
              <div className="step-icon">3</div>
              <div className="step-label">Download</div>
            </div>
          </div>

          <input 
            id="convert-upload" 
            className="sr-only" 
            type="file" 
            accept={getAcceptTypes()} 
            onChange={onFileChange} 
          />

          <Card className="card-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {isPdfToOther ? 'Output Format' : 'Source Format'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                    {(['png', 'jpg', 'txt', 'docx'] as ConversionFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        className={`btn ${format === fmt ? 'primary' : 'ghost'}`}
                        onClick={() => setFormat(fmt)}
                        disabled={status.loading}
                        style={{ 
                          fontWeight: format === fmt ? 700 : 600,
                          textTransform: 'uppercase',
                          fontSize: '0.9rem',
                          padding: '10px 16px'
                        }}
                      >
                        {fmt === 'png' && '🖼️ PNG'}
                        {fmt === 'jpg' && '📷 JPG'}
                        {fmt === 'txt' && '📄 TXT'}
                        {fmt === 'docx' && '📝 DOCX'}
                      </button>
                    ))}
                  </div>

                  {isPdfToOther && isImageFormat && (
                    <>
                      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Image Resolution (DPI)</div>
                        <div className="status-pill" style={{ fontSize: '0.85rem' }}>
                          {dpi} DPI
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="72" 
                        max="300" 
                        step="10" 
                        value={dpi} 
                        onChange={(e) => setDpi(parseInt(e.target.value))}
                        style={{ width: '100%', height: 8, borderRadius: 4 }}
                        disabled={status.loading}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <span>Lower (72)</span>
                        <span>Higher (300)</span>
                      </div>
                    </>
                  )}

                  {isPdfToOther && format === 'jpg' && (
                    <>
                      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>JPEG Quality</div>
                        <div className="status-pill" style={{ fontSize: '0.85rem' }}>
                          {Math.round(quality * 100)}%
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.1" 
                        value={quality} 
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        style={{ width: '100%', height: 8, borderRadius: 4 }}
                        disabled={status.loading}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <span>Lower Size</span>
                        <span>Better Quality</span>
                      </div>
                    </>
                  )}

                  {isPdfToOther && isImageFormat && (
                    <div className="card-lift" style={{ 
                      marginTop: 14, 
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(6, 182, 212, 0.08))',
                      borderRadius: '12px',
                      border: '1px solid rgba(124, 58, 237, 0.25)',
                      fontSize: '0.85rem',
                      color: 'var(--muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.2rem' }}>💡</span>
                        <span>Images will be exported as a ZIP file with one {format.toUpperCase()} per page.</span>
                      </div>
                    </div>
                  )}

                  {!isPdfToOther && isImageFormat && (
                    <div className="card-lift" style={{ 
                      marginTop: 14, 
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(6, 182, 212, 0.08))',
                      borderRadius: '12px',
                      border: '1px solid rgba(22, 163, 74, 0.25)',
                      fontSize: '0.85rem',
                      color: 'var(--muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.2rem' }}>💡</span>
                        <span>Upload a single {format.toUpperCase()} image or a ZIP file containing multiple images. Each image will become a page in the PDF.</span>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button 
                      variant="primary" 
                      onClick={(e) => { e.preventDefault(); handleConvert() }} 
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
                          Converting…
                        </>
                      ) : (
                        <>
                          🔄 {isPdfToOther ? `Convert to ${format.toUpperCase()}` : 'Convert to PDF'}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {status.message && (
                    <div className={`status-message ${status.loading ? 'loading' : convertedFile ? 'success' : ''}`} style={{ marginTop: 12 }}>
                      {status.loading && (
                        <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                      )}
                      {convertedFile && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
                      <span>{status.message}</span>
                    </div>
                  )}

                  {convertedFile && (
                    <div className="results-card" style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--text), rgba(231, 238, 248, 0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                          Conversion Results
                        </h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Converted File</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {convertedFile.name}
                            </div>
                          </div>
                          <div style={{ marginLeft: 16 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Size</div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--success)' }}>{formatFileSize(convertedFile.size)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button variant="primary" onClick={downloadConverted} style={{ fontWeight: 600 }}>
                            ⬇️ Download {isPdfToOther ? format.toUpperCase() : 'PDF'}
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
          <h3>{isPdfToOther ? 'Supported Output Formats' : 'Supported Input Formats'}</h3>
          <ul className="feature-list">
            {isPdfToOther ? (
              <>
                <li><strong>PNG/JPG:</strong> Extract pages as images — perfect for presentations or web use</li>
                <li><strong>TXT:</strong> Extract text content — useful for searching or editing text</li>
                <li><strong>DOCX:</strong> Convert to Word documents — edit content in Microsoft Word or Google Docs</li>
                <li><strong>Quality Options:</strong> Adjust DPI for images and quality for JPEGs to balance size and quality</li>
              </>
            ) : (
              <>
                <li><strong>Images (PNG/JPG):</strong> Convert single images or ZIP archives of images to PDF — each image becomes a page</li>
                <li><strong>Text (TXT):</strong> Convert plain text files to formatted PDF documents</li>
                <li><strong>Word (DOCX):</strong> Convert Word documents to PDF for universal compatibility</li>
                <li><strong>Batch Processing:</strong> Upload a ZIP file with multiple images to create a multi-page PDF</li>
              </>
            )}
          </ul>
        </Card>
      </div>
    </div>
  )
}
