import React, { useCallback, useEffect, useRef, useState } from 'react'
import './MergeBoard.css'
import { useToast, useAnnounce } from './ToastProvider'
import { PDFDocument } from 'pdf-lib'

// cached worker setup promise
let _pdfWorkerSetup: Promise<void> | null = null
async function ensurePdfWorker() {
  if (_pdfWorkerSetup) return _pdfWorkerSetup
  _pdfWorkerSetup = (async () => {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
      try {
        const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = (w && (w as any).default) || (w as any)
      } catch (err) {
        // fallback CDN
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.20.377/pdf.worker.min.js'
      }
    } catch (err) {
      // ignore; thumbnails will simply not render
    }
  })()
  return _pdfWorkerSetup
}

type FileItem = {
  id: string
  file: File
}

export default function MergeBoard({
  initialFiles = [],
  files,
  onFilesChange,
  onMergeComplete,
}: {
  initialFiles?: File[]
  files?: File[]
  onFilesChange?: (files: File[]) => void
  onMergeComplete?: (file: File) => void
}) {
  const { addToast } = useToast()
  const { announce } = useAnnounce()
  const [items, setItems] = useState<FileItem[]>(() =>
    (files || initialFiles || []).map((f, i) => ({ id: `${Date.now()}-${i}`, file: f }))
  )
  const dragId = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const propsFiles = files as File[] | undefined
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})
  const [thumbLoading, setThumbLoading] = useState<Record<string, boolean>>({})
  const [thumbError, setThumbError] = useState<Record<string, string | null>>({})
  const [pageCounts, setPageCounts] = useState<Record<string, number | null>>({})


  // keep a ref of the last files prop so we only re-sync when the actual file list changes
  const prevFilesRef = useRef<File[] | null>(null)
  const initialisedRef = useRef(false)

  function sameFileLists(a?: File[] | null, b?: File[] | null) {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const A = a[i]
      const B = b[i]
      if (!A || !B) return false
      if (A.name !== B.name || A.size !== B.size || A.lastModified !== B.lastModified) return false
    }
    return true
  }

  useEffect(() => {
    // controlled mode: sync to files prop but only when the *contents* change
    if (files) {
      if (sameFileLists(prevFilesRef.current, files)) return
      prevFilesRef.current = files
      const newItems = (files || []).map((f, i) => ({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`, file: f }))
      setItems(newItems)
      newItems.forEach((it) => {
        if (!thumbnails[it.id] && !thumbLoading[it.id]) generateThumbnail(it.file, it.id)
      })
      return
    }

    // uncontrolled: initialize once from initialFiles
    if (!initialisedRef.current) {
      initialisedRef.current = true
      const newItems = (initialFiles || []).map((f, i) => ({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`, file: f }))
      setItems(newItems)
      newItems.forEach((it) => {
        if (!thumbnails[it.id] && !thumbLoading[it.id]) generateThumbnail(it.file, it.id)
      })
    }
  }, [initialFiles, files])

  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({})

  const onFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files as any as File[])
    console.log('[MergeBoard] adding files', arr.map(a => a.name))
    const newItems = arr.map((f) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, file: f }))
    if (propsFiles && onFilesChange) {
      // controlled mode: delegate to parent
      onFilesChange([...propsFiles, ...arr])
    } else {
      setItems((prev) => {
        const merged = [...prev, ...newItems]
        // generate thumbnails for new items
        newItems.forEach((it) => generateThumbnail(it.file, it.id))
        // mark as just added for brief entrance animation
        setJustAdded((s) => {
          const copy = { ...s }
          newItems.forEach((it) => { copy[it.id] = true })
          return copy
        })
        // clear the added flags shortly after
        setTimeout(() => {
          setJustAdded((s) => {
            const copy = { ...s }
            newItems.forEach((it) => { delete copy[it.id] })
            return copy
          })
        }, 420)
        return merged
      })
    }
    // scroll files into view (small delay to wait for DOM update)
    setTimeout(() => {
      try { listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) } catch (err) {}
    }, 60)
  }, [propsFiles, onFilesChange])

  // Generate a thumbnail for a PDF file (first page) with retries and error state
  async function generateThumbnail(file: File, id: string, opts?: { force?: boolean }) {
    console.log('[MergeBoard] generateThumbnail start', id, file.name)
    // avoid double work
    if (thumbLoading[id] && !opts?.force) {
      console.log('[MergeBoard] thumbnail already loading', id)
      return
    }

    setThumbLoading((s) => ({ ...s, [id]: true }))
    setThumbError((s) => ({ ...s, [id]: null }))

    const maxAttempts = 3
    let success = false

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await ensurePdfWorker()
          const pdfjs = (await import('pdfjs-dist/legacy/build/pdf')) as any
          const bytes = new Uint8Array(await file.arrayBuffer())
          const loadingTask = pdfjs.getDocument({ data: bytes })
          const pdf = await loadingTask.promise
          const page = await pdf.getPage(1)
          // store total page count
          const total = pdf.numPages || 1
          setPageCounts((s) => ({ ...s, [id]: total }))
          const vp1 = page.getViewport({ scale: 1 })
          const targetWidth = 120
          const scale = targetWidth / vp1.width
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)
          const ctx = canvas.getContext('2d')!

          // Fill canvas with white background for PDF visibility
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const renderTask = page.render({ canvasContext: ctx, viewport })
          await renderTask.promise
          const data = canvas.toDataURL('image/png')
          setThumbnails((s) => ({ ...s, [id]: data }))
          console.log('[MergeBoard] thumbnail ready', id)
          // success — clear any error state
          setThumbError((s) => ({ ...s, [id]: null }))
          success = true
          break
        } catch (err: any) {
          console.warn(`[MergeBoard] Thumbnail attempt ${attempt} failed for ${id}`, err)
          if (attempt < maxAttempts) {
            // small backoff
            await new Promise((r) => setTimeout(r, 250 * attempt))
            continue
          }
          // final failure — mark as failed
          setThumbnails((s) => ({ ...s, [id]: null }))
          setPageCounts((s) => ({ ...s, [id]: null }))
          const msg = err && err.message ? String(err.message) : 'Preview failed'
          setThumbError((s) => ({ ...s, [id]: msg }))
        }
      }
    } finally {
      // always clear loading flag when we're done
      setThumbLoading((s) => ({ ...s, [id]: false }))
      if (!success && !thumbError[id]) {
        // ensure we set a generic message if none provided
        setThumbError((s) => ({ ...s, [id]: s[id] || 'Preview failed' }))
      }
    }
  }

  function retryThumbnail(id: string, file: File) {
    // user-initiated retry
    generateThumbnail(file, id, { force: true })
  }

  // listen for global "mergeboard-add" events to add files from page controls
  useEffect(() => {
    function onAdd(e: Event) {
      const ce = e as CustomEvent<File[]>
      const files = ce?.detail || []
      console.log('[MergeBoard] received mergeboard-add', files && (files as any).length)
      if (!files || !files.length) return
      onFiles(files)
    }
    window.addEventListener('mergeboard-add', onAdd as EventListener)
    return () => window.removeEventListener('mergeboard-add', onAdd as EventListener)
  }, [onFiles])

  // also listen directly for 'merge-add-files' in case a wrapper isn't present
  useEffect(() => {
    function onAddFiles(e: Event) {
      const ce = e as CustomEvent<File[]>
      const files = ce?.detail || []
      console.log('[MergeBoard] received merge-add-files', files && (files as any).length)
      if (!files || !files.length) return
      onFiles(files)
    }
    window.addEventListener('merge-add-files', onAddFiles as EventListener)
    return () => window.removeEventListener('merge-add-files', onAddFiles as EventListener)
  }, [onFiles])

  // preview state: open preview popup for file
  const [previewOpen, setPreviewOpen] = useState<null | { id: string; file: File; rect: DOMRect; mode: 'hover' | 'click' }>(null)
  const hoverTimer = useRef<number | null>(null)

  function openPreviewForElement(id: string, file: File, el: HTMLElement, mode: 'hover' | 'click') {
    const rect = el.getBoundingClientRect()
    setPreviewOpen({ id, file, rect, mode })
  }

  function closePreviewIfHover() {
    if (previewOpen && previewOpen.mode === 'hover') setPreviewOpen(null)
  }

  // Drag handlers
  function handleDragStart(e: React.DragEvent, id: string) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', id)
    } catch (err) {}
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    const dragging = dragId.current
    if (!dragging || dragging === overId) return
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === dragging)
      const to = prev.findIndex((p) => p.id === overId)
      if (from < 0 || to < 0) return prev
      const copy = [...prev]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragId.current = null
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const removed = prev.find((p) => p.id === id)
      const copy = prev.filter((p) => p.id !== id)
      if (propsFiles && onFilesChange) {
        try { onFilesChange(copy.map((it) => it.file)) } catch (err) {}
      }
      if (removed) {
        try { addToast(`${removed.file.name} removed`) } catch (err) {}
      }
      return copy
    })
  }

  function moveItem(id: string, dir: number) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx < 0) return prev
      const newIdx = Math.min(prev.length - 1, Math.max(0, idx + dir))
      const copy = [...prev]
      const [moved] = copy.splice(idx, 1)
      copy.splice(newIdx, 0, moved)
      if (propsFiles && onFilesChange) {
        try { onFilesChange(copy.map((it) => it.file)) } catch (err) {}
      }
      return copy
    })
  }

  const [merging, setMerging] = React.useState(false)

  async function mergeAndDownload() {
    if (!items.length) return
    setMerging(true)
    try {
      // Client-side merge using pdf-lib
      const files = items.map(it => it.file)
      const { mergePdfs, downloadBlob } = await import('../utils/pdfUtils')
      
      const blob = await mergePdfs(files, (current, total) => {
        // Update progress if needed
        if (onMergeComplete) {
          // Could emit progress events here
        }
      })
      
      const filename = 'merged.pdf'
      const url = URL.createObjectURL(blob)
      
      // Download the merged PDF
      downloadBlob(blob, filename)
      
      const outFile = new File([blob], filename, { type: 'application/pdf' })
      if (onMergeComplete) onMergeComplete(outFile)
      try { addToast('Merged successfully — download started') } catch (err) {}
    } catch (err: any) {
      console.error('Merge failed', err)
      const errorMsg = err?.message || 'Merge failed'
      try { addToast(errorMsg) } catch (e) {}
    } finally {
      setMerging(false)
    }
  }

  // respond to external merge-trigger event (hero CTA)
  React.useEffect(() => {
    function onMergeTrigger() { mergeAndDownload() }
    window.addEventListener('merge-trigger', onMergeTrigger)
    return () => window.removeEventListener('merge-trigger', onMergeTrigger)
  }, [items])

  return (
    <div className="merge-board">
      <div className="merge-board-inner">
        <div
          className={`dropzone ${items.length ? 'has-files' : ''}`}
          onDrop={(e) => {
            e.preventDefault()
            const dtFiles = e.dataTransfer.files
            if (dtFiles && dtFiles.length) onFiles(dtFiles)
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* board-level hidden upload input to add files when items already exist */}
          <input id="board-upload" className="sr-only" type="file" accept="application/pdf" multiple onChange={(e) => {
            const added = e.currentTarget.files
            if (added && added.length) onFiles(added)
            e.currentTarget.value = ''
          }} />
          {!items.length && (
            <div className="drop-hint">
              <p className="h1">Drag & drop PDFs here</p>
              <p className="muted">Or click to upload and then reorder them to set the merge order</p>
              <input
                aria-label="Upload PDFs to merge"
                className="upload-input"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  const files = e.currentTarget.files
                  if (files && files.length) onFiles(files)
                  e.currentTarget.value = ''
                }}
              />
            </div>
          )}

          {items.length > 0 && (
            <div className="files-area" ref={listRef} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
              <div className="files-list" role="list">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    data-item={it.id}
                    role="listitem"
                    className={`file-card ${justAdded[it.id] ? 'added' : ''}`}
                    draggable
                    tabIndex={0}
                    onClick={(e) => openPreviewForElement(it.id, it.file, e.currentTarget as HTMLElement, 'click')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        openPreviewForElement(it.id, it.file, e.currentTarget as HTMLElement, 'click')
                        return
                      }
                      // Keyboard reordering: Alt/Ctrl/Meta + ArrowLeft/ArrowRight
                      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.altKey || e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        const dir = e.key === 'ArrowLeft' ? -1 : 1
                        const index = items.findIndex((p) => p.id === it.id)
                        const newIdx = Math.min(items.length - 1, Math.max(0, index + dir))
                        if (index >= 0 && newIdx !== index) {
                          moveItem(it.id, dir)
                          announce(`${it.file.name} moved to position ${newIdx + 1}`)
                          setTimeout(() => {
                            const el = listRef.current?.querySelector(`[data-item="${it.id}"]`) as HTMLElement | null
                            el?.focus()
                          }, 120)
                        }
                      }
                    }}
                    onMouseEnter={(e) => { hoverTimer.current = window.setTimeout(() => openPreviewForElement(it.id, it.file, e.currentTarget as HTMLElement, 'hover'), 350) }}
                    onMouseLeave={() => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } ; closePreviewIfHover() }}
                    onDragStart={(e) => handleDragStart(e, it.id)}
                    onDragOver={(e) => handleDragOver(e, it.id)}
                  >
                    <div className="file-thumb">
                      <div className="order-badge" aria-hidden>{idx + 1}</div>
                      {thumbLoading[it.id] ? (
                        <div className="thumb-placeholder" aria-live="polite">
                          <div className="thumb-spinner" aria-hidden />
                          <div className="thumb-placeholder-label">Rendering…</div>
                        </div>
                      ) : thumbnails[it.id] ? (
                        <img src={thumbnails[it.id] || ''} alt={`Thumbnail for ${it.file.name}`} className="file-thumb-img" />
                      ) : thumbError[it.id] ? (
                        <div className="thumb-error" role="alert" aria-live="polite">
                          <div className="thumb-error-msg" aria-hidden>⚠</div>
                          <div className="thumb-error-text">Preview failed</div>
                          <button className="btn small" onClick={(e) => { e.stopPropagation(); e.preventDefault(); retryThumbnail(it.id, it.file) }} aria-label="Retry thumbnail">Retry</button>
                        </div>
                      ) : (
                        <div className="thumb-placeholder">PDF</div>
                      )}


                      {/* hover preview */}
                      <div className="preview" aria-hidden>
                        {thumbnails[it.id] ? <img src={thumbnails[it.id] || ''} alt="PDF preview" /> : <div className="preview-placeholder">PDF</div>}
                      </div>
                    </div>
                    <div className="file-meta">
                      <div className="file-name" title={it.file.name}>{it.file.name}</div>
                      <div className="file-size">{pageCounts[it.id] ? `${pageCounts[it.id]} page${pageCounts[it.id] === 1 ? '' : 's'}` : `${(it.file.size / 1024).toFixed(1)} KB`}</div>
                    </div>
                    <div className="file-actions">
                      <button className="btn small" onClick={(e) => { e.stopPropagation(); moveItem(it.id, -1) }} title="Move left" aria-label="Move left">◀</button>
                      <button className="btn small" onClick={(e) => { e.stopPropagation(); moveItem(it.id, 1) }} title="Move right" aria-label="Move right">▶</button>
                      <button className="btn small danger" onClick={(e) => { e.stopPropagation(); removeItem(it.id) }} title="Remove" aria-label="Remove file">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview popup rendered outside list to avoid nesting issues */}
              {previewOpen && (
                <MergePdfPreview file={previewOpen.file} onClose={() => setPreviewOpen(null)} />
              )}

              <div className={`controls ${items.length ? "fixed" : ""}`}>
                <div className="note">Order is left → right — Tip: hold Alt/Ctrl and press ← / → to move</div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => { (document.getElementById('board-upload') as HTMLInputElement | null)?.click() }}>Add files</button>
                  <button className="btn ghost" onClick={() => { 
                    // clear local items
                    setItems([]); 
                    setPreviewOpen(null);
                    // if controlled by parent, notify parent to clear files as well
                    if (propsFiles && onFilesChange) {
                      try { onFilesChange([]) } catch (err) {}
                    }
                    try { addToast('Files cleared') } catch (err) {}
                  }}>Clear</button>
                  <button 
                    className={items.length ? 'btn primary' : 'btn ghost'} 
                    disabled={!items.length || merging} 
                    onClick={() => mergeAndDownload()}
                  >
                    {merging ? 'Merging...' : 'Merge & Download'}
                  </button>
                </div>
              </div>


            </div>

          )}

          

        </div>
      </div>
    </div>
  )
}



