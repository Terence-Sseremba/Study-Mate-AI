import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { DocumentType, SourceChunk, ProcessingStatus, StudyMaterial } from '../types/index.ts';

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
  return decodeXmlEntities(rawText)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
    .replace(/\b([A-Za-z])(?:\s+([a-z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
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
 * Checks whether a section heading is just a positional placeholder
 * (e.g., "Page 1", "Chunk 2", "Section 1", "Slide 3") rather than a real subject heading.
 */
export function isGenericSectionHeading(heading?: string): boolean {
  if (!heading) return true;
  const trimmed = heading.trim();
  if (!trimmed) return true;
  return /^(?:page|chunk|section|slide|part|overview|document|untitled|course\s+passage|passage|text\s*[-—–]?\s*chunk)\s*\d*$/i.test(
    trimmed
  );
}

const TRAILING_NOISE_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'with', 'and', 'or', 'by',
  'at', 'from', 'as', 'into', 'that', 'which', 'who', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'this',
  'these', 'those', 'their', 'our', 'your', 'its', 'it', 'we', 'i', 'you', 'they',
  'he', 'she', 'not', 'no', 'if', 'when', 'where', 'how', 'why', 'what',
  'there', 'here', 'like', 'then', 'than', 'also', 'only', 'even', 'still',
  'just', 'very', 'more', 'most', 'some', 'many', 'much', 'such', 'about',
  'between', 'among', 'through', 'during', 'before', 'after', 'above', 'below'
]);

/**
 * Checks whether a heading represents non-instructional frontmatter or backmatter
 * (e.g., Dedication, Table of Contents, Acknowledgments, References, Bibliography).
 */
export function isFrontmatterOrBackmatterHeading(text?: string): boolean {
  if (!text) return false;
  const cleaned = text
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(?:chapter|section|part)\s*\d*\s*[:\-–—]?\s*/i, '')
    .replace(/\s+\d{1,4}$/, '')
    .replace(/[:\-–—.]+$/, '')
    .trim();
  return /^(?:dedication|contents|table\s+of\s+contents|brief\s+contents|acknowledg(?:e)?ments?|preface|foreword|copyright(?:\s+page)?|bibliography|references|works\s+cited|literature\s+cited|further\s+reading|suggested\s+reading|index|author\s+index|subject\s+index|about\s+the\s+author|credits|permissions|endnotes|footnotes|list\s+of\s+(?:figures|tables|illustrations|abbreviations))$/i.test(
    cleaned
  );
}

/**
 * Detects lines containing author names, student index/registration numbers,
 * university/institution banners, running page headers, exam instructions,
 * multiple-choice option rows, or bibliography citations.
 */
export function isMetadataOrNoiseLine(rawLine?: string, materialTitle?: string): boolean {
  if (!rawLine) return true;
  const line = decodeXmlEntities(rawLine).replace(/\s+/g, ' ').trim();
  if (!line || line.length < 3) return true;

  // Bare page numbers or roman numerals
  if (/^(?:page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\/\s*\d+|\d+|[ivxlcdm]+)$/i.test(line)) {
    return true;
  }

  // Explicit Author / Byline / Student / Instructor / Examiner / Course metadata labels
  if (
    /^(?:written\s+by|prepared\s+by|submitted\s+by|compiled\s+by|presented\s+by|edited\s+by|translated\s+by|student\s+name|candidate\s+name|name\s+of\s+(?:student|candidate)|group\s+(?:members?|no|number)|team\s+members?|course\s*(?:code|title|name|unit|no|number)|subject\s*(?:code|name)|paper\s*(?:code|no)|module\s*(?:code|leader)|academic\s+year|time\s+allowed|total\s+marks|candidate\s+roster|student\s+roster|class\s+list|attendance\s+list)\b/i.test(
      line
    ) ||
    /^(?:author|authors|student|candidate|instructor|lecturer|professor|supervisor|examiner|tutor|facilitator|department|faculty|college|school|university|semester|date|duration)\s*[:\-–—]/i.test(
      line
    )
  ) {
    return true;
  }
  if (/^name\s*[:\-–—]\s*[A-Z]/i.test(line)) return true;
  if (/^[Bb]y\s*[:\-–—]?\s+[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+/.test(line)) return true;

  // Academic titles / honorifics / credentials in byline-length lines
  if (
    line.length < 95 &&
    /\b(?:Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Eng\.|Ph\.?D\.?|M\.?Sc\.?|B\.?Sc\.?|B\.?A\.?|M\.?A\.?)\b/.test(
      line
    )
  ) {
    return true;
  }

  // Student Index / Registration / Matriculation / Roll / Candidate numbers
  if (
    /\b(?:index\s*(?:no|number|#)|reg(?:istration)?\s*(?:no|number|#)|student\s*(?:id|no|number|#)|matric(?:ulation)?\s*(?:no|number|#)|candidate\s*(?:no|number|#)|roll\s*(?:no|number|#)|admission\s*(?:no|number|#)|exam(?:ination)?\s*(?:no|number|#)|seat\s*(?:no|number|#))\b/i.test(
      line
    )
  ) {
    return true;
  }
  if (/^index\s*(?:no|number|#)?\s*[:\-–—]?\s*\d/i.test(line)) return true;

  // University / School registration & index slash/hyphen codes (e.g., 22/U/14892/PS, 2022/HD05/1294U, U0001/501, CSC/2023/001)
  if (
    /\b\d{2,4}\/[A-Z0-9]{1,6}\/\d{2,}[A-Z0-9/]*\b/i.test(line) ||
    /\b[A-Z]\d{3,5}\/\d{3,5}\b/i.test(line) ||
    /\b[A-Z]{2,5}\s*[/\-]\s*\d{2,4}\s*[/\-]\s*\d{2,}[A-Z0-9]*\b/i.test(line) ||
    /\b\d{8,14}\b/.test(line)
  ) {
    return true;
  }

  // Institutional / University / Faculty / Olympiad / Exam banners
  if (
    /\b(?:admission\s+ticket|examination\s+card|academic\s+year|marks\s+each|time\s+allowed|instructions\s+to\s+candidates|all\s+rights\s+reserved|isbn\s*[:\d-]|issn\s*[:\d-]|doi\s*:)\b/i.test(
      line
    )
  ) {
    return true;
  }
  if (
    line.length < 90 &&
    /^(?:department|faculty|school|college|institute|university|ministry)\s+of\b/i.test(line)
  ) {
    return true;
  }
  if (
    /^[A-Z0-9\s,&'().:-]{6,}$/.test(line) &&
    /\b(?:UNIVERSITY|INSTITUTE|COLLEGE|FACULTY|SCHOOL|DEPARTMENT|MINISTRY|ACADEMY|POLYTECHNIC|OLYMPIAD|COMPETITION|EXAMINATION|SEMESTER|HACKATHON|ROSTER|CANDIDATE)\b/.test(
      line
    )
  ) {
    return true;
  }
  if (/^multimodal\s+ai\s+hackathon\b/i.test(line)) return true;
  if (/^problems?\s+\d+\s*[-–—]\s*\d+/i.test(line)) return true;
  if (/^(?:question|problem|exercise|task)\s*#?\d*(?:\s*\([^)]*\))?$/i.test(line)) return true;

  // Multiple-choice option rows (e.g. "A) 2 B) 3 C) 4 D) 5")
  if (/^(?:[A-E][).]\s+)/.test(line) || /\bA[).]\s+\S+.*\bB[).]\s+\S+/.test(line)) {
    return true;
  }

  // Running page headers with leading or trailing page numbers (e.g., "16 WHO WROTE THE BIBLE?", "Who Wrote the Bible? 19")
  if (/^\d{1,4}\s+[A-Z\s?'":,-]{4,}$/.test(line)) return true;
  if (/^\d{2,4}\s+[A-Z][A-Za-z0-9\s?'":,-]{3,}$/.test(line)) return true;
  if (
    /^[A-Z][A-Za-z0-9\s?'":,&-]{3,}\s+\d{1,4}$/.test(line) &&
    !/^(?:chapter|part|section|module|unit|track|lecture|problem|question|figure|table|page|slide|step|stage|phase|level|rule)\s+\d+$/i.test(
      line
    )
  ) {
    return true;
  }

  // Bibliography / Reference citation lines (e.g., "Newey, S. and R. Seed. 1995...", "Owens, E. H. 1978.")
  if (
    /^[A-Z][a-zA-Z'-]+,\s*(?:[A-Z]\.\s*)+/.test(line) ||
    /^[A-Z][a-zA-Z'-]+,\s+[A-Z][a-zA-Z'-]+\s+(?:and|&)\s+[A-Z]/.test(line) ||
    /\b(?:19|20)\d{2}[a-z]?\.\s+[A-Z]/.test(line) ||
    /\(\s*(?:19|20)\d{2}[a-z]?\s*\)\./.test(line) ||
    /\b(?:J\.\s+Exp|Mar\.\s+Biol|Ecol\.\s+Monogr|Bull\.\s+Mar|Comm\.\s+ACM|pp\.\s*\d+|vol\.\s*\d+|\d+\(\d+\)\s*:\s*\d+)\b/i.test(
      line
    )
  ) {
    return true;
  }

  // Personal name bylines (e.g. "Luaa Leron & Golden Prince", "Mukasa David and Kato Paul")
  // Exclude academic/conceptual headings (words ending in -tion, -sion, -ment, -cies, -al, -ic, -ics, -logy, -ing, etc.)
  if (
    /^[A-Z][a-z]{1,18}(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]{1,18}\s*(?:&|and|,)\s*[A-Z][a-z]{1,18}(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]{1,18}$/.test(
      line
    ) &&
    !/\b(?:[A-Za-z]+(?:tion|sion|ment|ance|ence|ity|ism|ics|logy|graphy|metry|cies|ties|ing|ive|al|ic|ous|ble|ular|ary|ory)s?|database|data|system|systems|network|networks|software|hardware|algorithm|algorithms|structure|structures|calculus|algebra|matrix|vector|circuit|circuits|theorem|theory|model|models|method|methods|analysis|design|control|process|processes|energy|force|quantum|cell|cells|gene|genes|species|market|supply|demand|cost|price|value|state|states|church|bible|god|jesus|ancient|greece|rome|empire|history|war|peace|law|rights)\b/i.test(
      line
    )
  ) {
    return true;
  }

  // All-caps student name rosters (4+ uppercase words without academic/structural keywords)
  const words = line.split(/\s+/);
  if (
    words.length >= 4 &&
    words.every((w) => /^[A-Z'-]{2,15}$/.test(w)) &&
    !/\b(?:INTRODUCTION|ABSTRACT|METHODS|MATERIALS|RESULTS|DISCUSSION|CONCLUSION|SUMMARY|CHAPTER|SECTION|PART|MODULE|THEORY|SYSTEM|MODEL|ANALYSIS|DESIGN|ALGORITHM|DATABASE|NETWORK|PROGRESSION|CONSIDERATIONS|ARCHITECTURE|OVERVIEW|PRINCIPLES|CONCEPTS|COMPETITIVE|EXCLUSION|ECOLOGY|BIOLOGY|PHYSICS|CHEMISTRY|MATHEMATICS|HISTORY|BIBLE|GOD|JESUS|TUTORING|LEARNING|GROUNDING|ADAPTIVE)\b/.test(
      line
    )
  ) {
    return true;
  }

  // Exact match to materialTitle when used as a repeated running header
  if (materialTitle) {
    const normLine = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normTitle = materialTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normLine === normTitle && /\?$/.test(line)) {
      return true;
    }
  }

  return false;
}

/**
 * Cleans a candidate heading string by removing markdown markers, XML entities,
 * trailing page numbers, author bylines, index numbers, and course/paper suffixes.
 */
export function cleanExtractedHeading(rawHeading: string, materialTitle?: string): string {
  if (!rawHeading) return '';
  let cleaned = decodeXmlEntities(rawHeading)
    .replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
    .replace(/\b([A-Za-z])(?:\s+([a-z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[•*-]\s+/, '')
    .replace(/^(?:slide|page|section|chunk)\s*\d+\s*[:\-–—]\s*/i, '')
    .replace(/^(?:\d+(?:\.\d+)*\.?\s+)/, '')
    .trim();

  // Strip embedded author/byline/index suffixes (e.g. " - By Mukasa David (22/U/14892/PS)")
  cleaned = cleaned
    .replace(
      /\s*(?:[-–—|]|\b)(?:by|author|authors|prepared\s+by|submitted\s+by|written\s+by|student|index\s*(?:no|number|#)?|reg(?:istration)?\s*(?:no|number|#)?)\s*[:\-–—]?\s+[A-Z0-9].*$/i,
      ''
    )
    .replace(/\b\d{2,4}\/[A-Z0-9]{1,6}\/\d{2,}[A-Z0-9/]*\b/gi, '')
    .replace(/\s+[A-Za-z]+\s+research\s+paper\s+\d{4}.*$/i, '')
    .trim();

  // If the heading starts with the document title followed by a person byline (e.g., "Competitive Exclusion Luaa Leron & Golden Prince...")
  if (materialTitle && materialTitle.trim().length >= 4) {
    const cleanMatTitle = materialTitle.replace(/[_-]/g, ' ').trim();
    const escapedTitle = cleanMatTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^(${escapedTitle})\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+.*$`, 'i');
    const prefixMatch = cleaned.match(prefixRegex);
    if (prefixMatch && prefixMatch[1]) {
      cleaned = prefixMatch[1].trim();
    }
  }

  // Strip trailing punctuation
  cleaned = cleaned.replace(/[:\-–—,;]+$/, '').trim();

  // Strip trailing standalone page numbers (e.g. "Divine Humans in Ancient Greece and Rome 15")
  if (
    !/^(?:chapter|part|section|module|unit|track|lecture|stage|step|phase|level|rule)\s+\d+$/i.test(
      cleaned
    )
  ) {
    cleaned = cleaned.replace(/\s+\d{1,4}$/, '').trim();
  }

  // Normalize ALL-CAPS headings longer than 5 chars into clean Title Case (preserving short acronyms like PDF, AI, SQL, IRT)
  if (cleaned.length > 5 && cleaned === cleaned.toUpperCase() && /[A-Z]{4,}/.test(cleaned)) {
    const minorWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    cleaned = cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((w, idx) => {
        if (/^(?:ai|ui|ux|api|sql|pdf|irt|llm|rag|nlp|cpu|gpu|ram|rom|io|ii|iii|iv|vi|vii|viii|ix|xi|xii)$/i.test(w)) {
          return w.toUpperCase();
        }
        if (idx > 0 && minorWords.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }

  return cleaned;
}

/**
 * Validates whether a candidate string is a genuine, well-formed academic topic heading
 * (rejecting author names, index numbers, frontmatter, conversational clauses, and fragments).
 */
export function isValidTopicHeading(heading?: string, materialTitle?: string): boolean {
  if (!heading) return false;
  const cleaned = cleanExtractedHeading(heading, materialTitle);
  if (!cleaned || cleaned.length < 4 || cleaned.length > 75) return false;
  if (isGenericSectionHeading(cleaned)) return false;
  if (isFrontmatterOrBackmatterHeading(cleaned)) return false;
  if (isMetadataOrNoiseLine(cleaned, materialTitle)) return false;

  // Must contain at least one 3+ letter word and start with an uppercase letter or digit
  if (!/[A-Za-z]{3,}/.test(cleaned)) return false;
  if (!/^[A-Z0-9]/.test(cleaned)) return false;

  // Reject raw XML entity remnants or unbalanced parentheses/quotes
  if (/&(?:amp|lt|gt|quot|apos)\b/i.test(cleaned)) return false;
  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (openParens !== closeParens) return false;
  const doubleQuotes = (cleaned.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) return false;

  // Reject standalone chapter/section labels without a descriptive title (e.g. "CHAPTER 1")
  if (/^(?:chapter|part|section|unit|module|question|problem|exercise|figure|table|appendix)\s*[0-9IVX]*$/i.test(cleaned)) {
    return false;
  }

  // Reject conversational, pronominal, transitional, or mid-sentence fragment starts
  if (
    /^(?:overall|compared\s+with|compared\s+to|there\s+(?:is|are|was|were)|possible\s+that|from\s+(?:a|an|the|this|that|these|those)|in\s+this\s+(?:book|chapter|paper|section|study|course|lecture)|we\s+(?:start|will|have|can|see|now|need|must|consider|examine|discuss|use|define|assume|note|show|find)|if\s+(?:you|we|they|it|the|a|an)|when\s+(?:you|we|they|it|a|an)|you\s+(?:can|will|should|may|must|need|have|are)|it\s+(?:is|was|can|should|may|will|has|appears|seems)|this\s+(?:is|was|means|shows|suggests|indicates|requires|allows)|these\s+(?:are|were|results|findings)|however|furthermore|moreover|therefore|thus|hence|consequently|additionally|nevertheless|nonetheless|meanwhile|subsequently|finally|for\s+(?:example|instance)|as\s+(?:a\s+result|shown|seen|discussed|mentioned|noted)|according\s+to|based\s+on|in\s+(?:addition|contrast|other\s+words|particular|general|fact)|on\s+the\s+other\s+hand|although|because|since|while|whereas|unless|until|after|before|during|between|among|within|without|through|throughout|despite|towards?|upon|was\s+|were\s+|had\s+|has\s+|have\s+|did\s+|does\s+|do\s+|is\s+|are\s+|can\s+|could\s+|would\s+|should\s+|will\s+|may\s+|might\s+|must\s+|that\s+|which\s+|who\s+|whom\s+|whose\s+|where\s+|when\s+|why\s+|how\s+|what\s+|whether\s+|each\s+of|some\s+of|many\s+of|most\s+of|one\s+of|both\s+of|figure\s+\d|table\s+\d|fig\.\s*\d|eq\.\s*\d|equation\s+\d|produced\s+|created\s+|developed\s+|established\s+|located\s+|found\s+|given\s+|taken\s+|made\s+|used\s+|called\s+|known\s+)/i.test(
      cleaned
    )
  ) {
    return false;
  }

  const words = cleaned.split(/\s+/);
  if (words.length > 11) return false;

  // Reject headings ending with dangling prepositions, conjunctions, pronouns, or auxiliary verbs
  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lastWord || TRAILING_NOISE_WORDS.has(lastWord)) {
    return false;
  }

  // Reject if it contains conjugated past-tense narrative verbs typical of prose sentences ("was executed", "were observed")
  if (/\b(?:was|were|had\s+been)\s+[a-z]+ed\b/i.test(cleaned)) {
    return false;
  }

  // Require Title-Case capitalization across significant words to reject mid-sentence wrapped prose lines
  const minorWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'as', 'into', 'from', 'vs', 'via', 'per', 'de', 'la', 'et'
  ]);
  const significantWords = words.filter((w, idx) => {
    const bare = w.replace(/[^A-Za-z0-9]/g, '');
    if (!bare) return false;
    if (idx === 0) return true;
    return !minorWords.has(bare.toLowerCase());
  });
  if (significantWords.length >= 2) {
    const capCount = significantWords.filter((w) => {
      const bare = w.replace(/^[^A-Za-z0-9]+/, '');
      return /^[A-Z0-9]/.test(bare);
    }).length;
    if (capCount / significantWords.length < 0.65) {
      return false;
    }
  }

  return true;
}

/**
 * Truncates lines at an explicit standalone backmatter section header
 * (e.g., References, Bibliography, Works Cited, Literature Cited)
 * so trailing citation lists at the end of a page/chunk are ignored.
 */
function trimAtBackmatterSection(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if (
      /^(?:references|bibliography|works\s+cited|literature\s+cited|acknowledg(?:e)?ments?)$/i.test(
        line.replace(/[:\-–—.]+$/, '').trim()
      )
    ) {
      break;
    }
    result.push(line);
  }
  return result;
}

/**
 * Detects whether a chunk is predominantly non-instructional (e.g., frontmatter,
 * table of contents, dedication, acknowledgments, bibliography/references, or student rosters)
 * so it can be excluded from topic chips and quiz generation.
 */
export function isNonInstructionalChunk(chunk: SourceChunk): boolean {
  if (!chunk || !chunk.extractedText) return true;
  if (isFrontmatterOrBackmatterHeading(chunk.sectionHeading)) return true;

  const lines = chunk.extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(?:page\s*\d+|\d+)$/i.test(l));

  if (lines.length === 0) return true;

  // Check if the first meaningful line is an explicit frontmatter/backmatter header
  const firstNonRunning = lines.find((l) => !/^\d+\s+[A-Z]/.test(l) && !/[A-Z]\s+\d+$/.test(l));
  if (firstNonRunning && isFrontmatterOrBackmatterHeading(firstNonRunning)) {
    return true;
  }

  // Table of contents dot-leader or page-number listing detection
  const sampleLines = lines.slice(0, 14);
  const tocLines = sampleLines.filter(
    (l) => /(?:\.{3,}|\s+\d{1,3})$/.test(l) || /^(?:chapter|part|section)\s+\d+/i.test(l)
  );
  if (sampleLines.length >= 4 && tocLines.length / sampleLines.length >= 0.6) {
    return true;
  }

  // Filter out metadata/noise lines and anything after a backmatter header (e.g. References)
  const beforeBackmatter = trimAtBackmatterSection(lines);
  const instructionalLines = beforeBackmatter.filter(
    (l) => !isMetadataOrNoiseLine(l, chunk.materialTitle) && !isFrontmatterOrBackmatterHeading(l)
  );

  // If no substantive instructional text remains after removing metadata/references, the chunk is non-instructional
  const instructionalChars = instructionalLines.join(' ').trim().length;
  if (instructionalLines.length === 0 || instructionalChars < 45) {
    return true;
  }

  return false;
}

/**
 * Extracts a meaningful section/topic heading from raw passage text when an explicit
 * structural heading is unavailable or generic.
 */
export function extractMeaningfulSectionHeading(
  rawText: string,
  fallbackLabel = 'Document Section',
  materialTitle?: string
): string {
  if (!rawText || !rawText.trim()) return fallbackLabel;

  const text = decodeXmlEntities(rawText)
    .replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
    .replace(/^\s*(?:page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\/\s*\d+)\s*/i, '')
    .trim();

  if (!text) return fallbackLabel;

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(?:page\s*\d+|\d+)$/i.test(l));

  // If the first non-running line is frontmatter/backmatter, return it so isNonInstructionalChunk can flag it cleanly
  const nonRunningTop = rawLines.filter(
    (l) =>
      !/^\d{1,4}\s+[A-Z\s?'":,-]{4,}$/.test(l) &&
      !/^[A-Z][A-Za-z0-9\s?'":,&-]{3,}\s+\d{1,4}$/.test(l)
  );
  if (nonRunningTop.length > 0 && isFrontmatterOrBackmatterHeading(nonRunningTop[0])) {
    return cleanExtractedHeading(nonRunningTop[0], materialTitle) || fallbackLabel;
  }

  // Filter out metadata, author names, index numbers, university banners, running headers, and trailing References sections
  const cleanLines = trimAtBackmatterSection(rawLines).filter(
    (l) => !isMetadataOrNoiseLine(l, materialTitle)
  );

  // 1. Check top lines for Chapter/Track/Module combinations or standalone structural headings
  for (let i = 0; i < Math.min(cleanLines.length, 5); i++) {
    const line = cleanLines[i];

    // If line is "CHAPTER 1" / "PART II" / "MODULE 3", combine with the next line if it's a valid title
    if (/^(?:chapter|part|section|module|unit)\s+[0-9IVX]+$/i.test(line) && cleanLines[i + 1]) {
      const nextCandidate = cleanExtractedHeading(cleanLines[i + 1], materialTitle);
      if (isValidTopicHeading(nextCandidate, materialTitle)) {
        const prefix = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
        return `${prefix}: ${nextCandidate}`;
      }
    }

    // Check if the line itself is a standalone title/heading (and not a wrapped mid-sentence line)
    const nextRawLine = cleanLines[i + 1] || '';
    const nextIsLowerContinuation =
      /^[a-z]/.test(nextRawLine) && !/^[a-z][.)]\s+[A-Z]/.test(nextRawLine);
    const continuesMidSentence = !/[.!?:]$/.test(line) && nextIsLowerContinuation;

    if (!continuesMidSentence) {
      const candidate = cleanExtractedHeading(line, materialTitle);
      const wordCount = candidate.split(/\s+/).length;
      if (
        wordCount >= 1 &&
        wordCount <= 10 &&
        !/[.;,?]$/.test(line.replace(/[:\-–—]+$/, '').trim()) &&
        isValidTopicHeading(candidate, materialTitle)
      ) {
        return candidate;
      }
    }

    // Check for numbered/bulleted concept label with colon followed by prose (e.g., "1. Learner Model: Maintain a dynamic...")
    const colonLabelMatch = line.match(
      /^(?:(?:\d+(?:\.\d+)*\.?|[A-Z]\.|[•*\-\u25cf])\s+)?([A-Z][A-Za-z0-9\s,&/()'-]{3,52}?)\s*[:\-–—]\s+\S/
    );
    if (colonLabelMatch && colonLabelMatch[1]) {
      const labelCandidate = cleanExtractedHeading(colonLabelMatch[1], materialTitle);
      if (isValidTopicHeading(labelCandidate, materialTitle)) {
        return labelCandidate;
      }
    }
  }

  // 2. Scan all lines in the chunk for an embedded structural subheading (e.g. when a PDF page starts mid-sentence from the previous page)
  for (let i = 1; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // Standard academic section headers or colon-terminated subheadings
    if (
      /^(?:abstract|introduction|background|materials\s+and\s+methods|methodology|methods|experimental\s+design|results|results\s+and\s+discussion|discussion|conclusion|conclusions|summary|system\s+architecture|technical\s+considerations|key\s+concepts|core\s+principles|theoretical\s+framework|literature\s+review)\s*:?$/i.test(
        line
      )
    ) {
      const candidate = cleanExtractedHeading(line, materialTitle);
      if (isValidTopicHeading(candidate, materialTitle)) {
        return candidate;
      }
    }

    // Explicit Track / Module / Chapter / numbered heading mid-page
    if (
      /^(?:(?:track|module|chapter|unit|topic|lecture)\s+[A-Z0-9]+|\d+(?:\.\d+)*\.?\s+[A-Z])/i.test(
        line
      )
    ) {
      const colonPart = line.split(/\s*[:\-–—]\s+/)[0];
      const candidate = cleanExtractedHeading(
        line.length <= 68 && !/[.;]$/.test(line) ? line : colonPart,
        materialTitle
      );
      if (isValidTopicHeading(candidate, materialTitle)) {
        return candidate;
      }
    }

    // Short standalone heading ending with colon (e.g., "Technical Considerations:")
    if (/^[A-Z][A-Za-z0-9\s,&/()'-]{4,52}:$/.test(line)) {
      const candidate = cleanExtractedHeading(line, materialTitle);
      if (isValidTopicHeading(candidate, materialTitle)) {
        return candidate;
      }
    }
  }

  // 3. Check for explicit Track / Module / Chapter / Unit / Concept definitions in the clean text window
  const cleanWindow = cleanLines.slice(0, 8).join(' ').slice(0, 420).replace(/\s+/g, ' ').trim();

  const structuralMatch = cleanWindow.match(
    /\b((?:Track|Module|Chapter|Unit|Topic|Lecture)\s+[A-Z0-9]+(?:\s*[:\-–—]\s*[A-Z0-9][A-Za-z0-9\s,&/()'-]{2,45})?)/i
  );
  if (structuralMatch && structuralMatch[1]) {
    const candidate = cleanExtractedHeading(structuralMatch[1], materialTitle);
    if (isValidTopicHeading(candidate, materialTitle)) {
      return candidate;
    }
  }

  // 4. Check for a concept definition sentence ("<Concept> is a/an/the/defined as/where/refers to...")
  const sentences = cleanWindow.split(/(?<=[.!?])\s+/);
  for (const sent of sentences.slice(0, 3)) {
    const cleanSent = sent.replace(/^(?:\d+(?:\.\d+)*\.?|[•*\-\u25cf])\s+/, '').trim();
    const conceptMatch = cleanSent.match(
      /^([A-Z][A-Za-z0-9\s,&/()'-]{3,48}?)\s+\b(?:is\s+(?:a|an|the|defined\s+as|where|characterized\s+by)|are\s+(?:defined\s+as|characterized\s+by)|refers\s+to|describes|governs|represents|consists\s+of|occurs\s+when)\b/
    );
    if (conceptMatch && conceptMatch[1]) {
      const candidate = cleanExtractedHeading(conceptMatch[1], materialTitle);
      if (isValidTopicHeading(candidate, materialTitle)) {
        return candidate;
      }
    }
  }

  return fallbackLabel;
}

/**
 * Derives a clean, human-readable study topic name from a SourceChunk.
 * Preserves real document headings when valid and re-derives from passage text
 * if a stored heading is generic, frontmatter, or metadata/author/index noise.
 */
export function deriveTopicNameFromChunk(chunk: SourceChunk, index = 0): string {
  const rawHeading = (chunk.sectionHeading || '').trim();
  const strippedPrefix = rawHeading
    .replace(/^(?:slide|page|section|chunk|part)\s*\d+\s*[:\-–—]\s*/i, '')
    .trim();

  const cleanedExisting = cleanExtractedHeading(strippedPrefix, chunk.materialTitle);
  if (cleanedExisting && isValidTopicHeading(cleanedExisting, chunk.materialTitle)) {
    return cleanedExisting;
  }

  const fallback = chunk.materialTitle
    ? `${chunk.materialTitle} — Section ${index + 1}`
    : `Section ${index + 1}`;

  const derived = extractMeaningfulSectionHeading(
    chunk.extractedText,
    fallback,
    chunk.materialTitle
  );

  if (isValidTopicHeading(derived, chunk.materialTitle)) {
    return derived;
  }

  return fallback;
}

/**
 * Extracts a deduplicated, clean list of organized study topics from a StudyMaterial.
 * Filters out non-instructional chunks, author names, index numbers, and mid-sentence fragments,
 * and supplements with numbered sub-concepts when a short document has multiple labeled items on one page.
 */
export function extractOrganizedTopicsFromMaterial(
  material: StudyMaterial,
  maxTopics = 6
): string[] {
  const topics: string[] = [];
  const seenLower = new Set<string>();

  const addTopic = (candidate?: string) => {
    if (!candidate) return;
    const cleaned = cleanExtractedHeading(candidate, material.title);
    if (!isValidTopicHeading(cleaned, material.title)) return;
    const lower = cleaned.toLowerCase();
    if (seenLower.has(lower)) return;
    seenLower.add(lower);
    topics.push(cleaned);
  };

  const chunks = material.chunks || [];

  // Pass 1: Collect primary valid headings from instructional chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (isNonInstructionalChunk(chunk)) continue;
    const derived = deriveTopicNameFromChunk(chunk, i);
    // Skip generic fallback labels like "DocTitle — Section 2" when collecting topic chips
    if (!/\s+—\s+Section\s+\d+$/i.test(derived)) {
      addTopic(derived);
    }
    if (topics.length >= maxTopics) return topics;
  }

  // Pass 2: Scan instructional chunks for numbered headings or colon-headed subtopics (e.g. "2. Knowledge Grounding: ..." or "2. Tuple Relational Calculus")
  for (const chunk of chunks) {
    if (isNonInstructionalChunk(chunk)) continue;
    const rawLines = chunk.extractedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const lines = trimAtBackmatterSection(rawLines);
    for (const line of lines) {
      if (isMetadataOrNoiseLine(line, material.title)) continue;
      // Match "2. Concept Name: explanation..."
      const subMatch = line.match(
        /^(?:(?:\d+(?:\.\d+)*\.?|[•*\-\u25cf])\s+)([A-Z][A-Za-z0-9\s,&/()'-]{3,52}?)(?:\s*\([^)]*\))?\s*[:\-–—]\s+\S/
      );
      if (subMatch && subMatch[1]) {
        addTopic(subMatch[1]);
        if (topics.length >= maxTopics) return topics;
        continue;
      }
      // Match standalone numbered section headings "2. Tuple Relational Calculus" or "1. Multimodal Knowledge Base:"
      const standaloneNumMatch = line.match(
        /^\d+(?:\.\d+)*\.?\s+([A-Z][A-Za-z0-9\s,&/()'-]{3,58}?)\s*:?$/
      );
      if (standaloneNumMatch && standaloneNumMatch[1] && !/[.;?]$/.test(line)) {
        addTopic(standaloneNumMatch[1]);
        if (topics.length >= maxTopics) return topics;
      }
    }
  }

  // Pass 3: Fallback to clean material title if no subtopics were found
  if (topics.length === 0 && material.title) {
    const cleanTitle = cleanExtractedHeading(material.title);
    if (cleanTitle.length >= 3) {
      topics.push(cleanTitle);
    }
  }

  return topics;
}

/**
 * Extracts complete, self-contained factual statements from a SourceChunk for quiz generation.
 * Unwraps hard PDF line breaks before splitting into sentences and filters out metadata,
 * author names, index numbers, headers, questions, and broken sentence fragments.
 */
export function extractStudyStatementsFromChunk(chunk: SourceChunk): string[] {
  if (!chunk || !chunk.extractedText || isNonInstructionalChunk(chunk)) {
    return [];
  }

  const rawLines = trimAtBackmatterSection(
    decodeXmlEntities(chunk.extractedText)
      .replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
      .replace(/\b([A-Za-z])(?:\s+([a-z])){2,}\b/g, (m) => m.replace(/\s+/g, ''))
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );

  // Filter out metadata, running headers, frontmatter titles, and standalone short section headings
  const proseLines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (isMetadataOrNoiseLine(line, chunk.materialTitle)) continue;
    if (isFrontmatterOrBackmatterHeading(line)) continue;

    // Skip standalone title/heading lines that don't end in sentence punctuation
    const cleanedAsHeading = cleanExtractedHeading(line, chunk.materialTitle);
    if (
      chunk.sectionHeading &&
      cleanedAsHeading.toLowerCase() === chunk.sectionHeading.toLowerCase() &&
      !/[.!?]$/.test(line)
    ) {
      continue;
    }
    if (
      chunk.materialTitle &&
      cleanedAsHeading.toLowerCase() === chunk.materialTitle.toLowerCase() &&
      !/[.!?]$/.test(line)
    ) {
      continue;
    }
    const prevProseLine = proseLines[proseLines.length - 1] || '';
    const prevEndedSentence = !prevProseLine || /[.!?]$/.test(prevProseLine);
    const nextLine = rawLines[i + 1] || '';
    const nextIsLowercaseProse =
      /^[a-z]/.test(nextLine) && !/^[a-z][.)]\s+[A-Z]/.test(nextLine);
    const isStandaloneColonHeader =
      /^(?:\d+(?:\.\d+)*\.?\s+)?[A-Z][A-Za-z0-9\s,&/()'-]{2,52}:$/.test(line);
    if (
      isStandaloneColonHeader ||
      (prevEndedSentence &&
        /^[A-Z0-9]/.test(line) &&
        !/^[a-zA-Z][.)]\s+/.test(line) &&
        line.length < 55 &&
        !/[.!?]$/.test(line) &&
        !nextIsLowercaseProse &&
        isValidTopicHeading(line, chunk.materialTitle))
    ) {
      continue;
    }

    proseLines.push(line);
  }

  if (proseLines.length === 0) return [];

  // Unwrap PDF line breaks into logical paragraphs
  const paragraphs: string[] = [];
  let currentPara = '';

  const pushPara = (p: string) => {
    const trimmed = p.trim();
    if (!trimmed) return;
    paragraphs.push(/[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`);
  };

  for (const line of proseLines) {
    const isNewListItem =
      /^(?:(?:\d+(?:\.\d+)*|[a-zA-Z])[.)]|[•*\-\u25cf\u25cb\u25aa\u25b8])\s+[A-Z]/.test(line);
    if (isNewListItem && currentPara) {
      pushPara(currentPara);
      currentPara = line;
    } else if (!currentPara) {
      currentPara = line;
    } else if (/[a-z]-\s*$/i.test(currentPara) && /^[a-z]/.test(line)) {
      // Rejoin hyphenated word split across lines
      currentPara = currentPara.replace(/-\s*$/, '') + line;
    } else {
      currentPara = `${currentPara} ${line}`;
    }
  }
  if (currentPara.trim()) {
    pushPara(currentPara);
  }

  // Split unwrapped paragraphs into candidate sentences
  const candidateSentences: string[] = [];
  for (const para of paragraphs) {
    const splitSents = para.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
    for (const s of splitSents) {
      candidateSentences.push(s.trim());
    }
  }

  const validStatements: string[] = [];
  const seenLower = new Set<string>();

  for (const rawSent of candidateSentences) {
    const sent = rawSent
      .replace(/^(?:(?:\d+(?:\.\d+)*|[a-zA-Z])[.)]|[•*\-\u25cf\u25cb\u25aa\u25b8])\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (sent.length < 45 || sent.length > 260) continue;
    if (!/^[A-Z]/.test(sent)) continue;
    if (!/[.!]$/.test(sent)) continue;

    // Must have balanced parentheses and quotes
    const openParens = (sent.match(/\(/g) || []).length;
    const closeParens = (sent.match(/\)/g) || []).length;
    if (openParens !== closeParens) continue;

    const words = sent.split(/\s+/);
    if (words.length < 7) continue;

    // Reject questions, instructions, or first-person meta statements
    if (/\?$/.test(sent)) continue;
    if (
      /^(?:what|why|how|when|where|who|which|explain|describe|discuss|calculate|determine|find|solve|in\s+this\s+(?:book|chapter|paper|section|study)|we\s+(?:start|will|shall|now)|i\s+(?:will|have|would|argue)|figure\s+\d|table\s+\d|see\s+(?:figure|table|page|section|chapter))\b/i.test(
        sent
      )
    ) {
      continue;
    }

    if (isMetadataOrNoiseLine(sent, chunk.materialTitle)) continue;

    // Must contain an informational verb/predicate
    if (
      !/\b(?:is|are|was|were|has|have|had|can|could|will|would|must|should|may|provides|requires|maintains|adapts|uses|allows|enables|defines|describes|consists|involves|occurs|produces|increases|decreases|affects|demonstrates|indicates|shows|means|refers|helps|supports|tracks|builds|generates|evaluates|combines|prevents|leads|results|competes|coexist|divides|establishes|represents|governs)\b/i.test(
        sent
      )
    ) {
      continue;
    }

    const lower = sent.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      validStatements.push(sent);
    }
  }

  return validStatements;
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
          .map((item: any) => {
            if (!('str' in item)) return '';
            return item.hasEOL ? `${item.str}\n` : `${item.str} `;
          })
          .join('');
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

    // Generate semantic chunks strictly from real pages, carrying active section heading across continuation pages
    const chunks: SourceChunk[] = [];
    let chunkIdx = 0;
    let lastActiveHeading = '';

    const resolvePageHeading = (chunkText: string, pageNumber: number): string => {
      const fallback = lastActiveHeading || `Page ${pageNumber}`;
      const extracted = extractMeaningfulSectionHeading(chunkText, fallback, materialTitle);
      if (isValidTopicHeading(extracted, materialTitle)) {
        lastActiveHeading = extracted;
        return extracted;
      }
      return extracted;
    };

    for (const page of pages) {
      if (!page.text || page.text.trim().length === 0) continue;

      // If page is reasonably sized (< 1100 chars), keep it as a coherent page chunk
      if (page.text.length <= 1100) {
        chunkIdx++;
        const derivedHeading = resolvePageHeading(page.text, page.pageNumber);
        chunks.push({
          id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
          materialId,
          materialTitle,
          filename,
          documentType: 'pdf',
          chunkIndex: chunkIdx,
          pageNumber: page.pageNumber,
          pageOrSlideNumber: page.pageNumber,
          sectionHeading: derivedHeading,
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
            const chunkText = currentCombined.trim();
            const derivedHeading = resolvePageHeading(chunkText, page.pageNumber);
            chunks.push({
              id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
              materialId,
              materialTitle,
              filename,
              documentType: 'pdf',
              chunkIndex: chunkIdx,
              pageNumber: page.pageNumber,
              pageOrSlideNumber: page.pageNumber,
              sectionHeading: derivedHeading,
              anchorLabel: `Page ${page.pageNumber}`,
              extractedText: chunkText,
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
          const chunkText = currentCombined.trim();
          const derivedHeading = resolvePageHeading(chunkText, page.pageNumber);
          chunks.push({
            id: `chunk-${materialId}-p${page.pageNumber}-${chunkIdx}`,
            materialId,
            materialTitle,
            filename,
            documentType: 'pdf',
            chunkIndex: chunkIdx,
            pageNumber: page.pageNumber,
            pageOrSlideNumber: page.pageNumber,
            sectionHeading: derivedHeading,
            anchorLabel: `Page ${page.pageNumber}`,
            extractedText: chunkText,
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

    // Try HTML conversion to discover structured headings while preserving line breaks
    let sections: ExtractedSection[] = [];
    try {
      const htmlResult = await mammoth.convertToHtml(mammothInput);
      const html = htmlResult.value || '';

      // Split HTML by headings (h1, h2, h3, h4)
      const parts = html.split(/(?=<h[1-4][^>]*>)/i);
      let secIndex = 1;

      for (const part of parts) {
        if (!part.trim()) continue;

        // Extract heading text if exists, preserving internal line breaks to filter out author bylines
        const headingMatch = part.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
        let heading = '';
        if (headingMatch) {
          const rawHeadingLines = headingMatch[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(?:p|div|span)>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .split(/\r?\n/)
            .map((l) => cleanText(l))
            .filter((l) => l.length > 0 && !isMetadataOrNoiseLine(l, materialTitle));

          const candidateHeading = cleanExtractedHeading(rawHeadingLines[0] || '', materialTitle);
          if (isValidTopicHeading(candidateHeading, materialTitle)) {
            heading = candidateHeading;
          }
        }

        // Convert block HTML tags to newlines before stripping inline tags so paragraphs/bylines don't merge
        const htmlWithNewlines = part
          .replace(/<\/(?:p|h[1-6]|li|tr|div|blockquote|section)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n');
        const plainText = cleanText(htmlWithNewlines.replace(/<[^>]+>/g, ' '));
        if (plainText.length > 25) {
          const resolvedHeading =
            heading || extractMeaningfulSectionHeading(plainText, `Section ${secIndex}`, materialTitle);
          sections.push({
            heading: resolvedHeading,
            text: plainText,
            anchorLabel: `Word Document — ${resolvedHeading}`,
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
          const chunkText = buffer.trim();
          const resolvedHeading = extractMeaningfulSectionHeading(
            chunkText,
            `Section ${secIndex}`,
            materialTitle
          );
          sections.push({
            heading: resolvedHeading,
            text: chunkText,
            anchorLabel: `Word Document — Section ${secIndex}`,
          });
          secIndex++;
          buffer = para;
        } else {
          buffer = buffer ? `${buffer}\n\n${para}` : para;
        }
      }

      if (buffer.trim().length > 0) {
        const chunkText = buffer.trim();
        const resolvedHeading = extractMeaningfulSectionHeading(
          chunkText,
          `Section ${secIndex}`,
          materialTitle
        );
        sections.push({
          heading: resolvedHeading,
          text: chunkText,
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
      const derivedSlideTopic =
        slide.title ||
        extractMeaningfulSectionHeading(slide.text, `Slide ${slide.slideNumber}`);
      const heading =
        derivedSlideTopic && !/^slide\s*\d+$/i.test(derivedSlideTopic)
          ? derivedSlideTopic
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
  let currentHeading = '';
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (currentBuffer.join(' ').trim().length > 25) {
        const secText = cleanText(currentBuffer.join('\n'));
        const resolvedHeading =
          currentHeading ||
          extractMeaningfulSectionHeading(secText, `${materialTitle} — Overview`);
        sections.push({
          heading: resolvedHeading,
          text: secText,
          anchorLabel: `Markdown — ${resolvedHeading}`,
        });
        currentBuffer = [];
      }
      currentHeading = headingMatch[2].trim();
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.join(' ').trim().length > 0) {
    const secText = cleanText(currentBuffer.join('\n'));
    const resolvedHeading =
      currentHeading ||
      extractMeaningfulSectionHeading(secText, `${materialTitle} — Overview`);
    sections.push({
      heading: resolvedHeading,
      text: secText,
      anchorLabel: `Markdown — ${resolvedHeading}`,
    });
  }

  // If no headings found, split by double-newline paragraphs
  if (sections.length === 0) {
    const paras = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 25);
    paras.forEach((p, idx) => {
      const cleanedPara = cleanText(p);
      const resolvedHeading = extractMeaningfulSectionHeading(
        cleanedPara,
        `Section ${idx + 1}`
      );
      sections.push({
        heading: resolvedHeading,
        text: cleanedPara,
        anchorLabel: `Markdown — ${resolvedHeading}`,
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
      const chunkText = buffer.trim();
      const resolvedHeading = extractMeaningfulSectionHeading(chunkText, `Section ${chunkIdx}`);
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
        sectionHeading: resolvedHeading,
        anchorLabel: `Text — Section ${chunkIdx}`,
        extractedText: chunkText,
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
    const chunkText = buffer.trim();
    const resolvedHeading = extractMeaningfulSectionHeading(chunkText, `Section ${chunkIdx}`);
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
      sectionHeading: resolvedHeading,
      anchorLabel: `Text — Section ${chunkIdx}`,
      extractedText: chunkText,
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
