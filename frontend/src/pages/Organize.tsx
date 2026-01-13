/**
 * Organize PDF Pages
 * Reorder, insert, delete, extract, and rotate pages
 */

import React, { useState, useEffect } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { 
  loadPdfJsDocument, 
  validateFile, 
  downloadBlob,
  reorderPages,
  deletePages,
  rotatePages,
  extractPages,
  insertPages
} from '../utils/pdfUtils'

export default function Organize() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [organizedFile, setOrganizedFile] = useState<{ url: string; name: string; size: number } | null>(null)
  const [operation, setOperation] = useState<'reorder' | 'delete' | 'rotate' | 'extract' | 'insert'>('reorder')
  
  // Reorder state
  const [pageOrder, setPageOrder] = useState<number[]>([])
  
  // Delete state
  const [pagesToDelete, setPagesToDelete] = useState<Set<number>>(new Set())
  
  // Rotate state
  const [pagesToRotate, setPagesToRotate] = useState<Set<number>>(new Set())
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90)
  
  // Extract state
  const [pagesToExtract, setPagesToExtract] = useState<Set<number>>(new Set())
  
  // Insert state
  const [fileToInsert, setFileToInsert] = useState<File | null>(null)
  const [insertAfterPage, setInsertAfterPage] = useState<number>(1)

  useEffect(() => {
    return () => {
      if (organizedFile) URL.revokeObjectURL(organizedFile.url)
    }
  }, [organizedFile])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement> | File | null) {
    const f = (e && (e as File).name ? e as File : (e as React.ChangeEvent<HTMLInputElement>)?.currentTarget?.files?.[0]) || null
    if (!f) return
    
    const validation = validateFile(f)
    if (!validation.valid) {
      addToast(validation.error || 'Invalid file')
      return
    }
    
    setFile(f)
    setOrganizedFile(null)
    setStatus({ loading: false })
    
    try {
      const pdfDoc = await loadPdfJsDocument(f)
      const totalPages = pdfDoc.numPages
      setNumPages(totalPages)
      
      // Initialize page order
      setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1))
      
      // Reset states
      setPagesToDelete(new Set())
      setPagesToRotate(new Set())
      setPagesToExtract(new Set())
      setFileToInsert(null)
      setInsertAfterPage(1)
      
      addToast(`PDF loaded: ${totalPages} pages`)
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to load PDF'
      addToast(errorMsg)
      setNumPages(null)
    }
    
    if ((e as React.ChangeEvent<HTMLInputElement>)?.currentTarget) {
      (e as React.ChangeEvent<HTMLInputElement>).currentTarget.value = ''
    }
  }

  async function handleOrganize() {
    if (!file || !numPages) return

    try {
      setStatus({ loading: true, message: 'Processing...' })

      let blob: Blob
      let filename: string

      if (operation === 'reorder') {
        if (pageOrder.length !== numPages) {
          throw new Error('Page order must contain all pages')
        }
        blob = await reorderPages(file, pageOrder)
        filename = file.name.replace(/\.pdf$/i, '') + '_reordered.pdf'
      } else if (operation === 'delete') {
        if (pagesToDelete.size === 0) {
          throw new Error('Please select at least one page to delete')
        }
        if (pagesToDelete.size >= numPages) {
          throw new Error('Cannot delete all pages')
        }
        blob = await deletePages(file, Array.from(pagesToDelete))
        filename = file.name.replace(/\.pdf$/i, '') + '_deleted.pdf'
      } else if (operation === 'rotate') {
        if (pagesToRotate.size === 0) {
          throw new Error('Please select at least one page to rotate')
        }
        blob = await rotatePages(file, Array.from(pagesToRotate), rotateAngle)
        filename = file.name.replace(/\.pdf$/i, '') + '_rotated.pdf'
      } else if (operation === 'extract') {
        if (pagesToExtract.size === 0) {
          throw new Error('Please select at least one page to extract')
        }
        blob = await extractPages(file, Array.from(pagesToExtract))
        filename = file.name.replace(/\.pdf$/i, '') + '_extracted.pdf'
      } else if (operation === 'insert') {
        if (!fileToInsert) {
          throw new Error('Please select a PDF file to insert')
        }
        blob = await insertPages(file, fileToInsert, insertAfterPage)
        filename = file.name.replace(/\.pdf$/i, '') + '_inserted.pdf'
      } else {
        throw new Error('Invalid operation')
      }

      if (!blob || blob.size < 10) {
        throw new Error('Processing produced invalid result')
      }

      const url = URL.createObjectURL(blob)
      setOrganizedFile({ url, name: filename, size: blob.size })
      setStatus({ loading: false, message: 'PDF organized successfully!' })
      addToast('PDF organized successfully!')
    } catch (error: any) {
      console.error('Organize failed', error)
      const errorMsg = error?.message || 'Failed to organize PDF'
      setStatus({ loading: false, message: errorMsg })
      addToast(errorMsg)
    }
  }

  function togglePageSelection(pageNum: number, set: Set<number>, setter: (set: Set<number>) => void) {
    const newSet = new Set(set)
    if (newSet.has(pageNum)) {
      newSet.delete(pageNum)
    } else {
      newSet.add(pageNum)
    }
    setter(newSet)
  }

  function movePageUp(index: number) {
    if (index === 0) return
    const newOrder = [...pageOrder]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setPageOrder(newOrder)
  }

  function movePageDown(index: number) {
    if (index === pageOrder.length - 1) return
    const newOrder = [...pageOrder]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setPageOrder(newOrder)
  }

  function downloadOrganized() {
    if (!organizedFile) return
    try {
      downloadBlob(new Blob([], { type: 'application/pdf' }), organizedFile.name)
      fetch(organizedFile.url).then(res => res.blob()).then(blob => {
        downloadBlob(blob, organizedFile.name)
      }).catch(() => {
        const a = document.createElement('a')
        a.href = organizedFile.url
        a.download = organizedFile.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      const a = document.createElement('a')
      a.href = organizedFile.url
      a.download = organizedFile.name
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Organize PDF Pages</h1>
          <p className="page-subtitle">
            Reorder, insert, delete, extract, or rotate pages in your PDF.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('organize-upload') as HTMLInputElement | null)?.click()}
            >
              Upload PDF
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { 
              setFile(null)
              setNumPages(null)
              setOrganizedFile(null)
              setStatus({ loading: false })
            }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Operation Selection */}
      {file && (
        <Card className="card-padding">
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-secondary)', padding: 6, borderRadius: '12px', flexWrap: 'wrap' }}>
            {(['reorder', 'delete', 'rotate', 'extract', 'insert'] as const).map((op) => (
              <Button
                key={op}
                variant={operation === op ? 'primary' : 'ghost'}
                onClick={() => {
                  setOperation(op)
                  setOrganizedFile(null)
                  setStatus({ loading: false })
                }}
                style={{ flex: '1 1 auto', minWidth: '100px', textTransform: 'capitalize' }}
              >
                {op === 'reorder' && '🔄 Reorder'}
                {op === 'delete' && '🗑️ Delete'}
                {op === 'rotate' && '↻ Rotate'}
                {op === 'extract' && '📤 Extract'}
                {op === 'insert' && '➕ Insert'}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {!file ? (
        <Card className="upload-zone">
          <div className="upload-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Upload a PDF to Organize</h3>
            <p>Drag and drop a PDF file here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('organize-upload') as HTMLInputElement | null)?.click()}>
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
                {formatFileSize(file.size)} • {numPages} {numPages === 1 ? 'page' : 'pages'}
              </div>
            </div>

            {/* Operation-specific UI */}
            {operation === 'reorder' && numPages && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <label style={{ fontWeight: 600 }}>Page Order (drag to reorder)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '400px', overflowY: 'auto' }}>
                  {pageOrder.map((pageNum, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600, minWidth: '60px' }}>Page {pageNum}</div>
                      <div style={{ flex: 1 }} />
                      <Button variant="ghost" onClick={() => movePageUp(index)} disabled={index === 0}>
                        ↑
                      </Button>
                      <Button variant="ghost" onClick={() => movePageDown(index)} disabled={index === pageOrder.length - 1}>
                        ↓
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {operation === 'delete' && numPages && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <label style={{ fontWeight: 600 }}>Select Pages to Delete ({pagesToDelete.size} selected)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`btn ${pagesToDelete.has(pageNum) ? 'primary' : 'ghost'}`}
                      onClick={() => togglePageSelection(pageNum, pagesToDelete, setPagesToDelete)}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {operation === 'rotate' && numPages && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Rotation Angle</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([90, 180, 270] as const).map((angle) => (
                      <button
                        key={angle}
                        className={`btn ${rotateAngle === angle ? 'primary' : 'ghost'}`}
                        onClick={() => setRotateAngle(angle)}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 600 }}>Select Pages to Rotate ({pagesToRotate.size} selected)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginTop: 8 }}>
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`btn ${pagesToRotate.has(pageNum) ? 'primary' : 'ghost'}`}
                        onClick={() => togglePageSelection(pageNum, pagesToRotate, setPagesToRotate)}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {operation === 'extract' && numPages && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <label style={{ fontWeight: 600 }}>Select Pages to Extract ({pagesToExtract.size} selected)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`btn ${pagesToExtract.has(pageNum) ? 'primary' : 'ghost'}`}
                      onClick={() => togglePageSelection(pageNum, pagesToExtract, setPagesToExtract)}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {operation === 'insert' && numPages && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <input
                    id="insert-file-upload"
                    className="sr-only"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        const validation = validateFile(f)
                        if (validation.valid) {
                          setFileToInsert(f)
                        } else {
                          addToast(validation.error || 'Invalid file')
                        }
                      }
                      e.target.value = ''
                    }}
                  />
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>PDF File to Insert</label>
                  {fileToInsert ? (
                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600 }}>{fileToInsert.name}</div>
                      <Button variant="ghost" onClick={() => setFileToInsert(null)} style={{ marginTop: 8 }}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => document.getElementById('insert-file-upload')?.click()}>
                      📁 Select PDF to Insert
                    </Button>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Insert After Page</label>
                  <input
                    type="number"
                    min="0"
                    max={numPages}
                    value={insertAfterPage}
                    onChange={(e) => setInsertAfterPage(Math.max(0, Math.min(numPages, parseInt(e.target.value) || 0)))}
                    style={{ width: '100%', maxWidth: '200px', padding: '8px 12px', borderRadius: 8 }}
                  />
                  <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    Enter 0 to insert at the beginning
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                onClick={handleOrganize}
                disabled={status.loading || (operation === 'reorder' && pageOrder.length !== numPages) || 
                         (operation === 'delete' && pagesToDelete.size === 0) ||
                         (operation === 'rotate' && pagesToRotate.size === 0) ||
                         (operation === 'extract' && pagesToExtract.size === 0) ||
                         (operation === 'insert' && !fileToInsert)}
                style={{ fontWeight: 700 }}
              >
                {status.loading ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⚙️</span>
                    Processing...
                  </>
                ) : (
                  <>✨ Organize PDF</>
                )}
              </Button>
            </div>

            {status.message && (
              <div className={`status-message ${status.loading ? 'loading' : organizedFile ? 'success' : ''}`} style={{ marginTop: 12 }}>
                {status.loading && (
                  <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                )}
                {organizedFile && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
                <span>{status.message}</span>
              </div>
            )}
          </Card>

          <input
            id="organize-upload"
            className="sr-only"
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
          />

          {organizedFile && (
            <Card className="card-padding">
              <div className="results-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>PDF Organized</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Filename</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {organizedFile.name}
                      </div>
                    </div>
                    <div style={{ marginLeft: 16 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Size</div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--success)' }}>{formatFileSize(organizedFile.size)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="primary" onClick={downloadOrganized} style={{ fontWeight: 600 }}>
                      ⬇️ Download PDF
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
