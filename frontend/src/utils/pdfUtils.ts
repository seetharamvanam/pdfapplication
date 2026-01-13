/**
 * Comprehensive client-side PDF utility functions
 * All operations run entirely in the browser without server dependencies
 */

import { PDFDocument, PDFPage, PDFFont, rgb, PDFEmbeddedPage, PDFRef, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { saveAs } from 'file-saver'

// Initialize PDF.js worker
let workerInitialized = false
async function ensurePdfWorker() {
  if (workerInitialized) return
  try {
    const workerUrl = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjsLib.GlobalWorkerOptions.workerSrc = (workerUrl as any).default || workerUrl
    workerInitialized = true
  } catch (e) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
      workerInitialized = true
    } catch (err) {
      console.warn('Could not initialize PDF.js worker', err)
    }
  }
}

// File size limits (100MB default)
const MAX_FILE_SIZE = 100 * 1024 * 1024

/**
 * Validates file before processing
 */
export function validateFile(file: File, maxSize = MAX_FILE_SIZE): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'No file provided' }
  if (file.size === 0) return { valid: false, error: 'File is empty' }
  if (file.size > maxSize) return { valid: false, error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit` }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must be a PDF' }
  }
  return { valid: true }
}

/**
 * Loads a PDF document from a File
 */
export async function loadPdfDocument(file: File): Promise<{ doc: PDFDocument; bytes: Uint8Array }> {
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    return { doc, bytes }
  } catch (error: any) {
    if (error.message?.includes('password') || error.name === 'PDFPasswordException') {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Failed to load PDF: ${error.message || String(error)}`)
  }
}

/**
 * Loads a PDF document using PDF.js for reading/rendering
 */
export async function loadPdfJsDocument(file: File | string): Promise<any> {
  await ensurePdfWorker()
  try {
    let source: any
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer()
      source = { data: arrayBuffer }
    } else {
      source = file
    }
    const loadingTask = pdfjsLib.getDocument(source)
    const pdfDoc = await loadingTask.promise
    return pdfDoc
  } catch (error: any) {
    if (error.name === 'PasswordException' || error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Failed to load PDF: ${error.message || String(error)}`)
  }
}

/**
 * Merges multiple PDFs into a single document
 */
export async function mergePdfs(files: File[], onProgress?: (current: number, total: number) => void): Promise<Blob> {
  if (!files || files.length === 0) throw new Error('No files provided')
  if (files.length === 1) {
    const validation = validateFile(files[0])
    if (!validation.valid) throw new Error(validation.error || 'Invalid file')
    return files[0]
  }

  const mergedPdf = await PDFDocument.create()
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const validation = validateFile(file)
      if (!validation.valid) {
        console.warn(`Skipping invalid file: ${file.name} - ${validation.error}`)
        continue
      }

      try {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
        const pageIndices = pdf.getPageIndices()
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices)
        copiedPages.forEach((page) => mergedPdf.addPage(page))
        
        if (onProgress) onProgress(i + 1, files.length)
      } catch (error: any) {
        if (error.message?.includes('password')) {
          throw new Error(`File "${file.name}" is password-protected. Please unlock it first.`)
        }
        throw new Error(`Failed to merge "${file.name}": ${error.message || String(error)}`)
      }
    }

    const mergedBytes = await mergedPdf.save()
    return new Blob([mergedBytes], { type: 'application/pdf' })
  } catch (error: any) {
    throw new Error(`Merge failed: ${error.message || String(error)}`)
  }
}

/**
 * Splits a PDF into multiple documents based on page ranges
 */
export async function splitPdf(
  file: File,
  ranges: Array<{ start: number; end: number; name?: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ name: string; blob: Blob }>> {
  if (!ranges || ranges.length === 0) throw new Error('No ranges provided')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = sourcePdf.getPageCount()
    
    const results: Array<{ name: string; blob: Blob }> = []
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      let start = Math.max(1, range.start)
      let end = Math.min(totalPages, range.end)
      
      if (start > end) {
        console.warn(`Invalid range: ${start}-${end}, skipping`)
        continue
      }
      
      // Convert to 0-based indices
      start = start - 1
      end = end - 1
      
      const newPdf = await PDFDocument.create()
      const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
      copiedPages.forEach((page) => newPdf.addPage(page))
      
      const pdfBytes = await newPdf.save()
      const name = range.name || `${file.name.replace(/\.pdf$/i, '')}_pages_${range.start}-${range.end}.pdf`
      results.push({
        name,
        blob: new Blob([pdfBytes], { type: 'application/pdf' })
      })
      
      if (onProgress) onProgress(i + 1, ranges.length)
    }
    
    return results
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Split failed: ${error.message || String(error)}`)
  }
}

