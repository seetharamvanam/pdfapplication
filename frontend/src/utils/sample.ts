import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function createSamplePdf(name = 'sample.pdf', text = 'This is a sample PDF for demo purposes.') {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([600, 800])
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontSize = 18
  page.drawText(text, {
    x: 50,
    y: 700,
    size: fontSize,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  try {
    return new File([blob], name, { type: 'application/pdf' })
  } catch (e) {
    const f: any = blob
    f.name = name
    return f as File
  }
}