// Popup component: renders PDF pages into a large centered modal so users can inspect documents
function MergePdfPreview({ file, onClose }: { file: File; onClose: () => void }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  const abortRef = React.useRef(false)

  React.useEffect(() => {
    abortRef.current = false
    let mounted = true
    async function load() {
      setLoading(true)
      setProgress({ done: 0, total: 0 })
      try {
        await ensurePdfWorker()
        const pdfjs = (await import('pdfjs-dist/legacy/build/pdf')) as any
        const bytes = new Uint8Array(await file.arrayBuffer())
        const loadingTask = pdfjs.getDocument({ data: bytes })
        const pdf = await loadingTask.promise
        if (!mounted || abortRef.current) return
        const total = pdf.numPages || 0
        setProgress({ done: 0, total })
        // clear previous
        if (containerRef.current) containerRef.current.innerHTML = ''
        // pick a large render width so previews are clear — responsive to viewport
        const bigWidth = Math.min(window.innerWidth * 0.8, 1400)
        for (let p = 1; p <= total; p++) {
          if (abortRef.current) break
          const page = await pdf.getPage(p)
          if (abortRef.current) break
          const vp = page.getViewport({ scale: 1 })
          const scale = bigWidth / vp.width
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)
          const ctx = canvas.getContext('2d')!

          // Fill canvas with white background for PDF visibility
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const renderTask = page.render({ canvasContext: ctx, viewport })
          await renderTask.promise
          if (!mounted || abortRef.current) break
          canvas.className = 'preview-page'
          containerRef.current?.appendChild(canvas)
          setProgress((s) => ({ ...s, done: s.done + 1 }))
        }
      } catch (err) {
        console.warn('Preview failed', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { mounted = false; abortRef.current = true; window.removeEventListener('keydown', onKey) }
  }, [file, onClose])

  // Render a full-screen overlay + centered popup for a larger, focused preview
  return (
    <div className="pdf-preview-overlay" role="dialog" aria-label="PDF preview">
      <div className="pdf-preview-backdrop" onClick={onClose} />
      <div className="pdf-preview-popup" role="document" aria-modal="true">
        <div className="pdf-preview-header">
          <div className="pdf-preview-title">Preview</div>
          <div className="pdf-preview-meta">{loading ? `Rendering ${progress.done}/${progress.total}` : `${progress.total} pages`}</div>
          <button className="btn small" onClick={onClose} aria-label="Close preview">✕</button>
        </div>
        <div className="pdf-preview-body" tabIndex={0} ref={containerRef} />
      </div>
    </div>
  )
}