/**
 * Extracts pages from a PDF
 */
export async function extractPages(
  file: File,
  pageNumbers: number[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  if (!pageNumbers || pageNumbers.length === 0) throw new Error('No pages specified')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = sourcePdf.getPageCount()
    
    // Validate and convert to 0-based indices
    const pageIndices = pageNumbers
      .filter(p => p >= 1 && p <= totalPages)
      .map(p => p - 1)
    
    if (pageIndices.length === 0) {
      throw new Error('No valid pages to extract')
    }
    
    const newPdf = await PDFDocument.create()
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))
    
    if (onProgress) onProgress(1, 1)
    
    const pdfBytes = await newPdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Extract failed: ${error.message || String(error)}`)
  }
}

/**
 * Reorders pages in a PDF
 */
export async function reorderPages(
  file: File,
  newOrder: number[]
): Promise<Blob> {
  if (!newOrder || newOrder.length === 0) throw new Error('No page order specified')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = sourcePdf.getPageCount()
    
    // Validate new order
    if (newOrder.length !== totalPages) {
      throw new Error(`Page order must contain ${totalPages} pages`)
    }
    
    const pageIndices = newOrder
      .filter(p => p >= 1 && p <= totalPages)
      .map(p => p - 1)
    
    if (pageIndices.length !== totalPages) {
      throw new Error('Invalid page order')
    }
    
    const newPdf = await PDFDocument.create()
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))
    
    const pdfBytes = await newPdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Reorder failed: ${error.message || String(error)}`)
  }
}

/**
 * Rotates pages in a PDF
 */
export async function rotatePages(
  file: File,
  pageNumbers: number[],
  angle: 90 | 180 | 270
): Promise<Blob> {
  if (!pageNumbers || pageNumbers.length === 0) throw new Error('No pages specified')
  if (![90, 180, 270].includes(angle)) throw new Error('Angle must be 90, 180, or 270')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = pdf.getPageCount()
    
    const pageIndices = pageNumbers
      .filter(p => p >= 1 && p <= totalPages)
      .map(p => p - 1)
    
    if (pageIndices.length === 0) {
      throw new Error('No valid pages to rotate')
    }
    
    const rotation = angle as 90 | 180 | 270
    pageIndices.forEach((pageIndex) => {
      const page = pdf.getPage(pageIndex)
      const currentRotation = page.getRotation().angle
      page.setRotation(rotation + currentRotation)
    })
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Rotate failed: ${error.message || String(error)}`)
  }
}

/**
 * Deletes pages from a PDF
 */
export async function deletePages(
  file: File,
  pageNumbers: number[]
): Promise<Blob> {
  if (!pageNumbers || pageNumbers.length === 0) throw new Error('No pages specified')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = pdf.getPageCount()
    
    // Sort in descending order to avoid index shifting issues
    const pageIndicesToDelete = pageNumbers
      .filter(p => p >= 1 && p <= totalPages)
      .map(p => p - 1)
      .sort((a, b) => b - a)
    
    if (pageIndicesToDelete.length === 0) {
      throw new Error('No valid pages to delete')
    }
    
    if (pageIndicesToDelete.length === totalPages) {
      throw new Error('Cannot delete all pages')
    }
    
    pageIndicesToDelete.forEach((pageIndex) => {
      pdf.removePage(pageIndex)
    })
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Delete pages failed: ${error.message || String(error)}`)
  }
}

