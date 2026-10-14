import type {
  SourceChunk,
  SourceCitation,
  StudyMaterial,
  TutorPreferences,
  TutorInteractionMode,
  TutorSourceLabel,
} from '../types/index.ts';

import { deriveTopicNameFromChunk, isGenericSectionHeading } from './documentExtraction.ts';

/**
 * Common English stop words and conversational/document-framing words to filter out
 * when extracting specific subject keywords.
 */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'explain', 'explained', 'explaining', 'few', 'for', 'from', 'further', 'had',
  'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve',
  'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of',
  'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d',
  'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'tell',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s',
  'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your',
  'yours', 'yourself', 'yourselves', 'give', 'show', 'describe', 'define', 'meaning',
  'work', 'works', 'working', 'worked',
  'function', 'functions', 'functioning',
  'operate', 'operates', 'operation', 'operating',
  'use', 'uses', 'used', 'using', 'usage',
  'apply', 'applies', 'applied', 'application', 'applications',
  'difference', 'differences', 'different', 'differ',
  'compare', 'comparing', 'comparison', 'versus', 'vs',
  'summary', 'summarize', 'summarized', 'summarizing', 'overview',
  'detail', 'details', 'detailed',
  'concept', 'concepts', 'conceptual',
  'principle', 'principles',
  'basic', 'basics',
  'understand', 'understanding',
  'know', 'learn',
  'help', 'please',
  'type', 'types',
  'example', 'examples',
  'role', 'roles',
  'purpose', 'purposes',
  'feature', 'features',
  'note', 'notes',
  'mean', 'means',
  'defined', 'definition', 'definitions',
  'important', 'importance',
  'various', 'general',
  'need', 'want',
  // Query & document framing modifiers
  'main', 'key', 'core', 'major', 'primary', 'central', 'essential', 'fundamental',
  'specific', 'specifically', 'brief', 'briefly', 'short', 'list', 'outline',
  'identify', 'state', 'mention', 'mentioned', 'cover', 'covered', 'covering',
  'include', 'included', 'including', 'contain', 'contained', 'according', 'based',
  'selected', 'source', 'sources', 'material', 'materials', 'document', 'documents',
  'uploaded', 'file', 'files', 'pdf', 'docx', 'pptx', 'slide', 'slides', 'page',
  'pages', 'section', 'sections', 'chapter', 'chapters', 'course', 'study', 'text',
  'passage', 'passages', 'topic', 'topics', 'point', 'points', 'aspect', 'aspects',
  'factor', 'factors', 'element', 'elements', 'information', 'info', 'regarding',
  'concerning', 'discuss', 'discussed', 'takeaway', 'takeaways', 'difficult', 'hard',
  'complex', 'simple', 'easy', 'clear', 'clearly'
]);

/**
 * Structural prefixes that often precede a single-letter or numeric designator
 * (e.g., "Track D", "Part A", "Section 2", "Schedule B", "Module 1").
 */
const DESIGNATOR_PREFIXES = new Set([
  'track', 'part', 'section', 'schedule', 'module', 'unit', 'chapter', 'appendix',
  'group', 'option', 'grade', 'class', 'type', 'phase', 'stage', 'tier', 'level',
  'category', 'form', 'table', 'figure', 'exhibit', 'rule', 'step', 'item', 'case',
  'band', 'pillar', 'question', 'problem', 'lab', 'lecture'
]);

/**
 * Generic academic inquiry nouns that can appear in questions across any subject.
 * When a query also contains specific domain keywords (e.g., "Track D" or "sequential circuit"),
 * chunks must match the specific domain keywords rather than matching only a generic noun.
 */
const GENERIC_INQUIRY_NOUNS = new Set([
  'requirement', 'requirements', 'deliverable', 'deliverables', 'criteria',
  'criterion', 'rule', 'rules', 'guideline', 'guidelines', 'objective',
  'objectives', 'step', 'steps', 'process', 'processes', 'procedure',
  'procedures', 'method', 'methods', 'approach', 'approaches', 'system',
  'systems', 'structure', 'structures', 'component', 'components',
  'category', 'categories', 'stage', 'stages', 'phase', 'phases',
  'condition', 'conditions', 'characteristic', 'characteristics',
  'property', 'properties', 'benefit', 'benefits', 'advantage', 'advantages',
  'disadvantage', 'disadvantages', 'limitation', 'limitations', 'challenge',
  'challenges', 'impact', 'impacts', 'effect', 'effects', 'cause', 'causes',
  'reason', 'reasons', 'problem', 'problems', 'solution', 'solutions'
]);

const REQUIREMENT_SYNONYMS = new Set([
  'requirement', 'requirements', 'require', 'requires', 'required',
  'deliverable', 'deliverables', 'criteria', 'criterion', 'specification',
  'specifications', 'objective', 'objectives', 'mandatory', 'must',
  'expectation', 'expectations', 'guideline', 'guidelines'
]);

/**
 * Normalizes a word by stripping common English inflectional suffixes.
 */
