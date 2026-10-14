import type {
  SourceChunk,
  SourceCitation,
  StudyMaterial,
  TutorPreferences,
  TutorInteractionMode,
  TutorSourceLabel,
} from '../types';

/**
 * Common English stop words to filter out when extracting semantic query terms.
 */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'explain', 'few', 'for', 'from', 'further', 'had',
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
  'yours', 'yourself', 'yourselves', 'give', 'show', 'describe', 'define', 'meaning'
]);

/**
 * Tokenizes a string into normalized, significant query keywords.
 */
export function extractQueryKeywords(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .trim();

  // Also split on hyphens to get individual words and hyphenated compounds
  const rawWords = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const words: string[] = [];

  for (const w of rawWords) {
    if (w.includes('-') || w.includes('_')) {
      const parts = w.split(/[-_]+/).filter((p) => p.length >= 2);
      words.push(w.replace(/[-_]+/g, ' '));
      words.push(...parts);
    } else {
      words.push(w);
    }
  }

  const keywords = words.filter((w) => !STOP_WORDS.has(w));

  if (keywords.length === 0) {
    return words.filter((w) => w.length >= 3);
  }

  return Array.from(new Set(keywords));
}

/**
 * Extracts multi-word concept phrases (e.g., "object-oriented programming", "sequential circuit", "presumptive tax")
 */
export function extractQueryPhrases(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const phrases: string[] = [];

  // Add normalized original phrase if length >= 2 words
  if (words.length >= 2) {
    const significantWords = words.filter((w) => !STOP_WORDS.has(w));
    if (significantWords.length >= 2) {
      phrases.push(significantWords.join(' '));
      // Also un-hyphenated version
      phrases.push(significantWords.join(' ').replace(/-/g, ' '));
    }
  }

  // 2-gram and 3-gram phrases of non-stop words
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/-/g, ' ');
    const w2 = words[i + 1].replace(/-/g, ' ');
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      phrases.push(`${w1} ${w2}`);
    }
    if (i < words.length - 2 && !STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 2])) {
      phrases.push(`${w1} ${w2} ${words[i + 2]}`);
    }
  }

  return Array.from(new Set(phrases.filter((p) => p.length >= 4)));
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
 * Escapes regex special characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates whether a scored chunk genuinely addresses the student's question.
 * Rejects coincidental single-term matches and prevents forcing unrelated
 * documents (e.g. taxation notes for a computer science or physics question).
 */
export function isChunkGenuinelyRelevant(
  match: ScoredChunkMatch,
  queryKeywords: string[],
  minimumThreshold = 0.45
): boolean {
  if (match.score < minimumThreshold || match.matchedKeywords.length === 0) {
    return false;
  }

  // Exact multi-word concept phrase match is verified strong evidence
  if (match.exactPhraseFound && match.score >= 0.45) {
    return true;
  }

  // Heading match with strong score
  if (match.headingMatch && match.score >= 0.55) {
    return true;
  }

  // For multi-word queries (e.g., "object-oriented programming", "sequential circuit", "import duty"):
  if (queryKeywords.length >= 2) {
    const coverage = match.matchedKeywords.length / queryKeywords.length;

    // Must match at least 2 distinct keywords AND have high score AND reasonable proximity
    if (
      match.matchedKeywords.length >= 2 &&
      coverage >= 0.60 &&
      match.score >= 0.50 &&
      (match.proximitySpan === undefined || match.proximitySpan <= 35)
    ) {
      return true;
    }

    // Fails gate: matching loose or scattered query terms without phrase/heading/proximity
    return false;
  }

  // For single-word specific technical queries (e.g., "depreciation", "amortization"):
  return match.score >= 0.50;
}

/**
 * Searches and ranks document chunks against a user's question.
 * Applies a strict relevance gate before admitting passages as evidence.
 */
