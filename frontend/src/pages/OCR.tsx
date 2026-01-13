/**
 * OCR (Optical Character Recognition) Page
 * Convert scanned PDFs or images to editable/searchable text
 */

import React, { useState, useEffect, useRef } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { validateFile, ensurePdfWorker } from '../utils/pdfUtils'
import { convertPdfToImages } from '../utils/pdfConvert'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'

export default function OCR() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ loading: boolean; message?: string; progress?: number }>({ loading: false })
  const [extractedText, setExtractedText] = useState<string>('')
  const [language, setLanguage] = useState('eng')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tesseractWorker, setTesseractWorker] = useState<any>(null)

  useEffect(() => {
    return () => {
      if (tesseractWorker) {
        try {
          tesseractWorker.terminate()
        } catch (e) {
          // Ignore termination errors
        }
      }
    }
  }, [tesseractWorker])

  // Initialize Tesseract.js
  useEffect(() => {
    let cancelled = false
    
    async function initTesseract() {
      try {
        setStatus({ loading: true, message: 'Loading OCR engine...' })
        
        // Dynamic import of Tesseract.js
        const { createWorker } = await import('tesseract.js')
        if (cancelled) return
        
        const worker = await createWorker(language, 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              const progress = Math.round(m.progress * 100)
              setStatus({ loading: true, message: `Recognizing text... ${progress}%`, progress })
            }
          }
        })
        
        if (cancelled) {
          worker.terminate()
          return
        }
        
        setTesseractWorker(worker)
        setStatus({ loading: false })
      } catch (error: any) {
        if (!cancelled) {
          console.error('Failed to initialize Tesseract', error)
          setStatus({ loading: false, message: `Failed to load OCR engine: ${error.message || String(error)}` })
          addToast('Failed to load OCR engine')
        }
      }
    }
    
    initTesseract()
    
    return () => {
      cancelled = true
    }
  }, [language, addToast])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement> | File | null) {
    const f = (e && (e as File).name ? e as File : (e as React.ChangeEvent<HTMLInputElement>)?.currentTarget?.files?.[0]) || null
    if (!f) return
    
    const validation = validateFile(f, 50 * 1024 * 1024) // 50MB limit for OCR
    if (!validation.valid) {
      addToast(validation.error || 'Invalid file')
      return
    }
    
    setFile(f)
    setExtractedText('')
    setStatus({ loading: false })
    
    if ((e as React.ChangeEvent<HTMLInputElement>)?.currentTarget) {
      (e as React.ChangeEvent<HTMLInputElement>).currentTarget.value = ''
    }
  }

  async function performOCR() {
    if (!file || !tesseractWorker) {
      addToast('Please select a file and wait for OCR engine to load')
      return
    }

    try {
      setStatus({ loading: true, message: 'Processing...', progress: 0 })
      setExtractedText('')

      let images: Blob[] = []

      // Check if file is PDF or image
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Convert PDF pages to images
        setStatus({ loading: true, message: 'Converting PDF to images...' })
        await ensurePdfWorker()
        
        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdfDoc = await loadingTask.promise
        const numPages = pdfDoc.numPages

        // Limit to 10 pages for performance
        if (numPages > 10) {
          addToast(`PDF has ${numPages} pages. Processing first 10 pages only for performance.`)
        }

        const pagesToProcess = Math.min(numPages, 10)
        const scale = 2 // Higher scale for better OCR accuracy

        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          setStatus({ loading: true, message: `Converting page ${pageNum}/${pagesToProcess}...` })
          
          const page = await pdfDoc.getPage(pageNum)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Could not get canvas context')

          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise

          const imageBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to convert canvas to blob'))
              },
              'image/png'
            )
          })

          images.push(imageBlob)
        }
      } else if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) {
        // Use image directly
        images = [file]
      } else {
        throw new Error('Unsupported file type. Please use PDF or image files.')
      }

      if (images.length === 0) {
        throw new Error('No images to process')
      }

      // Perform OCR on each image
      let allText = ''
      
      for (let i = 0; i < images.length; i++) {
        setStatus({ 
          loading: true, 
          message: images.length > 1 ? `Processing image ${i + 1}/${images.length}...` : 'Recognizing text...',
          progress: 0
        })

        const imageBlob = images[i]
        
        // Convert blob to image data
        const imageUrl = URL.createObjectURL(imageBlob)
        const img = new Image()
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })

        // Perform OCR
        const { data: { text } } = await tesseractWorker.recognize(img)
        
        URL.revokeObjectURL(imageUrl)

        if (text && text.trim()) {
          if (images.length > 1) {
            allText += `\n\n--- Page ${i + 1} ---\n\n${text}`
          } else {
            allText += text
          }
        }
      }

      setExtractedText(allText.trim())
      setStatus({ loading: false, message: `OCR completed! Extracted ${allText.length} characters.` })
      addToast('OCR completed successfully!')
    } catch (error: any) {
      console.error('OCR failed', error)
      const errorMsg = error?.message || 'OCR failed'
      setStatus({ loading: false, message: errorMsg })
      addToast(errorMsg)
    }
  }

  function copyText() {
    if (!extractedText) return
    navigator.clipboard.writeText(extractedText).then(() => {
      addToast('Text copied to clipboard')
    }).catch(() => {
      addToast('Failed to copy text')
    })
  }

  function downloadText() {
    if (!extractedText) return
    const blob = new Blob([extractedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file?.name ? file.name.replace(/\.[^.]+$/, '') + '_ocr.txt' : 'extracted_text.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isProcessing = status.loading && file !== null

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">OCR - Scan to Text</h1>
          <p className="page-subtitle">
            Convert scanned PDFs or images to editable, searchable text using optical character recognition.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('ocr-upload') as HTMLInputElement | null)?.click()}
            >
              Upload File
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { setFile(null); setExtractedText(''); setStatus({ loading: false }) }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Language Selection */}
      <Card className="card-padding">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>OCR Language</label>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              if (tesseractWorker) {
                tesseractWorker.terminate()
                setTesseractWorker(null)
              }
            }}
            disabled={status.loading}
            style={{ width: '100%', maxWidth: '300px', padding: '8px 12px', borderRadius: 8 }}
          >
            <option value="eng">English</option>
            <option value="spa">Spanish</option>
            <option value="fra">French</option>
            <option value="deu">German</option>
            <option value="ita">Italian</option>
            <option value="por">Portuguese</option>
            <option value="chi_sim">Chinese (Simplified)</option>
            <option value="jpn">Japanese</option>
            <option value="kor">Korean</option>
            <option value="ara">Arabic</option>
            <option value="rus">Russian</option>
          </select>
          <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
            Note: Changing language will reload the OCR engine.
          </div>
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
            <h3>Upload PDF or Image for OCR</h3>
            <p>Drag and drop a PDF or image file here, or click to browse</p>
            <Button variant="secondary" onClick={() => (document.getElementById('ocr-upload') as HTMLInputElement | null)?.click()}>
              Select File
            </Button>
            <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              Supported: PDF, PNG, JPG, JPEG, GIF, WEBP, BMP<br />
              Maximum file size: 50MB
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card className="card-padding">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <strong>{file.name}</strong>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
              </div>
            </div>

            {!tesseractWorker && (
              <div className="card-lift" style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(251, 146, 60, 0.08))',
                borderRadius: '12px',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                fontSize: '0.85rem',
                color: 'var(--muted)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>⏳</span>
                  <span>Loading OCR engine... Please wait.</span>
                </div>
              </div>
            )}

            {tesseractWorker && !extractedText && (
              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
                <Button
                  variant="primary"
                  onClick={performOCR}
                  disabled={!tesseractWorker || isProcessing}
                  style={{ fontWeight: 700 }}
                >
                  {isProcessing ? (
                    <>
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⚙️</span>
                      Processing...
                    </>
                  ) : (
                    <>🔍 Perform OCR</>
                  )}
                </Button>
              </div>
            )}
          </Card>

          <input
            id="ocr-upload"
            className="sr-only"
            type="file"
            accept="application/pdf,image/*"
            onChange={onFileChange}
          />

          {status.message && (
            <Card className="card-padding">
              <div className={`status-message ${status.loading ? 'loading' : extractedText ? 'success' : ''}`}>
                {status.loading && (
                  <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                )}
                {extractedText && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
                <span>{status.message}</span>
                {status.progress !== undefined && (
                  <div style={{ marginTop: 8, width: '100%', height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${status.progress}%`,
                        height: '100%',
                        background: 'var(--color-primary-600)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          {extractedText && (
            <Card className="card-padding">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Extracted Text</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" onClick={copyText} style={{ fontSize: '0.9rem' }}>
                    📋 Copy
                  </Button>
                  <Button variant="ghost" onClick={downloadText} style={{ fontSize: '0.9rem' }}>
                    ⬇️ Download
                  </Button>
                </div>
              </div>
              <textarea
                value={extractedText}
                readOnly
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '12px',
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  resize: 'vertical',
                }}
              />
              <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                {extractedText.length} characters extracted
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="page-info-section">
        <Card>
          <h3>How OCR Works</h3>
          <ul className="feature-list">
            <li><strong>Supported Formats:</strong> PDF documents and image files (PNG, JPG, GIF, WEBP, BMP)</li>
            <li><strong>Multiple Languages:</strong> Supports 10+ languages including English, Spanish, Chinese, Japanese, and more</li>
            <li><strong>PDF Processing:</strong> Automatically converts PDF pages to images before OCR recognition</li>
            <li><strong>Performance:</strong> Processing time depends on file size and complexity. Large PDFs may take several minutes.</li>
            <li><strong>Limitations:</strong> OCR accuracy depends on image quality. Poor quality scans may produce less accurate results.</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
