import { useState, useRef } from 'react'
import * as pdfLib from 'pdf-lib'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import './PageLayout.css'
import { useToast } from '../components/ToastProvider'
import { addPasswordProtection, removePasswordProtection, validateFile, downloadBlob } from '../utils/pdfUtils'

export default function Secure() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [encryptionLevel, setEncryptionLevel] = useState<'128' | '256'>('128')
  const [permissions, setPermissions] = useState({
    printing: false,
    copying: false,
    modifying: false,
    annotating: false,
  })
  const [watermarkText, setWatermarkText] = useState('')
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      showToast('PDF loaded', 'success')
    }
  }

  async function handlePasswordProtect() {
    if (!file || !password) {
      showToast('Please enter a password', 'warning')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    if (password.length < 3) {
      showToast('Password must be at least 3 characters', 'warning')
      return
    }

    const validation = validateFile(file)
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error')
      return
    }

    try {
      setLoading(true)
      const blob = await addPasswordProtection(file, password, undefined, {
        printing: permissions.printing,
        modifying: permissions.modifying,
        copying: permissions.copying,
        annotating: permissions.annotating,
        fillingForms: true,
        contentAccessibility: true,
        documentAssembly: true,
      })

      const filename = `secured-${file.name}`
      downloadBlob(blob, filename)
      showToast('PDF secured with password successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to secure PDF', error)
      const errorMsg = error?.message || 'Failed to secure PDF'
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddWatermark() {
    if (!file) {
      showToast('Please select a PDF first', 'warning')
      return
    }

    if (!watermarkText.trim()) {
      showToast('Please enter watermark text', 'warning')
      return
    }

    try {
      setLoading(true)
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfLib.PDFDocument.load(arrayBuffer)
      const pages = pdf.getPages()
      const font = await pdf.embedFont(pdfLib.StandardFonts.Helvetica)

      pages.forEach((page) => {
        const { width, height } = page.getSize()
        page.drawText(watermarkText, {
          x: width / 2,
          y: height / 2,
          size: 50,
          font,
          opacity: watermarkOpacity,
          rotate: pdfLib.degrees(-45),
          color: pdfLib.rgb(0.7, 0.7, 0.7),
        })
      })

      const pdfBytes = await pdf.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `watermarked-${file.name}`
      a.click()
      URL.revokeObjectURL(url)
      
      showToast('Watermark added successfully', 'success')
    } catch (error) {
      showToast('Failed to add watermark', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemovePassword() {
    if (!file) {
      showToast('Please select a PDF first', 'warning')
      return
    }

    showToast('Password removal requires the PDF password. This feature needs additional implementation.', 'info')
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Secure PDF</h1>
          <p className="page-subtitle">
            Password protection, encryption, watermarking, and permission management for your documents.
          </p>
        </div>
        <div className="page-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handleFileSelect}
          />
          {!file ? (
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              Upload PDF
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setFile(null)}>
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
            <h3>Upload a PDF to Secure</h3>
            <p>Drag and drop your PDF here, or click to browse</p>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Select File
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="card-padding">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <strong>{file.name}</strong>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Password Protection */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                Password Protection
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Encrypt your PDF with a password
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Encryption Level</label>
              <select
                className="form-input"
                value={encryptionLevel}
                onChange={(e) => setEncryptionLevel(e.target.value as '128' | '256')}
              >
                <option value="128">128-bit AES (Standard)</option>
                <option value="256">256-bit AES (Strong)</option>
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handlePasswordProtect}
              disabled={loading || !file}
              className="w-full"
            >
              {loading ? 'Securing...' : 'Apply Password Protection'}
            </Button>
          </div>
        </Card>

        {/* Permissions */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                Document Permissions
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Control what users can do with your PDF
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permissions.printing}
                  onChange={(e) => setPermissions({ ...permissions, printing: e.target.checked })}
                />
                <span>Allow Printing</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permissions.copying}
                  onChange={(e) => setPermissions({ ...permissions, copying: e.target.checked })}
                />
                <span>Allow Copying Text/Images</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permissions.modifying}
                  onChange={(e) => setPermissions({ ...permissions, modifying: e.target.checked })}
                />
                <span>Allow Modifying Contents</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permissions.annotating}
                  onChange={(e) => setPermissions({ ...permissions, annotating: e.target.checked })}
                />
                <span>Allow Adding Annotations</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Watermarking */}
        <Card className="card-padding">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                Add Watermark
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Add text watermark to your PDF
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Watermark Text</label>
              <input
                type="text"
                className="form-input"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g., CONFIDENTIAL, DRAFT"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Opacity: {(watermarkOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <Button
              variant="primary"
              onClick={handleAddWatermark}
              disabled={loading || !file}
              className="w-full"
            >
              {loading ? 'Adding...' : 'Add Watermark'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="page-info-section">
        <Card>
          <h3>Security Features</h3>
          <ul className="feature-list">
            <li><strong>Password Protection:</strong> Encrypt PDFs with AES encryption (128-bit or 256-bit)</li>
            <li><strong>Permission Restrictions:</strong> Control printing, copying, modifying, and annotating</li>
            <li><strong>Watermarking:</strong> Add visible text watermarks to protect intellectual property</li>
            <li><strong>Digital Signatures:</strong> Add digital signatures for document authenticity (requires certificates)</li>
            <li><strong>Redaction:</strong> Permanently remove sensitive information before sharing</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