/**
 * Inserts pages from one PDF into another at a specific position
 */
export async function insertPages(
  targetFile: File,
  sourceFile: File,
  insertAfterPage: number
): Promise<Blob> {
  const targetValidation = validateFile(targetFile)
  if (!targetValidation.valid) throw new Error(`Target file: ${targetValidation.error}`)
  
  const sourceValidation = validateFile(sourceFile)
  if (!sourceValidation.valid) throw new Error(`Source file: ${sourceValidation.error}`)

  try {
    const targetArrayBuffer = await targetFile.arrayBuffer()
    const targetBytes = new Uint8Array(targetArrayBuffer)
    const targetPdf = await PDFDocument.load(targetBytes, { ignoreEncryption: false })
    const targetPageCount = targetPdf.getPageCount()
    
    const insertIndex = Math.max(0, Math.min(targetPageCount, insertAfterPage))
    
    const sourceArrayBuffer = await sourceFile.arrayBuffer()
    const sourceBytes = new Uint8Array(sourceArrayBuffer)
    const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: false })
    const sourcePageIndices = sourcePdf.getPageIndices()
    
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePageIndices)
    
    // Insert pages in reverse order to maintain correct position
    for (let i = copiedPages.length - 1; i >= 0; i--) {
      targetPdf.insertPage(insertIndex, copiedPages[i])
    }
    
    const pdfBytes = await targetPdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('One of the PDFs is password-protected. Please unlock it first.')
    }
    throw new Error(`Insert pages failed: ${error.message || String(error)}`)
  }
}

/**
 * Crops a page in a PDF
 */
export async function cropPage(
  file: File,
  pageNumber: number,
  cropBox: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  if (pageNumber < 1) throw new Error('Page number must be at least 1')
  if (cropBox.width <= 0 || cropBox.height <= 0) {
    throw new Error('Crop box dimensions must be positive')
  }
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const totalPages = pdf.getPageCount()
    
    if (pageNumber > totalPages) {
      throw new Error(`Page ${pageNumber} does not exist (PDF has ${totalPages} pages)`)
    }
    
    const page = pdf.getPage(pageNumber - 1)
    const { width, height } = page.getSize()
    
    // Validate crop box is within page bounds
    if (cropBox.x < 0 || cropBox.y < 0 || 
        cropBox.x + cropBox.width > width || 
        cropBox.y + cropBox.height > height) {
      throw new Error('Crop box is outside page boundaries')
    }
    
    page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Crop failed: ${error.message || String(error)}`)
  }
}

/**
 * Adds password protection to a PDF
 */
export async function addPasswordProtection(
  file: File,
  userPassword: string,
  ownerPassword?: string,
  permissions?: {
    printing?: boolean
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
): Promise<Blob> {
  if (!userPassword || userPassword.length < 3) {
    throw new Error('User password must be at least 3 characters')
  }
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    
    const finalOwnerPassword = ownerPassword || userPassword
    
    // PDF-lib uses permissions flags (set to false to allow)
    const flags = {
      print: !permissions?.printing,
      modify: !permissions?.modifying,
      copy: !permissions?.copying,
      annotate: !permissions?.annotating,
      fillForms: !permissions?.fillingForms,
      contentAccessibility: !permissions?.contentAccessibility,
      assemble: !permissions?.documentAssembly,
    }
    
    pdf.encrypt({
      userPassword: userPassword,
      ownerPassword: finalOwnerPassword,
      ...flags
    })
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password') && error.message?.includes('required')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Add password protection failed: ${error.message || String(error)}`)
  }
}

/**
 * Removes password protection from a PDF
 */