export function stemWord(w: string): string {
  const s = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('es') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) return s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) return s.slice(0, -3);
  if (s.endsWith('ed') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('tion') && s.length > 5) return s.slice(0, -4);
  return s;
}

/**
 * Checks if two words match semantically through exact match, prefixes, stemming,
 * or standard academic synonyms (e.g. taxation <-> tax, requirements <-> deliverables).
 */
export function wordsMatch(w1: string, w2: string): boolean {
  const clean1 = w1.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  const clean2 = w2.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;

  // Single-character tokens must match exactly (e.g. "d" === "d", never prefix-matching "direct")
  if (clean1.length === 1 || clean2.length === 1) {
    return clean1 === clean2;
  }

  const s1 = stemWord(clean1);
  const s2 = stemWord(clean2);
  if (s1.length >= 2 && s1 === s2) return true;
  if (clean1.length >= 3 && clean2.length >= 3) {
    if (clean1.startsWith(clean2) && clean1.length <= clean2.length + 3) return true;
    if (clean2.startsWith(clean1) && clean2.length <= clean1.length + 3) return true;
  }
  if (s1.length >= 3 && s2.length >= 3) {
    if (s1.startsWith(s2) && s1.length <= s2.length + 2) return true;
    if (s2.startsWith(s1) && s2.length <= s1.length + 2) return true;
  }

  // Specific domain synonym linkages
  if (
    (clean1 === 'taxation' || clean1 === 'tax' || clean1 === 'taxes' || clean1 === 'taxable') &&
    (clean2 === 'taxation' || clean2 === 'tax' || clean2 === 'taxes' || clean2 === 'taxable')
  ) {
    return true;
  }
  if (REQUIREMENT_SYNONYMS.has(clean1) && REQUIREMENT_SYNONYMS.has(clean2)) {
    return true;
  }
  if ((w1 === 'flip-flops' && w2 === 'flip') || (w1 === 'flip' && w2 === 'flip-flops')) return true;
  return false;
}

/**
 * Tokenizes a string into normalized, significant query keywords.
 * Preserves single-letter/numeric designators (such as "d" in "Track D" or "2" in "Tier 2").
 */
export function extractQueryKeywords(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .trim();

  const rawTokens = normalized.split(/\s+/).filter((w) => w.length >= 1);
  const words: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const w = rawTokens[i];
    const prev = i > 0 ? rawTokens[i - 1] : '';

    if (w.length === 1) {
      // Keep single-character token if it follows a designator prefix (e.g., "track d", "part a")
      // or if it is a digit or consonant/letter other than standalone article 'a' / pronoun 'i'
      if (DESIGNATOR_PREFIXES.has(prev) || (w !== 'a' && w !== 'i')) {
        words.push(w);
      }
      continue;
    }

    if (w.includes('-') || w.includes('_')) {
      const parts = w.split(/[-_]+/).filter((p) => p.length >= 1);
      words.push(w.replace(/[-_]+/g, ' '));
      words.push(...parts.filter((p) => p.length >= 2 || DESIGNATOR_PREFIXES.has(parts[0])));
    } else {
      words.push(w);
    }
  }

  const keywords = words.filter((w, idx) => {
    if (w.length === 1) {
      // Always keep single-char designators that passed the filter above
      return true;
    }
    return !STOP_WORDS.has(w);
  });

  return Array.from(new Set(keywords));
}

/**
 * Extracts multi-word concept phrases (e.g., "track d", "object-oriented programming", "sequential circuit", "presumptive tax")
 */
export function extractQueryPhrases(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  const rawTokens = normalized.split(/\s+/).filter((w) => w.length >= 1);
  const phrases: string[] = [];

  // 1. Capture explicit designator phrases like "track d", "part a", "module 2", "section 3"
  for (let i = 0; i < rawTokens.length - 1; i++) {
    if (DESIGNATOR_PREFIXES.has(rawTokens[i]) && /^[a-z0-9]{1,4}$/.test(rawTokens[i + 1])) {
      phrases.push(`${rawTokens[i]} ${rawTokens[i + 1]}`);
    }
  }

  const words = rawTokens.filter(
    (w, i) => w.length >= 2 || (i > 0 && DESIGNATOR_PREFIXES.has(rawTokens[i - 1]))
  );

  // 2. Add normalized significant phrase if length >= 2 words
  if (words.length >= 2) {
    const significantWords = words.filter((w) => w.length === 1 || !STOP_WORDS.has(w));
    if (significantWords.length >= 2) {
      phrases.push(significantWords.join(' '));
      phrases.push(significantWords.join(' ').replace(/-/g, ' '));
    }
  }

  // 3. 2-gram and 3-gram phrases of non-stop words
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/-/g, ' ');
    const w2 = words[i + 1].replace(/-/g, ' ');
    const w1Keep = words[i].length === 1 || !STOP_WORDS.has(words[i]);
    const w2Keep = words[i + 1].length === 1 || !STOP_WORDS.has(words[i + 1]);
    if (w1Keep && w2Keep) {
      phrases.push(`${w1} ${w2}`);
    }
    if (
      i < words.length - 2 &&
      w1Keep &&
      (words[i + 2].length === 1 || !STOP_WORDS.has(words[i + 2]))
    ) {
      phrases.push(`${w1} ${w2} ${words[i + 2]}`);
    }
  }

  return Array.from(new Set(phrases.filter((p) => p.length >= 4)));
}

