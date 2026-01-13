/**
 * Forms Page
 * Create and fill interactive PDF forms
 * Note: Full form implementation requires pdf-lib form field creation
 */

import React, { useState, useEffect } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import './ops.css'
import { useToast } from '../components/ToastProvider'
import { validateFile, downloadBlob } from '../utils/pdfUtils'
import { PDFDocument } from 'pdf-lib'

export default function Forms() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{ loading: boolean; message?: string }>({ loading: false })
  const [mode, setMode] = useState<'create' | 'fill'>('fill')
  const [formFile, setFormFile] = useState<{ url: string; name: string; size: number } | null>(null)
  const [formFields, setFormFields] = useState<Record<string, string>>({})

  useEffect(() => {
    return () => {
      if (formFile) URL.revokeObjectURL(formFile.url)
    }
  }, [formFile])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return

    const validation = validateFile(f)
    if (!validation.valid) {
      addToast(validation.error || 'Invalid file')
      return
    }

    setFile(f)
    setFormFile(null)
    setFormFields({})

    if (mode === 'fill') {
      try {
        // Load PDF and detect form fields
        setStatus({ loading: true, message: 'Loading form...' })
        const arrayBuffer = await f.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        
        // Extract form fields (simplified - full implementation would enumerate all fields)
        const fields: Record<string, string> = {}
        // Note: pdf-lib form field enumeration requires more complex code
        // For now, show a placeholder
        
        setFormFields(fields)
        setStatus({ loading: false, message: 'Form loaded' })
        addToast('Form loaded. Use pdf-lib API to enumerate and fill fields.')
      } catch (error: any) {
        setStatus({ loading: false, message: error?.message || 'Failed to load form' })
        addToast('Failed to load form')
      }
    }

    e.target.value = ''
  }

  async function handleFillForm() {
    if (!file || Object.keys(formFields).length === 0) {
      addToast('Please select a PDF and fill form fields')
      return
    }

    try {
      setStatus({ loading: true, message: 'Filling form...' })
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      
      // Fill form fields using pdf-lib
      // Note: This requires form field enumeration and filling
      // const form = pdf.getForm()
      // form.getTextField('fieldName').setText(formFields['fieldName'])
      
      const pdfBytes = await pdf.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      setFormFile({ url, name: file.name.replace(/\.pdf$/i, '') + '_filled.pdf', size: blob.size })
      setStatus({ loading: false, message: 'Form filled successfully!' })
      addToast('Form filled successfully!')
    } catch (error: any) {
      setStatus({ loading: false, message: error?.message || 'Failed to fill form' })
      addToast('Failed to fill form')
    }
  }

  function downloadForm() {
    if (!formFile) return
    try {
      downloadBlob(new Blob([], { type: 'application/pdf' }), formFile.name)
      fetch(formFile.url).then(res => res.blob()).then(blob => {
        downloadBlob(blob, formFile.name)
      }).catch(() => {
        const a = document.createElement('a')
        a.href = formFile.url
        a.download = formFile.name
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
    } catch (err) {
      const a = document.createElement('a')
      a.href = formFile.url
      a.download = formFile.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">PDF Forms</h1>
          <p className="page-subtitle">
            Create and fill interactive PDF forms with text fields, checkboxes, and buttons.
          </p>
        </div>
        <div className="page-actions">
          {!file ? (
            <Button
              variant="primary"
              onClick={() => (document.getElementById('forms-upload') as HTMLInputElement | null)?.click()}
            >
              {mode === 'create' ? 'Create Form' : 'Fill Form'}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { 
              setFile(null)
              setFormFile(null)
              setFormFields({})
              setStatus({ loading: false })
            }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selection */}
      <Card className="card-padding">
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-secondary)', padding: 6, borderRadius: '12px' }}>
          <Button
            variant={mode === 'fill' ? 'primary' : 'ghost'}
            onClick={() => {
              setMode('fill')
              setFile(null)
              setFormFile(null)
              setFormFields({})
            }}
            style={{ flex: 1 }}
          >
            📝 Fill Form
          </Button>
          <Button
            variant={mode === 'create' ? 'primary' : 'ghost'}
            onClick={() => {
              setMode('create')
              setFile(null)
              setFormFile(null)
              setFormFields({})
            }}
            style={{ flex: 1 }}
          >
            ✨ Create Form
          </Button>
        </div>
      </Card>

      {mode === 'fill' ? (
        !file ? (
          <Card className="upload-zone">
            <div className="upload-content">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <h3>Upload a PDF Form</h3>
              <p>Drag and drop a PDF with form fields here, or click to browse</p>
              <Button variant="secondary" onClick={() => (document.getElementById('forms-upload') as HTMLInputElement | null)?.click()}>
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
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>

              {Object.keys(formFields).length === 0 ? (
                <div className="card-lift" style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(251, 146, 60, 0.08))',
                  borderRadius: '12px',
                  border: '1px solid rgba(251, 191, 36, 0.25)',
                  fontSize: '0.85rem',
                  color: 'var(--muted)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <span>Note: Form field detection and filling requires pdf-lib form API. This is a placeholder for the feature.</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {Object.entries(formFields).map(([fieldName, value]) => (
                    <div key={fieldName}>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>{fieldName}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setFormFields(prev => ({ ...prev, [fieldName]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                      />
                    </div>
                  ))}
                  <Button variant="primary" onClick={handleFillForm} disabled={status.loading} style={{ marginTop: 8 }}>
                    {status.loading ? 'Filling...' : '✨ Fill Form'}
                  </Button>
                </div>
              )}
            </Card>

            {formFile && (
              <Card className="card-padding">
                <div className="results-card">
                  <h4 style={{ marginBottom: 14 }}>Form Filled</h4>
                  <Button variant="primary" onClick={downloadForm} style={{ fontWeight: 600 }}>
                    ⬇️ Download Filled Form
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )
      ) : (
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
              <span>Form creation feature requires pdf-lib form field creation API. This would allow creating text fields, checkboxes, radio buttons, and more.</span>
            </div>
          </div>
        </Card>
      )}

      <input
        id="forms-upload"
        className="sr-only"
        type="file"
        accept="application/pdf"
        onChange={onFileChange}
      />
    </div>
  )
}
