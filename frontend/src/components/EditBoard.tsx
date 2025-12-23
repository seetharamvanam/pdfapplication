import { useEffect, useMemo, useRef, useState } from 'react'
import './EditBoard.css'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

type Tool = 'select' | 'text' | 'pen' | 'image'

type Point = { x: number; y: number }

type Item =
  | {
      id: string
      type: 'text'
      page: number
      x: number
      y: number
      text: string
      fontSize: number
      color: string
      fontFamily: 'sans' | 'serif'
    }
  | {
      id: string
      type: 'pen'
      page: number
      color: string
      strokeWidth: number
      points: Point[]
    }
  | {
      id: string
      type: 'image'
      page: number
      x: number
      y: number
      width: number
      height: number
      dataUrl: string
    }

type PageSize = { width: number; height: number }

function hexToRgb(hex: string) {
  const c = hex.replace('#', '')
  const n = parseInt(c, 16)
  if (c.length === 3) {
    const r = (n >> 8) & 0xf
    const g = (n >> 4) & 0xf
    const b = n & 0xf
    return { r: (r / 15), g: (g / 15), b: (b / 15) }
  }
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return { r: r / 255, g: g / 255, b: b / 255 }
}

// Setup pdf.js worker once
let _pdfWorkerSetup: Promise<void> | null = null
async function ensurePdfWorker() {
  if (_pdfWorkerSetup) return _pdfWorkerSetup
  _pdfWorkerSetup = (async () => {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
      try {
        const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = (w && (w as any).default) || (w as any)
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.20.377/pdf.worker.min.js'
      }
    } catch {
      // ignore
    }
  })()
  return _pdfWorkerSetup
}