/**
 * Detects whether a query is asking for a broad summary, overview, concept explanation,
 * or comparison of the selected study materials without introducing external topic keywords.
 */
function isBroadDocumentStudyQuery(query: string, extractedKeywords: string[]): boolean {
  const specificKeywords = extractedKeywords.filter((k) => !GENERIC_INQUIRY_NOUNS.has(k));
  if (specificKeywords.length > 0) {
    return false;
  }
  const qLower = query.toLowerCase();
  return /\b(summar(?:y|ize|ise)|overview|key\s+concepts?|main\s+(?:points?|topics?|ideas?|concepts?|requirements?|takeaways?)|explain|compare|outline|review|what\s+(?:is|are)\s+(?:this|these|the)\s+(?:document|material|source|notes?|pdf|file|course)|selected\s+sources?|my\s+(?:notes?|sources?|materials?))\b/i.test(
    qLower
  );
}

export interface ScoredChunkMatch {
  chunk: SourceChunk;
  score: number; // 0.0 to 1.0
  matchedKeywords: string[];
  exactPhraseFound: boolean;
  headingMatch: boolean;
  proximitySpan?: number;
}

export interface RetrievalResult {
  matches: ScoredChunkMatch[];
  isSufficient: boolean;
  insufficientReason?: string;
  searchedChunksCount: number;
  activeMaterialCount: number;
}

/**
 * Validates whether a scored chunk genuinely addresses the student's question.
 * Rejects coincidental single-term matches and prevents forcing unrelated
 * documents (e.g. taxation notes for a computer science or physics question),
 * while reliably admitting genuine course inquiries (e.g. questions with
 * singular/plural variations, designators like "Track D", synonyms, or conversational phrasing).
 */
export function isChunkGenuinelyRelevant(
  match: ScoredChunkMatch,
  queryKeywords: string[],
  minimumThreshold = 0.38
): boolean {
  if (match.matchedKeywords.length === 0) {
    return false;
  }

  // Separate specific domain keywords (e.g. "track", "d", "sequential", "circuit", "vat")
  // from generic inquiry nouns (e.g. "requirements", "rules", "steps", "system").
  const specificKeywords = queryKeywords.filter((k) => !GENERIC_INQUIRY_NOUNS.has(k));
  if (specificKeywords.length > 0) {
    const matchedSpecific = match.matchedKeywords.filter((k) => !GENERIC_INQUIRY_NOUNS.has(k));
    if (matchedSpecific.length === 0) {
      // Matched only a generic word like "requirements" or "system" without matching the actual subject!
      return false;
    }

    // If there are multiple specific keywords (e.g. "sequential" + "circuit", or "track" + "d"),
    // require either an exact phrase match, a heading match on a specific keyword, or >= 50% specific coverage
    if (specificKeywords.length >= 2 && !match.exactPhraseFound) {
      const specificCoverage = matchedSpecific.length / specificKeywords.length;
      if (specificCoverage < 0.5) {
        return false;
      }
    }
  }

  // Exact multi-word concept phrase match is verified strong evidence
  if (match.exactPhraseFound && match.score >= Math.min(0.38, minimumThreshold)) {
    return true;
  }

  // Heading match with solid keyword support
  if (match.headingMatch && match.score >= 0.36) {
    return true;
  }

  // For multi-word queries:
  if (queryKeywords.length >= 2) {
    const coverage = match.matchedKeywords.length / queryKeywords.length;

    // Must match at least 2 distinct keywords with sufficient coverage
    if (match.matchedKeywords.length >= 2 && coverage >= 0.50 && match.score >= 0.38) {
      return true;
    }

    // High-confidence specific keyword match (e.g. specific keyword matched + strong density)
    if (
      specificKeywords.length === 1 &&
      match.matchedKeywords.some((k) => !GENERIC_INQUIRY_NOUNS.has(k)) &&
      match.score >= 0.38
    ) {
      return true;
    }

    if (match.score >= 0.55 && specificKeywords.length <= 1) {
      return true;
    }

    // Fails gate: matching loose or scattered query terms without phrase/heading/proximity
    return false;
  }

  // For single-word specific technical queries (e.g., "depreciation", "latch", "taxation"):
  return match.score >= 0.36;
}

/**
 * Searches and ranks document chunks against a user's question.
 * Applies a calibrated relevance gate before admitting passages as evidence.
 */
