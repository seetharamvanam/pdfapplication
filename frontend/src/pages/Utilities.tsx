/**
 * Utilities Page
 * Headers/footers, page numbering, bates numbering, compare PDFs
 */

import React, { useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { validateFile, downloadBlob, loadPdfDocument } from '../utils/pdfUtils'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export default function Utilities() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [utility, setUtility] = useState<'headers' | 'numbering' | 'bates' | 'compare'>('headers')
  const [resultFile, setResultFile] = useState<{ url: string; name: string; size: number } | null>(null)
  
  // Headers/Footers
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  
  // Page Numbering
  const [pageNumberFormat, setPageNumberFormat] = useState<'1' | '1/10' | 'Page 1'>('1')
  const [startNumber, setStartNumber] = useState(1)
  
  // Bates Numbering
  const [batesPrefix, setBatesPrefix] = useState('')
  const [batesStartNumber, setBatesStartNumber] = useState(1)
  
  // Compare
  const [file2, setFile2] = useState<File | null>(null)

  async function handleUtility() {
    if (!file) return

    try {
      setStatus({ loading: true, message: 'Processing...' })

      let blob: Blob
      let filename: string

      if (utility === 'headers') {
        const { doc } = await loadPdfDocument(file)
        const font = await doc.embedFont(StandardFonts.Helvetica)
        const pages = doc.getPages()

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const { width, height } = page.getSize()

          if (headerText) {
            page.drawText(headerText, {
              x: 50,
              y: height - 30,
              size: 10,
              font: font,
              color: rgb(0, 0, 0),
            })
          }

          if (footerText) {
            page.drawText(footerText, {
              x: 50,
              y: 30,
              size: 10,
              font: font,
              color: rgb(0, 0, 0),
            })
          }
        }

        const pdfBytes = await doc.save()
        blob = new Blob([pdfBytes], { type: 'application/pdf' })
        filename = file.name.replace(/\.pdf$/i, '') + '_headers.pdf'
      } else if (utility === 'numbering') {
        const { doc } = await loadPdfDocument(file)
        const font = await doc.embedFont(StandardFonts.Helvetica)
        const pages = doc.getPages()

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const { width, height } = page.getSize()
          const pageNumber = startNumber + i

          let text = ''
          if (pageNumberFormat === '1') {
            text = `${pageNumber}`
          } else if (pageNumberFormat === '1/10') {
            text = `${pageNumber}/${pages.length}`
          } else {
            text = `Page ${pageNumber}`
          }

          page.drawText(text, {
            x: width / 2 - 20,
            y: 30,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          })
        }

        const pdfBytes = await doc.save()
        blob = new Blob([pdfBytes], { type: 'application/pdf' })
        filename = file.name.replace(/\.pdf$/i, '') + '_numbered.pdf'
      } else if (utility === 'bates') {
        const { doc } = await loadPdfDocument(file)
        const font = await doc.embedFont(StandardFonts.Helvetica)
        const pages = doc.getPages()

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const { width } = page.getSize()
          const batesNumber = batesStartNumber + i
          const text = batesPrefix ? `${batesPrefix}-${batesNumber}` : `${batesNumber}`

          page.drawText(text, {
            x: width - 100,
            y: 30,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          })
        }

        const pdfBytes = await doc.save()
        blob = new Blob([pdfBytes], { type: 'application/pdf' })
        filename = file.name.replace(/\.pdf$/i, '') + '_bates.pdf'
      } else {
        throw new Error('Comparison feature requires advanced implementation')
      }

      const url = URL.createObjectURL(blob)
      setResultFile({ url, name: filename, size: blob.size })
      setStatus({ loading: false, message: 'Processing completed!' })
      addToast('Processing completed!')
    } catch (error: any) {
      setStatus({ loading: false, message: error?.message || 'Processing failed' })
      addToast(error?.message || 'Processing failed')
    }
  }

  function downloadResult() {
    if (!resultFile) return
    try {
      downloadBlob(new Blob([], { type: 'application/pdf' }), resultFile.name)
      fetch(resultFile.url).then(res => res.blob()).then(blob => {
        downloadBlob(blob, resultFile.name)
      }).catch(() => {
        const a = document.createElement('a')
        a.href = resultFile.url
        a.download = resultFile.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      const a = document.createElement('a')
      a.href = resultFile.url
      a.download = resultFile.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">PDF Utilities</h1>
          <p className="page-subtitle">
            Add headers/footers, page numbering, bates numbering, and compare PDFs.
          </p>
        </div>
      </div>

      {/* Utility Selection */}
      <Card className="card-padding">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {(['headers', 'numbering', 'bates', 'compare'] as const).map((u) => (
            <Button
              key={u}
              variant={utility === u ? 'primary' : 'ghost'}
              onClick={() => {
                setUtility(u)
                setResultFile(null)
                setStatus({ loading: false })
              }}
              style={{ textTransform: 'capitalize' }}
            >
              {u === 'headers' && '📄 Headers'}
              {u === 'numbering' && '🔢 Numbering'}
              {u === 'bates' && '🏷️ Bates'}
              {u === 'compare' && '🔍 Compare'}
            </Button>
          ))}
        </div>
      </Card>

      {utility !== 'compare' && (
        <>
          {!file ? (
            <Card className="upload-zone">
              <div className="upload-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <h3>Upload a PDF</h3>
                <Button variant="secondary" onClick={() => (document.getElementById('utilities-upload') as HTMLInputElement | null)?.click()}>
                  Select File
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="card-padding">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <strong>{file.name}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                {utility === 'headers' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Header Text</label>
                      <input
                        type="text"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        placeholder="Enter header text..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Footer Text</label>
                      <input
                        type="text"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        placeholder="Enter footer text..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                  </>
                )}

                {utility === 'numbering' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Format</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['1', '1/10', 'Page 1'] as const).map((format) => (
                          <button
                            key={format}
                            className={`btn ${pageNumberFormat === format ? 'primary' : 'ghost'}`}
                            onClick={() => setPageNumberFormat(format)}
                          >
                            {format}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Start Number</label>
                      <input
                        type="number"
                        min="1"
                        value={startNumber}
                        onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '100%', maxWidth: '200px', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                  </>
                )}

                {utility === 'bates' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Prefix (Optional)</label>
                      <input
                        type="text"
                        value={batesPrefix}
                        onChange={(e) => setBatesPrefix(e.target.value)}
                        placeholder="e.g., DOC, CASE"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Start Number</label>
                      <input
                        type="number"
                        min="1"
                        value={batesStartNumber}
                        onChange={(e) => setBatesStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '100%', maxWidth: '200px', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                  </>
                )}

                <Button variant="primary" onClick={handleUtility} disabled={status.loading} style={{ marginTop: 8 }}>
                  {status.loading ? 'Processing...' : '✨ Apply'}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {utility === 'compare' && (
        <Card className="card-padding">
          <div className="card-lift" style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.08))',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            fontSize: '0.85rem',
            color: 'var(--muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <span>PDF comparison requires advanced diff algorithms and visual rendering. This feature would show side-by-side differences between two PDFs.</span>
            </div>
          </div>
        </Card>
      )}

      {resultFile && (
        <Card className="card-padding">
          <div className="results-card">
            <h4 style={{ marginBottom: 14 }}>Processing Complete</h4>
            <Button variant="primary" onClick={downloadResult} style={{ fontWeight: 600 }}>
              ⬇️ Download PDF
            </Button>
          </div>
        </Card>
      )}

      <input
        id="utilities-upload"
        className="sr-only"
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            const validation = validateFile(f)
            if (validation.valid) {
              setFile(f)
              setResultFile(null)
            } else {
              addToast(validation.error || 'Invalid file')
            }
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}
