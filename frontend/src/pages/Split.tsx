import React, { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PdfViewer from '../components/PdfViewer'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'

function parseRanges(input: string, total: number) {
  const cleaned = (input || '').trim()
  if (!cleaned) return []
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean)
  const ranges: { start: number; end: number }[] = []
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      if (n < 1 || n > total) throw new Error(`Page ${n} is out of range`)
      ranges.push({ start: n, end: n })
    } else if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(x => parseInt(x.trim(), 10))
      if (isNaN(a) || isNaN(b)) throw new Error(`Invalid range: ${part}`)
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`Range ${part} is out of bounds`)
      if (a > b) throw new Error(`Invalid range: ${part}`)
      ranges.push({ start: a, end: b })
    } else {
      throw new Error(`Invalid range token: ${part}`)
    }
  }
  return ranges
}

async function splitPdfByRanges(file: File, ranges: { start: number; end: number }[], onProgress?: (done: number, total: number) => void) {
  const { PDFDocument } = await import('pdf-lib')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(bytes)
  const outputs: { name: string; blob: Blob }[] = []
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]
    if (onProgress) onProgress(i, ranges.length)
    const out = await PDFDocument.create()
    const indices = [] as number[]
    for (let p = r.start; p <= r.end; p++) indices.push(p - 1)
    const copied = await out.copyPages(src, indices)
    copied.forEach((p) => out.addPage(p))
    const outBytes = await out.save()
    outputs.push({ name: `${file.name.replace(/\.pdf$/i, '')}-${r.start}-${r.end}.pdf`, blob: new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }) })
  }
  if (onProgress) onProgress(ranges.length, ranges.length)
  return outputs
}