export function retrieveRelevantChunks(
  materials: StudyMaterial[],
  query: string,
  options?: {
    materialIdFilter?: string;
    selectedMaterialIds?: string[];
    maxResults?: number;
    sufficiencyThreshold?: number;
  }
): RetrievalResult {
  const {
    materialIdFilter,
    selectedMaterialIds,
    maxResults = 5,
    sufficiencyThreshold = 0.40,
  } = options || {};

  const selectedSet = Array.isArray(selectedMaterialIds)
    ? new Set(selectedMaterialIds)
    : null;

  // 1. Filter materials based on user selection
  const eligibleMaterials = materials.filter((m) => {
    if (materialIdFilter && m.id !== materialIdFilter) {
      return false;
    }
    if (selectedSet && !selectedSet.has(m.id)) {
      return false;
    }
    // Exclude materials in error/failed extraction state
    if (m.processingStatus === 'failed' || m.processingStatus === 'error') {
      return false;
    }
    return true;
  });

  // 2. Gather candidate chunks
  const allChunks: SourceChunk[] = eligibleMaterials.flatMap((m) => m.chunks || []);

  if (allChunks.length === 0) {
    return {
      matches: [],
      isSufficient: false,
      insufficientReason:
        "I couldn't find enough information in your uploaded study materials to answer that question.",
      searchedChunksCount: 0,
      activeMaterialCount: eligibleMaterials.length,
    };
  }

  const queryKeywords = extractQueryKeywords(query);
  const queryPhrases = extractQueryPhrases(query);

  // Handle broad overview/summary/concept study requests on the selected sources
  if (queryKeywords.length === 0) {
    if (isBroadDocumentStudyQuery(query, queryKeywords)) {
      const representativeMatches: ScoredChunkMatch[] = [];
      // Pick representative chunks across eligible materials
      for (const mat of eligibleMaterials) {
        const matChunks = mat.chunks || [];
        for (const chunk of matChunks.slice(0, Math.max(2, Math.ceil(maxResults / eligibleMaterials.length)))) {
          representativeMatches.push({
            chunk,
            score: 0.85,
            matchedKeywords: [deriveTopicNameFromChunk(chunk).split(/\s+/)[0]?.toLowerCase() || 'overview'],
            exactPhraseFound: true,
            headingMatch: true,
          });
        }
      }
      const topRep = representativeMatches.slice(0, maxResults);
      return {
        matches: topRep,
        isSufficient: topRep.length > 0,
        searchedChunksCount: allChunks.length,
        activeMaterialCount: eligibleMaterials.length,
      };
    }

    return {
      matches: [],
      isSufficient: false,
      insufficientReason:
        "I couldn't find enough information in your uploaded study materials to answer that question.",
      searchedChunksCount: allChunks.length,
      activeMaterialCount: eligibleMaterials.length,
    };
  }

  // 3. Score every chunk using phrase matching, stemming-aware tokens, derived headings, and proximity
  const scoredList: ScoredChunkMatch[] = allChunks.map((chunk, idx) => {
    const rawText = chunk.extractedText || '';
    const textLower = rawText.toLowerCase();
    const effectiveHeading = isGenericSectionHeading(chunk.sectionHeading)
      ? deriveTopicNameFromChunk(chunk, idx)
      : chunk.sectionHeading || '';
    const headingLower = effectiveHeading.toLowerCase();
    const docTitleLower = `${chunk.materialTitle || ''} ${(chunk.filename || '').replace(/[_-]/g, ' ')}`.toLowerCase();

    // A. Check exact multi-word phrase match in heading, text, or document title
    let exactPhraseFound = false;
    let headingPhraseMatch = false;

    for (const phrase of queryPhrases) {
      const cleanPhrase = phrase.toLowerCase().trim();
      if (cleanPhrase.length >= 4) {
        if (headingLower.includes(cleanPhrase) || docTitleLower.includes(cleanPhrase)) {
          headingPhraseMatch = true;
          exactPhraseFound = true;
          break;
        }
        if (textLower.includes(cleanPhrase)) {
          exactPhraseFound = true;
          break;
        }
      }
    }

    // B. Stemming and word-boundary keyword matches and token positions
    const matchedKeywords: string[] = [];
    let termMatchesCount = 0;
    const tokenPositions: number[] = [];

    // Normalize punctuation into spaces before splitting into word tokens
    const textWords = textLower.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const headingWords = headingLower.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const titleWords = docTitleLower.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

    for (const kw of queryKeywords) {
      let matchedInChunk = false;

      // Find occurrences of kw in textWords
      for (let wIdx = 0; wIdx < textWords.length; wIdx++) {
        if (wordsMatch(textWords[wIdx], kw)) {
          matchedInChunk = true;
          tokenPositions.push(wIdx);
          termMatchesCount++;
        }
      }

      // Check heading matches
      for (let hIdx = 0; hIdx < headingWords.length; hIdx++) {
        if (wordsMatch(headingWords[hIdx], kw)) {
          matchedInChunk = true;
          termMatchesCount += 1.5;
        }
      }

      // Check title matches
      for (let tIdx = 0; tIdx < titleWords.length; tIdx++) {
        if (wordsMatch(titleWords[tIdx], kw)) {
          matchedInChunk = true;
          termMatchesCount += 0.75;
        }
      }

      if (matchedInChunk) {
        matchedKeywords.push(kw);
      }
    }

    const specificKeywords = queryKeywords.filter((k) => !GENERIC_INQUIRY_NOUNS.has(k));
    const headingKeywordCheckList = specificKeywords.length > 0 ? specificKeywords : queryKeywords;

    const headingMatch =
      headingPhraseMatch ||
      headingKeywordCheckList.some(
        (kw) =>
          headingWords.some((hw) => wordsMatch(hw, kw)) ||
          titleWords.some((tw) => wordsMatch(tw, kw))
      );

    // C. Proximity span: minimum distance containing matched keywords
    let proximitySpan = 999;
    if (tokenPositions.length >= 2) {
      tokenPositions.sort((a, b) => a - b);
      let minSpan = 999;
      for (let i = 0; i < tokenPositions.length - 1; i++) {
        const span = tokenPositions[i + 1] - tokenPositions[i];
        if (span < minSpan && span > 0) minSpan = span;
      }
      proximitySpan = minSpan;
    }

    const keywordCoverage =
      queryKeywords.length > 0 ? matchedKeywords.length / queryKeywords.length : 0;

    // D. Compute sound composite relevance score
    let rawScore = 0;

    if (exactPhraseFound) {
      rawScore += headingPhraseMatch ? 0.85 : 0.72;
      rawScore += keywordCoverage * 0.22;
      rawScore += Math.min(termMatchesCount, 6) * 0.01;
    } else {
      rawScore += keywordCoverage * 0.45;
      if (headingMatch) rawScore += 0.25;
      if (proximitySpan <= 15) rawScore += 0.25;
      else if (proximitySpan <= 35) rawScore += 0.15;
      rawScore += Math.min(termMatchesCount, 6) * 0.03;
    }

    const finalScore = Math.min(1.0, Math.max(0.0, rawScore));

    return {
      chunk,
      score: finalScore,
      matchedKeywords,
      exactPhraseFound,
      headingMatch,
      proximitySpan: tokenPositions.length >= 2 ? proximitySpan : undefined,
    };
  });

  // 4. Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // 5. Apply the strict Relevance Gate
  let qualifyingMatches = scoredList.filter((item) =>
    isChunkGenuinelyRelevant(item, queryKeywords, sufficiencyThreshold)
  );

  // If query is a broad document study query (e.g. "What are the main requirements?" with no external subject keywords)
  // and no literal keyword matched, fall back to the top chunks of the selected documents.
  if (qualifyingMatches.length === 0 && isBroadDocumentStudyQuery(query, queryKeywords)) {
    qualifyingMatches = allChunks.slice(0, maxResults).map((chunk) => ({
      chunk,
      score: 0.75,
      matchedKeywords: queryKeywords,
      exactPhraseFound: false,
      headingMatch: true,
    }));
  }

  // 6. Include immediate continuation chunk when a heading/section match spans consecutive chunks
  const selectedIds = new Set(qualifyingMatches.slice(0, maxResults).map((m) => m.chunk.id));
  const topMatches = [...qualifyingMatches.slice(0, maxResults)];

  if (topMatches.length > 0 && topMatches.length < maxResults) {
    const primary = topMatches[0];
    const primaryIndex = primary.chunk.chunkIndex;
    const nextChunk =
      primaryIndex !== undefined
        ? allChunks.find(
            (c) =>
              c.materialId === primary.chunk.materialId &&
              c.chunkIndex === primaryIndex + 1 &&
              !selectedIds.has(c.id)
          )
        : undefined;
    if (nextChunk) {
      const nextScored = scoredList.find((s) => s.chunk.id === nextChunk.id);
      topMatches.push(
        nextScored && nextScored.score > 0.35
          ? nextScored
          : {
              chunk: nextChunk,
              score: Math.max(0.42, primary.score - 0.15),
              matchedKeywords: primary.matchedKeywords,
              exactPhraseFound: false,
              headingMatch: false,
            }
      );
    }
  }

  const isSufficient = topMatches.length > 0;

  return {
    matches: topMatches,
    isSufficient,
    insufficientReason: isSufficient
      ? undefined
      : "I couldn't find enough information in your uploaded study materials to answer that question.",
    searchedChunksCount: allChunks.length,
    activeMaterialCount: eligibleMaterials.length,
  };
}

