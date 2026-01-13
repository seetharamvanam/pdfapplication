/**
 * PDF conversion utilities (client-side)
 * Converts PDFs to/from various formats
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import { ensurePdfWorker } from './pdfUtils'

// Maximum DPI for image conversion
const MAX_DPI = 600
const MIN_DPI = 72
const DEFAULT_DPI = 150

/**
 * Converts PDF pages to images (PNG or JPEG)
 */
export async function convertPdfToImages(
  file: File,
  format: 'png' | 'jpg' = 'png',
  dpi: number = DEFAULT_DPI,
  quality: number = 0.9,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (!file) throw new Error('No file provided')
  if (dpi < MIN_DPI || dpi > MAX_DPI) {
    throw new Error(`DPI must be between ${MIN_DPI} and ${MAX_DPI}`)
  }
  if (quality < 0.1 || quality > 1.0) {
    throw new Error('Quality must be between 0.1 and 1.0')
  }

  await ensurePdfWorker()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages

    const zip = new JSZip()
    const scale = dpi / 72

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not get canvas context')

      canvas.width = viewport.width
      canvas.height = viewport.height

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      await page.render(renderContext).promise

      // Convert canvas to blob
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to convert canvas to blob'))
          },
          format === 'jpg' ? 'image/jpeg' : 'image/png',
          format === 'jpg' ? quality : undefined
        )
      })

      const extension = format === 'jpg' ? 'jpg' : 'png'
      const filename = `${file.name.replace(/\.pdf$/i, '')}_page_${pageNum}.${extension}`
      zip.file(filename, imageBlob)

      if (onProgress) onProgress(pageNum, numPages)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    return zipBlob
  } catch (error: any) {
    if (error.name === 'PasswordException' || error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`PDF to image conversion failed: ${error.message || String(error)}`)
  }
}

/**
 * Converts PDF to text
 */
export async function convertPdfToText(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  if (!file) throw new Error('No file provided')

  await ensurePdfWorker()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages

    let fullText = ''

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
      
      fullText += pageText + '\n\n'

      if (onProgress) onProgress(pageNum, numPages)
    }

    return fullText.trim()
  } catch (error: any) {
    if (error.name === 'PasswordException' || error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`PDF to text conversion failed: ${error.message || String(error)}`)
  }
}

/**
 * Converts image(s) to PDF
 */
export async function convertImagesToPdf(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (!files || files.length === 0) throw new Error('No image files provided')

  try {
    const pdf = await PDFDocument.create()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Validate file type
      if (!file.type.startsWith('image/') && 
          !file.name.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i)) {
        console.warn(`Skipping non-image file: ${file.name}`)
        continue
      }

      try {
        // Read image as array buffer
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)

        // Determine image format
        let imageFormat: 'png' | 'jpg'
        const fileName = file.name.toLowerCase()
        if (fileName.endsWith('.png') || file.type === 'image/png') {
          imageFormat = 'png'
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                   file.type === 'image/jpeg' || file.type === 'image/jpg') {
          imageFormat = 'jpg'
        } else {
          // Try to detect format or default to PNG
          imageFormat = 'png'
        }

        // Embed image
        let image
        try {
          if (imageFormat === 'png') {
            image = await pdf.embedPng(bytes)
          } else {
            image = await pdf.embedJpg(bytes)
          }
        } catch (embedError) {
          // Fallback: try as PNG
          try {
            image = await pdf.embedPng(bytes)
          } catch {
            // Fallback: try as JPG
            image = await pdf.embedJpg(bytes)
          }
        }

        // Create page with image dimensions
        const { width, height } = image.scale(1)
        const page = pdf.addPage([width, height])
        
        // Draw image
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        })

        if (onProgress) onProgress(i + 1, files.length)
      } catch (imageError: any) {
        console.warn(`Failed to add image ${file.name}: ${imageError.message}`)
        // Continue with other images
      }
    }

    if (pdf.getPageCount() === 0) {
      throw new Error('No valid images could be converted')
    }

    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    throw new Error(`Image to PDF conversion failed: ${error.message || String(error)}`)
  }
}

/**
 * Converts text to PDF
 */
