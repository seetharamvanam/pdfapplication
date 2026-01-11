import { useEffect, useRef, useState } from 'react'
import './PdfViewer.css'

type Props = {
  src: string
  filename?: string
}

export default function PdfViewer({ src, filename }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pdf, setPdf] = useState<any | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let pdfjsLib: any
    async function load() {
      // @ts-ignore - dynamic import of PDF.js legacy build
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
      // worker
      try {
        // Load worker using Vite's ?url import which resolves to an absolute URL
        // pdfjs-dist provides a legacy worker build; use Vite's ?url to resolve its path
        const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjsLib.GlobalWorkerOptions.workerSrc = (w && (w as any).default) || (w as any)
      } catch (e) {
        try {
          // Fallback to CDN if bundler resolution fails
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.20.377/pdf.worker.min.js'
        } catch (e) {
          // ignore
        }
      }

      try {
        setError(null)
        const loadingTask = pdfjsLib.getDocument(src)
        const pdfDoc = await loadingTask.promise
        if (cancelled) return
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setPageNum(1)
      } catch (err: any) {
        console.error('Failed to load PDF', err)
        const msg = err && err.message ? err.message : String(err)
        setError('Unable to load the PDF. ' + msg)
      }
    }
    load()
    return () => { cancelled = true; if (pdf) { try { pdf.destroy() } catch {} } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    async function render() {
      try {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return
        const viewport = page.getViewport({ scale, rotation })
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        // Fill canvas with white background for PDF visibility
        ctx!.fillStyle = '#ffffff'
        ctx!.fillRect(0, 0, canvas.width, canvas.height)

        const renderContext = {
          canvasContext: ctx!,
          viewport,
        }
        await page.render(renderContext).promise
      } catch (e) {
        console.error('Render error', e)
        setError('An error occurred while rendering the page.')
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdf, pageNum, scale, rotation])

  function prev() { if (pageNum > 1) setPageNum((p) => p - 1) }
  function next() { if (pageNum < numPages) setPageNum((p) => p + 1) }
  function zoomIn() { setScale((s) => Math.min(3, +(s + 0.25).toFixed(2))) }
  function zoomOut() { setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2))) }
  function rotateLeft() { setRotation((r) => (r - 90) % 360) }
  function rotateRight() { setRotation((r) => (r + 90) % 360) }

  return (
    <div className="pdfviewer">
      <div className="pv-toolbar">
        <div className="pv-left">
          <div className="pv-file">{filename ?? 'Document'}</div>
        </div>

        <div className="pv-center">
          <button className="btn ghost" onClick={prev} aria-label="Previous page">◀</button>
          <span className="pv-page">
            <input className="pv-page-input" value={pageNum} onChange={(e) => {
              let v = parseInt(e.target.value || '1', 10)
              if (isNaN(v)) v = 1
              if (v < 1) v = 1
              if (numPages && v > numPages) v = numPages
              setPageNum(v)
            }} />
            <span> / {numPages}</span>
          </span>
          <button className="btn ghost" onClick={next} aria-label="Next page">▶</button>
        </div>

        <div className="pv-right">
          <button className="btn ghost" onClick={zoomOut} aria-label="Zoom out">−</button>
          <div className="pv-scale">{Math.round(scale * 100)}%</div>
          <button className="btn ghost" onClick={zoomIn} aria-label="Zoom in">+</button>
          <button className="btn ghost" onClick={rotateLeft} aria-label="Rotate left">⤺</button>
          <button className="btn ghost" onClick={rotateRight} aria-label="Rotate right">⤻</button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 18 }} role="alert">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Viewer error</div>
          <div style={{ marginBottom: 8 }}>{error}</div>
          <div>If you uploaded a sample, try uploading a different PDF file. You can also <a href={src} target="_blank" rel="noreferrer">open in a new tab</a>.</div>
        </div>
      ) : (
        <div className="pv-canvas-wrap">
          <canvas ref={canvasRef} className="pv-canvas" />
        </div>
      )}
    </div>
  )
}