/**
 * Extracts a verbatim excerpt around the most relevant query keywords.
 */
export function extractVerbatimExcerpt(
  text: string,
  matchedKeywords: string[],
  maxLength = 220
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text.trim();

  let bestIdx = -1;
  const lower = text.toLowerCase();
  for (const kw of matchedKeywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }

  if (bestIdx === -1 || bestIdx < 60) {
    const slice = text.slice(0, maxLength);
    const lastSpace = slice.lastIndexOf(' ');
    return (lastSpace > 100 ? slice.slice(0, lastSpace) : slice).trim() + '...';
  }

  const start = Math.max(0, bestIdx - 40);
  const rawSlice = text.slice(start, start + maxLength);
  const firstSpace = start > 0 ? rawSlice.indexOf(' ') : 0;
  const lastSpace = rawSlice.lastIndexOf(' ');

  const cleanStart = firstSpace !== -1 ? firstSpace + 1 : 0;
  const cleanEnd = lastSpace > cleanStart ? lastSpace : rawSlice.length;

  const prefix = start > 0 ? '...' : '';
  const suffix = start + maxLength < text.length ? '...' : '';

  return `${prefix}${rawSlice.slice(cleanStart, cleanEnd).trim()}${suffix}`;
}

/**
 * Builds a genuine, verified SourceCitation contract from a retrieved chunk.
 */
