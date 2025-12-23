package com.pdfapplication.pdfapplication.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Service for converting PDF documents to other formats and vice versa.
 * Supports conversion to/from images (PNG, JPG), text (TXT), and Word documents (DOCX).
 */
@Service
public class PdfConverter {

    /**
     * Converts a PDF to PNG images (one per page).
     * 
     * @param input Input stream containing the PDF document
     * @param dpi Resolution for rendering (default: 150 DPI)
     * @return List of PNG images as byte arrays, one per page
     * @throws IOException if PDF processing fails
     */
    public List<byte[]> convertToPng(InputStream input, int dpi) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }
        if (dpi < 72 || dpi > 600) {
            throw new IllegalArgumentException("DPI must be between 72 and 600");
        }

        PDDocument document = null;
        List<byte[]> images = new ArrayList<>();
        
        try {
            document = PDDocument.load(input);
            PDFRenderer renderer = new PDFRenderer(document);
            int pageCount = document.getNumberOfPages();
            
            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, dpi);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(image, "PNG", baos);
                images.add(baos.toByteArray());
            }
            
            return images;
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert PDF to PNG: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts a PDF to PNG images with default DPI (150).
     */
    public List<byte[]> convertToPng(InputStream input) throws IOException {
        return convertToPng(input, 150);
    }

    /**
     * Converts a PDF to JPG images (one per page).
     * 
     * @param input Input stream containing the PDF document
     * @param dpi Resolution for rendering (default: 150 DPI)
     * @param quality JPEG quality (0.0 to 1.0, default: 0.9)
     * @return List of JPG images as byte arrays, one per page
     * @throws IOException if PDF processing fails
     */
    public List<byte[]> convertToJpg(InputStream input, int dpi, float quality) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }
        if (dpi < 72 || dpi > 600) {
            throw new IllegalArgumentException("DPI must be between 72 and 600");
        }
        if (quality < 0.0f || quality > 1.0f) {
            throw new IllegalArgumentException("Quality must be between 0.0 and 1.0");
        }

        PDDocument document = null;
        List<byte[]> images = new ArrayList<>();
        
        try {
            document = PDDocument.load(input);
            PDFRenderer renderer = new PDFRenderer(document);
            int pageCount = document.getNumberOfPages();
            
            // Convert RGB images to JPG-compatible format
            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, dpi);
                
                // Convert to RGB if necessary (JPG doesn't support transparency)
                BufferedImage rgbImage;
                if (image.getType() == BufferedImage.TYPE_INT_RGB) {
                    rgbImage = image;
                } else {
                    rgbImage = new BufferedImage(
                        image.getWidth(), 
                        image.getHeight(), 
                        BufferedImage.TYPE_INT_RGB
                    );
                    java.awt.Graphics2D g = rgbImage.createGraphics();
                    g.drawImage(image, 0, 0, null);
                    g.dispose();
                }
                
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
                javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(baos);
                writer.setOutput(ios);
                
                javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                if (param.canWriteCompressed()) {
                    param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                    param.setCompressionQuality(quality);
                }
                
                writer.write(null, new javax.imageio.IIOImage(rgbImage, null, null), param);
                writer.dispose();
                ios.close();
                
                images.add(baos.toByteArray());
            }
            
            return images;
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert PDF to JPG: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts a PDF to JPG images with default settings (150 DPI, 0.9 quality).
     */
    public List<byte[]> convertToJpg(InputStream input) throws IOException {
        return convertToJpg(input, 150, 0.9f);
    }

    /**
     * Converts a PDF to plain text.
     * 
     * @param input Input stream containing the PDF document
     * @return Text content as byte array
     * @throws IOException if PDF processing fails
     */
    public byte[] convertToText(InputStream input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        PDDocument document = null;
        
        try {
            document = PDDocument.load(input);
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            return text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert PDF to text: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts a PDF to a Word document (DOCX).
     * 
     * @param input Input stream containing the PDF document
     * @return DOCX document as byte array
     * @throws IOException if PDF processing fails
     */
    public byte[] convertToDocx(InputStream input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        PDDocument document = null;
        XWPFDocument docx = null;
        
        try {
            document = PDDocument.load(input);
            docx = new XWPFDocument();
            
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            
            // Split text into paragraphs (by double newlines or page breaks)
            String[] paragraphs = text.split("\\n\\s*\\n|\\f");
            
            for (String paraText : paragraphs) {
                paraText = paraText.trim();
                if (!paraText.isEmpty()) {
                    XWPFParagraph paragraph = docx.createParagraph();
                    XWPFRun run = paragraph.createRun();
                    run.setText(paraText);
                }
            }
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            docx.write(baos);
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert PDF to DOCX: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
            if (docx != null) {
                try {
                    docx.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Creates a ZIP file from a list of image byte arrays.
     */
    public byte[] createZipFromImages(List<byte[]> images, String baseFilename, String extension) throws IOException {
        ByteArrayOutputStream zipOutputStream = new ByteArrayOutputStream();
        
        try (ZipOutputStream zos = new ZipOutputStream(zipOutputStream)) {
            for (int i = 0; i < images.size(); i++) {
                byte[] image = images.get(i);
                String entryName = baseFilename + "_page" + (i + 1) + "." + extension;
                
                ZipEntry entry = new ZipEntry(entryName);
                zos.putNextEntry(entry);
                zos.write(image);
                zos.closeEntry();
            }
        }
        
        return zipOutputStream.toByteArray();
    }

    // ========== REVERSE CONVERSION: FROM OTHER FORMATS TO PDF ==========

    /**
     * Converts an image (PNG or JPG) to PDF.
     * 
     * @param input Input stream containing the image
     * @param imageFormat Image format ("png" or "jpg")
     * @return PDF document as byte array
     * @throws IOException if image processing fails
     */
    public byte[] convertImageToPdf(InputStream input, String imageFormat) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }
        if (imageFormat == null || (!imageFormat.equalsIgnoreCase("png") && !imageFormat.equalsIgnoreCase("jpg") && !imageFormat.equalsIgnoreCase("jpeg"))) {
            throw new IllegalArgumentException("Image format must be PNG or JPG");
        }

        PDDocument document = null;
        
        try {
            // Read image bytes first
            byte[] imageBytes = inputToByteArray(input);
            BufferedImage image = ImageIO.read(new java.io.ByteArrayInputStream(imageBytes));
            if (image == null) {
                throw new IOException("Could not read image from input stream");
            }

            document = new PDDocument();
            PDPage page = new PDPage(new PDRectangle(image.getWidth(), image.getHeight()));
            document.addPage(page);

            String format = imageFormat.equalsIgnoreCase("png") ? "png" : "jpg";
            PDImageXObject pdImage = PDImageXObject.createFromByteArray(document, imageBytes, format);
            
            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.drawImage(pdImage, 0, 0, image.getWidth(), image.getHeight());
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert image to PDF: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts multiple images (from a ZIP file) to a single PDF.
     * Each image becomes a page in the PDF.
     * 
     * @param zipInput Input stream containing a ZIP file with images
     * @return PDF document as byte array
     * @throws IOException if processing fails
     */
    public byte[] convertImagesZipToPdf(InputStream zipInput) throws IOException {
        if (zipInput == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        PDDocument document = null;
        List<BufferedImage> images = new ArrayList<>();
        
        try {
            // Extract images from ZIP
            try (ZipInputStream zis = new ZipInputStream(zipInput)) {
                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    if (!entry.isDirectory()) {
                        String name = entry.getName().toLowerCase();
                        if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            byte[] buffer = new byte[8192];
                            int len;
                            while ((len = zis.read(buffer)) > 0) {
                                baos.write(buffer, 0, len);
                            }
                            BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(baos.toByteArray()));
                            if (img != null) {
                                images.add(img);
                            }
                        }
                    }
                    zis.closeEntry();
                }
            }

            if (images.isEmpty()) {
                throw new IOException("No valid images found in ZIP file");
            }

            document = new PDDocument();
            
            for (BufferedImage image : images) {
                PDPage page = new PDPage(new PDRectangle(image.getWidth(), image.getHeight()));
                document.addPage(page);

                ByteArrayOutputStream imgBaos = new ByteArrayOutputStream();
                String format = image.getType() == BufferedImage.TYPE_INT_ARGB || 
                               image.getType() == BufferedImage.TYPE_4BYTE_ABGR ? "png" : "jpg";
                ImageIO.write(image, format, imgBaos);
                
                PDImageXObject pdImage = PDImageXObject.createFromByteArray(document, 
                    imgBaos.toByteArray(), format);
                
                try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                    contentStream.drawImage(pdImage, 0, 0, image.getWidth(), image.getHeight());
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert images to PDF: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts a Word document (DOCX) to PDF.
     * 
     * @param input Input stream containing the DOCX document
     * @return PDF document as byte array
     * @throws IOException if conversion fails
     */
    public byte[] convertDocxToPdf(InputStream input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        XWPFDocument docx = null;
        PDDocument document = null;
        
        try {
            docx = new XWPFDocument(input);
            document = new PDDocument();
            
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            
            float margin = 50;
            float yPosition = page.getMediaBox().getHeight() - margin;
            float pageWidth = page.getMediaBox().getWidth() - (2 * margin);
            
            PDType1Font font = PDType1Font.HELVETICA;
            float fontSize = 12;
            float lineHeight = fontSize * 1.2f;
            
            PDPageContentStream contentStream = new PDPageContentStream(document, page);
            contentStream.setFont(font, fontSize);
            contentStream.beginText();
            contentStream.newLineAtOffset(margin, yPosition);
            
            for (XWPFParagraph paragraph : docx.getParagraphs()) {
                String text = paragraph.getText();
                if (text == null || text.trim().isEmpty()) {
                    yPosition -= lineHeight;
                    if (yPosition < margin) {
                        contentStream.endText();
                        contentStream.close();
                        
                        page = new PDPage(PDRectangle.A4);
                        document.addPage(page);
                        yPosition = page.getMediaBox().getHeight() - margin;
                        contentStream = new PDPageContentStream(document, page);
                        contentStream.setFont(font, fontSize);
                        contentStream.beginText();
                        contentStream.newLineAtOffset(margin, yPosition);
                    } else {
                        contentStream.newLineAtOffset(0, -lineHeight);
                    }
                    continue;
                }
                
                // Simple word wrapping
                String[] words = text.split("\\s+");
                float currentX = margin;
                
                for (String word : words) {
                    float wordWidth = font.getStringWidth(word + " ") / 1000 * fontSize;
                    
                    if (currentX + wordWidth > pageWidth + margin) {
                        yPosition -= lineHeight;
                        currentX = margin;
                        
                        if (yPosition < margin) {
                            contentStream.endText();
                            contentStream.close();
                            
                            page = new PDPage(PDRectangle.A4);
                            document.addPage(page);
                            yPosition = page.getMediaBox().getHeight() - margin;
                            contentStream = new PDPageContentStream(document, page);
                            contentStream.setFont(font, fontSize);
                            contentStream.beginText();
                            contentStream.newLineAtOffset(margin, yPosition);
                        } else {
                            contentStream.newLineAtOffset(-(currentX - margin), -lineHeight);
                        }
                    }
                    
                    contentStream.showText(word + " ");
                    currentX += wordWidth;
                }
                
                yPosition -= lineHeight;
                if (yPosition < margin) {
                    contentStream.endText();
                    contentStream.close();
                    
                    page = new PDPage(PDRectangle.A4);
                    document.addPage(page);
                    yPosition = page.getMediaBox().getHeight() - margin;
                    contentStream = new PDPageContentStream(document, page);
                    contentStream.setFont(font, fontSize);
                    contentStream.beginText();
                    contentStream.newLineAtOffset(margin, yPosition);
                } else {
                    contentStream.newLineAtOffset(-(currentX - margin), -lineHeight);
                }
            }
            
            contentStream.endText();
            contentStream.close();
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert DOCX to PDF: " + e.getMessage(), e);
        } finally {
            if (docx != null) {
                try {
                    docx.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Converts plain text to PDF.
     * 
     * @param input Input stream containing the text
     * @return PDF document as byte array
     * @throws IOException if conversion fails
     */
    public byte[] convertTextToPdf(InputStream input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        PDDocument document = null;
        
        try {
            String text = new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            
            document = new PDDocument();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            
            float margin = 50;
            float yPosition = page.getMediaBox().getHeight() - margin;
            float pageWidth = page.getMediaBox().getWidth() - (2 * margin);
            
            PDType1Font font = PDType1Font.HELVETICA;
            float fontSize = 12;
            float lineHeight = fontSize * 1.2f;
            
            PDPageContentStream contentStream = new PDPageContentStream(document, page);
            contentStream.setFont(font, fontSize);
            contentStream.beginText();
            contentStream.newLineAtOffset(margin, yPosition);
            
            String[] lines = text.split("\n");
            
            for (String line : lines) {
                if (line.trim().isEmpty()) {
                    yPosition -= lineHeight;
                    if (yPosition < margin) {
                        contentStream.endText();
                        contentStream.close();
                        
                        page = new PDPage(PDRectangle.A4);
                        document.addPage(page);
                        yPosition = page.getMediaBox().getHeight() - margin;
                        contentStream = new PDPageContentStream(document, page);
                        contentStream.setFont(font, fontSize);
                        contentStream.beginText();
                        contentStream.newLineAtOffset(margin, yPosition);
                    } else {
                        contentStream.newLineAtOffset(0, -lineHeight);
                    }
                    continue;
                }
                
                // Simple word wrapping
                String[] words = line.split("\\s+");
                float currentX = margin;
                
                for (String word : words) {
                    float wordWidth = font.getStringWidth(word + " ") / 1000 * fontSize;
                    
                    if (currentX + wordWidth > pageWidth + margin) {
                        yPosition -= lineHeight;
                        currentX = margin;
                        
                        if (yPosition < margin) {
                            contentStream.endText();
                            contentStream.close();
                            
                            page = new PDPage(PDRectangle.A4);
                            document.addPage(page);
                            yPosition = page.getMediaBox().getHeight() - margin;
                            contentStream = new PDPageContentStream(document, page);
                            contentStream.setFont(font, fontSize);
                            contentStream.beginText();
                            contentStream.newLineAtOffset(margin, yPosition);
                        } else {
                            contentStream.newLineAtOffset(-(currentX - margin), -lineHeight);
                        }
                    }
                    
                    contentStream.showText(word + " ");
                    currentX += wordWidth;
                }
                
                yPosition -= lineHeight;
                if (yPosition < margin) {
                    contentStream.endText();
                    contentStream.close();
                    
                    page = new PDPage(PDRectangle.A4);
                    document.addPage(page);
                    yPosition = page.getMediaBox().getHeight() - margin;
                    contentStream = new PDPageContentStream(document, page);
                    contentStream.setFont(font, fontSize);
                    contentStream.beginText();
                    contentStream.newLineAtOffset(margin, yPosition);
                } else {
                    contentStream.newLineAtOffset(-(currentX - margin), -lineHeight);
                }
            }
            
            contentStream.endText();
            contentStream.close();
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Failed to convert text to PDF: " + e.getMessage(), e);
        } finally {
            if (document != null) {
                try {
                    document.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Helper method to convert InputStream to byte array.
     */
    private byte[] inputToByteArray(InputStream input) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int len;
        while ((len = input.read(buffer)) > 0) {
            baos.write(buffer, 0, len);
        }
        return baos.toByteArray();
    }
}

