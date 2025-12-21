package com.pdfapplication.pdfapplication.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Service for splitting PDF documents into multiple PDFs.
 * Uses Apache PDFBox for robust PDF handling, supporting complex PDFs with
 * fonts, images, annotations, and other advanced features.
 */
@Service
public class PdfSplitter {

    /**
     * Splits a PDF document into multiple PDFs based on page ranges.
     * Each range will produce a separate PDF document.
     * 
     * @param input Input stream containing the PDF document to split
     * @param pageRanges List of page ranges, where each range is represented as [startPage, endPage]
     *                   Pages are 1-indexed (first page is 1)
     * @return List of split PDFs as byte arrays, one for each page range
     * @throws IOException if PDF processing fails or PDF is invalid
     */
    public List<byte[]> splitByRanges(InputStream input, List<int[]> pageRanges) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }
        if (pageRanges == null || pageRanges.isEmpty()) {
            throw new IllegalArgumentException("Page ranges cannot be null or empty");
        }

        PDDocument sourceDoc = null;
        List<byte[]> splitPdfs = new ArrayList<>();
        
        try {
            // Load the source document
            sourceDoc = PDDocument.load(input);
            int totalPages = sourceDoc.getNumberOfPages();
            
            // Validate page ranges
            for (int[] range : pageRanges) {
                if (range == null || range.length != 2) {
                    throw new IllegalArgumentException("Each page range must contain exactly 2 elements [startPage, endPage]");
                }
                int startPage = range[0];
                int endPage = range[1];
                
                if (startPage < 1 || endPage < 1) {
                    throw new IllegalArgumentException("Page numbers must be 1-indexed and greater than 0");
                }
                if (startPage > endPage) {
                    throw new IllegalArgumentException("Start page (" + startPage + ") cannot be greater than end page (" + endPage + ")");
                }
                if (startPage > totalPages) {
                    throw new IllegalArgumentException("Start page (" + startPage + ") exceeds total pages (" + totalPages + ")");
                }
                // Adjust endPage if it exceeds total pages
                if (endPage > totalPages) {
                    endPage = totalPages;
                }
            }
            
            // Split the document for each range
            for (int[] range : pageRanges) {
                int startPage = range[0];
                int endPage = range[1];
                
                // Adjust endPage if it exceeds total pages
                if (endPage > totalPages) {
                    endPage = totalPages;
                }
                
                // Create a new document for this range
                PDDocument splitDoc = new PDDocument();
                
                try {
                    // Copy pages from startPage to endPage (convert to 0-indexed)
                    for (int pageNum = startPage - 1; pageNum < endPage; pageNum++) {
                        splitDoc.importPage(sourceDoc.getPage(pageNum));
                    }
                    
                    // Save to byte array
                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    splitDoc.save(outputStream);
                    splitPdfs.add(outputStream.toByteArray());
                    outputStream.close();
                    
                } finally {
                    if (splitDoc != null) {
                        try {
                            splitDoc.close();
                        } catch (IOException e) {
                            // Ignore close errors
                        }
                    }
                }
            }
            
            return splitPdfs;
            
        } catch (IOException e) {
            // Re-throw IOExceptions as-is
            throw e;
        } catch (IllegalArgumentException e) {
            // Re-throw IllegalArgumentException as-is
            throw e;
        } catch (Exception e) {
            // Wrap any other exceptions
            throw new IOException("Failed to split PDF: " + e.getMessage(), e);
        } finally {
            // Clean up: close source document
            if (sourceDoc != null) {
                try {
                    sourceDoc.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Splits a PDF document into individual pages.
     * Each page will be a separate PDF document.
     * 
     * @param input Input stream containing the PDF document to split
     * @return List of split PDFs as byte arrays, one for each page
     * @throws IOException if PDF processing fails or PDF is invalid
     */
    public List<byte[]> splitByPages(InputStream input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }

        PDDocument sourceDoc = null;
        List<byte[]> splitPdfs = new ArrayList<>();
        
        try {
            // Load the source document
            sourceDoc = PDDocument.load(input);
            int totalPages = sourceDoc.getNumberOfPages();
            
            if (totalPages == 0) {
                throw new IllegalArgumentException("PDF document has no pages");
            }
            
            // Split each page into a separate document
            for (int pageNum = 0; pageNum < totalPages; pageNum++) {
                PDDocument pageDoc = new PDDocument();
                
                try {
                    // Import the page
                    pageDoc.importPage(sourceDoc.getPage(pageNum));
                    
                    // Save to byte array
                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    pageDoc.save(outputStream);
                    splitPdfs.add(outputStream.toByteArray());
                    outputStream.close();
                    
                } finally {
                    if (pageDoc != null) {
                        try {
                            pageDoc.close();
                        } catch (IOException e) {
                            // Ignore close errors
                        }
                    }
                }
            }
            
            return splitPdfs;
            
        } catch (IOException e) {
            // Re-throw IOExceptions as-is
            throw e;
        } catch (IllegalArgumentException e) {
            // Re-throw IllegalArgumentException as-is
            throw e;
        } catch (Exception e) {
            // Wrap any other exceptions
            throw new IOException("Failed to split PDF: " + e.getMessage(), e);
        } finally {
            // Clean up: close source document
            if (sourceDoc != null) {
                try {
                    sourceDoc.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }

    /**
     * Splits a PDF document at specified page numbers.
     * The document will be split before each specified page number.
     * For example, splitting at [3, 5] will create 3 PDFs: pages 1-2, pages 3-4, and pages 5-end.
     * 
     * @param input Input stream containing the PDF document to split
     * @param splitPages List of page numbers where to split (1-indexed)
     * @return List of split PDFs as byte arrays
     * @throws IOException if PDF processing fails or PDF is invalid
     */
    public List<byte[]> splitAtPages(InputStream input, List<Integer> splitPages) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("Input stream cannot be null");
        }
        if (splitPages == null || splitPages.isEmpty()) {
            throw new IllegalArgumentException("Split pages cannot be null or empty");
        }

        PDDocument sourceDoc = null;
        List<byte[]> splitPdfs = new ArrayList<>();
        
        try {
            // Load the source document
            sourceDoc = PDDocument.load(input);
            int totalPages = sourceDoc.getNumberOfPages();
            
            if (totalPages == 0) {
                throw new IllegalArgumentException("PDF document has no pages");
            }
            
            // Sort and validate split pages
            List<Integer> sortedSplitPages = new ArrayList<>(splitPages);
            sortedSplitPages.sort(Integer::compareTo);
            
            // Remove duplicates and invalid pages
            sortedSplitPages.removeIf(page -> page < 1 || page > totalPages);
            
            if (sortedSplitPages.isEmpty()) {
                throw new IllegalArgumentException("No valid split pages provided");
            }
            
            // Build page ranges from split points and split directly
            int startPage = 1;
            
            for (int splitPage : sortedSplitPages) {
                if (splitPage > startPage) {
                    // Create a document for this range
                    PDDocument splitDoc = new PDDocument();
                    try {
                        // Copy pages from startPage to splitPage-1 (convert to 0-indexed)
                        for (int pageNum = startPage - 1; pageNum < splitPage - 1; pageNum++) {
                            splitDoc.importPage(sourceDoc.getPage(pageNum));
                        }
                        
                        // Save to byte array
                        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                        splitDoc.save(outputStream);
                        splitPdfs.add(outputStream.toByteArray());
                        outputStream.close();
                    } finally {
                        if (splitDoc != null) {
                            try {
                                splitDoc.close();
                            } catch (IOException e) {
                                // Ignore close errors
                            }
                        }
                    }
                }
                startPage = splitPage;
            }
            
            // Add the final range from last split point to end
            if (startPage <= totalPages) {
                PDDocument splitDoc = new PDDocument();
                try {
                    // Copy pages from startPage to end (convert to 0-indexed)
                    for (int pageNum = startPage - 1; pageNum < totalPages; pageNum++) {
                        splitDoc.importPage(sourceDoc.getPage(pageNum));
                    }
                    
                    // Save to byte array
                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    splitDoc.save(outputStream);
                    splitPdfs.add(outputStream.toByteArray());
                    outputStream.close();
                } finally {
                    if (splitDoc != null) {
                        try {
                            splitDoc.close();
                        } catch (IOException e) {
                            // Ignore close errors
                        }
                    }
                }
            }
            
            return splitPdfs;
            
        } catch (IOException e) {
            // Re-throw IOExceptions as-is
            throw e;
        } catch (IllegalArgumentException e) {
            // Re-throw IllegalArgumentException as-is
            throw e;
        } catch (Exception e) {
            // Wrap any other exceptions
            throw new IOException("Failed to split PDF: " + e.getMessage(), e);
        } finally {
            // Clean up: close source document
            if (sourceDoc != null) {
                try {
                    sourceDoc.close();
                } catch (IOException e) {
                    // Ignore close errors
                }
            }
        }
    }
}