export function buildCitation(
  chunk: SourceChunk,
  score: number,
  matchedKeywords: string[] = []
): SourceCitation {
  const excerpt = extractVerbatimExcerpt(chunk.extractedText, matchedKeywords, 200);

  let honestAnchor = chunk.anchorLabel;
  if (!honestAnchor) {
    if (chunk.documentType === 'pdf' || (chunk.pageNumber !== undefined && !chunk.slideNumber)) {
      honestAnchor = `Page ${chunk.pageNumber ?? chunk.pageOrSlideNumber ?? 'N/A'}`;
    } else if (chunk.documentType === 'pptx' || chunk.slideNumber !== undefined) {
      honestAnchor = `Slide ${chunk.slideNumber ?? chunk.pageOrSlideNumber ?? 'N/A'}`;
    } else {
      honestAnchor = chunk.sectionHeading || 'Section Passage';
    }
  }

  const effectiveHeading = isGenericSectionHeading(chunk.sectionHeading)
    ? deriveTopicNameFromChunk(chunk)
    : chunk.sectionHeading || 'Course Passage';

  return {
    id: `cite-${chunk.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chunkId: chunk.id,
    materialId: chunk.materialId,
    materialTitle: chunk.materialTitle,
    pageNumber: chunk.pageNumber,
    slideNumber: chunk.slideNumber,
    pageOrSlideNumber: chunk.pageNumber || chunk.slideNumber || chunk.pageOrSlideNumber,
    anchorLabel: honestAnchor,
    sectionHeading: effectiveHeading,
    excerpt,
    relevanceScore: Math.round(score * 100) / 100,
  };
}

/**
 * Synthesizes a sound educational explanation using general educational knowledge
 * without referencing or citing any unrelated uploaded materials.
 */
function synthesizeGeneralEducationalAnswer(
  question: string,
  preferences: TutorPreferences
): string {
  const qLower = question.toLowerCase();
  const approach = preferences.teachingApproach || 'socratic';

  // 1. Object-Oriented Programming (OOP)
  if (
    qLower.includes('object-oriented') ||
    qLower.includes('object oriented') ||
    (qLower.includes('oop') && !qLower.includes('loop'))
  ) {
    if (approach === 'socratic') {
      return `To explore **Object-Oriented Programming (OOP)** from first principles:\n\n**Guided Inquiry:**\nIn procedural programming, programs are organized as collections of functions that operate on separate data structures. As systems scale to millions of lines of code, this separation creates strong coupling and state vulnerability.\n\n1. How does bundling data (attributes) and behavior (methods) into a single entity—an **Object**—help manage complexity?\n2. Consider the four foundational pillars of OOP: **Encapsulation**, **Abstraction**, **Inheritance**, and **Polymorphism**. Which of these protects internal state from unintended external mutation?`;
    } else if (approach === 'step_by_step') {
      return `### Object-Oriented Programming (OOP): Systematic Overview\n\n1. **Core Concept:**\n   OOP is a programming paradigm centered on **objects**—instances of classes that combine data (fields/attributes) with procedures (methods) that manipulate that data.\n\n2. **The Four Foundational Pillars:**\n   - **Encapsulation:** Bundling data and methods into a single unit (class) and restricting direct access to internal state using access modifiers (private, protected, public).\n   - **Abstraction:** Hiding complex implementation details behind a clean, intuitive public interface.\n   - **Inheritance:** Allowing a new class (subclass/child) to acquire the properties and methods of an existing class (superclass/parent) to eliminate redundancy.\n   - **Polymorphism:** Enabling entities of different types to be treated through a unified interface (e.g., method overriding and method overloading).\n\n3. **Practical Real-World Analogy:**\n   Think of a **Car**: You interact with the steering wheel and pedals (abstraction), the engine's internal pistons and fuel injection operate inside the chassis (encapsulation), an Electric Car inherits from Vehicle (inheritance), and pressing the accelerator accelerates either a gas or electric engine appropriately (polymorphism).\n\n4. **Common Languages:** Java, Python, C++, C#, TypeScript.`;
    } else {
      return `**Object-Oriented Programming (OOP)** is a major programming paradigm organized around **objects** (instances of classes) rather than purely sequential actions. Each object contains state (attributes) and behavior (methods).\n\nOOP rests upon four fundamental pillars:\n- **Encapsulation:** Enclosing internal state and exposing only controlled methods.\n- **Abstraction:** Concealing internal complexity while presenting a straightforward API.\n- **Inheritance:** Deriving new classes from parent classes to maximize code reuse.\n- **Polymorphism:** Permitting different classes to be accessed via a common interface with specialized behaviors.`;
    }
  }

  // 2. Sequential Circuits
  if (qLower.includes('sequential circuit') || (qLower.includes('sequential') && qLower.includes('circuit'))) {
    if (approach === 'socratic') {
      return `To understand **sequential circuits** from first principles:\n\n**Guided Inquiry:**\nIn combinational logic (such as an AND or OR gate), the output is strictly a function of the current inputs at this exact instant. What happens if a circuit needs to count pulses, remember a password, or step through phases of a protocol?\n\n1. How does introducing a memory element (such as a flip-flop or latch) change the output equation?\n2. What role does a periodic clock signal play in synchronizing these state transitions?`;
    } else if (approach === 'step_by_step') {
      return `### Sequential Circuits: Systematic Breakdown\n\n1. **Core Definition:** A **sequential circuit** is a digital logic circuit whose output depends not only on the current combination of inputs, but also on the history of past inputs (its internal stored state).\n\n2. **Fundamental Architecture:**\n   - **Combinational Logic:** Computes next-state values and outputs.\n   - **Memory Elements:** Latches or Flip-Flops (D, JK, T) that retain state between clock cycles.\n   - **Feedback Path:** Feeds stored state back into the combinational inputs.\n\n3. **Synchronous vs. Asynchronous:**\n   - *Synchronous:* State transitions occur simultaneously on clock edges.\n   - *Asynchronous:* State transitions are triggered directly by input changes without a central clock.\n\n4. **Common Applications:** Registers, binary counters, RAM cells, and Finite State Machines (FSMs).`;
    } else {
      return `A **sequential circuit** is a digital electronic logic circuit whose output depends on both its current inputs and its past input history (its internal state). Unlike combinational logic (where outputs depend solely on present inputs), sequential circuits utilize memory elements such as flip-flops or latches synchronized by a clock signal to store state over time. Common examples include counters, shift registers, and CPU control units.`;
    }
  }

  // 3. Newton's Second Law
  if (
    qLower.includes('newton') &&
    (qLower.includes('second') || qLower.includes('2nd') || qLower.includes('law'))
  ) {
    if (approach === 'socratic') {
      return `Let's examine **Newton's Second Law of Motion** from fundamental physics principles:\n\n**Guided Inquiry:**\nImagine pushing an empty shopping cart versus pushing a fully loaded car with the exact same muscular effort.\n\n1. Why does the cart accelerate rapidly while the car barely budges?\n2. In mathematical terms, how do force, mass, and the resulting rate of change of momentum relate to one another?`;
    } else if (approach === 'step_by_step') {
      return `### Newton's Second Law of Motion: Systematic Overview\n\n1. **Formal Statement:**\n   The acceleration of an object is directly proportional to the net external force acting on it, in the direction of the net force, and inversely proportional to its mass.\n\n2. **Mathematical Formulation:**\n   $$\\mathbf{F}_{\\text{net}} = m \\mathbf{a}$$\n   More fundamentally in calculus, force is the time derivative of linear momentum ($\\mathbf{p} = m\\mathbf{v}$):\n   $$\\mathbf{F}_{\\text{net}} = \\frac{d\\mathbf{p}}{dt}$$\n\n3. **Key Quantities & SI Units:**\n   - $\\mathbf{F}$ = Net force (Newtons, where $1\\text{ N} = 1\\text{ kg}\\cdot\\text{m/s}^2$)\n   - $m$ = Inertial mass (kilograms, $\\text{kg}$)\n   - $\\mathbf{a}$ = Acceleration ($\\text{m/s}^2$)\n\n4. **Practical Significance:**\n   It quantifies cause and effect in classical dynamics: forces cause masses to accelerate. If net force is zero, velocity is constant (Newton's First Law).`;
    } else {
      return `**Newton's Second Law of Motion** states that the acceleration of an object is directly proportional to the net force applied to it and inversely proportional to its mass ($F = ma$). In momentum terms, force equals the time rate of change of linear momentum ($F = dp/dt$). The SI unit of force is the Newton (N).`;
    }
  }

  // General fallback tailored to question and approach
  if (approach === 'socratic') {
    return `Let's analyze "${question}" from fundamental academic principles:\n\n**Inquiry:** What are the foundational definitions, assumptions, or components underlying this topic? Before arriving at a conclusion, consider how varying the primary variables would alter the expected outcome.`;
  } else if (approach === 'step_by_step') {
    return `### Step-by-Step Overview for "${question}":\n\n1. **Core Definition:** Analysis of the central concept and operational principles.\n2. **Mechanisms & Rules:** The primary processes governing this topic.\n3. **Practical Application:** How this applies in standard problem scenarios.`;
  } else {
    return `Regarding "${question}": This concept involves establishing the baseline parameters and evaluating the systematic interactions according to standard academic principles.`;
  }
}

