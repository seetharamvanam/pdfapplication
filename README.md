# PDF Application

A comprehensive, full-featured PDF manipulation tool built with React and Spring Boot. Perform various PDF operations including merge, split, compress, convert, edit, and view PDFs—all in your browser with no signup required.

## 🚀 Features

### Core Operations
- **Merge PDFs**: Combine multiple PDF files into a single document
- **Split & Extract**: Split large PDFs into smaller files or extract specific pages
- **Compress**: Reduce PDF file size while preserving quality and readability
- **Convert**: Convert PDFs to/from various formats:
  - PDF → PNG/JPG (images)
  - PDF → TXT (text extraction)
  - PDF → DOCX (Word documents)
  - Images/Text/Word → PDF
- **Edit & Annotate**: Full-featured in-browser PDF editor with:
  - Text editing (add, move, edit text with font controls)
  - Pen tool for freehand drawing
  - Image insertion
  - Page management (reorder, delete, rotate pages)
  - Find and replace functionality
  - Undo/redo support
  - Continuous scrolling navigation
- **View**: Fast in-browser PDF viewer
- **Secure**: Add passwords and permissions to PDFs

### Key Highlights
- ✅ **100% Client-Side Editing**: PDF editing happens entirely in your browser—no server uploads
- ✅ **No Signup Required**: Use all features without creating an account
- ✅ **Privacy-First**: Your files never leave your device for editing operations
- ✅ **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS
- ✅ **Fast & Efficient**: Optimized for large PDFs and batch operations

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **PDF.js** - PDF rendering and viewing
- **PDF-lib** - PDF manipulation and editing

### Backend
- **Spring Boot 4.0** - Java framework
- **Apache PDFBox** - PDF processing
- **Apache POI** - Document conversion (Word, etc.)
- **Java 17** - Runtime

## 📁 Project Structure

```
pdfapplication/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── EditBoard.tsx # Main PDF editor component
│   │   │   ├── MergeBoard.tsx
│   │   │   ├── PdfViewer.tsx
│   │   │   └── ...
│   │   ├── pages/            # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── Edit.tsx
│   │   │   ├── Merge.tsx
│   │   │   ├── Split.tsx
│   │   │   ├── Compress.tsx
│   │   │   ├── Convert.tsx
│   │   │   └── ...
│   │   └── utils/            # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Spring Boot backend
│   ├── src/main/java/
│   │   └── com/pdfapplication/
│   │       ├── controller/   # REST controllers
│   │       ├── service/      # Business logic
│   │       └── config/       # Configuration
│   └── build.gradle
└── .github/
    └── workflows/
        └── deploy-frontend.yml  # CI/CD for GitHub Pages
```

## 🚦 Getting Started

### Prerequisites
- **Node.js** 20+ (for frontend)
- **Java 17+** (for backend)
- **Gradle** (included via wrapper)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdfapplication
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Build backend** (optional, for server-side operations)
   ```bash
   cd ../backend
   ./gradlew build
   ```

### Running the Application

#### Frontend Only (Client-Side Operations)
For editing, viewing, and other client-side operations:
```bash
cd frontend
npm run dev
```
The app will be available at `http://localhost:5173`

#### Full Stack (With Backend)
For operations requiring server-side processing (merge, split, compress, convert):

1. **Start the backend**
   ```bash
   cd backend
   ./gradlew bootRun
   ```
   Backend runs on `http://localhost:8080`

2. **Start the frontend** (in a separate terminal)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on `http://localhost:5173` and proxies API requests to the backend

## 📖 Usage

### Edit PDF
1. Navigate to the Edit page
2. Upload a PDF file or use a sample PDF
3. Use the toolbar to:
   - **Select tool**: Click and drag text/images to move them
   - **Text tool**: Click anywhere to add text boxes
   - **Pen tool**: Draw freehand annotations
   - **Image tool**: Insert images from your device
4. Adjust colors, fonts, and sizes using the toolbar controls
5. Use page controls to rotate, reorder, or delete pages
6. Click "Download edited PDF" to save your changes

### Merge PDFs
1. Go to the Merge page
2. Upload multiple PDF files
3. Reorder files by dragging
4. Click "Merge PDFs" to combine them
5. Download the merged file

### Split PDF
1. Navigate to Split page
2. Upload a PDF file
3. Choose split method (by page ranges or extract specific pages)
4. Download the split files

### Compress PDF
1. Go to Compress page
2. Upload a PDF
3. Adjust compression settings
4. Download the compressed file

### Convert PDF
1. Navigate to Convert page
2. Choose conversion direction (PDF to other formats or vice versa)
3. Upload file(s)
4. Configure conversion options (DPI, quality, etc.)
5. Download the converted file(s)

## 🏗️ Development

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```
Output: `frontend/dist/`

**Backend:**
```bash
cd backend
./gradlew build
```
Output: `backend/build/libs/`

### Code Structure

#### Frontend Components
- **EditBoard.tsx**: Core PDF editor with canvas rendering, overlay management, and export functionality
- **MergeBoard.tsx**: Handles PDF merging UI and file management
- **PdfViewer.tsx**: PDF.js-based viewer component

#### Backend Services
- **PdfMerger**: Combines multiple PDFs
- **PdfSplitter**: Splits PDFs by pages
- **PdfCompressor**: Compresses PDF files
- **PdfConverter**: Handles format conversions

### Testing

**Frontend:**
```bash
cd frontend
npm run lint
```

**Backend:**
```bash
cd backend
./gradlew test
```

## 🚢 Deployment

### GitHub Pages (Frontend)
The project includes a GitHub Actions workflow that automatically deploys the frontend to GitHub Pages when changes are pushed to the `main` branch.

**Manual deployment:**
1. Build the frontend: `cd frontend && npm run build`
2. Configure GitHub Pages to serve from `frontend/dist` or use the included workflow

### Backend Deployment
The backend can be deployed as a standalone Spring Boot application:
```bash
cd backend
./gradlew bootJar
java -jar build/libs/pdfapplication-0.0.1-SNAPSHOT.jar
```

## 🎯 Roadmap

Planned features:
- [ ] Full annotation & markup suite (highlights, shapes, notes, stamps)
- [ ] Form support (view/fill/edit PDF forms)
- [ ] E-signature workflows
- [ ] Redaction and sanitization tools
- [ ] OCR for scanned documents
- [ ] Compare/combine/organize capabilities
- [ ] Accessibility and tagging helpers
- [ ] Security/permissions controls
- [ ] Automation hooks and presets

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering
- [PDF-lib](https://pdf-lib.js.org/) - PDF manipulation
- [Apache PDFBox](https://pdfbox.apache.org/) - Server-side PDF processing
- [Spring Boot](https://spring.io/projects/spring-boot) - Backend framework

---

**Made with ❤️ for easy PDF management**