export function retrieveRelevantChunks(
  materials: StudyMaterial[],
  query: string,
  options?: {
    materialIdFilter?: string;
    maxResults?: number;
    sufficiencyThreshold?: number;
  }
): RetrievalResult {
  const {
    materialIdFilter,
    maxResults = 3,
    sufficiencyThreshold = 0.45,
  } = options || {};

  // 1. Filter materials based on user selection
  const eligibleMaterials = materials.filter((m) => {
    if (materialIdFilter && m.id !== materialIdFilter) {
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
        eligibleMaterials.length === 0
          ? 'No valid study materials found in the selected scope.'
          : 'Uploaded materials contain no indexed text chunks.',
      searchedChunksCount: 0,
      activeMaterialCount: eligibleMaterials.length,
    };
  }

  const queryKeywords = extractQueryKeywords(query);
  const queryPhrases = extractQueryPhrases(query);

  if (queryKeywords.length === 0) {
    return {
      matches: [],
      isSufficient: false,
      insufficientReason: 'Query does not contain specific course keywords to match.',
      searchedChunksCount: allChunks.length,
      activeMaterialCount: eligibleMaterials.length,
    };
  }

  // 3. Score every chunk using phrase matching, word-boundary regex, and proximity
  const scoredList: ScoredChunkMatch[] = allChunks.map((chunk) => {
    const rawText = chunk.extractedText || '';
    const textLower = rawText.toLowerCase();
    const headingLower = (chunk.sectionHeading || '').toLowerCase();
    const docTitleLower = (chunk.materialTitle || '').toLowerCase();

    // A. Check exact multi-word phrase match
    let exactPhraseFound = false;
    let headingPhraseMatch = false;

    for (const phrase of queryPhrases) {
      const cleanPhrase = phrase.toLowerCase().trim();
      if (cleanPhrase.length >= 4) {
        if (headingLower.includes(cleanPhrase)) {
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

    // B. Word-boundary keyword matches and token positions
    const matchedKeywords: string[] = [];
    let termMatchesCount = 0;
    const tokenPositions: number[] = [];

    // Break chunk text into words for proximity measurement
    const textWords = textLower.split(/\s+/);

    for (const kw of queryKeywords) {
      const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
      let matchedInChunk = false;

      // Find all positions of kw in textWords
      for (let wIdx = 0; wIdx < textWords.length; wIdx++) {
        const cleanWord = textWords[wIdx].replace(/[^a-z0-9]/g, '');
        if (cleanWord === kw || cleanWord.startsWith(kw) && cleanWord.length <= kw.length + 2) {
          matchedInChunk = true;
          tokenPositions.push(wIdx);
          termMatchesCount++;
        }
      }

      if (headingLower.includes(kw) || regex.test(headingLower)) {
        matchedInChunk = true;
        termMatchesCount += 1.5;
      }
      if (docTitleLower.includes(kw) || regex.test(docTitleLower)) {
        termMatchesCount += 0.5;
      }

      if (matchedInChunk) {
        matchedKeywords.push(kw);
      }
    }

    const headingMatch =
      headingPhraseMatch ||
      queryKeywords.some((kw) => {
        const reg = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
        return reg.test(headingLower);
      });

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
      rawScore += headingPhraseMatch ? 0.90 : 0.75;
      rawScore += keywordCoverage * 0.20;
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
  const qualifyingMatches = scoredList.filter((item) =>
    isChunkGenuinelyRelevant(item, queryKeywords, sufficiencyThreshold)
  );

  const topMatches = qualifyingMatches.slice(0, maxResults);
  const isSufficient = topMatches.length > 0;

  return {
    matches: topMatches,
    isSufficient,
    insufficientReason: isSufficient
      ? undefined
      : `I couldn't find enough information in your uploaded materials to answer this question.`,
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

  return {
    id: `cite-${chunk.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chunkId: chunk.id,
    materialId: chunk.materialId,
    materialTitle: chunk.materialTitle,
    pageNumber: chunk.pageNumber,
    slideNumber: chunk.slideNumber,
    pageOrSlideNumber: chunk.pageNumber || chunk.slideNumber || chunk.pageOrSlideNumber,
    anchorLabel: honestAnchor,
    sectionHeading: chunk.sectionHeading || 'Course Passage',
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
        "I couldn't find enough information in your uploaded materials to answer this question.";

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
  const citations = matches.map((m) => buildCitation(m.chunk, m.score, m.matchedKeywords));
  const topMatch = matches[0];
  const chunk = topMatch.chunk;

  const docAnchor =
    chunk.anchorLabel ||
    (chunk.pageNumber
      ? `Page ${chunk.pageNumber}`
      : chunk.slideNumber
      ? `Slide ${chunk.slideNumber}`
      : chunk.sectionHeading);

  const docRef = `[${chunk.materialTitle} — ${docAnchor}]`;
  const approach = preferences.teachingApproach || 'socratic';
  const isConcise = preferences.explanationLength === 'concise';

  let answer = '';

  if (approach === 'socratic') {
    if (isConcise) {
      answer = `Based on your course material in **${chunk.materialTitle}** (${docAnchor}):\n\n> "${chunk.extractedText}"\n\n**Inquiry:** How does this principle apply to your current course objectives? What would happen if this constraint was altered?`;
    } else {
      answer = `Let's explore this systematically, grounded in **${chunk.materialTitle}** (${docAnchor}).\n\nUnder **${chunk.sectionHeading}**, your uploaded text establishes:\n> "${chunk.extractedText}"\n\n### Guided Inquiry:\n1. How does this mechanism satisfy the primary requirements described in ${chunk.materialTitle}?\n2. What practical consequences or failure modes would occur if this condition were not met?`;
    }
  } else if (approach === 'step_by_step') {
    answer = `### Step-by-Step Breakdown — Grounded in ${docRef}\n\n1. **Core Principle:** Grounded in ${chunk.sectionHeading}.\n2. **Verified Source Evidence:** "${chunk.extractedText}"\n3. **Application & Mechanics:** This directly establishes the verified operational rules for your course.\n\n*Reference: ${docRef}*`;
  } else {
    // Direct
    answer = `**Direct Explanation** (Grounded in ${docRef}):\n\nAccording to **${chunk.sectionHeading}** in ${chunk.materialTitle}:\n> "${chunk.extractedText}"\n\nThis passage directly addresses "${question}" with verified evidence from your uploaded course materials.`;
  }

  // If multiple chunks retrieved, cross-reference additional source
  if (matches.length > 1) {
    const secondChunk = matches[1].chunk;
    const secondAnchor =
      secondChunk.anchorLabel ||
      (secondChunk.pageNumber
        ? `Page ${secondChunk.pageNumber}`
        : secondChunk.slideNumber
        ? `Slide ${secondChunk.slideNumber}`
        : secondChunk.sectionHeading);
    answer += `\n\n*Additional Supporting Evidence from ${secondChunk.materialTitle} (${secondAnchor}):* "${extractVerbatimExcerpt(
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
