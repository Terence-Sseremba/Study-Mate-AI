import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { DocumentType, SourceChunk, ProcessingStatus, StudyMaterial } from '../types';

// Ensure Promise.try is available across runtime environments
if (typeof Promise !== 'undefined' && !(Promise as any).try) {
  (Promise as any).try = function (fn: (...args: any[]) => any, ...args: any[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// Configure PDF.js worker in browser environments if not already initialized
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Falls back to in-thread parsing seamlessly
  }
}

export interface FileClassification {
  fileType: DocumentType;
  fileExtension: string;
  mimeType: string;
  typeLabel: string;
  badgeLabel: string;
  isSupported: boolean;
  unsupportedReason?: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedSlide {
  slideNumber: number;
  title?: string;
  text: string;
}

export interface ExtractedSection {
  heading: string;
  text: string;
  anchorLabel: string;
}

export interface ExtractionResult {
  fileType: DocumentType;
  pageCount?: number;
  slideCount?: number;
  chunks: SourceChunk[];
  processingStatus: ProcessingStatus;
  statusMessage: string;
  extractionError?: string;
}

/**
 * 1. REAL FILE-TYPE DETECTION
 * Determines the true file type using both extension and browser File MIME type.
 * Normalizes labels and rejects unsupported files.
 */
export function classifyUploadedFile(file: File): FileClassification {
  const fileName = file.name || '';
  const lastDotIdx = fileName.lastIndexOf('.');
  const ext = lastDotIdx !== -1 ? fileName.slice(lastDotIdx).toLowerCase() : '';
  const mime = (file.type || '').toLowerCase();

  // 1. PDF
  if (ext === '.pdf' || mime === 'application/pdf') {
    return {
      fileType: 'pdf',
      fileExtension: '.pdf',
      mimeType: mime || 'application/pdf',
      typeLabel: 'PDF',
      badgeLabel: 'PDF Document',
      isSupported: true,
    };
  }

  // 2. Microsoft Word (.docx)
  if (
    ext === '.docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      fileType: 'docx',
      fileExtension: '.docx',
      mimeType: mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      typeLabel: 'Word Document',
      badgeLabel: 'Word (.docx)',
      isSupported: true,
    };
  }

  // 3. PowerPoint (.pptx, .ppt)
  if (
    ext === '.pptx' ||
    ext === '.ppt' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.ms-powerpoint'
  ) {
    return {
      fileType: 'pptx',
      fileExtension: ext || '.pptx',
      mimeType: mime || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      typeLabel: 'PowerPoint',
      badgeLabel: 'PowerPoint (.pptx)',
      isSupported: true,
    };
  }

  // 4. Markdown (.md)
  if (
    ext === '.md' ||
    ext === '.markdown' ||
    mime === 'text/markdown' ||
    mime === 'text/x-markdown'
  ) {
    return {
      fileType: 'md',
      fileExtension: '.md',
      mimeType: mime || 'text/markdown',
      typeLabel: 'Markdown',
      badgeLabel: 'Markdown (.md)',
      isSupported: true,
    };
  }

  // 5. Plain text (.txt)
  if (ext === '.txt' || mime === 'text/plain') {
    return {
      fileType: 'txt',
      fileExtension: '.txt',
      mimeType: mime || 'text/plain',
      typeLabel: 'Text',
      badgeLabel: 'Plain Text (.txt)',
      isSupported: true,
    };
  }

  // Unsupported files
  return {
    fileType: 'notes',
    fileExtension: ext || 'unknown',
    mimeType: mime || 'application/octet-stream',
    typeLabel: 'Unsupported',
    badgeLabel: ext ? ext.toUpperCase() : 'Unknown',
    isSupported: false,
    unsupportedReason: `Unsupported file type "${ext || file.name}". StudyMate AI accepts PDF textbooks (.pdf), Word documents (.docx), PowerPoint presentations (.pptx), Markdown (.md), and Plain Text (.txt).`,
  };
}

/**
 * Clean and normalize extracted text:
 * - Trims whitespace
 * - Collapses excessive blank lines
 * - Replaces non-printable control characters
 */
function cleanText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Decode common XML entities in OpenXML presentations and documents.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * 2. REAL PDF EXTRACTION (Page-by-page)
 */
export async function extractPdf(
  fileData: ArrayBuffer,
  materialId: string,
  materialTitle: string,
  filename: string
): Promise<ExtractionResult> {
  try {
    // Allocate a dedicated, unshared Uint8Array copy so structuredClone/transfer works cleanly
    const srcBytes = new Uint8Array(fileData);
    const pdfBytes = new Uint8Array(srcBytes.byteLength);
    pdfBytes.set(srcBytes);

    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    if (numPages === 0) {
      return {
        fileType: 'pdf',
        pageCount: 0,
        chunks: [],
        processingStatus: 'failed',
        statusMessage: 'PDF document contains 0 pages.',
        extractionError: 'The uploaded PDF document contains no pages or is empty.',
      };
    }

    const pages: ExtractedPage[] = [];
    let totalTextChars = 0;

    for (let pageIdx = 1; pageIdx <= numPages; pageIdx++) {
      try {
        const page = await pdfDoc.getPage(pageIdx);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        const cleaned = cleanText(pageText);

        if (cleaned.length > 0) {
          pages.push({ pageNumber: pageIdx, text: cleaned });
          totalTextChars += cleaned.length;
        } else {
          // Record empty page
          pages.push({ pageNumber: pageIdx, text: '' });
        }
      } catch (pageErr: any) {
        console.warn(`Failed extracting PDF page ${pageIdx}:`, pageErr);
        pages.push({ pageNumber: pageIdx, text: '' });
      }
    }

    if (totalTextChars === 0) {
      return {
        fileType: 'pdf',
        pageCount: numPages,
        chunks: [],
        processingStatus: 'failed',
        statusMessage: `No extractable text found across ${numPages} pages.`,
        extractionError:
          'This PDF does not contain extractable text layers. If this is a scanned document or image-only PDF, text extraction requires selectable digital text.',
      };
    }

    // Generate semantic chunks strictly from real pages
    const chunks: SourceChunk[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      if (!page.text || page.text.trim().length === 0) continue;

      // If page is reasonably sized (< 1100 chars), keep it as a coherent page chunk
      if (page.text.length <= 1100) {
        chunkIdx++;
        chunks.push({
          id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
          materialId,
          materialTitle,
          filename,
          documentType: 'pdf',
          chunkIndex: chunkIdx,
          pageNumber: page.pageNumber,
          pageOrSlideNumber: page.pageNumber,
          sectionHeading: `Page ${page.pageNumber}`,
          anchorLabel: `Page ${page.pageNumber}`,
          extractedText: page.text,
          tokenEstimate: Math.max(1, Math.round(page.text.length / 4)),
          confidenceScore: 1.0,
        });
      } else {
        // Break long pages into logical paragraphs (300-800 chars) retaining the real page anchor
        const paragraphs = page.text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
        let currentCombined = '';

        for (const para of paragraphs) {
          if (currentCombined.length + para.length > 900 && currentCombined.length > 300) {
            chunkIdx++;
            chunks.push({
              id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
              materialId,
              materialTitle,
              filename,
              documentType: 'pdf',
              chunkIndex: chunkIdx,
              pageNumber: page.pageNumber,
              pageOrSlideNumber: page.pageNumber,
              sectionHeading: `Page ${page.pageNumber}`,
              anchorLabel: `Page ${page.pageNumber}`,
              extractedText: currentCombined.trim(),
              tokenEstimate: Math.max(1, Math.round(currentCombined.length / 4)),
              confidenceScore: 1.0,
            });
            currentCombined = para;
          } else {
            currentCombined = currentCombined ? `${currentCombined}\n\n${para}` : para;
          }
        }

        if (currentCombined.trim().length > 0) {
          chunkIdx++;
          chunks.push({
            id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
            materialId,
            materialTitle,
            filename,
            documentType: 'pdf',
            chunkIndex: chunkIdx,
            pageNumber: page.pageNumber,
            pageOrSlideNumber: page.pageNumber,
            sectionHeading: `Page ${page.pageNumber}`,
            anchorLabel: `Page ${page.pageNumber}`,
            extractedText: currentCombined.trim(),
            tokenEstimate: Math.max(1, Math.round(currentCombined.length / 4)),
            confidenceScore: 1.0,
          });
        }
      }
    }

    const pagesWithText = pages.filter((p) => p.text.length > 0).length;
    const isPartial = pagesWithText < numPages;

    return {
      fileType: 'pdf',
      pageCount: numPages,
      chunks,
      processingStatus: isPartial && chunks.length > 0 ? 'partially_extracted' : 'indexed',
      statusMessage:
        isPartial && chunks.length > 0
          ? `${chunks.length} chunks indexed across ${pagesWithText}/${numPages} pages with text.`
          : `${chunks.length} chunks indexed across ${numPages} pages.`,
    };
  } catch (err: any) {
    console.error('PDF extraction error:', err);
    const isPassword =
      err?.name === 'PasswordException' ||
      (err?.message && err.message.toLowerCase().includes('password'));

    return {
      fileType: 'pdf',
      chunks: [],
      processingStatus: 'failed',
      statusMessage: isPassword
        ? 'Password-protected PDF cannot be read.'
        : 'Failed to extract text from PDF.',
      extractionError: isPassword
        ? 'This PDF is encrypted or password-protected. Please remove the password and re-upload.'
        : `Could not parse PDF: ${err?.message || 'corrupted or unrecognized PDF structure'}.`,
    };
  }
}

/**
 * 3. REAL DOCX EXTRACTION (Word Document)
 * Extracts genuine paragraphs and headings without inventing fake page numbers.
 */
export async function extractDocx(
  fileData: ArrayBuffer,
  materialId: string,
  materialTitle: string,
  filename: string
): Promise<ExtractionResult> {
  try {
    const mammothInput: any = { arrayBuffer: fileData };
    if (typeof Buffer !== 'undefined') {
      mammothInput.buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData);
    }

    const rawResult = await mammoth.extractRawText(mammothInput);
    const fullText = cleanText(rawResult.value || '');

    if (!fullText || fullText.trim().length === 0) {
      return {
        fileType: 'docx',
        chunks: [],
        processingStatus: 'failed',
        statusMessage: 'No extractable text in Word document.',
        extractionError:
          'The uploaded Word document (.docx) contains no readable paragraphs or text.',
      };
    }

    // Try HTML conversion to discover structured headings
    let sections: ExtractedSection[] = [];
    try {
      const htmlResult = await mammoth.convertToHtml(mammothInput);
      const html = htmlResult.value || '';

      // Split HTML by headings (h1, h2, h3, h4)
      const parts = html.split(/(?=<h[1-4][^>]*>)/i);
      let secIndex = 1;

      for (const part of parts) {
        if (!part.trim()) continue;

        // Extract heading text if exists
        const headingMatch = part.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
        let heading = '';
        if (headingMatch) {
          heading = cleanText(headingMatch[1].replace(/<[^>]+>/g, ''));
        }

        // Strip HTML tags for clean text
        const plainText = cleanText(part.replace(/<[^>]+>/g, ' '));
        if (plainText.length > 25) {
          sections.push({
            heading: heading || `Section ${secIndex}`,
            text: plainText,
            anchorLabel: `Word Document — ${heading || `Section ${secIndex}`}`,
          });
          secIndex++;
        }
      }
    } catch (htmlErr) {
      console.warn('DOCX HTML structuring fallback to plain paragraph split:', htmlErr);
    }

    // Fallback: If no headings were found in HTML, split full text by paragraphs
    if (sections.length === 0) {
      const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 25);
      let secIndex = 1;
      let buffer = '';

      for (const para of paragraphs) {
        if (buffer.length + para.length > 800 && buffer.length > 250) {
          sections.push({
            heading: `Section ${secIndex}`,
            text: buffer.trim(),
            anchorLabel: `Word Document — Section ${secIndex}`,
          });
          secIndex++;
          buffer = para;
        } else {
          buffer = buffer ? `${buffer}\n\n${para}` : para;
        }
      }

      if (buffer.trim().length > 0) {
        sections.push({
          heading: `Section ${secIndex}`,
          text: buffer.trim(),
          anchorLabel: `Word Document — Section ${secIndex}`,
        });
      }
    }

    // Build chunks without fake page numbers
    const chunks: SourceChunk[] = sections.map((sec, idx) => ({
      id: `chunk-${materialId}-docx-${idx + 1}`,
      materialId,
      materialTitle,
      filename,
      documentType: 'docx',
      chunkIndex: idx + 1,
      pageNumber: undefined, // Honest: no fake page number
      slideNumber: undefined,
      pageOrSlideNumber: undefined,
      sectionHeading: sec.heading,
      anchorLabel: sec.anchorLabel,
      extractedText: sec.text,
      tokenEstimate: Math.max(1, Math.round(sec.text.length / 4)),
      confidenceScore: 1.0,
    }));

    return {
      fileType: 'docx',
      chunks,
      processingStatus: 'indexed',
      statusMessage: `${chunks.length} semantic sections extracted from Word document.`,
    };
  } catch (err: any) {
    console.error('DOCX extraction error:', err);
    return {
      fileType: 'docx',
      chunks: [],
      processingStatus: 'failed',
      statusMessage: 'Failed to extract text from Word document.',
      extractionError: `Could not parse .docx file: ${err?.message || 'corrupted or unrecognized Word format'}.`,
    };
  }
}

