package com.pdfapplication.pdfapplication.service;

import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Service for merging multiple PDF documents into a single PDF.
 * Uses Apache PDFBox for robust PDF handling, supporting complex PDFs with
 * fonts, images, annotations, and other advanced features.
 */
@Service
public class PdfMerger {

    /**
     * Merges multiple PDF input streams into a single PDF byte array.
     * 
     * @param inputs List of input streams containing PDF documents
     * @return Merged PDF as byte array
     * @throws IOException if PDF processing fails or PDFs are invalid
     */
    public byte[] merge(List<InputStream> inputs) throws IOException {
        if (inputs == null || inputs.isEmpty()) {
            throw new IllegalArgumentException("Input list cannot be null or empty");
        }

        PDDocument mergedDoc = null;
        List<PDDocument> sourceDocs = new ArrayList<>();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        
        try {
            // Create the merged document
            mergedDoc = new PDDocument();
            
            // Load all source documents
            for (InputStream input : inputs) {
                if (input == null) {
                    throw new IllegalArgumentException("Input stream cannot be null");
                }
                
                PDDocument sourceDoc = PDDocument.load(input);
                sourceDocs.add(sourceDoc);
            }
            
            // Use PDFMergerUtility to append each source document to the merged document
            PDFMergerUtility merger = new PDFMergerUtility();
            for (PDDocument sourceDoc : sourceDocs) {
                merger.appendDocument(mergedDoc, sourceDoc);
            }
            
            // Save the merged document to output stream
            mergedDoc.save(outputStream);
            
            // Return the merged PDF as byte array
            return outputStream.toByteArray();
            
        } catch (IOException e) {
            // Re-throw IOExceptions as-is
            throw e;
        } catch (Exception e) {
            // Wrap any other exceptions
            throw new IOException("Failed to merge PDFs: " + e.getMessage(), e);
        } finally {
            // Clean up: close all documents
            if (mergedDoc != null) {
                try {
                    mergedDoc.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
            
            for (PDDocument doc : sourceDocs) {
                try {
                    if (doc != null) {
                        doc.close();
                    }
                } catch (IOException e) {
                    // Ignore close errors during cleanup
                }
            }
            
            try {
                outputStream.close();
            } catch (IOException e) {
                // Ignore close errors
            }
        }
    }
}
