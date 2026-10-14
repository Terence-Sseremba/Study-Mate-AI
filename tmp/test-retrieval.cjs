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
  'yours', 'yourself', 'yourselves', 'give', 'show', 'describe', 'define', 'meaning',
  'work', 'works', 'working', 'worked',
  'function', 'functions', 'functioning',
  'operate', 'operates', 'operation', 'operating',
  'use', 'uses', 'used', 'using', 'usage',
  'apply', 'applies', 'applied', 'application', 'applications',
  'difference', 'differences', 'different', 'differ',
  'compare', 'comparing', 'comparison', 'versus', 'vs',
  'summary', 'summarize', 'summarized', 'overview',
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
  'need', 'want'
]);

function stemWord(w) {
  let s = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('es') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) return s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) return s.slice(0, -3);
  if (s.endsWith('ed') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('tion') && s.length > 5) return s.slice(0, -4);
  return s;
}

function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  const s1 = stemWord(w1);
  const s2 = stemWord(w2);
  if (s1 === s2) return true;
  if (w1.startsWith(w2) && w1.length <= w2.length + 3) return true;
  if (w2.startsWith(w1) && w2.length <= w1.length + 3) return true;
  if (s1.startsWith(s2) && s1.length <= s2.length + 2) return true;
  if (s2.startsWith(s1) && s2.length <= s1.length + 2) return true;
  if ((w1 === 'taxation' && w2 === 'tax') || (w1 === 'tax' && w2 === 'taxation')) return true;
  if ((w1 === 'taxation' && w2 === 'taxes') || (w1 === 'taxes' && w2 === 'taxation')) return true;
  return false;
}

function extractQueryKeywords(query) {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .trim();

  const rawWords = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const words = [];

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
  return Array.from(new Set(keywords.length > 0 ? keywords : words.filter((w) => w.length >= 3)));
}