/**
 * 4. REAL PPTX EXTRACTION (PowerPoint Slides)
 * Extracts slide-by-slide text in numerical order, retaining genuine slide numbers.
 */
export async function extractPptx(
  fileData: ArrayBuffer,
  materialId: string,
  materialTitle: string,
  filename: string
): Promise<ExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(fileData);

    // Discover all slide XML files inside ppt/slides/
    const slideFilePaths = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(path)
    );

    if (slideFilePaths.length === 0) {
      return {
        fileType: 'pptx',
        slideCount: 0,
        chunks: [],
        processingStatus: 'failed',
        statusMessage: 'PowerPoint presentation has 0 slides.',
        extractionError:
          'No slide XML files were found in this presentation. The file may be corrupt or empty.',
      };
    }

    // Sort numerically by slide number: slide1.xml, slide2.xml, ... slide10.xml
    slideFilePaths.sort((a, b) => {
      const matchA = a.match(/slide(\d+)\.xml/i);
      const matchB = b.match(/slide(\d+)\.xml/i);
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;
      return numA - numB;
    });

    const slides: ExtractedSlide[] = [];
    let totalChars = 0;

    for (const sPath of slideFilePaths) {
      const match = sPath.match(/slide(\d+)\.xml/i);
      const slideNum = match ? parseInt(match[1], 10) : slides.length + 1;

      try {
        const xml = await zip.files[sPath].async('string');

        // Extract text runs from <a:t>
        const textRuns: string[] = [];
        const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(xml)) !== null) {
          const run = decodeXmlEntities(m[1].trim());
          if (run) textRuns.push(run);
        }

        const slideText = cleanText(textRuns.join(' '));
        // Discover title from the first paragraph run if short
        const firstLine = textRuns[0] ? cleanText(textRuns[0]) : '';
        const title = firstLine && firstLine.length <= 60 ? firstLine : undefined;

        slides.push({
          slideNumber: slideNum,
          title,
          text: slideText,
        });

        totalChars += slideText.length;
      } catch (slideErr) {
        console.warn(`Failed extracting PPTX slide at ${sPath}:`, slideErr);
        slides.push({
          slideNumber: slideNum,
          text: '',
        });
      }
    }

    if (totalChars === 0) {
      return {
        fileType: 'pptx',
        slideCount: slides.length,
        chunks: [],
        processingStatus: 'failed',
        statusMessage: `No extractable text found across ${slides.length} slides.`,
        extractionError:
          'This PowerPoint file contains no text elements (e.g. slides containing only full-bleed images without text boxes).',
      };
    }

    // Build chunks preserving real slide numbers
    const chunks: SourceChunk[] = [];
    let chunkIdx = 0;

    for (const slide of slides) {
      if (!slide.text || slide.text.trim().length === 0) continue;

      chunkIdx++;
      const heading = slide.title
        ? `Slide ${slide.slideNumber}: ${slide.title}`
        : `Slide ${slide.slideNumber}`;

      chunks.push({
        id: `chunk-${materialId}-slide-${slide.slideNumber}`,
        materialId,
        materialTitle,
        filename,
        documentType: 'pptx',
        chunkIndex: chunkIdx,
        slideNumber: slide.slideNumber,
        pageOrSlideNumber: slide.slideNumber,
        pageNumber: undefined,
        sectionHeading: heading,
        anchorLabel: `Slide ${slide.slideNumber}`,
        extractedText: slide.text,
        tokenEstimate: Math.max(1, Math.round(slide.text.length / 4)),
        confidenceScore: 1.0,
      });
    }

    return {
      fileType: 'pptx',
      slideCount: slides.length,
      chunks,
      processingStatus: 'indexed',
      statusMessage: `${chunks.length} slides indexed with genuine slide numbers.`,
    };
  } catch (err: any) {
    console.error('PPTX extraction error:', err);
    return {
      fileType: 'pptx',
      chunks: [],
      processingStatus: 'failed',
      statusMessage: 'Failed to extract text from PowerPoint.',
      extractionError: `Could not parse PowerPoint presentation: ${err?.message || 'corrupted or unrecognized PPTX archive'}.`,
    };
  }
}

