package com.pdfapplication.pdfapplication.controller;

import com.pdfapplication.pdfapplication.service.PdfMerger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class MergeController {

    private final PdfMerger pdfMerger;

    @Autowired
    public MergeController(PdfMerger pdfMerger) {
        this.pdfMerger = pdfMerger;
    }

    @PostMapping(path = "/merge", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> merge(@RequestParam("files") MultipartFile[] files) {
        // Validate input
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("No files provided".getBytes(StandardCharsets.UTF_8));
        }

        // Validate that all files are PDFs
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("One or more files are empty".getBytes(StandardCharsets.UTF_8));
            }
            String contentType = file.getContentType();
            if (contentType == null || !contentType.equals("application/pdf")) {
                return ResponseEntity.badRequest()
                        .contentType(MediaType.TEXT_PLAIN)
                        .body(("All files must be PDF documents. Found: " + contentType).getBytes(StandardCharsets.UTF_8));
            }
        }

        try {
            // Convert MultipartFiles to InputStreams
            List<java.io.InputStream> streams = Arrays.stream(files)
                    .map(f -> {
                        try {
                            return f.getInputStream();
                        } catch (IOException e) {
                            throw new RuntimeException("Failed to read file: " + f.getOriginalFilename(), e);
                        }
                    })
                    .collect(Collectors.toList());

            // Merge PDFs
            byte[] merged = pdfMerger.merge(streams);

            // Validate merged result
            if (merged == null || merged.length == 0) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Merge operation produced an empty result".getBytes(StandardCharsets.UTF_8));
            }

            // Set response headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "merged.pdf");
            headers.setContentLength(merged.length);

            return ResponseEntity.ok().headers(headers).body(merged);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Invalid request: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Failed to merge PDFs: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(("Unexpected error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }
}