export default function Split() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [rangesText, setRangesText] = useState('')
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [results, setResults] = useState<{ name: string; url: string; size: number }[]>([])

  const thumbsRef = React.useRef<HTMLDivElement | null>(null)
  const renderTasksRef = React.useRef<any[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [parsedRanges, setParsedRanges] = useState<{ start: number; end: number }[]>([])
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [rangeStart, setRangeStart] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      results.forEach(r => URL.revokeObjectURL(r.url))
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [results, previewUrl])

  async function ensurePdfWorkerLocal() {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
      try {
        const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = (w && (w as any).default) || (w as any)
      } catch (err) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.20.377/pdf.worker.min.js'
      }
    } catch (err) {
      // ignore
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement> | File | null) {
    const f = (e && (e as File).name ? e as File : (e as React.ChangeEvent<HTMLInputElement>)?.currentTarget?.files?.[0]) || null
    if (!f) return
    setFile(f)
    try { window.dispatchEvent(new CustomEvent('pdf-upload', { detail: f })) } catch (err) {}
    try { addToast('File loaded') } catch (err) {}
    try {
      setStatus({ loading: true, message: 'Reading PDF...' })
      const { PDFDocument } = await import('pdf-lib')
      const bytes = new Uint8Array(await f.arrayBuffer())
      const pdf = await PDFDocument.load(bytes)
      const pages = pdf.getPageCount ? (pdf.getPageCount() as unknown as number) : (pdf.getPages().length)
      setNumPages(pages)
      setStatus({ loading: false })
      setTimeout(() => generateThumbnails(f, Math.min(pages, 20)), 50)
    } catch (err: any) {
      console.error('Failed to load PDF for split:', err)
      setStatus({ loading: false, message: 'Failed to read PDF' })
    } finally {
      if ((e as React.ChangeEvent<HTMLInputElement>)?.currentTarget) (e as React.ChangeEvent<HTMLInputElement>).currentTarget.value = ''
    }
  }

  async function extractFilesFromZip(zipBlob: Blob): Promise<{ name: string; blob: Blob }[]> {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBlob)
    const filePromises: Promise<{ name: string; blob: Blob }>[] = []
    
    zip.forEach((relativePath, file) => {
      if (!file.dir) {
        filePromises.push(
          file.async('blob').then(blob => ({ name: relativePath, blob }))
        )
      }
    })
    
    const files = await Promise.all(filePromises)
    return files
  }

  async function handleSplit() {
    if (!file) return
    if (!numPages) return
    let ranges
    try {
      ranges = parseRanges(rangesText, numPages)
      if (!ranges.length) { 
        setStatus({ loading: false, message: 'No ranges specified' })
        setRangeError('Please enter at least one valid page range')
        return 
      }
      setRangeError(null)
    } catch (err: any) {
      setStatus({ loading: false, message: err.message || 'Invalid ranges' })
      setRangeError(err.message || 'Invalid ranges')
      return
    }
    setStatus({ loading: true, message: 'Splitting...' })
    
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const rangesStr = ranges.map(r => `${r.start}-${r.end}`).join(',')
      form.append('ranges', rangesStr)

      const res = await fetch('/api/split/ranges', {
        method: 'POST',
        body: form,
      })

      if (res.ok) {
        const zipBlob = await res.blob()
        if (zipBlob && zipBlob.size > 100 && (zipBlob.type === 'application/zip' || zipBlob.type === 'application/octet-stream')) {
          try {
            const extractedFiles = await extractFilesFromZip(zipBlob)
            processSplitResults(extractedFiles, false)
            return
          } catch (zipErr) {
            console.warn('Failed to extract ZIP, falling back to client-side', zipErr)
          }
        }
      } else {
        const txt = await res.text().catch(() => 'Split failed')
        console.warn('Backend split failed, falling back to client-side:', txt)
      }
    } catch (apiErr) {
      console.warn('Backend API call failed, falling back to client-side:', apiErr)
    }

    try {
      const outputs = await splitPdfByRanges(file, ranges, (done, total) => setStatus({ loading: true, message: `Processing ${done}/${total}` }))
      processSplitResults(outputs, true)
    } catch (err: any) {
      console.error('Split failed', err)
      setStatus({ loading: false, message: 'Split failed' })
      try { addToast('Split failed') } catch (e) {}
    }
  }

  async function generateThumbnails(file: File, maxPages = 8) {
    if (!thumbsRef.current) return
    thumbsRef.current.innerHTML = ''
    renderTasksRef.current.forEach(t => { try { t.cancel?.() } catch {} })
    renderTasksRef.current = []
    try {
      await ensurePdfWorkerLocal()
      const pdfjs = (await import('pdfjs-dist/legacy/build/pdf')) as any
      const bytes = new Uint8Array(await file.arrayBuffer())
      const loadingTask = pdfjs.getDocument({ data: bytes })
      const pdf = await loadingTask.promise
      const total = pdf.numPages || 0
      const limit = Math.min(maxPages, total)
      for (let p = 1; p <= limit; p++) {
        const page = await pdf.getPage(p)
        const vp = page.getViewport({ scale: 1 })
        const desiredWidth = 110
        const scale = desiredWidth / vp.width
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        canvas.className = 'page-thumb'
        canvas.setAttribute('data-page', String(p))
        const pageNumber = p
        
        const ctx = canvas.getContext('2d')!

        // Fill canvas with white background for PDF visibility
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const renderTask = page.render({ canvasContext: ctx, viewport })
        renderTasksRef.current.push(renderTask)
        await renderTask.promise
        
        // Initial style update
        applyCanvasSelectedStyle(canvas, selectedPages.has(pageNumber))
        
        canvas.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          
          if (e.shiftKey && rangeStart !== null) {
            // Range selection
            const start = Math.min(rangeStart, pageNumber)
            const end = Math.max(rangeStart, pageNumber)
            const newRanges = Array.from({ length: end - start + 1 }, (_, i) => start + i)
            setSelectedPages(prev => {
              const updated = new Set(prev)
              newRanges.forEach(pg => updated.add(pg))
              setTimeout(() => updateAllCanvasStyles(updated), 0)
              return updated
            })
            setRangeStart(null)
            setTimeout(() => updateRangesFromSelection(), 10)
          } else if (e.ctrlKey || e.metaKey) {
            // Multi-select
            setSelectedPages(prev => {
              const updated = new Set(prev)
              if (updated.has(pageNumber)) {
                updated.delete(pageNumber)
                applyCanvasSelectedStyle(canvas, false)
              } else {
                updated.add(pageNumber)
                applyCanvasSelectedStyle(canvas, true)
              }
              setTimeout(() => updateRangesFromSelection(), 10)
              return updated
            })
          } else {
            // Single click - toggle selection
            setSelectedPages(prev => {
              const updated = new Set(prev)
              if (updated.has(pageNumber) && updated.size === 1) {
                // Deselect if only this one selected
                updated.delete(pageNumber)
                applyCanvasSelectedStyle(canvas, false)
                setRangeStart(null)
              } else {
                // Select this page
                updated.clear()
                updated.add(pageNumber)
                updateAllCanvasStyles(new Set())
                applyCanvasSelectedStyle(canvas, true)
                setRangeStart(pageNumber)
              }
              setTimeout(() => updateRangesFromSelection(), 10)
              return updated
            })
          }
        })
        
        // Double click for preview
        canvas.addEventListener('dblclick', () => {
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          const url = URL.createObjectURL(file)
          setPreviewUrl(url)
          setPreviewOpen(true)
        })
        
        thumbsRef.current.appendChild(canvas)
      }
    } catch (err) {
      console.warn('Thumbnail generation failed', err)
    }
  }

  // Helper function to process split results
  function processSplitResults(outputs: { name: string; blob: Blob }[], isClientSide: boolean) {
    const res = outputs.map(o => ({ 
      name: o.name, 
      url: URL.createObjectURL(o.blob), 
      size: o.blob.size 
    }))
    setResults(res)
    setStatus({ loading: false, message: `Created ${res.length} file(s)` })
    setRangeError(null)
    try { addToast(`Created ${res.length} file(s)${isClientSide ? ' (client-side)' : ''}`) } catch (err) {}
  }

  async function splitToPages() {
    if (!file || !numPages) return
    setStatus({ loading: true, message: 'Splitting to pages...' })
    
    try {
      const form = new FormData()
      form.append('file', file, file.name)

      const res = await fetch('/api/split/pages', {
        method: 'POST',
        body: form,
      })

      if (res.ok) {
        const zipBlob = await res.blob()
        if (zipBlob && zipBlob.size > 100 && (zipBlob.type === 'application/zip' || zipBlob.type === 'application/octet-stream')) {
          try {
            const extractedFiles = await extractFilesFromZip(zipBlob)
            processSplitResults(extractedFiles, false)
            return
          } catch (zipErr) {
            console.warn('Failed to extract ZIP, falling back to client-side', zipErr)
          }
        }
      } else {
        const txt = await res.text().catch(() => 'Split failed')
        console.warn('Backend split failed, falling back to client-side:', txt)
      }
    } catch (apiErr) {
      console.warn('Backend API call failed, falling back to client-side:', apiErr)
    }

    try {
      const ranges = Array.from({ length: numPages }, (_, i) => ({ start: i + 1, end: i + 1 }))
      const outputs = await splitPdfByRanges(file, ranges, (done, total) => setStatus({ loading: true, message: `Processing ${done}/${total}` }))
      processSplitResults(outputs, true)
    } catch (err: any) {
      console.error('Split failed', err)
      setStatus({ loading: false, message: 'Split failed' })
      try { addToast('Split failed') } catch (e) {}
    }
  }

  function downloadResult(r: { name: string; url: string }) {
    const a = document.createElement('a')
    a.href = r.url
    a.download = r.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function clearResults() {
    results.forEach(r => URL.revokeObjectURL(r.url))
    setResults([])
  }

  // Helper function to apply selected style to a canvas
  function applyCanvasSelectedStyle(canvas: HTMLCanvasElement, isSelected: boolean) {
    if (isSelected) {
      canvas.classList.add('selected')
      canvas.style.borderColor = 'var(--accent)'
      canvas.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.3), 0 8px 24px rgba(124,58,237,0.4)'
    } else {
      canvas.classList.remove('selected')
      canvas.style.borderColor = 'transparent'
      canvas.style.boxShadow = ''
    }
  }

  // Helper function to update all canvas styles based on selected pages
  function updateAllCanvasStyles(selectedSet: Set<number>) {
    if (!thumbsRef.current) return
    Array.from(thumbsRef.current.children).forEach((child, idx) => {
      const c = child as HTMLCanvasElement
      const pgNum = idx + 1
      applyCanvasSelectedStyle(c, selectedSet.has(pgNum))
    })
  }

  function updateRangesFromSelection() {
    if (selectedPages.size === 0) {
      setParsedRanges([])
      return
    }
    
    const sorted = Array.from(selectedPages).sort((a, b) => a - b)
    const ranges: { start: number; end: number }[] = []
    let start = sorted[0]
    let end = sorted[0]
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i]
      } else {
        ranges.push({ start, end })
        start = sorted[i]
        end = sorted[i]
      }
    }
    ranges.push({ start, end })
    
    setParsedRanges(ranges)
    setRangesText(ranges.map(r => r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`).join(','))
  }


  function clearSelection() {
    setSelectedPages(new Set())
    setParsedRanges([])
    setRangesText('')
    setRangeStart(null)
    updateAllCanvasStyles(new Set())
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
              <div className="pdf-preview-meta">Previewing file</div>
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
          <h1 className="page-title">Split PDF</h1>
          <p className="page-subtitle">
            Split a large PDF into smaller files or extract specific pages. Choose page ranges or split into individual pages.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('split-upload') as HTMLInputElement | null)?.click()}
            >
              Upload PDF
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { 
              setFile(null); 
              setNumPages(null); 
              clearResults(); 
              setRangesText('');
              setRangeError(null);
              setParsedRanges([]);
              setStatus({ loading: false });
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
            <h3>Upload a PDF to Split</h3>
            <p>Drag and drop your PDF here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('split-upload') as HTMLInputElement | null)?.click()}>
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
                {formatFileSize(file.size)} • {numPages || 0} page{numPages !== 1 ? 's' : ''}
              </div>
            </div>
          </Card>

          <div className="stepper">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-label">Upload</div>
            </div>
            <div className={`step ${parsedRanges.length > 0 || results.length > 0 ? 'active' : ''}`}>
              <div className="step-icon">{parsedRanges.length > 0 || results.length > 0 ? '✓' : '2'}</div>
              <div className="step-label">Select Pages</div>
            </div>
            <div className={`step ${results.length > 0 ? 'done' : ''}`}>
              <div className="step-icon">{results.length > 0 ? '✓' : '3'}</div>
              <div className="step-label">Download</div>
            </div>
          </div>

          <input 
            id="split-upload" 
            className="sr-only" 
            type="file" 
            accept="application/pdf" 
            onChange={onFileChange} 
          />

          <Card className="card-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="merge-helper">
                Specify page ranges to extract, then click Split to download. Each range creates a separate PDF file.
              </div>

              {file && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Page ranges</div>
                    {parsedRanges.length > 0 && (
                      <div className="status-pill" style={{ fontSize: '0.85rem' }}>
                        {parsedRanges.length} range{parsedRanges.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <input 
                    className="text-input" 
                    placeholder="e.g. 1-3,5,8-10" 
                    value={rangesText} 
                    onChange={(e) => {
                      const value = e.target.value
                      setRangesText(value)
                      setRangeError(null)
                      if (value.trim() && numPages) {
                        try {
                          const ranges = parseRanges(value, numPages)
                          setParsedRanges(ranges)
                          // Update visual selection
                          const newSelected = new Set<number>()
                          ranges.forEach(r => {
                            for (let pg = r.start; pg <= r.end; pg++) {
                              newSelected.add(pg)
                            }
                          })
                          setSelectedPages(newSelected)
                          setTimeout(() => updateAllCanvasStyles(newSelected), 0)
                        } catch (err: any) {
                          setRangeError(err.message)
                          setParsedRanges([])
                          setSelectedPages(new Set())
                          updateAllCanvasStyles(new Set())
                        }
                      } else {
                        setParsedRanges([])
                        setSelectedPages(new Set())
                        updateAllCanvasStyles(new Set())
                      }
                    }} 
                    style={{ width: '100%' }}
                    disabled={!file || status.loading}
                  />
                  {rangeError && (
                    <div className="status-message error" style={{ marginTop: 8 }}>
                      <span>⚠️</span> {rangeError}
                    </div>
                  )}
                  {!rangeError && parsedRanges.length > 0 && (
                    <div className="card-lift" style={{ 
                      marginTop: 10, 
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(6, 182, 212, 0.08))',
                      borderRadius: '12px',
                      border: '1px solid rgba(22, 163, 74, 0.25)',
                      fontSize: '0.85rem',
                      color: 'var(--success)',
                      fontWeight: 700,
                      boxShadow: '0 4px 16px rgba(22, 163, 74, 0.15)',
                      animation: 'slideIn 0.3s var(--ease)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: '1.3rem', animation: 'badgeFloat 3s ease infinite' }}>✨</span>
                        <span style={{ fontSize: '0.95rem' }}>Will create <strong>{parsedRanges.length}</strong> file{parsedRanges.length > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {parsedRanges.map((r, i) => (
                          <span 
                            key={i} 
                            className="animated-badge"
                            style={{ 
                              padding: '6px 12px',
                              background: 'rgba(22, 163, 74, 0.2)',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              border: '1px solid rgba(22, 163, 74, 0.4)',
                              color: 'var(--success)'
                            }}
                          >
                            {r.start === r.end ? `Page ${r.start}` : `Pages ${r.start}-${r.end}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!rangeError && !parsedRanges.length && rangesText && (
                    <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--muted)', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      💡 <strong>Tip:</strong> Enter page ranges separated by commas. Examples: <code style={{ fontSize: '0.85em', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'Monaco, monospace' }}>1-5</code>, <code style={{ fontSize: '0.85em', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'Monaco, monospace' }}>3,7,9</code>, <code style={{ fontSize: '0.85em', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'Monaco, monospace' }}>1-3,5,8-10</code>
                      <br />
                      <span style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px', display: 'block' }}>
                        Or click thumbnails below to select pages visually!
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button 
                      variant="primary" 
                      onClick={(e) => { e.preventDefault(); handleSplit() }} 
                      disabled={!file || !rangesText || status.loading || parsedRanges.length === 0}
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
                          Processing…
                        </>
                      ) : (
                        <>
                          ✂️ Split into {parsedRanges.length || 0} file{parsedRanges.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={(e) => { e.preventDefault(); splitToPages() }} 
                      disabled={!file || status.loading}
                      style={{ fontWeight: 600 }}
                    >
                      📄 Split to single pages
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        setRangesText(''); 
                        setRangeError(null); 
                        setParsedRanges([]);
                        clearSelection();
                      }}
                      disabled={!rangesText && selectedPages.size === 0}
                      style={{ fontWeight: 600 }}
                    >
                      🗑️ Clear
                    </Button>
                    {selectedPages.size > 0 && (
                      <div style={{ 
                        marginLeft: 'auto',
                        fontSize: '0.8rem',
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span>💡</span>
                        <span>Click thumbnails to select • Shift+Click for range • Ctrl+Click to toggle</span>
                      </div>
                    )}
                  </div>
                  {status.message && (
                    <div className={`status-message ${status.loading ? 'loading' : results.length > 0 ? 'success' : ''}`}>
                      {status.loading && (
                        <>
                          <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                          {status.message.includes('/') && (() => {
                            const match = status.message.match(/(\d+)\/(\d+)/)
                            if (match) {
                              const current = parseInt(match[1])
                              const total = parseInt(match[2])
                              const percentage = total > 0 ? (current / total) * 100 : 0
                              return (
                                <div className="progress-bar-container" style={{ marginTop: 10 }}>
                                  <div className="progress-bar" style={{ width: `${percentage}%` }} />
                                </div>
                              )
                            }
                            return null
                          })()}
                        </>
                      )}
                      {results.length > 0 && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
                      <span>{status.message}</span>
                    </div>
                  )}
                </div>
              )}

              {file && numPages && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div className="muted glow-effect" style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.3rem' }}>📄</span> 
                      <span>Page preview</span>
                      {selectedPages.size > 0 && (
                        <span className="animated-badge" style={{ 
                          padding: '4px 10px',
                          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(6, 182, 212, 0.2))',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--accent)',
                          border: '1px solid rgba(124, 58, 237, 0.3)'
                        }}>
                          {selectedPages.size} selected
                        </span>
                      )}
                    </div>
                    <div className="status-pill" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                      Showing {Math.min(numPages, 20)} of {numPages} pages
                    </div>
                  </div>
                  <div className="page-thumbs" ref={thumbsRef} />
                  <div className="card-lift" style={{ 
                    marginTop: 14, 
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.85rem',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>💡</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Quick selection tips:</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.9, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <span>• <strong>Click</strong> to select</span>
                        <span>• <strong>Ctrl/Cmd+Click</strong> to toggle</span>
                        <span>• <strong>Shift+Click</strong> for range</span>
                        <span>• <strong>Double-click</strong> to preview</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="results-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--text), rgba(231, 238, 248, 0.8))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      Split Results
                    </h4>
                    <div className="status-pill" style={{ fontSize: '0.85rem' }}>
                      {results.length} file{results.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {results.map((r) => (
                      <div 
                        key={r.url} 
                        className="result-item"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                            {r.name}
                          </div>
                          <div className="muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>📄 {(r.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn small primary" onClick={() => downloadResult(r)} style={{ fontWeight: 600 }}>Download</button>
                          <button className="btn small ghost" onClick={() => { URL.revokeObjectURL(r.url); setResults(prev => prev.filter(x => x.url !== r.url)) }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="primary" onClick={() => { results.forEach(r => downloadResult(r)) }} style={{ fontWeight: 600 }}>
                        ⬇️ Download all ({results.length})
                      </Button>
                      <Button variant="ghost" onClick={() => clearResults()}>Clear all</Button>
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
          <h3>How Splitting Works</h3>
          <ul className="feature-list">
            <li><strong>Single pages:</strong> Enter <code>3,5,7</code> to extract pages 3, 5, and 7</li>
            <li><strong>Ranges:</strong> Enter <code>1-5</code> to extract pages 1 through 5</li>
            <li><strong>Mixed:</strong> Enter <code>1-3,5,8-10</code> to combine ranges and single pages</li>
            <li><strong>Quick split:</strong> Use "Split to single pages" to create one PDF per page</li>
            <li><strong>Privacy:</strong> All processing happens in your browser — files never leave your device</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
