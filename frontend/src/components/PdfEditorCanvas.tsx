import { useEffect, useRef, useState, useCallback } from 'react'
import './PdfEditorCanvas.css'

export type DrawingTool = 'pen' | 'highlight' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser' | 'select'
export type DrawingAction = {
  tool: DrawingTool
  points: Array<{ x: number; y: number }>
  color: string
  strokeWidth: number
  fill?: boolean
  text?: string
  fontSize?: number
}

type Props = {
  pdfSrc: string
  currentPage?: number
  onPageChange?: (page: number) => void
  scale?: number
  rotation?: number
  selectedTool?: DrawingTool
  toolColor?: string
  toolStrokeWidth?: number
  onDrawingChange?: (actions: DrawingAction[]) => void
  drawings?: DrawingAction[]
}

export default function PdfEditorCanvas({
  pdfSrc,
  currentPage = 1,
  onPageChange,
  scale: initialScale = 1,
  rotation: initialRotation = 0,
  selectedTool = 'select',
  toolColor = '#000000',
  toolStrokeWidth = 2,
  onDrawingChange,
  drawings = [],
}: Props) {
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  const [pdf, setPdf] = useState<any | null>(null)
  const [pageNum, setPageNum] = useState(currentPage)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(initialScale)
  const [rotation, setRotation] = useState(initialRotation)
  const [error, setError] = useState<string | null>(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null)
  const [drawingActions, setDrawingActions] = useState<DrawingAction[]>(drawings)
  const [actionHistory, setActionHistory] = useState<DrawingAction[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Load PDF
  useEffect(() => {
    let cancelled = false
    let pdfjsLib: any
    
    async function load() {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
      try {
        const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjsLib.GlobalWorkerOptions.workerSrc = (w && (w as any).default) || (w as any)
      } catch (e) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.20.377/pdf.worker.min.js'
        } catch (e) {}
      }

      try {
        setError(null)
        const loadingTask = pdfjsLib.getDocument(pdfSrc)
        const pdfDoc = await loadingTask.promise
        if (cancelled) return
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setPageNum(currentPage)
      } catch (err: any) {
        console.error('Failed to load PDF', err)
        const msg = err && err.message ? err.message : String(err)
        setError('Unable to load the PDF. ' + msg)
      }
    }
    load()
    return () => { cancelled = true; if (pdf) { try { pdf.destroy() } catch {} } }
  }, [pdfSrc, currentPage])

  // Render PDF to canvas
  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    
    async function render() {
      try {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return
        const viewport = page.getViewport({ scale, rotation })
        const canvas = pdfCanvasRef.current
        if (!canvas) return
        
        const ctx = canvas.getContext('2d')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        ctx!.fillStyle = '#ffffff'
        ctx!.fillRect(0, 0, canvas.width, canvas.height)

        const renderContext = {
          canvasContext: ctx!,
          viewport,
        }
        await page.render(renderContext).promise
        
        // Sync edit canvas size
        const editCanvas = editCanvasRef.current
        if (editCanvas) {
          editCanvas.width = canvas.width
          editCanvas.height = canvas.height
        }
      } catch (e) {
        console.error('Render error', e)
        setError('An error occurred while rendering the page.')
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdf, pageNum, scale, rotation])

  // Sync page number
  useEffect(() => {
    if (onPageChange && pageNum !== currentPage) {
      onPageChange(pageNum)
    }
  }, [pageNum, currentPage, onPageChange])

  // Sync drawings
  useEffect(() => {
    if (onDrawingChange) {
      onDrawingChange(drawingActions)
    }
  }, [drawingActions, onDrawingChange])

  // Draw a single action
  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawingAction) => {
    ctx.save()
    ctx.strokeStyle = action.color
    ctx.fillStyle = action.color
    ctx.lineWidth = action.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (action.tool === 'pen' || action.tool === 'highlight') {
      if (action.tool === 'highlight') {
        ctx.globalAlpha = 0.3
        ctx.lineWidth = action.strokeWidth * 2
      }
      
      if (action.points.length > 1) {
        ctx.beginPath()
        ctx.moveTo(action.points[0].x, action.points[0].y)
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y)
        }
        ctx.stroke()
      }
    } else if (action.tool === 'rectangle') {
      if (action.points.length >= 2) {
        const start = action.points[0]
        const end = action.points[action.points.length - 1]
        const width = end.x - start.x
        const height = end.y - start.y
        ctx.strokeRect(start.x, start.y, width, height)
        if (action.fill) {
          ctx.fillRect(start.x, start.y, width, height)
        }
      }
    } else if (action.tool === 'circle') {
      if (action.points.length >= 2) {
        const start = action.points[0]
        const end = action.points[action.points.length - 1]
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
        ctx.beginPath()
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2)
        ctx.stroke()
        if (action.fill) {
          ctx.fill()
        }
      }
    } else if (action.tool === 'arrow') {
      if (action.points.length >= 2) {
        const start = action.points[0]
        const end = action.points[action.points.length - 1]
        const angle = Math.atan2(end.y - start.y, end.x - start.x)
        const headLength = 15
        const headAngle = Math.PI / 6
        
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.lineTo(
          end.x - headLength * Math.cos(angle - headAngle),
          end.y - headLength * Math.sin(angle - headAngle)
        )
        ctx.moveTo(end.x, end.y)
        ctx.lineTo(
          end.x - headLength * Math.cos(angle + headAngle),
          end.y - headLength * Math.sin(angle + headAngle)
        )
        ctx.stroke()
      }
    } else if (action.tool === 'text' && action.text) {
      ctx.font = `${action.fontSize || 16}px Arial`
      ctx.fillText(action.text, action.points[0]?.x || 0, action.points[0]?.y || 0)
    } else if (action.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = action.strokeWidth
      if (action.points.length > 1) {
        ctx.beginPath()
        ctx.moveTo(action.points[0].x, action.points[0].y)
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y)
        }
        ctx.stroke()
      }
    }
    
    ctx.restore()
  }, [])

  // Redraw edit canvas
  const redrawEditCanvas = useCallback(() => {
    const editCanvas = editCanvasRef.current
    if (!editCanvas) return
    
    const ctx = editCanvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, editCanvas.width, editCanvas.height)
    
    drawingActions.forEach((action) => {
      drawAction(ctx, action)
    })
    
    if (currentAction) {
      drawAction(ctx, currentAction)
    }
  }, [drawingActions, currentAction, drawAction])

  useEffect(() => {
    redrawEditCanvas()
  }, [redrawEditCanvas])

  // Get coordinates relative to canvas
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = editCanvasRef.current
    if (!canvas) return null
    
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      return null
    }
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  // Handle mouse/touch start
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'select') return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    e.preventDefault()
    setIsDrawing(true)
    startPosRef.current = coords
    lastPosRef.current = coords
    
    const newAction: DrawingAction = {
      tool: selectedTool,
      points: [coords],
      color: toolColor,
      strokeWidth: toolStrokeWidth,
      fontSize: 16,
    }
    
    setCurrentAction(newAction)
  }

  // Handle mouse/touch move
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    e.preventDefault()
    
    if (currentAction.tool === 'text') {
      // Text tool doesn't need move tracking
      return
    }
    
    lastPosRef.current = coords
    
    setCurrentAction({
      ...currentAction,
      points: [...currentAction.points, coords],
    })
  }

  // Handle mouse/touch end
  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) return
    
    e.preventDefault()
    setIsDrawing(false)
    
    // For text tool, prompt for text
    if (currentAction.tool === 'text' && currentAction.points.length > 0) {
      const text = prompt('Enter text:')
      if (text) {
        const finalAction: DrawingAction = {
          ...currentAction,
          text,
        }
        addAction(finalAction)
      }
    } else if (currentAction.points.length > 0) {
      addAction(currentAction)
    }
    
    setCurrentAction(null)
    startPosRef.current = null
    lastPosRef.current = null
  }

  // Add action to history
  const addAction = (action: DrawingAction) => {
    const newActions = [...drawingActions, action]
    setDrawingActions(newActions)
    
    // Update history
    const newHistory = actionHistory.slice(0, historyIndex + 1)
    newHistory.push(newActions)
    setActionHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setDrawingActions(actionHistory[newIndex] || [])
    } else if (historyIndex === 0) {
      setHistoryIndex(-1)
      setDrawingActions([])
    }
  }, [historyIndex, actionHistory])

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < actionHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setDrawingActions(actionHistory[newIndex] || [])
    }
  }, [historyIndex, actionHistory])

  // Clear current page drawings
  const clearDrawings = () => {
    setDrawingActions([])
    setActionHistory([[]])
    setHistoryIndex(-1)
  }

  // Navigation
  const prevPage = () => {
    if (pageNum > 1) setPageNum(p => p - 1)
  }
  
  const nextPage = () => {
    if (pageNum < numPages) setPageNum(p => p + 1)
  }
  
  const zoomIn = () => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))
  const rotateLeft = () => setRotation(r => (r - 90) % 360)
  const rotateRight = () => setRotation(r => (r + 90) % 360)

  if (error) {
    return (
      <div className="pdf-editor-error">
        <div>Viewer error</div>
        <div>{error}</div>
      </div>
    )
  }

  return (
    <div className="pdf-editor-canvas" ref={containerRef}>
      <div className="pdf-editor-toolbar">
        <div className="pdf-editor-page-info">
          <button className="btn-ghost" onClick={prevPage} disabled={pageNum === 1}>◀</button>
          <span>
            <input
              className="page-input"
              value={pageNum}
              onChange={(e) => {
                let v = parseInt(e.target.value || '1', 10)
                if (isNaN(v)) v = 1
                if (v < 1) v = 1
                if (numPages && v > numPages) v = numPages
                setPageNum(v)
              }}
            />
            <span> / {numPages}</span>
          </span>
          <button className="btn-ghost" onClick={nextPage} disabled={pageNum === numPages}>▶</button>
        </div>

        <div className="pdf-editor-zoom">
          <button className="btn-ghost" onClick={zoomOut}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="btn-ghost" onClick={zoomIn}>+</button>
          <button className="btn-ghost" onClick={rotateLeft}>⤺</button>
          <button className="btn-ghost" onClick={rotateRight}>⤻</button>
        </div>

        <div className="pdf-editor-history">
          <button className="btn-ghost" onClick={undo} disabled={historyIndex < 0}>↶ Undo</button>
          <button className="btn-ghost" onClick={redo} disabled={historyIndex >= actionHistory.length - 1}>↷ Redo</button>
          <button className="btn-ghost" onClick={clearDrawings}>Clear</button>
        </div>
      </div>

      <div className="pdf-editor-canvas-container">
        <div className="pdf-editor-canvas-wrapper">
          <canvas ref={pdfCanvasRef} className="pdf-editor-base-canvas" />
          <canvas
            ref={editCanvasRef}
            className="pdf-editor-edit-canvas"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{ cursor: selectedTool === 'select' ? 'default' : 'crosshair' }}
          />
        </div>
      </div>
    </div>
  )
}