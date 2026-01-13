/**
 * Create PDF Page
 * Create PDFs from scratch, files, clipboard, or URLs
 */

import React, { useState, useEffect } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { createBlankPdf, createPdfFromText, validateFile, downloadBlob } from '../utils/pdfUtils'
import { convertImagesToPdf, convertTextToPdf, convertHtmlToPdf } from '../utils/pdfConvert'
import JSZip from 'jszip'

type CreateMode = 'blank' | 'text' | 'files' | 'clipboard' | 'url'

export default function Create() {
  const { addToast } = useToast()
  const [mode, setMode] = useState<CreateMode>('blank')
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [createdFile, setCreatedFile] = useState<{ url: string; name: string; size: number } | null>(null)
  
  // Blank PDF settings
  const [pageSize, setPageSize] = useState<'letter' | 'a4' | 'custom'>('letter')
  const [customWidth, setCustomWidth] = useState(612)
  const [customHeight, setCustomHeight] = useState(792)
  const [pageCount, setPageCount] = useState(1)
  
  // Text PDF settings
  const [textContent, setTextContent] = useState('')
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState<'Helvetica' | 'TimesRoman' | 'Courier'>('Helvetica')
  
  // Files
  const [files, setFiles] = useState<File[]>([])
  
  // URL
  const [url, setUrl] = useState('')
  
  // Clipboard
  const [clipboardContent, setClipboardContent] = useState('')

  useEffect(() => {
    return () => {
      if (createdFile) URL.revokeObjectURL(createdFile.url)
    }
  }, [createdFile])

  useEffect(() => {
    // Load clipboard content
    if (mode === 'clipboard' && navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        if (text) setClipboardContent(text)
      }).catch(() => {
        // Clipboard access denied or not available
      })
    }
  }, [mode])

  const pageSizes: Record<string, [number, number]> = {
    letter: [612, 792], // US Letter (8.5 x 11 inches)
    a4: [595, 842],     // A4 (210 x 297 mm)
  }

  async function handleCreate() {
    try {
      setStatus({ loading: true, message: 'Creating PDF...' })

      let blob: Blob
      let filename: string

      if (mode === 'blank') {
        const [width, height] = pageSize === 'custom' 
          ? [customWidth, customHeight]
          : pageSizes[pageSize] || pageSizes.letter

        if (width <= 0 || height <= 0) {
          throw new Error('Page dimensions must be positive')
        }
        if (pageCount < 1 || pageCount > 1000) {
          throw new Error('Page count must be between 1 and 1000')
        }

        blob = await createBlankPdf(width, height, pageCount)
        filename = `blank_${pageSize}_${pageCount}pages.pdf`
      } else if (mode === 'text') {
        if (!textContent.trim()) {
          throw new Error('Text content cannot be empty')
        }
        blob = await createPdfFromText(textContent, {
          fontSize,
          fontFamily,
          pageSize: pageSizes[pageSize] || pageSizes.letter,
        })
        filename = 'text_document.pdf'
      } else if (mode === 'files') {
        if (files.length === 0) {
          throw new Error('Please select at least one file')
        }

        // Determine file types
        const images: File[] = []
        const textFiles: File[] = []

        for (const file of files) {
          if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) {
            images.push(file)
          } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
            textFiles.push(file)
          } else if (file.name.endsWith('.zip')) {
            // Extract images from ZIP
            const zip = new JSZip()
            const zipData = await file.arrayBuffer()
            const zipFile = await zip.loadAsync(zipData)
            
            for (const [filename, fileData] of Object.entries(zipFile.files)) {
              if (!fileData.dir && /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(filename)) {
                const blob = await fileData.async('blob')
                const imageFile = new File([blob], filename, { type: blob.type })
                images.push(imageFile)
              }
            }
          }
        }

        if (images.length > 0) {
          blob = await convertImagesToPdf(images, (current, total) => {
            setStatus({ loading: true, message: `Converting image ${current}/${total}...` })
          })
          filename = 'document_from_images.pdf'
        } else if (textFiles.length > 0) {
          // Combine text files
          let combinedText = ''
          for (const file of textFiles) {
            const text = await file.text()
            combinedText += `\n\n--- ${file.name} ---\n\n${text}`
          }
          blob = await convertTextToPdf(combinedText, {
            fontSize,
            fontFamily,
            pageSize: pageSizes[pageSize] || pageSizes.letter,
          })
          filename = 'document_from_text.pdf'
        } else {
          throw new Error('No supported files found. Please upload images or text files.')
        }
      } else if (mode === 'clipboard') {
        if (!clipboardContent.trim()) {
          throw new Error('Clipboard is empty or does not contain text')
        }
        blob = await convertTextToPdf(clipboardContent, {
          fontSize,
          fontFamily,
          pageSize: pageSizes[pageSize] || pageSizes.letter,
        })
        filename = 'document_from_clipboard.pdf'
      } else if (mode === 'url') {
        if (!url.trim()) {
          throw new Error('Please enter a URL')
        }

        try {
          // Fetch URL content
          setStatus({ loading: true, message: 'Fetching content from URL...' })
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`)
          }

          const htmlContent = await response.text()
          
          // Convert HTML to PDF
          blob = await convertHtmlToPdf(htmlContent, {
            pageSize: pageSizes[pageSize] || pageSizes.letter,
          })
          filename = 'document_from_url.pdf'
        } catch (error: any) {
          if (error.message?.includes('CORS')) {
            throw new Error('CORS error: Cannot fetch URL. Please use a URL that allows cross-origin requests.')
          }
          throw error
        }
      } else {
        throw new Error('Invalid mode')
      }

      if (!blob || blob.size < 10) {
        throw new Error('Failed to create PDF')
      }

      const url = URL.createObjectURL(blob)
      setCreatedFile({ url, name: filename, size: blob.size })
      setStatus({ loading: false, message: 'PDF created successfully!' })
      addToast('PDF created successfully!')
    } catch (error: any) {
      console.error('Create failed', error)
      const errorMsg = error?.message || 'Failed to create PDF'
      setStatus({ loading: false, message: errorMsg })
      addToast(errorMsg)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Validate files
    const validFiles: File[] = []
    for (const file of selectedFiles) {
      if (file.size === 0) {
        addToast(`Skipping empty file: ${file.name}`)
        continue
      }
      if (file.size > 100 * 1024 * 1024) {
        addToast(`Skipping large file (>100MB): ${file.name}`)
        continue
      }
      validFiles.push(file)
    }

    setFiles(prev => [...prev, ...validFiles])
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function downloadCreated() {
    if (!createdFile) return
    try {
      downloadBlob(new Blob([], { type: 'application/pdf' }), createdFile.name)
      fetch(createdFile.url).then(res => res.blob()).then(blob => {
        downloadBlob(blob, createdFile.name)
      }).catch(() => {
        const a = document.createElement('a')
        a.href = createdFile.url
        a.download = createdFile.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      const a = document.createElement('a')
      a.href = createdFile.url
      a.download = createdFile.name
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
          <h1 className="page-title">Create PDF</h1>
          <p className="page-subtitle">
            Create PDFs from scratch, text, files, clipboard content, or web pages.
          </p>
        </div>
        <div className="page-actions">
          {createdFile && (
            <Button variant="ghost" onClick={() => { 
              if (createdFile) URL.revokeObjectURL(createdFile.url)
              setCreatedFile(null)
              setStatus({ loading: false })
            }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selection */}
      <Card className="card-padding">
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-secondary)', padding: 6, borderRadius: '12px', flexWrap: 'wrap' }}>
          {(['blank', 'text', 'files', 'clipboard', 'url'] as CreateMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'primary' : 'ghost'}
              onClick={() => {
                setMode(m)
                setCreatedFile(null)
                setStatus({ loading: false })
              }}
              style={{ flex: '1 1 auto', minWidth: '120px' }}
            >
              {m === 'blank' && '📄 Blank'}
              {m === 'text' && '📝 Text'}
              {m === 'files' && '📁 Files'}
              {m === 'clipboard' && '📋 Clipboard'}
              {m === 'url' && '🌐 URL'}
            </Button>
          ))}
        </div>
      </Card>

      {/* Content Based on Mode */}
      <Card className="card-padding">
        {mode === 'blank' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Page Size</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {(['letter', 'a4', 'custom'] as const).map((size) => (
                  <button
                    key={size}
                    className={`btn ${pageSize === size ? 'primary' : 'ghost'}`}
                    onClick={() => setPageSize(size)}
                  >
                    {size === 'letter' && '📄 US Letter'}
                    {size === 'a4' && '📄 A4'}
                    {size === 'custom' && '📄 Custom'}
                  </button>
                ))}
              </div>
            </div>

            {pageSize === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Width (points)</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(72, parseInt(e.target.value) || 612))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Height (points)</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(72, parseInt(e.target.value) || 792))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Number of Pages</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={pageCount}
                onChange={(e) => setPageCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>
          </div>
        )}

        {mode === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Text Content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Enter text content for your PDF..."
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Font Size</label>
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Math.max(8, Math.min(72, parseInt(e.target.value) || 12)))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as 'Helvetica' | 'TimesRoman' | 'Courier')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="TimesRoman">Times Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mode === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <input
                id="create-file-upload"
                className="sr-only"
                type="file"
                multiple
                accept="image/*,.txt,.zip"
                onChange={handleFileSelect}
              />
              <Button
                variant="secondary"
                onClick={() => document.getElementById('create-file-upload')?.click()}
              >
                📁 Select Files (Images, Text, ZIP)
              </Button>
            </div>

            {files.length > 0 && (
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Selected Files ({files.length})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{file.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                          {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => removeFile(index)}>
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'clipboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Clipboard Content</label>
              <textarea
                value={clipboardContent}
                onChange={(e) => setClipboardContent(e.target.value)}
                placeholder="Paste content here or click the button below to load from clipboard..."
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  if (navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText()
                    setClipboardContent(text)
                    addToast('Clipboard content loaded')
                  } else {
                    addToast('Clipboard API not available')
                  }
                } catch (err) {
                  addToast('Failed to read clipboard. Please paste manually.')
                }
              }}
            >
              📋 Load from Clipboard
            </Button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Font Size</label>
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Math.max(8, Math.min(72, parseInt(e.target.value) || 12)))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as 'Helvetica' | 'TimesRoman' | 'Courier')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="TimesRoman">Times Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mode === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: '14px',
                }}
              />
            </div>
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
                <span>Note: CORS restrictions may prevent fetching some URLs. The webpage content will be converted to PDF.</span>
              </div>
            </div>
          </div>
        )}

        {/* Create Button */}
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 8 }}>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={status.loading || (mode === 'text' && !textContent.trim()) || (mode === 'files' && files.length === 0) || (mode === 'clipboard' && !clipboardContent.trim()) || (mode === 'url' && !url.trim())}
            style={{ fontWeight: 700 }}
          >
            {status.loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⚙️</span>
                Creating...
              </>
            ) : (
              <>✨ Create PDF</>
            )}
          </Button>
        </div>

        {status.message && (
          <div className={`status-message ${status.loading ? 'loading' : createdFile ? 'success' : ''}`} style={{ marginTop: 12 }}>
            {status.loading && (
              <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
            )}
            {createdFile && !status.loading && <span style={{ fontSize: '1.1rem' }}>✓</span>}
            <span>{status.message}</span>
          </div>
        )}

        {createdFile && (
          <div className="results-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>PDF Created</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Filename</div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {createdFile.name}
                  </div>
                </div>
                <div style={{ marginLeft: 16 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>Size</div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--success)' }}>{formatFileSize(createdFile.size)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" onClick={downloadCreated} style={{ fontWeight: 600 }}>
                  ⬇️ Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
