package com.pdfapplication.pdfapplication.controller;

import com.pdfapplication.pdfapplication.service.PdfSplitter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api")
public class SplitController {

    private final PdfSplitter pdfSplitter;

    @Autowired
    public SplitController(PdfSplitter pdfSplitter) {
        this.pdfSplitter = pdfSplitter;
    }

    /**
     * Splits a PDF into individual pages.
     * Returns a ZIP file containing all split PDFs.
     */
    @PostMapping(path = "/split/pages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> splitByPages(@RequestParam("file") MultipartFile file) {
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
            // Split PDF into individual pages
            List<byte[]> splitPdfs = pdfSplitter.splitByPages(file.getInputStream());

            // Validate result
            if (splitPdfs == null || splitPdfs.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Split operation produced no results".getBytes(StandardCharsets.UTF_8));
            }

            // Create ZIP file containing all split PDFs
            byte[] zipBytes = createZipFromPdfs(splitPdfs, getBaseFilename(file.getOriginalFilename()));

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "split_pages.zip");
            headers.setContentLength(zipBytes.length);

            return ResponseEntity.ok().headers(headers).body(zipBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to split PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Splits a PDF by page ranges.
     * Expects ranges in format: "1-5,6-10,11-15" or as separate parameters.
     * Returns a ZIP file containing all split PDFs.
     */
    @PostMapping(path = "/split/ranges", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> splitByRanges(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "ranges", required = false) String rangesParam) {
        
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

        if (rangesParam == null || rangesParam.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Page ranges must be provided (e.g., '1-5,6-10')".getBytes(StandardCharsets.UTF_8));
        }

        try {
            // Parse page ranges
            List<int[]> pageRanges = parsePageRanges(rangesParam);
            
            if (pageRanges.isEmpty()) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Invalid page range format. Expected format: '1-5,6-10'".getBytes(StandardCharsets.UTF_8));
            }

            // Split PDF by ranges
            List<byte[]> splitPdfs = pdfSplitter.splitByRanges(file.getInputStream(), pageRanges);

            // Validate result
            if (splitPdfs == null || splitPdfs.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Split operation produced no results".getBytes(StandardCharsets.UTF_8));
            }

            // Create ZIP file containing all split PDFs
            byte[] zipBytes = createZipFromPdfs(splitPdfs, getBaseFilename(file.getOriginalFilename()));

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "split_ranges.zip");
            headers.setContentLength(zipBytes.length);

            return ResponseEntity.ok().headers(headers).body(zipBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to split PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Splits a PDF at specified page numbers.
     * Expects pages in format: "3,5,7" or as separate parameters.
     * Returns a ZIP file containing all split PDFs.
     */
    @PostMapping(path = "/split/at", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> splitAtPages(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "pages", required = false) String pagesParam) {
        
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

        if (pagesParam == null || pagesParam.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Split pages must be provided (e.g., '3,5,7')".getBytes(StandardCharsets.UTF_8));
        }

        try {
            // Parse split pages
            List<Integer> splitPages = parseSplitPages(pagesParam);
            
            if (splitPages.isEmpty()) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Invalid split pages format. Expected format: '3,5,7'".getBytes(StandardCharsets.UTF_8));
            }

            // Split PDF at pages
            List<byte[]> splitPdfs = pdfSplitter.splitAtPages(file.getInputStream(), splitPages);

            // Validate result
            if (splitPdfs == null || splitPdfs.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Split operation produced no results".getBytes(StandardCharsets.UTF_8));
            }

            // Create ZIP file containing all split PDFs
            byte[] zipBytes = createZipFromPdfs(splitPdfs, getBaseFilename(file.getOriginalFilename()));

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "split_at_pages.zip");
            headers.setContentLength(zipBytes.length);

            return ResponseEntity.ok().headers(headers).body(zipBytes);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to split PDF: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * Parses page ranges from a string like "1-5,6-10,11-15"
     */
    private List<int[]> parsePageRanges(String rangesParam) {
        List<int[]> ranges = new ArrayList<>();
        String[] rangeStrings = rangesParam.split(",");
        
        for (String rangeStr : rangeStrings) {
            rangeStr = rangeStr.trim();
            if (rangeStr.isEmpty()) {
                continue;
            }
            
            String[] parts = rangeStr.split("-");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid range format: " + rangeStr + ". Expected format: 'start-end'");
            }
            
            try {
                int start = Integer.parseInt(parts[0].trim());
                int end = Integer.parseInt(parts[1].trim());
                ranges.add(new int[]{start, end});
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid number in range: " + rangeStr);
            }
        }
        
        return ranges;
    }

    /**
     * Parses split pages from a string like "3,5,7"
     */
    private List<Integer> parseSplitPages(String pagesParam) {
        List<Integer> pages = new ArrayList<>();
        String[] pageStrings = pagesParam.split(",");
        
        for (String pageStr : pageStrings) {
            pageStr = pageStr.trim();
            if (pageStr.isEmpty()) {
                continue;
            }
            
            try {
                int page = Integer.parseInt(pageStr);
                pages.add(page);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid page number: " + pageStr);
            }
        }
        
        return pages;
    }

    /**
     * Creates a ZIP file from a list of PDF byte arrays
     */
    private byte[] createZipFromPdfs(List<byte[]> pdfs, String baseFilename) throws IOException {
        java.io.ByteArrayOutputStream zipOutputStream = new java.io.ByteArrayOutputStream();
        
        try (ZipOutputStream zos = new ZipOutputStream(zipOutputStream)) {
            for (int i = 0; i < pdfs.size(); i++) {
                byte[] pdf = pdfs.get(i);
                String entryName = baseFilename + "_part" + (i + 1) + ".pdf";
                
                ZipEntry entry = new ZipEntry(entryName);
                zos.putNextEntry(entry);
                zos.write(pdf);
                zos.closeEntry();
            }
        }
        
        return zipOutputStream.toByteArray();
    }

    /**
     * Extracts base filename without extension
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

