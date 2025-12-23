package com.pdfapplication.pdfapplication.controller;

import com.pdfapplication.pdfapplication.service.PdfConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ConvertController {

    private final PdfConverter pdfConverter;

    @Autowired
    public ConvertController(PdfConverter pdfConverter) {
        this.pdfConverter = pdfConverter;
    }

    /**
     * Converts a PDF to PNG images (one per page).
     * Returns a ZIP file containing all PNG images.
     */
    @PostMapping(path = "/convert/png", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertToPng(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "dpi", required = false, defaultValue = "150") int dpi) {
        
        return handleImageConversion(file, "png", dpi, 0.0f);
    }

    /**
     * Converts a PDF to JPG images (one per page).
     * Returns a ZIP file containing all JPG images.
     */
    @PostMapping(path = "/convert/jpg", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertToJpg(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "dpi", required = false, defaultValue = "150") int dpi,
            @RequestParam(value = "quality", required = false, defaultValue = "0.9") float quality) {
        
        return handleImageConversion(file, "jpg", dpi, quality);
    }

    /**
     * Converts a PDF to plain text.
     * Returns a TXT file.
     */
    @PostMapping(path = "/convert/txt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertToText(@RequestParam("file") MultipartFile file) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is a PDF
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("File must be a PDF document. Found: " + contentType).getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] textBytes = pdfConverter.convertToText(file.getInputStream());

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            String filename = getBaseFilename(file.getOriginalFilename()) + ".txt";
            headers.setContentDispositionFormData("attachment", filename);
            headers.setContentLength(textBytes.length);

            return ResponseEntity.ok().headers(headers).body(textBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert PDF to text: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Converts a PDF to a Word document (DOCX).
     * Returns a DOCX file.
     */
    @PostMapping(path = "/convert/docx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertToDocx(@RequestParam("file") MultipartFile file) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is a PDF
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("File must be a PDF document. Found: " + contentType).getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] docxBytes = pdfConverter.convertToDocx(file.getInputStream());

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            String filename = getBaseFilename(file.getOriginalFilename()) + ".docx";
            headers.setContentDispositionFormData("attachment", filename);
            headers.setContentLength(docxBytes.length);

            return ResponseEntity.ok().headers(headers).body(docxBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert PDF to DOCX: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Helper method to handle image conversion (PNG or JPG).
     */
    private ResponseEntity<?> handleImageConversion(MultipartFile file, String format, int dpi, float quality) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is a PDF
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("File must be a PDF document. Found: " + contentType).getBytes(StandardCharsets.UTF_8));
        }

        try {
            List<byte[]> images;
            if ("png".equalsIgnoreCase(format)) {
                images = pdfConverter.convertToPng(file.getInputStream(), dpi);
            } else {
                images = pdfConverter.convertToJpg(file.getInputStream(), dpi, quality);
            }

            // Validate result
            if (images == null || images.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Conversion produced no results".getBytes(StandardCharsets.UTF_8));
            }

            // Create ZIP file containing all images
            byte[] zipBytes = pdfConverter.createZipFromImages(images, getBaseFilename(file.getOriginalFilename()), format);

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            String zipFilename = getBaseFilename(file.getOriginalFilename()) + "_" + format.toUpperCase() + ".zip";
            headers.setContentDispositionFormData("attachment", zipFilename);
            headers.setContentLength(zipBytes.length);

            return ResponseEntity.ok().headers(headers).body(zipBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert PDF to " + format.toUpperCase() + ": " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    // ========== REVERSE CONVERSION: FROM OTHER FORMATS TO PDF ==========

    /**
     * Converts an image (PNG or JPG) to PDF.
     * Returns a PDF file.
     */
    @PostMapping(path = "/convert/from/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertImageToPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "format", required = false, defaultValue = "auto") String format) {
        
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Detect format from filename or content type
        String detectedFormat = format;
        if ("auto".equals(format)) {
            String filename = file.getOriginalFilename();
            String contentType = file.getContentType();
            
            if (filename != null) {
                String lowerName = filename.toLowerCase();
                if (lowerName.endsWith(".png")) {
                    detectedFormat = "png";
                } else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
                    detectedFormat = "jpg";
                }
            }
            
            if (detectedFormat == null && contentType != null) {
                if (contentType.contains("png")) {
                    detectedFormat = "png";
                } else if (contentType.contains("jpeg") || contentType.contains("jpg")) {
                    detectedFormat = "jpg";
                }
            }
            
            if (detectedFormat == null) {
                detectedFormat = "jpg"; // Default
            }
        }

        if (!detectedFormat.equalsIgnoreCase("png") && !detectedFormat.equalsIgnoreCase("jpg")) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Unsupported image format. Only PNG and JPG are supported.".getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] pdfBytes = pdfConverter.convertImageToPdf(file.getInputStream(), detectedFormat);

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String filename = getBaseFilename(file.getOriginalFilename()) + ".pdf";
            headers.setContentDispositionFormData("attachment", filename);
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok().headers(headers).body(pdfBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert image to PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Converts multiple images (from a ZIP file) to a single PDF.
     * Each image becomes a page in the PDF.
     */
    @PostMapping(path = "/convert/from/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertImagesZipToPdf(@RequestParam("file") MultipartFile file) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is a ZIP
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean isZip = (contentType != null && contentType.contains("zip")) ||
                       (filename != null && filename.toLowerCase().endsWith(".zip"));
        
        if (!isZip) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("File must be a ZIP archive containing images.".getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] pdfBytes = pdfConverter.convertImagesZipToPdf(file.getInputStream());

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String pdfFilename = getBaseFilename(file.getOriginalFilename()) + ".pdf";
            headers.setContentDispositionFormData("attachment", pdfFilename);
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok().headers(headers).body(pdfBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert images to PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Converts a Word document (DOCX) to PDF.
     * Returns a PDF file.
     */
    @PostMapping(path = "/convert/from/docx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertDocxToPdf(@RequestParam("file") MultipartFile file) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is a DOCX
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean isDocx = (contentType != null && contentType.contains("wordprocessingml")) ||
                        (filename != null && filename.toLowerCase().endsWith(".docx"));
        
        if (!isDocx) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("File must be a DOCX document.".getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] pdfBytes = pdfConverter.convertDocxToPdf(file.getInputStream());

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String pdfFilename = getBaseFilename(file.getOriginalFilename()) + ".pdf";
            headers.setContentDispositionFormData("attachment", pdfFilename);
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok().headers(headers).body(pdfBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert DOCX to PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Converts plain text to PDF.
     * Returns a PDF file.
     */
    @PostMapping(path = "/convert/from/txt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> convertTextToPdf(@RequestParam("file") MultipartFile file) {
        // Validate input
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No file provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that file is text
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean isText = (contentType != null && contentType.contains("text")) ||
                        (filename != null && filename.toLowerCase().endsWith(".txt"));
        
        if (!isText) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("File must be a text file (TXT).".getBytes(StandardCharsets.UTF_8));
        }

        try {
            byte[] pdfBytes = pdfConverter.convertTextToPdf(file.getInputStream());

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            String pdfFilename = getBaseFilename(file.getOriginalFilename()) + ".pdf";
            headers.setContentDispositionFormData("attachment", pdfFilename);
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok().headers(headers).body(pdfBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to convert text to PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Extracts base filename without extension.
     */
    private String getBaseFilename(String filename) {
        if (filename == null || filename.isEmpty()) {
            return "document";
        }
        
        int lastDot = filename.lastIndexOf('.');
        if (lastDot > 0) {
            return filename.substring(0, lastDot);
        }
        return filename;
    }
}