export async function convertTextToPdf(
  text: string,
  options: {
    fontSize?: number
    fontFamily?: 'Helvetica' | 'TimesRoman' | 'Courier'
    pageSize?: [number, number]
    margins?: { top: number; right: number; bottom: number; left: number }
  } = {}
): Promise<Blob> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty')
  }

  try {
    const pdf = await PDFDocument.create()
    const fontSize = options.fontSize || 12
    const fontFamily = options.fontFamily || 'Helvetica'
    const pageSize = options.pageSize || [612, 792] // US Letter
    const margins = options.margins || { top: 72, right: 72, bottom: 72, left: 72 }

    let font
    switch (fontFamily) {
      case 'TimesRoman':
        font = await pdf.embedFont(StandardFonts.TimesRoman)
        break
      case 'Courier':
        font = await pdf.embedFont(StandardFonts.Courier)
        break
      default:
        font = await pdf.embedFont(StandardFonts.Helvetica)
    }

    let page = pdf.addPage(pageSize)
    const { width, height } = page.getSize()
    const maxWidth = width - margins.left - margins.right
    let y = height - margins.top

    const lines = text.split('\n')

    for (const line of lines) {
      // Check if we need a new page
      if (y < margins.bottom) {
        page = pdf.addPage(pageSize)
        y = height - margins.top
      }

      // Simple word wrapping
      const words = line.split(' ')
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)

        if (textWidth > maxWidth && currentLine) {
          // Draw current line and start new one
          page.drawText(currentLine, {
            x: margins.left,
            y: y - fontSize,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          })
          y -= fontSize * 1.5
          currentLine = word

          // Check if we need a new page
          if (y < margins.bottom) {
            page = pdf.addPage(pageSize)
            y = height - margins.top
          }
        } else {
          currentLine = testLine
        }
      }

      // Draw remaining line
      if (currentLine) {
        page.drawText(currentLine, {
          x: margins.left,
          y: y - fontSize,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })
        y -= fontSize * 1.5
      } else {
        // Empty line
        y -= fontSize * 1.5
      }
    }

    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    throw new Error(`Text to PDF conversion failed: ${error.message || String(error)}`)
  }
}

/**
 * Converts HTML to PDF (basic implementation using canvas)
 * Note: This is a simplified implementation. For better results, consider using libraries like Puppeteer or Playwright
 */
export async function convertHtmlToPdf(
  htmlString: string,
  options: {
    pageSize?: [number, number]
    waitTime?: number
  } = {}
): Promise<Blob> {
  if (!htmlString || htmlString.trim().length === 0) {
    throw new Error('HTML cannot be empty')
  }

  // This is a simplified implementation
  // In production, you might want to use a headless browser or a specialized library
  // For now, we'll create a PDF with basic text extraction

  try {
    // Strip HTML tags for basic text extraction
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlString
    const text = tempDiv.textContent || tempDiv.innerText || ''

    // Create PDF from extracted text
    return await convertTextToPdf(text, {
      pageSize: options.pageSize || [612, 792],
    })
  } catch (error: any) {
    throw new Error(`HTML to PDF conversion failed: ${error.message || String(error)}`)
  }
}

/**
 * Extracts images from PDF
 */
export async function extractImagesFromPdf(
  file: File,
  format: 'png' | 'jpg' = 'png',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (!file) throw new Error('No file provided')

  await ensurePdfWorker()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages

    const zip = new JSZip()
    let imageIndex = 0

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const operators = await page.getOperatorList()

      // Extract images from operators (simplified approach)
      // Note: This is a basic implementation. Full image extraction is complex.
      
      // For now, render page as image
      const viewport = page.getViewport({ scale: 2 })
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
          format === 'jpg' ? 'image/jpeg' : 'image/png'
        )
      })

      imageIndex++
      const filename = `${file.name.replace(/\.pdf$/i, '')}_image_${imageIndex}.${format === 'jpg' ? 'jpg' : 'png'}`
      zip.file(filename, imageBlob)

      if (onProgress) onProgress(pageNum, numPages)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    return zipBlob
  } catch (error: any) {
    if (error.name === 'PasswordException' || error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Extract images failed: ${error.message || String(error)}`)
  }
}