export default function EditBoard({ file, onExport }: { file: File; onExport?: (f: File) => void }) {
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const overlayRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [pdf, setPdf] = useState<any | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageSizes, setPageSizes] = useState<PageSize[]>([])
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState<Record<number, number>>({})
  const [items, setItems] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState('#d32f2f')
  const [fontSize, setFontSize] = useState(16)
  const [penSize, setPenSize] = useState(2)
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans')
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const historyRef = useRef<{ past: Item[][]; future: Item[][] }>({ past: [], future: [] })
  const selectedIdRef = useRef<string | null>(null)
  const [findTerm, setFindTerm] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    let currentUrl: string | null = null
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await ensurePdfWorker()
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
        const buf = await file.arrayBuffer()
        if (cancelled) return
        setFileBytes(buf)
        currentUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
        setObjectUrl(currentUrl)
        const loadingTask = pdfjs.getDocument({ url: currentUrl })
        const doc = await loadingTask.promise
        if (cancelled) return
        setPdf(doc)
        const total = doc.numPages || 0
        setNumPages(total)
        const sizes: PageSize[] = []
        const order: number[] = []
        for (let i = 1; i <= total; i++) {
          const pg = await doc.getPage(i)
          const vp = pg.getViewport({ scale: 1 })
          sizes.push({ width: vp.width, height: vp.height })
          order.push(i)
        }
        setPageSizes(sizes)
        setPageOrder(order)
        setPage(1)
        setItems([])
        historyRef.current = { past: [], future: [] }
      } catch (err: any) {
        console.error('edit load error', err)
        setError('Could not open PDF. Try another file.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (currentUrl) {
        try { URL.revokeObjectURL(currentUrl) } catch {}
      }
      if (pdf) {
        try { pdf.destroy() } catch {}
      }
    }
  }, [file])

  // render all pages into their canvases for continuous scroll
  useEffect(() => {
    if (!pdf || !numPages) return
    let cancelled = false
    async function renderAll() {
      try {
        for (let logical = 1; logical <= numPages; logical++) {
          const physical = pageOrder[logical - 1] || logical
          const pg = await pdf.getPage(physical)
          if (cancelled) return
          const rot = rotation[logical] || 0
          const baseSize = pageSizes[logical - 1] || pg.getViewport({ scale: 1 })
          const viewport = pg.getViewport({ scale, rotation: rot })
          const canvas = canvasRefs.current[logical]
          if (!canvas) continue
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          await pg.render({ canvasContext: ctx, viewport }).promise
          // ensure we keep an updated logical size for overlays
          pageSizes[logical - 1] = { width: baseSize.width, height: baseSize.height }
        }
      } catch (err) {
        console.error('render error', err)
      }
    }
    renderAll()
    return () => { cancelled = true }
  }, [pdf, numPages, pageOrder, rotation, scale, pageSizes])

  function pushHistory(next: Item[]) {
    historyRef.current.past.push(items)
    historyRef.current.future = []
    setItems(next)
  }

  function goPrevPage() {
    setPage((p) => (p > 1 ? p - 1 : p))
  }

  function goNextPage() {
    setPage((p) => (p < numPages ? p + 1 : p))
  }

  function undo() {
    const { past, future } = historyRef.current
    if (!past.length) return
    const prev = past.pop() as Item[]
    historyRef.current.future = [items, ...future]
    setItems(prev)
  }

  function redo() {
    const { past, future } = historyRef.current
    if (!future.length) return
    const next = future.shift() as Item[]
    historyRef.current.past.push(items)
    setItems(next)
  }

  function movePage(direction: 'prev' | 'next') {
    setPageOrder((order) => {
      if (!order.length) return order
      const idx = page - 1
      const target = direction === 'prev' ? idx - 1 : idx + 1
      if (target < 0 || target >= order.length) return order
      const copy = [...order]
      const tmp = copy[idx]
      copy[idx] = copy[target]
      copy[target] = tmp
      // update current page to follow moved page
      setPage(target + 1)
      return copy
    })
  }

  function deleteCurrentPage() {
    if (numPages <= 1) {
      alert('Cannot remove the last page.')
      return
    }
    const current = page
    setPageOrder((order) => {
      const copy = order.slice()
      copy.splice(current - 1, 1)
      return copy
    })
    setNumPages((n) => Math.max(1, n - 1))
    // remove items on this logical page, shift others down
    setItems((prev) =>
      prev
        .filter((it) => it.page !== current)
        .map((it) =>
          it.page > current
            ? { ...it, page: it.page - 1 }
            : it,
        ),
    )
    setRotation((prev) => {
      const next: Record<number, number> = {}
      for (let i = 1; i <= numPages; i++) {
        if (i === current) continue
        const srcIdx = i
        const dstIdx = i > current ? i - 1 : i
        if (prev[srcIdx] != null) next[dstIdx] = prev[srcIdx]
      }
      return next
    })
    setPage((p) => Math.max(1, Math.min(p, numPages - 1)))
  }

  function addTextAt(targetPage: number, clientX: number, clientY: number) {
    const overlay = overlayRefs.current[targetPage]
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const relX = clientX - rect.left
    const relY = clientY - rect.top
    const xNorm = rect.width ? relX / rect.width : 0
    const yNorm = rect.height ? relY / rect.height : 0
    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const next: Item[] = [...items, {
      id,
      type: 'text',
      page: targetPage,
      x: xNorm,
      y: yNorm,
      text: 'Edit me',
      fontSize,
      color,
      fontFamily,
    }]
    pushHistory(next)
    setSelectedId(id)
    selectedIdRef.current = id
  }

  function startPen(targetPage: number, e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const overlay = overlayRefs.current[targetPage]
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const startPoint: Point = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
    let points: Point[] = [startPoint]
    const id = `pen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    function move(ev: PointerEvent) {
      ev.preventDefault()
      const p: Point = {
        x: (ev.clientX - rect.left) / rect.width,
        y: (ev.clientY - rect.top) / rect.height,
      }
      points = [...points, p]
      setItems((prev) => {
        const without = prev.filter((i) => i.id !== id)
        return [...without, { id, type: 'pen', page: targetPage, color, strokeWidth: penSize, points }]
      })
    }
    function up(ev: PointerEvent) {
      ev.preventDefault()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const next = [...items.filter((i) => i.id !== id), { id, type: 'pen', page: targetPage, color, strokeWidth: penSize, points }]
      pushHistory(next)
      setSelectedId(id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    setItems((prev) => [...prev, { id, type: 'pen', page: targetPage, color, strokeWidth: penSize, points }])
    selectedIdRef.current = id
  }

  function onOverlayClick(targetPage: number, e: React.MouseEvent<HTMLDivElement>) {
    setPage(targetPage)
    if (tool === 'text') {
      addTextAt(targetPage, e.clientX, e.clientY)
    } else {
      setSelectedId(null)
      selectedIdRef.current = null
    }
  }

  function onItemDragStart(it: Item, e: React.MouseEvent) {
    if (tool !== 'select' || it.type !== 'text') return
    e.stopPropagation()
    const overlay = overlayRefs.current[it.page]
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const baseX = it.x * rect.width
    const baseY = it.y * rect.height
    function move(ev: MouseEvent) {
      ev.preventDefault()
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      setItems((prev) =>
        prev.map((p) =>
          p.id === it.id
            ? {
                ...p,
                x: Math.max(0, Math.min(1, (baseX + dx) / rect.width)),
                y: Math.max(0, Math.min(1, (baseY + dy) / rect.height)),
              }
            : p,
        ),
      )
    }
    function up(ev: MouseEvent) {
      ev.preventDefault()
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const next = items.map((p) =>
        p.id === it.id
          ? {
              ...p,
              x: Math.max(0, Math.min(1, (p as any).x)),
              y: Math.max(0, Math.min(1, (p as any).y)),
            }
          : p,
      )
      pushHistory(next)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    setSelectedId(it.id)
    selectedIdRef.current = it.id
  }

  function onTextChange(id: string, text: string) {
    setItems((prev) => prev.map((p) => p.id === id && p.type === 'text' ? { ...p, text } : p))
  }

  function deleteSelected() {
    const id = selectedIdRef.current
    if (!id) return
    const next = items.filter((i) => i.id !== id)
    if (next.length === items.length) return
    pushHistory(next)
    setSelectedId(null)
    selectedIdRef.current = null
  }

  // keyboard shortcuts: Delete to remove selected, Ctrl+Z / Ctrl+Y for undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      // do not intercept when typing in inputs or textareas
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault()
        deleteSelected()
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (meta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        undo()
      } else if (meta && (e.key === 'y' || (e.shiftKey && (e.key === 'Z' || e.key === 'z')))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items])

  // simple find-next across overlay text items
  const textItems = items.filter((i) => i.type === 'text')
  const matches = useMemo(
    () =>
      !findTerm
        ? []
        : textItems.filter((t) =>
            t.text.toLowerCase().includes(findTerm.toLowerCase()),
          ),
    [textItems, findTerm],
  )

  function jumpToMatch(delta: 1 | -1) {
    if (!matches.length) return
    setFindIndex((idx) => {
      let next = idx + delta
      if (next < 0) next = matches.length - 1
      if (next >= matches.length) next = 0
      const target = matches[next]
      if (target) {
        setPage(target.page)
        setSelectedId(target.id)
        selectedIdRef.current = target.id
      }
      return next
    })
  }

  async function download() {
    if (!fileBytes) return
    try {
      const srcDoc = await PDFDocument.load(fileBytes)
      const newDoc = await PDFDocument.create()
      const sansFont = await newDoc.embedFont(StandardFonts.Helvetica)
      const serifFont = await newDoc.embedFont(StandardFonts.TimesRoman)

      const order = pageOrder.length
        ? pageOrder.map((p) => Math.max(1, Math.min(srcDoc.getPageCount(), p)) - 1)
        : Array.from({ length: srcDoc.getPageCount() }, (_, i) => i)

      const copied = await newDoc.copyPages(srcDoc, order)
      copied.forEach((p) => newDoc.addPage(p))

      const pages = newDoc.getPages()

      // apply per-page rotation by logical page index
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i]
        const rot = rotation[i + 1] || 0
        if (rot) {
          pg.setRotation(degrees(rot))
        }
      }

      // cache embedded images by dataUrl
      const imageCache: Record<string, any> = {}

      for (const it of items) {
        const logical = it.page
        const pg = pages[logical - 1]
        const pageWidth = pg.getWidth()
        const pageHeight = pg.getHeight()

        if (it.type === 'text') {
          const x = it.x * pageWidth
          const yTop = it.y * pageHeight
          const y = pageHeight - yTop - it.fontSize
          const { r, g, b } = hexToRgb(it.color || '#000')
          const font = it.fontFamily === 'serif' ? serifFont : sansFont
          pg.drawText(it.text || '', {
            x,
            y,
            size: it.fontSize,
            color: rgb(r, g, b),
            font,
          })
        } else if (it.type === 'pen') {
          if (!it.points.length) continue
          const path = it.points
            .map((p, idx) => {
              const x = p.x * pageWidth
              const y = pageHeight - p.y * pageHeight
              return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
            })
            .join(' ')
          const { r, g, b } = hexToRgb(it.color || '#000')
          pg.drawSvgPath(path, { borderColor: rgb(r, g, b), borderWidth: it.strokeWidth })
        } else if (it.type === 'image') {
          const { x, y, width, height, dataUrl } = it
          if (!dataUrl) continue
          const imgX = x * pageWidth
          const imgYTop = y * pageHeight
          const imgW = width * pageWidth
          const imgH = height * pageHeight
          const imgY = pageHeight - imgYTop - imgH

          let embedded = imageCache[dataUrl]
          if (!embedded) {
            const isPng = dataUrl.startsWith('data:image/png')
            const base64 = dataUrl.split(',')[1]
            if (!base64) continue
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
            embedded = imageCache[dataUrl] = isPng ? await newDoc.embedPng(bytes) : await newDoc.embedJpg(bytes)
          }
          pg.drawImage(embedded, { x: imgX, y: imgY, width: imgW, height: imgH })
        }
      }
      const pdfBytes = await newDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const outFile = new File([blob], `edited-${file.name}`, { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = outFile.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      if (onExport) onExport(outFile)
    } catch (err) {
      console.error('download error', err)
      alert('Failed to export PDF. Please try again.')
    }
  }

  return (
    <div className="edit-board">
      <div className="eb-toolbar">
        <div className="eb-left">
          <span className="eb-filename" title={file.name}>{file.name}</span>
          <div className="eb-group">
            <button className={tool === 'select' ? 'btn primary' : 'btn ghost'} onClick={() => setTool('select')}>Select</button>
            <button className={tool === 'text' ? 'btn primary' : 'btn ghost'} onClick={() => setTool('text')}>Text</button>
            <button className={tool === 'pen' ? 'btn primary' : 'btn ghost'} onClick={() => setTool('pen')}>Pen</button>
            <button
              className={tool === 'image' ? 'btn primary' : 'btn ghost'}
              onClick={(e) => {
                e.preventDefault()
                setTool('image')
                imageInputRef.current?.click()
              }}
            >
              Image
            </button>
          </div>
          <div className="eb-group">
            <label className="eb-label">Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
            <label className="eb-label">Font <input type="number" min={8} max={96} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 12)} style={{ width: 64 }} /></label>
            <label className="eb-label">Pen <input type="number" min={1} max={12} value={penSize} onChange={(e) => setPenSize(Number(e.target.value) || 2)} style={{ width: 56 }} /></label>
            <label className="eb-label">
              Face
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value === 'serif' ? 'serif' : 'sans')}>
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
              </select>
            </label>
          </div>
        </div>
        <div className="eb-center">
          <span className="eb-page">Page {page} / {numPages || '—'}</span>
          <button className="btn ghost" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}>−</button>
          <span className="eb-scale">{Math.round(scale * 100)}%</span>
          <button className="btn ghost" onClick={() => setScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))}>+</button>
          <button className="btn ghost" onClick={() => setRotation((r) => ({ ...r, [page]: ((r[page] || 0) - 90 + 360) % 360 }))}>⤺</button>
          <button className="btn ghost" onClick={() => setRotation((r) => ({ ...r, [page]: ((r[page] || 0) + 90) % 360 }))}>⤻</button>
          <button className="btn ghost" onClick={undo} disabled={!historyRef.current.past.length}>Undo</button>
          <button className="btn ghost" onClick={redo} disabled={!historyRef.current.future.length}>Redo</button>
        </div>
        <div className="eb-right">
          <div className="eb-group">
            <label className="eb-label">
              Find
              <input
                type="text"
                value={findTerm}
                onChange={(e) => {
                  setFindTerm(e.target.value)
                  setFindIndex(0)
                }}
                placeholder="Text…"
                style={{ width: 120 }}
              />
            </label>
            <button className="btn ghost" onClick={() => jumpToMatch(-1)} disabled={!matches.length}>◀</button>
            <button className="btn ghost" onClick={() => jumpToMatch(1)} disabled={!matches.length}>▶</button>
          </div>
          <button className="btn ghost" onClick={() => movePage('prev')} disabled={page <= 1}>Move page ↑</button>
          <button className="btn ghost" onClick={() => movePage('next')} disabled={page >= numPages}>Move page ↓</button>
          <button className="btn ghost" onClick={deleteCurrentPage} disabled={numPages <= 1}>Delete page</button>
          <button className="btn ghost" onClick={deleteSelected} disabled={!selectedId}>Delete item</button>
          <button className="btn primary" onClick={download} disabled={loading}>Download edited PDF</button>
        </div>
      </div>

      {error && (
        <div className="eb-error" role="alert">{error}</div>
      )}

      {/* hidden image input for inserting images */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (!f) return
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const img = new Image()
            img.onload = () => {
              const logicalPage = page
              const size = pageSizes[logicalPage - 1] || { width: img.width, height: img.height }
              const targetWidthPx = size.width * 0.4
              const scaleFactor = targetWidthPx / img.width
              const targetHeightPx = img.height * scaleFactor
              const widthNorm = targetWidthPx / size.width
              const heightNorm = targetHeightPx / size.height
              const xNorm = 0.5 - widthNorm / 2
              const yNorm = 0.4 - heightNorm / 2
              const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              const next: Item[] = [
                ...items,
                {
                  id,
                  type: 'image',
                  page: logicalPage,
                  x: Math.max(0, xNorm),
                  y: Math.max(0, yNorm),
                  width: widthNorm,
                  height: heightNorm,
                  dataUrl,
                },
              ]
              pushHistory(next)
              setSelectedId(id)
              selectedIdRef.current = id
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(f)
        }}
      />

      <div className="eb-pages">
        {Array.from({ length: numPages }).map((_, idx) => {
          const logicalPage = idx + 1
          const size = pageSizes[logicalPage - 1] || { width: 600, height: 800 }
          const width = size.width * scale
          const height = size.height * scale
          return (
            <div key={logicalPage} className="eb-page-wrap">
              <div className="eb-page-label">Page {logicalPage}</div>
              <div
                className="eb-canvas-wrap"
                style={{ width, height }}
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[logicalPage] = el
                  }}
                  className="eb-canvas"
                />
                <div
                  ref={(el) => {
                    overlayRefs.current[logicalPage] = el
                  }}
                  className="eb-overlay"
                  style={{ width, height }}
                  onClick={(e) => onOverlayClick(logicalPage, e)}
                  onPointerDown={(e) => {
                    if (tool === 'pen') startPen(logicalPage, e)
                  }}
                >
                  {items
                    .filter((i) => i.page === logicalPage)
                    .map((it) => {
                      if (it.type === 'text') {
                        const left = it.x * width
                        const top = it.y * height
                        return (
                          <div
                            key={it.id}
                            className={`eb-text ${selectedId === it.id ? 'selected' : ''}`}
                            style={{
                              left,
                              top,
                              color: it.color,
                              fontSize: it.fontSize,
                              fontFamily:
                                it.fontFamily === 'serif'
                                  ? 'Georgia, Times, "Times New Roman", serif'
                                  : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            }}
                            onMouseDown={(e) => onItemDragStart(it, e)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(it.id)
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => onTextChange(it.id, e.currentTarget.innerText)}
                            onInput={(e) => onTextChange(it.id, e.currentTarget.innerText)}
                          >
                            {it.text}
                          </div>
                        )
                      }
                      if (it.type === 'pen') {
                        const path = it.points
                          .map((p, idx2) => `${idx2 === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
                          .join(' ')
                        return (
                          <svg
                            key={it.id}
                            className={`eb-stroke ${selectedId === it.id ? 'selected' : ''}`}
                            style={{ pointerEvents: 'none' }}
                          >
                            <path
                              d={path}
                              stroke={it.color}
                              strokeWidth={it.strokeWidth}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )
                      }
                      if (it.type === 'image') {
                        const left = it.x * width
                        const top = it.y * height
                        const wPx = it.width * width
                        const hPx = it.height * height
                        return (
                          <img
                            key={it.id}
                            src={it.dataUrl}
                            className={`eb-image ${selectedId === it.id ? 'selected' : ''}`}
                            style={{
                              left,
                              top,
                              width: wPx,
                              height: hPx,
                            }}
                            alt="Inserted"
                            onMouseDown={(e) => onItemDragStart(it, e)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(it.id)
                            }}
                          />
                        )
                      }
                      return null
                    })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

