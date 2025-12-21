package com.pdfapplication.pdfapplication.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class PdfSplitterTest {

    @Autowired
    private PdfSplitter pdfSplitter;

    @Test
    public void testSplitByRangesWithNullInput() {
        List<int[]> ranges = new ArrayList<>();
        ranges.add(new int[]{1, 5});
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(null, ranges);
        });
    }

    @Test
    public void testSplitByRangesWithNullRanges() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(input, null);
        });
    }

    @Test
    public void testSplitByRangesWithEmptyRanges() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        List<int[]> emptyRanges = new ArrayList<>();
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(input, emptyRanges);
        });
    }

    @Test
    public void testSplitByRangesWithInvalidRangeFormat() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        List<int[]> invalidRanges = new ArrayList<>();
        invalidRanges.add(new int[]{1}); // Only one element
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(input, invalidRanges);
        });
    }

    @Test
    public void testSplitByRangesWithInvalidPageNumbers() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        List<int[]> invalidRanges = new ArrayList<>();
        invalidRanges.add(new int[]{0, 5}); // Start page is 0
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(input, invalidRanges);
        });
    }

    @Test
    public void testSplitByRangesWithStartGreaterThanEnd() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        List<int[]> invalidRanges = new ArrayList<>();
        invalidRanges.add(new int[]{5, 1}); // Start > End
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByRanges(input, invalidRanges);
        });
    }

    @Test
    public void testSplitByPagesWithNullInput() {
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitByPages(null);
        });
    }

    @Test
    public void testSplitAtPagesWithNullInput() {
        List<Integer> splitPages = new ArrayList<>();
        splitPages.add(3);
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitAtPages(null, splitPages);
        });
    }

    @Test
    public void testSplitAtPagesWithNullPages() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitAtPages(input, null);
        });
    }

    @Test
    public void testSplitAtPagesWithEmptyPages() {
        InputStream input = new ByteArrayInputStream(new byte[]{});
        List<Integer> emptyPages = new ArrayList<>();
        
        assertThrows(IllegalArgumentException.class, () -> {
            pdfSplitter.splitAtPages(input, emptyPages);
        });
    }

    // Note: To test actual PDF splitting, you would need sample PDF files
    // This test verifies the service is properly wired and handles edge cases
}

