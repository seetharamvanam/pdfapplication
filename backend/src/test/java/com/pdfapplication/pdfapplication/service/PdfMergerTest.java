package com.pdfapplication.pdfapplication.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class PdfMergerTest {

    @Autowired
    private PdfMerger pdfMerger;

    @Test
    public void testMergeWithEmptyList() {
        List<InputStream> emptyList = new ArrayList<>();
        assertThrows(IllegalArgumentException.class, () -> {
            pdfMerger.merge(emptyList);
        });
    }

    @Test
    public void testMergeWithNullList() {
        assertThrows(IllegalArgumentException.class, () -> {
            pdfMerger.merge(null);
        });
    }


}