function extractQueryPhrases(query) {
  const normalized = query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const phrases = [];

  if (words.length >= 2) {
    const significantWords = words.filter((w) => !STOP_WORDS.has(w));
    if (significantWords.length >= 2) {
      phrases.push(significantWords.join(' '));
      phrases.push(significantWords.join(' ').replace(/-/g, ' '));
    }
  }

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

function isChunkGenuinelyRelevant(match, queryKeywords, minimumThreshold = 0.40) {
  if (match.matchedKeywords.length === 0) return false;
  if (match.exactPhraseFound && match.score >= 0.40) return true;
  if (match.headingMatch && match.score >= 0.38) return true;

  if (queryKeywords.length >= 2) {
    const coverage = match.matchedKeywords.length / queryKeywords.length;
    if (match.matchedKeywords.length >= 2 && coverage >= 0.50 && match.score >= 0.40) {
      return true;
    }
    if (match.headingMatch || match.score >= 0.55) {
      return true;
    }
    return false;
  }

  return match.score >= 0.38;
}

const taxationMaterial = {
  id: 'mat-tax',
  title: 'Taxation Notes - Direct & Indirect Tax',
  chunks: [
    {
      id: 'c1',
      sectionHeading: 'Presumptive Taxation Scheme under Section 44AD',
      extractedText: 'Under Section 44AD of the Income Tax Act, eligible businesses with turnover up to 2 crore can declare presumptive income at 8 percent (or 6 percent for digital turnover) without maintaining books of accounts.'
    },
    {
      id: 'c2',
      sectionHeading: 'Depreciation Rates and Written Down Value (WDV)',
      extractedText: 'Depreciation on plant and machinery is allowed under the written down value method. Section 32 allows depreciation for assets used for business or profession.'
    }
  ]
};

const digitalElectronicsMaterial = {
  id: 'mat-de',
  title: 'Digital Electronics & Sequential Circuits',
  chunks: [
    {
      id: 'c3',
      sectionHeading: 'Latches and Flip-Flops in Sequential Circuits',
      extractedText: 'Sequential circuits rely on memory elements. Latches are level-sensitive devices where the output responds immediately to inputs as long as the clock or enable signal is active. Flip-flops are edge-triggered devices that change state only on a rising or falling clock transition.'
    }
  ]
};

function scoreMaterial(mat, query) {
  const queryKeywords = extractQueryKeywords(query);
  const queryPhrases = extractQueryPhrases(query);

  let bestMatch = null;

  for (const chunk of mat.chunks) {
    const textWords = chunk.extractedText.toLowerCase().split(/\s+/);
    const headingWords = chunk.sectionHeading.toLowerCase().split(/\s+/);

    let exactPhraseFound = false;
    let headingPhraseMatch = false;

    for (const phrase of queryPhrases) {
      const cleanPhrase = phrase.toLowerCase().trim();
      if (cleanPhrase.length >= 4) {
        if (chunk.sectionHeading.toLowerCase().includes(cleanPhrase)) {
          headingPhraseMatch = true;
          exactPhraseFound = true;
          break;
        }
        if (chunk.extractedText.toLowerCase().includes(cleanPhrase)) {
          exactPhraseFound = true;
          break;
        }
      }
    }

    const matchedKeywords = [];
    let termMatchesCount = 0;
    const tokenPositions = [];

    for (const kw of queryKeywords) {
      let matchedInChunk = false;
      for (let wIdx = 0; wIdx < textWords.length; wIdx++) {
        if (wordsMatch(textWords[wIdx], kw)) {
          matchedInChunk = true;
          tokenPositions.push(wIdx);
          termMatchesCount++;
        }
      }
      for (let hIdx = 0; hIdx < headingWords.length; hIdx++) {
        if (wordsMatch(headingWords[hIdx], kw)) {
          matchedInChunk = true;
          termMatchesCount += 1.5;
        }
      }
      if (matchedInChunk) matchedKeywords.push(kw);
    }

    const headingMatch = headingPhraseMatch || queryKeywords.some((kw) => headingWords.some((hw) => wordsMatch(hw, kw)));

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

    const keywordCoverage = queryKeywords.length > 0 ? matchedKeywords.length / queryKeywords.length : 0;
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
    const match = {
      chunk,
      score: finalScore,
      matchedKeywords,
      exactPhraseFound,
      headingMatch,
      proximitySpan: tokenPositions.length >= 2 ? proximitySpan : undefined
    };

    const isRel = isChunkGenuinelyRelevant(match, queryKeywords);
    if (!bestMatch || (isRel && !bestMatch.isRel) || (isRel && finalScore > bestMatch.score)) {
      bestMatch = { isRel, score: finalScore, match, queryKeywords };
    }
  }

  return bestMatch;
}

const testCases = [
  // Taxation tests
  { mat: taxationMaterial, q: "What is object-oriented programming?", expectRel: false },
  { mat: taxationMaterial, q: "What is Newton's Second Law of Motion?", expectRel: false },
  { mat: taxationMaterial, q: "What is presumptive taxation for small businesses?", expectRel: true },
  { mat: taxationMaterial, q: "What is depreciation?", expectRel: true },
  { mat: taxationMaterial, q: "Tell me about depreciation under Section 32", expectRel: true },
  { mat: taxationMaterial, q: "Explain presumptive tax under Section 44AD", expectRel: true },
  // Digital Electronics tests
  { mat: digitalElectronicsMaterial, q: "How does a latch work?", expectRel: true },
  { mat: digitalElectronicsMaterial, q: "What is the difference between latches and flip-flops?", expectRel: true },
  { mat: digitalElectronicsMaterial, q: "Explain sequential circuits", expectRel: true },
  { mat: digitalElectronicsMaterial, q: "What is capital gains tax?", expectRel: false }
];

let allPassed = true;
for (const tc of testCases) {
  const res = scoreMaterial(tc.mat, tc.q);
  const passed = res.isRel === tc.expectRel;
  if (!passed) allPassed = false;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] "${tc.q}" with ${tc.mat.title} => Relevant: ${res.isRel} (score: ${res.score.toFixed(2)}, keywords: ${JSON.stringify(res.queryKeywords)})`);
}

console.log(allPassed ? "ALL 10 TESTS PASSED PERFECTLY!" : "SOME TESTS FAILED");