export async function removePasswordProtection(
  file: File,
  password: string
): Promise<Blob> {
  if (!password) throw new Error('Password is required')
  
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { password })
    
    // Create a new PDF without encryption by copying pages
    const newPdf = await PDFDocument.create()
    const pageIndices = pdf.getPageIndices()
    const copiedPages = await newPdf.copyPages(pdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))
    
    // Copy metadata if possible
    try {
      const title = pdf.getTitle()
      if (title) newPdf.setTitle(title)
    } catch {}
    
    try {
      const author = pdf.getAuthor()
      if (author) newPdf.setAuthor(author)
    } catch {}
    
    const pdfBytes = await newPdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password') || error.name === 'PDFPasswordException') {
      throw new Error('Incorrect password')
    }
    throw new Error(`Remove password protection failed: ${error.message || String(error)}`)
  }
}

/**
 * Compresses a PDF by optimizing resources
 */
export async function compressPdf(
  file: File,
  quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<Blob> {
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    
    // pdf-lib doesn't have built-in compression, but we can use save options
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    
    // Quality settings affect file size
    const saveOptions: any = {
      useObjectStreams: true, // Enable object streams for compression
    }
    
    if (quality === 'low') {
      saveOptions.compress = true
    }
    
    const pdfBytes = await pdf.save(saveOptions)
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Compress failed: ${error.message || String(error)}`)
  }
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    saveAs(blob, filename)
  } catch (error) {
    // Fallback to manual download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
}

/**
 * Gets PDF metadata
 */
export async function getPdfMetadata(file: File): Promise<{
  title?: string
  author?: string
  subject?: string
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
  pageCount: number
  fileSize: number
}> {
  const validation = validateFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file')

  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    
    const pageCount = pdf.getPageCount()
    const metadata: any = {
      pageCount,
      fileSize: file.size
    }
    
    try {
      const title = pdf.getTitle()
      if (title) metadata.title = title
    } catch {}
    
    try {
      const author = pdf.getAuthor()
      if (author) metadata.author = author
    } catch {}
    
    try {
      const subject = pdf.getSubject()
      if (subject) metadata.subject = subject
    } catch {}
    
    try {
      const creator = pdf.getCreator()
      if (creator) metadata.creator = creator
    } catch {}
    
    try {
      const producer = pdf.getProducer()
      if (producer) metadata.producer = producer
    } catch {}
    
    try {
      const creationDate = pdf.getCreationDate()
      if (creationDate) metadata.creationDate = creationDate
    } catch {}
    
    try {
      const modificationDate = pdf.getModificationDate()
      if (modificationDate) metadata.modificationDate = modificationDate
    } catch {}
    
    return metadata
  } catch (error: any) {
    if (error.message?.includes('password')) {
      throw new Error('PDF is password-protected. Please unlock it first.')
    }
    throw new Error(`Get metadata failed: ${error.message || String(error)}`)
  }
}

/**
 * Creates a blank PDF
 */
export async function createBlankPdf(
  width: number = 612,
  height: number = 792,
  pageCount: number = 1
): Promise<Blob> {
  if (width <= 0 || height <= 0) throw new Error('Dimensions must be positive')
  if (pageCount < 1) throw new Error('Page count must be at least 1')
  if (pageCount > 1000) throw new Error('Page count cannot exceed 1000')

  try {
    const pdf = await PDFDocument.create()
    
    for (let i = 0; i < pageCount; i++) {
      pdf.addPage([width, height])
    }
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    throw new Error(`Create blank PDF failed: ${error.message || String(error)}`)
  }
}

/**
 * Creates a PDF from text
 */
export async function createPdfFromText(
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
    
    let font: PDFFont
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
    
    const page = pdf.addPage(pageSize)
    const { width, height } = page.getSize()
    const maxWidth = width - margins.left - margins.right
    const maxHeight = height - margins.top - margins.bottom
    
    let y = height - margins.top
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (y < margins.bottom) {
        // Add new page
        const newPage = pdf.addPage(pageSize)
        y = height - margins.top
      }
      
      page.drawText(line, {
        x: margins.left,
        y: y - fontSize,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
        maxWidth: maxWidth,
      })
      
      y -= fontSize * 1.5 // Line height
    }
    
    const pdfBytes = await pdf.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (error: any) {
    throw new Error(`Create PDF from text failed: ${error.message || String(error)}`)
  }
}

export { ensurePdfWorker }
