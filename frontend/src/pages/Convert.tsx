import React, { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { IconConvert } from '../components/icons'
import './ops.css'
import { useToast } from '../components/ToastProvider'

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
    
    setStatus({ loading: true, message: mode === 'pdf-to-other' 
      ? `Converting to ${format.toUpperCase()}...` 
      : `Converting to PDF...` })
    
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      
      let endpoint: string
      if (mode === 'pdf-to-other') {
        endpoint = `/api/convert/${format}`
        if (format === 'png' || format === 'jpg') {
          form.append('dpi', dpi.toString())
          if (format === 'jpg') {
            form.append('quality', quality.toString())
          }
        }
      } else {
        // Other to PDF
        if (format === 'png' || format === 'jpg') {
          // Check if it's a ZIP file (multiple images) or single image
          const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')
          if (isZip) {
            endpoint = '/api/convert/from/images'
          } else {
            endpoint = '/api/convert/from/image'
            form.append('format', format)
          }
        } else if (format === 'docx') {
          endpoint = '/api/convert/from/docx'
        } else {
          endpoint = '/api/convert/from/txt'
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => 'Conversion failed')
        setStatus({ loading: false, message: `Conversion failed: ${txt}` })
        try { addToast(`Conversion failed: ${txt}`) } catch (err) {}
        return
      }

      const blob = await res.blob()
      if (!blob || blob.size < 10) {
        setStatus({ loading: false, message: 'Conversion produced invalid result' })
        try { addToast('Conversion failed') } catch (err) {}
        return
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename: string
      if (mode === 'pdf-to-other') {
        filename = file.name.replace(/\.pdf$/i, '') + '.' + (format === 'png' || format === 'jpg' ? 'zip' : format)
      } else {
        filename = file.name.replace(/\.[^.]+$/, '') + '.pdf'
      }
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
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
      setStatus({ loading: false, message: 'Conversion failed' })
      try { addToast('Conversion failed') } catch (e) {}
    }
  }

  function downloadConverted() {
    if (!convertedFile) return
    const a = document.createElement('a')
    a.href = convertedFile.url
    a.download = convertedFile.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const isImageFormat = format === 'png' || format === 'jpg'
  const isPdfToOther = mode === 'pdf-to-other'

  return (
    <main className="page page-ops">
      <section className="ops-hero">
        <div className="ops-hero-inner">
          <div>
            <h1>Convert PDF</h1>
            <p className="sub">Convert PDFs to other formats or convert other formats to PDF — choose your conversion direction.</p>
            
            {/* Conversion Mode Selector */}
            <div style={{ marginTop: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  className={`btn ${isPdfToOther ? 'primary' : 'ghost'}`}
                  onClick={() => setMode('pdf-to-other')}
                  style={{ flex: 1, fontWeight: isPdfToOther ? 700 : 600 }}
                >
                  📄 PDF → Other
                </button>
                <button
                  className={`btn ${!isPdfToOther ? 'primary' : 'ghost'}`}
                  onClick={() => setMode('other-to-pdf')}
                  style={{ flex: 1, fontWeight: !isPdfToOther ? 700 : 600 }}
                >
                  📝 Other → PDF
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: 12 }}>
              {file ? null : (
                <>
                  <Button variant="primary" onClick={(e) => { e.preventDefault(); (document.getElementById('convert-upload') as HTMLInputElement | null)?.click() }}>
                    {isPdfToOther ? 'Upload PDF to convert' : 'Upload file to convert to PDF'}
                  </Button>
                  <input 
                    id="convert-upload" 
                    className="sr-only" 
                    type="file" 
                    accept={getAcceptTypes()} 
                    onChange={onFileChange} 
                  />
                </>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="merge-helper">
                {file 
                  ? (isPdfToOther 
                    ? 'Select output format and options, then click Convert to download.' 
                    : 'Select source format, then click Convert to create PDF.')
                  : (isPdfToOther
                    ? 'Upload or drag a PDF file below to convert it to another format.'
                    : 'Upload or drag files (images, DOCX, or text) below to convert to PDF.')}
              </div>

              {file && (
                <div style={{ marginTop: 12 }}>
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
                    {file && (
                      <div className="status-pill">
                        {formatFileSize(file.size)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!file && (
                <div style={{ marginTop: 12 }}>
                  <div className="dropzone" onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) onFileChange(f); }} onDragOver={(e) => e.preventDefault()}>
                    <div className="drop-hint">
                      <p className="h1">Drag & drop {isPdfToOther ? 'a PDF' : 'files'} here</p>
                      <p className="muted">Or click to upload and convert</p>
                      <input 
                        id="convert-upload-drop" 
                        aria-label={`Upload ${isPdfToOther ? 'PDF' : 'file'} to convert`} 
                        className="upload-input" 
                        type="file" 
                        accept={getAcceptTypes()} 
                        onChange={onFileChange} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {file && (
                <div style={{ marginTop: 12 }}>
                  <div className="file-info-card" style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {formatFileSize(file.size)}
                        </div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          {file.type || 'Unknown type'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label htmlFor="convert-upload-replace">
                        <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); }} aria-label="Replace file">
                          Replace
                        </button>
                      </label>
                      <input id="convert-upload-replace" className="sr-only" type="file" accept={getAcceptTypes()} onChange={onFileChange} />
                      <button 
                        className="btn small ghost" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setFile(null); 
                          setConvertedFile(null);
                          setStatus({ loading: false });
                        }} 
                        aria-label="Remove file"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {file && (
                <div style={{ marginTop: 12 }}>
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
              )}
            </div>

            <div className="ops-details">
              <h3>{isPdfToOther ? 'Supported output formats' : 'Supported input formats'}</h3>
              <p className="sub">
                {isPdfToOther 
                  ? 'Convert PDFs to various formats for editing, sharing, or archiving.'
                  : 'Convert various file formats to PDF for universal compatibility and sharing.'}
              </p>
              <ul className="ops-features">
                {isPdfToOther ? (
                  <>
                    <li><strong>PNG/JPG:</strong> Extract pages as images — perfect for presentations or web use.</li>
                    <li><strong>TXT:</strong> Extract text content — useful for searching or editing text.</li>
                    <li><strong>DOCX:</strong> Convert to Word documents — edit content in Microsoft Word or Google Docs.</li>
                    <li><strong>Quality options:</strong> Adjust DPI for images and quality for JPEGs to balance size and quality.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Images (PNG/JPG):</strong> Convert single images or ZIP archives of images to PDF — each image becomes a page.</li>
                    <li><strong>Text (TXT):</strong> Convert plain text files to formatted PDF documents.</li>
                    <li><strong>Word (DOCX):</strong> Convert Word documents to PDF for universal compatibility.</li>
                    <li><strong>Batch processing:</strong> Upload a ZIP file with multiple images to create a multi-page PDF.</li>
                  </>
                )}
              </ul>
            </div>

            <div className="examples">
              {isPdfToOther ? (
                <>
                  <div className="example-card">
                    <h4>Image extraction</h4>
                    <p className="sub">Extract pages as PNG or JPG images for use in presentations or websites.</p>
                    <div className="example-actions">
                      <button className="btn ghost" onClick={(e)=>{ e.preventDefault(); import('../utils/sample').then(m=>m.createSamplePdf('images.pdf','Images sample')).then(f=>{ try{ window.dispatchEvent(new CustomEvent('pdf-upload',{detail:f})) }catch(err){} }) }}>Try sample</button>
                    </div>
                  </div>

                  <div className="example-card">
                    <h4>DOCX conversion</h4>
                    <p className="sub">Convert PDFs to editable Word documents for quick edits.</p>
                    <div className="example-actions">
                      <button className="btn ghost" onClick={(e)=>{ e.preventDefault(); import('../utils/sample').then(m=>m.createSamplePdf('docx-sample.pdf','DOCX sample')).then(f=>{ try{ window.dispatchEvent(new CustomEvent('pdf-upload',{detail:f})) }catch(err){} }) }}>Try sample</button>
                    </div>
                  </div>

                  <div className="example-card">
                    <h4>Text extraction</h4>
                    <p className="sub">Extract text content from PDFs for searching or editing.</p>
                    <div className="example-actions">
                      <button className="btn ghost" onClick={(e)=>{ e.preventDefault(); import('../utils/sample').then(m=>m.createSamplePdf('text-sample.pdf','Text extraction sample')).then(f=>{ try{ window.dispatchEvent(new CustomEvent('pdf-upload',{detail:f})) }catch(err){} }) }}>Try sample</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="example-card">
                    <h4>Image to PDF</h4>
                    <p className="sub">Convert photos, screenshots, or scanned images to PDF documents.</p>
                  </div>

                  <div className="example-card">
                    <h4>Word to PDF</h4>
                    <p className="sub">Convert Word documents to PDF for sharing and archiving.</p>
                  </div>

                  <div className="example-card">
                    <h4>Text to PDF</h4>
                    <p className="sub">Convert plain text files to formatted PDF documents.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div aria-hidden>
            <Card>
              <div className="icon"><IconConvert /></div>
              <h3>{isPdfToOther ? 'Multiple targets' : 'Universal format'}</h3>
              <p>{isPdfToOther 
                ? 'Choose output format and download converted files instantly.'
                : 'Convert any supported format to PDF for universal compatibility.'}
              </p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