/**
 * 5. REAL MARKDOWN (.md) EXTRACTION
 * Preserves Markdown section headings and logical boundaries without inventing fake page numbers.
 */
export async function extractMarkdown(
  rawContent: string,
  materialId: string,
  materialTitle: string,
  filename: string
): Promise<ExtractionResult> {
  const fullText = cleanText(rawContent);

  if (!fullText || fullText.trim().length === 0) {
    return {
      fileType: 'md',
      chunks: [],
      processingStatus: 'failed',
      statusMessage: 'Markdown file is empty.',
      extractionError: 'The uploaded Markdown file (.md) contains no text.',
    };
  }

  // Split by markdown headings: #, ##, ###, ####
  const lines = fullText.split('\n');
  const sections: ExtractedSection[] = [];
  let currentHeading = 'Overview';
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (currentBuffer.join(' ').trim().length > 25) {
        sections.push({
          heading: currentHeading,
          text: cleanText(currentBuffer.join('\n')),
          anchorLabel: `Markdown — ${currentHeading}`,
        });
        currentBuffer = [];
      }
      currentHeading = headingMatch[2].trim();
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.join(' ').trim().length > 0) {
    sections.push({
      heading: currentHeading,
      text: cleanText(currentBuffer.join('\n')),
      anchorLabel: `Markdown — ${currentHeading}`,
    });
  }

  // If no headings found, split by double-newline paragraphs
  if (sections.length === 0) {
    const paras = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 25);
    paras.forEach((p, idx) => {
      sections.push({
        heading: `Section ${idx + 1}`,
        text: cleanText(p),
        anchorLabel: `Markdown — Section ${idx + 1}`,
      });
    });
  }

  const chunks: SourceChunk[] = sections.map((sec, idx) => ({
    id: `chunk-${materialId}-md-${idx + 1}`,
    materialId,
    materialTitle,
    filename,
    documentType: 'md',
    chunkIndex: idx + 1,
    pageNumber: undefined,
    slideNumber: undefined,
    pageOrSlideNumber: undefined,
    sectionHeading: sec.heading,
    anchorLabel: sec.anchorLabel,
    extractedText: sec.text,
    tokenEstimate: Math.max(1, Math.round(sec.text.length / 4)),
    confidenceScore: 1.0,
  }));

  return {
    fileType: 'md',
    chunks,
    processingStatus: 'indexed',
    statusMessage: `${chunks.length} Markdown sections indexed with source headings.`,
  };
}