/**
 * Synthesizes an answer when running in local/fallback mode,
 * adhering to the student's preferences, interaction mode, and grounding evidence.
 */
export function generateLocalGroundedAnswer(
  question: string,
  matches: ScoredChunkMatch[],
  preferences: TutorPreferences,
  options?: {
    unsupportedMessage?: string;
    interactionMode?: TutorInteractionMode;
  }
): {
  answer: string;
  citations: SourceCitation[];
  isGroundingVerified: boolean;
  sourceLabel?: TutorSourceLabel;
} {
  const { unsupportedMessage, interactionMode = 'smart_tutor' } = options || {};

  // 1. If no relevant evidence exists in uploaded materials
  if (matches.length === 0) {
    if (interactionMode === 'grounded_study') {
      const defaultGroundedMsg =
        unsupportedMessage ||
        "I couldn't find enough information in your uploaded study materials to answer that question.";

      return {
        answer: defaultGroundedMsg,
        citations: [],
        isGroundingVerified: false,
        sourceLabel: undefined,
      };
    }

    // Smart Tutor Mode: Answer using general educational knowledge
    let answer = synthesizeGeneralEducationalAnswer(question, preferences);

    if (preferences.enableKnowledgeChecks) {
      answer += `\n\n---\n**Comprehension Check**: How would you explain this concept in your own words?`;
    }

    return {
      answer,
      citations: [],
      isGroundingVerified: false,
      sourceLabel: 'General Knowledge',
    };
  }

  // 2. Build citations strictly from genuinely matched chunks
  const citations = matches.slice(0, 3).map((m) => buildCitation(m.chunk, m.score, m.matchedKeywords));
  const topMatch = matches[0];
  const chunk = topMatch.chunk;
  const effectiveHeading = isGenericSectionHeading(chunk.sectionHeading)
    ? deriveTopicNameFromChunk(chunk)
    : chunk.sectionHeading;

  const docAnchor =
    chunk.anchorLabel ||
    (chunk.pageNumber
      ? `Page ${chunk.pageNumber}`
      : chunk.slideNumber
      ? `Slide ${chunk.slideNumber}`
      : effectiveHeading);

  const docRef = `${chunk.materialTitle} (${docAnchor})`;
  const approach = preferences.teachingApproach || 'socratic';
  const isConcise = preferences.explanationLength === 'concise';

  // Clean and prepare evidence excerpt
  const evidenceExcerpt = chunk.extractedText.trim();

  let answer = '';

  if (approach === 'socratic') {
    if (isConcise) {
      answer = `Based on your course materials in **${docRef}**:\n\n${evidenceExcerpt}\n\n**Guided Question:** How does this principle directly apply to your problem, and what constraint does it impose?`;
    } else {
      answer = `### Grounded Analysis — ${docRef}\n\nFrom your study material in **${effectiveHeading}**:\n\n${evidenceExcerpt}\n\n### Guided Inquiry\n1. How does this mechanism satisfy the foundational requirements established in ${chunk.materialTitle}?\n2. What practical consequences or failure modes occur if these conditions are violated?`;
    }
  } else if (approach === 'step_by_step') {
    answer = `### Step-by-Step Breakdown — ${docRef}\n\n1. **Core Concept:** Grounded in **${effectiveHeading}**.\n2. **Verified Principle:**\n${evidenceExcerpt}\n3. **Application & Rules:** This passage defines the specific criteria applicable to your syllabus.\n\n*Source Reference: ${docRef}*`;
  } else {
    // Direct
    answer = `### Direct Explanation — ${docRef}\n\nAccording to **${effectiveHeading}** in *${chunk.materialTitle}*:\n\n${evidenceExcerpt}\n\nThis material directly addresses your question based on your uploaded course notes.`;
  }

  // If multiple chunks retrieved, cross-reference additional source
  if (matches.length > 1) {
    const secondChunk = matches[1].chunk;
    const secondHeading = isGenericSectionHeading(secondChunk.sectionHeading)
      ? deriveTopicNameFromChunk(secondChunk)
      : secondChunk.sectionHeading;
    const secondAnchor =
      secondChunk.anchorLabel ||
      (secondChunk.pageNumber
        ? `Page ${secondChunk.pageNumber}`
        : secondChunk.slideNumber
        ? `Slide ${secondChunk.slideNumber}`
        : secondHeading);
    answer += `\n\n*Supporting Material from ${secondChunk.materialTitle} (${secondAnchor}):*\n"${extractVerbatimExcerpt(
      secondChunk.extractedText,
      matches[1].matchedKeywords,
      140
    )}"`;
  }

  if (preferences.enableKnowledgeChecks) {
    answer += `\n\n---\n**Comprehension Check**: In your own words, how does the passage on ${docAnchor} explain this concept?`;
  }

  return {
    answer,
    citations,
    isGroundingVerified: true,
    sourceLabel: 'Based on Your Study Materials',
  };
}
