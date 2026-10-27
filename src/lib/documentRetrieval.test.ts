import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildCitation, extractQueryKeywords, retrieveRelevantChunks, wordsMatch } from './documentRetrieval.ts';
import type { StudyMaterial, SourceChunk } from '../types/index.ts';
import { prepareConversation, resolveRetrievalQuestion } from '../server/conversationContext.ts';

function material(heading: string, id = 'math'): StudyMaterial {
  const chunks = Array.from({ length: 20 }, (_, index) => ({
    id: `${id}-${index + 1}`, materialId: id, materialTitle: 'Matrix Algebra',
    filename: 'matrix.pdf', documentType: 'pdf', chunkIndex: index + 1,
    pageNumber: index + 1, anchorLabel: `Page ${index + 1}`,
    sectionHeading: index === 11 ? heading : `Page ${index + 1}`,
    extractedText: index === 11
      ? 'A 3 × 3 determinant is expanded by cofactors. For the first row, the middle cofactor has a negative sign. If its matrix entry is negative, the contribution can be positive.'
      : `Page ${index + 1} discusses unrelated matrix course administration.`,
  })) as SourceChunk[];
  return { id, title: 'Matrix Algebra', filename: 'matrix.pdf', chunks } as StudyMaterial;
}

for (const heading of ['A 3 × 3 Determinant', 'Page 12']) {
  test(`determinant retrieval under ${heading}`, () => {
    const source = material(heading);
    for (const query of [
      '3 × 3 determinant', '3x3 determinant', '3 by 3 determinant',
      'Help me learn and practice 3 × 3 determinants',
    ]) {
      const result = retrieveRelevantChunks([source], query, { selectedMaterialIds: ['math'] });
      assert.equal(result.isSufficient, true, query);
      assert.equal(result.matches[0].chunk.id, 'math-12', query);
    }
    assert.equal(retrieveRelevantChunks([source], 'Explain photosynthesis in plants').isSufficient, false);
    const match = retrieveRelevantChunks([source], '3x3 determinant').matches[0];
    const citation = buildCitation(match.chunk, match.score, match.matchedKeywords);
    assert.equal(citation.materialId, 'math');
    assert.equal(citation.chunkId, 'math-12');
    assert.equal(citation.pageNumber, 12);
  });
}

test('selected sources and absent selection stay strict', () => {
  const source = material('Page 12');
  assert.equal(retrieveRelevantChunks([source], '3x3 determinant', { selectedMaterialIds: [] }).isSufficient, false);
  assert.equal(retrieveRelevantChunks([source], '3x3 determinant', { selectedMaterialIds: ['other'] }).isSufficient, false);
  assert.equal(retrieveRelevantChunks([source, material('Page 12', 'other')], '3x3 determinant', { selectedMaterialIds: ['math'] }).matches.every(m => m.chunk.materialId === 'math'), true);
});

test('grounded follow-up retrieves only selected document evidence', () => {
  const history = prepareConversation('Can you give another example of that?', [
    { role: 'user', text: 'Explain 3x3 determinants in my notes.' },
    { role: 'assistant', text: 'A previous generated answer is not evidence.' },
  ]);
  const query = resolveRetrievalQuestion('Can you give another example of that?', history);
  const result = retrieveRelevantChunks([material('Page 12')], query, { selectedMaterialIds: ['math'] });
  assert.equal(result.matches[0]?.chunk.id, 'math-12');
});

test('language tokens remain distinct and match their actual source text', () => {
  assert.deepEqual(extractQueryKeywords('Compare C#, C++, and Java'), ['c#', 'c++', 'java']);
  assert.equal(wordsMatch('c#', 'c++'), false);
  assert.equal(wordsMatch('c#', 'c'), false);
  assert.equal(wordsMatch('C++', 'c++'), true);
  const source = material('Page 12');
  source.chunks[11].extractedText = 'C# and C++ are distinct programming languages. Java is another language.';
  source.chunks[11].sectionHeading = 'Programming languages';
  for (const language of ['C#', 'C++', 'Java']) {
    const result = retrieveRelevantChunks([source], `Explain ${language}`, { selectedMaterialIds: ['math'] });
    assert.equal(result.isSufficient, true, language);
    assert.ok(result.matches[0].matchedKeywords.includes(language.toLowerCase()), language);
  }
});

test('distributed concepts require a supported main subject', () => {
  const source = material('Inheritance');
  source.chunks[11].extractedText = 'Inheritance lets a child class reuse and extend a parent class.';
  source.chunks[12].extractedText = 'Upcasting assigns a child class reference to a parent class reference.';
  source.chunks[12].sectionHeading = 'Upcasting';
  source.chunks[13].extractedText = 'Downcasting converts a parent class reference back to a child class reference.';
  source.chunks[13].sectionHeading = 'Downcasting';
  const result = retrieveRelevantChunks([source], 'Explain inheritance, upcasting and downcasting', { selectedMaterialIds: ['math'] });
  assert.equal(result.isSufficient, true);
  assert.deepEqual(new Set(result.matches.slice(0, 3).map(match => match.chunk.id)), new Set(['math-12', 'math-13', 'math-14']));
  assert.equal(retrieveRelevantChunks([source], 'Explain photosynthesis with an inheritance analogy').isSufficient, false);
  assert.equal(retrieveRelevantChunks([source], 'Explain photosynthesis and inheritance').isSufficient, false);
});