/**
 * 5. REAL PLAIN TEXT (.txt) EXTRACTION
 * Splits into logical paragraphs without inventing fake page numbers.
 */
export async function extractPlainText(
  rawContent: string,
  materialId: string,
  materialTitle: string,
  filename: string
): Promise<ExtractionResult> {
  const fullText = cleanText(rawContent);

  if (!fullText || fullText.trim().length === 0) {
    return {
      fileType: 'txt',
      chunks: [],
      processingStatus: 'failed',
      statusMessage: 'Text file is empty.',
      extractionError: 'The uploaded text file (.txt) contains no readable text.',
    };
  }

  const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 25);
  const chunks: SourceChunk[] = [];
  let chunkIdx = 0;
  let buffer = '';

  for (const para of paragraphs) {
    if (buffer.length + para.length > 800 && buffer.length > 250) {
      chunkIdx++;
      chunks.push({
        id: `chunk-${materialId}-txt-${chunkIdx}`,
        materialId,
        materialTitle,
        filename,
        documentType: 'txt',
        chunkIndex: chunkIdx,
        pageNumber: undefined,
        slideNumber: undefined,
        pageOrSlideNumber: undefined,
        sectionHeading: `Chunk ${chunkIdx}`,
        anchorLabel: `Text — Chunk ${chunkIdx}`,
        extractedText: buffer.trim(),
        tokenEstimate: Math.max(1, Math.round(buffer.length / 4)),
        confidenceScore: 1.0,
      });
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  if (buffer.trim().length > 0) {
    chunkIdx++;
    chunks.push({
      id: `chunk-${materialId}-txt-${chunkIdx}`,
      materialId,
      materialTitle,
      filename,
      documentType: 'txt',
      chunkIndex: chunkIdx,
      pageNumber: undefined,
      slideNumber: undefined,
      pageOrSlideNumber: undefined,
      sectionHeading: `Chunk ${chunkIdx}`,
      anchorLabel: `Text — Chunk ${chunkIdx}`,
      extractedText: buffer.trim(),
      tokenEstimate: Math.max(1, Math.round(buffer.length / 4)),
      confidenceScore: 1.0,
    });
  }

  return {
    fileType: 'txt',
    chunks,
    processingStatus: 'indexed',
    statusMessage: `${chunks.length} text chunks indexed from document.`,
  };
}

/**
 * Universal document ingestion pipeline
 * Validates, classifies, extracts verbatim text, and returns a fully populated StudyMaterial.
 */
export async function processUploadedDocument(
  file: File,
  onProgress?: (stage: string) => void
): Promise<StudyMaterial> {
  // Check empty file
  if (file.size === 0) {
    throw new Error('The uploaded file is empty (0 bytes). Please upload a valid course document.');
  }

  // Maximum file size check (30MB)
  if (file.size > 30 * 1024 * 1024) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 30MB limit. Please upload a smaller document.`
    );
  }

  onProgress?.('Detecting file classification & MIME metadata...');
  const classification = classifyUploadedFile(file);

  if (!classification.isSupported) {
    throw new Error(
      classification.unsupportedReason || `Unsupported file format for "${file.name}".`
    );
  }

  const cleanDocTitle = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .trim();

  const materialId = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fileSizeFormatted =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;

  let extractionResult: ExtractionResult;

  if (classification.fileType === 'pdf') {
    onProgress?.('Parsing PDF binary structure and page tree...');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.('Extracting page-by-page text layers...');
    extractionResult = await extractPdf(arrayBuffer, materialId, cleanDocTitle, file.name);
  } else if (classification.fileType === 'docx') {
    onProgress?.('Unpacking Word OpenXML document archive...');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.('Extracting paragraphs and document headings...');
    extractionResult = await extractDocx(arrayBuffer, materialId, cleanDocTitle, file.name);
  } else if (classification.fileType === 'pptx') {
    onProgress?.('Unpacking PowerPoint slide XML packages...');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.('Extracting slide text elements in numerical order...');
    extractionResult = await extractPptx(arrayBuffer, materialId, cleanDocTitle, file.name);
  } else if (classification.fileType === 'md') {
    onProgress?.('Reading Markdown source and indexing section headers...');
    const text = await file.text();
    extractionResult = await extractMarkdown(text, materialId, cleanDocTitle, file.name);
  } else if (classification.fileType === 'txt') {
    onProgress?.('Reading text stream and chunking semantic paragraphs...');
    const text = await file.text();
    extractionResult = await extractPlainText(text, materialId, cleanDocTitle, file.name);
  } else {
    throw new Error(`Unsupported document type: ${classification.fileType}`);
  }

  onProgress?.('Finalizing grounding chunks and source anchors...');

  const material: StudyMaterial = {
    id: materialId,
    title: cleanDocTitle,
    filename: file.name,
    fileType: extractionResult.fileType,
    fileExtension: classification.fileExtension,
    mimeType: classification.mimeType,
    fileSizeBytes: file.size,
    fileSizeFormatted,
    pageCount: extractionResult.pageCount,
    slideCount: extractionResult.slideCount,
    chunksCount: extractionResult.chunks.length,
    uploadedAt: new Date().toISOString(),
    courseCode: 'COURSE',
    courseName: 'Course Documents',
    processingStatus: extractionResult.processingStatus,
    statusMessage: extractionResult.statusMessage,
    extractionError: extractionResult.extractionError,
    chunks: extractionResult.chunks,
    isDemoSample: false,
  };

  return material;
}
