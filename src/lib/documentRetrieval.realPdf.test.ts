import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { extractPdf } from './documentExtraction.ts';
import { buildCitation, retrieveRelevantChunks } from './documentRetrieval.ts';
import type { StudyMaterial } from '../types/index.ts';
import { prepareConversation, resolveRetrievalQuestion } from '../server/conversationContext.ts';

const pdfPath = 'C:/Users/Terence/Documents/COCIS WORK/OOP/Lecture 8 - Inheritance & Polymorphism.pdf';

test('real inheritance PDF supports distributed grounded tutoring', { skip: !existsSync(pdfPath) }, async () => {
  const bytes = await readFile(pdfPath);
  const result = await extractPdf(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    'inheritance',
    'Lecture 8 - Inheritance & Polymorphism',
    'Lecture 8 - Inheritance & Polymorphism.pdf',
  );
  assert.equal(result.processingStatus, 'indexed');
  assert.equal(result.pageCount, 58);
  assert.equal(result.chunks.length, 58);
  assert.ok(!result.chunks.some(chunk => /\bc#(?!\w)/i.test(chunk.extractedText)));
  assert.ok(!result.chunks.some(chunk => /\banalog(?:y|ies)\b/i.test(chunk.extractedText)));
  const source = {
    id: 'inheritance', title: 'Lecture 8 - Inheritance & Polymorphism',
    filename: 'Lecture 8 - Inheritance & Polymorphism.pdf',
    processingStatus: result.processingStatus, chunks: result.chunks,
  } as StudyMaterial;
  const retrieve = (query: string, materials = [source], selectedMaterialIds = ['inheritance']) =>
    retrieveRelevantChunks(materials, query, { selectedMaterialIds, maxResults: 6, sufficiencyThreshold: 0.38 });

  for (const term of ['inheritance', 'upcasting', 'downcasting', 'typecasting']) {
    const hits = result.chunks.filter(chunk => chunk.extractedText.toLowerCase().includes(term));
    assert.ok(hits.length > 0, term);
    assert.equal(retrieve(`Explain ${term}`).isSufficient, true, term);
  }
  for (const query of [
    'What are the different types of polymorphism?',
    'kindly please help to explain some concepts of polymorphism together with other concepts of typecasting, as you are discussing you are free to use some related analogies of C# while demonstrating to me so that we have a fruitful discussion.',
    'Explain inheritance and upcasting',
    'Explain inheritance and downcasting',
    'Explain inheritance, upcasting, downcasting, and typecasting',
    'Help me understand inheritance, upcasting, downcasting, and typecasting with analogies and examples. Discuss this with me.',
    'Help me understand inheritance, upcasting, downcasting, and typecasting. Use analogies and compare how the same ideas work in C#.',
    'Help me understand inheritance, upcasting, downcasting, and typecasting. Use analogies and show how the same ideas work in C#.',
    'Use C# examples to explain inheritance.',
  ]) {
    const retrieved = retrieve(query);
    assert.equal(retrieved.isSufficient, true, query);
    assert.ok(retrieved.matches.length <= 6, query);
  }
  const topicQuestion = 'Explain runtime polymorphism and method overriding.';
  const sourceBoundedQuestion = 'According to my uploaded lecture notes only, explain runtime polymorphism and method overriding. Do not use external knowledge.';
  const topicMatches = retrieve(topicQuestion);
  const boundedMatches = retrieve(sourceBoundedQuestion);
  assert.equal(topicMatches.isSufficient, true);
  assert.equal(boundedMatches.isSufficient, true);
  assert.ok(topicMatches.matches.some(match => match.chunk.pageNumber === 34));
  assert.ok(boundedMatches.matches.some(match => match.chunk.pageNumber === 34));
  assert.equal(
    retrieve('According to my uploaded lecture notes only, explain photosynthesis. Do not use external knowledge.').isSufficient,
    false,
  );
  assert.equal(retrieve('Explain polymorphism and typecasting. Do not use external knowledge.').isSufficient, true);
  const distributed = retrieve('Explain inheritance, upcasting, downcasting, and typecasting');
  const pages = distributed.matches.map(match => match.chunk.pageNumber);
  for (const page of [41, 44, 46]) assert.ok(pages.includes(page), `missing page ${page}`);
  assert.ok(pages.some(page => page !== undefined && page <= 21), 'missing inheritance foundation');
  for (const match of distributed.matches) {
    const citation = buildCitation(match.chunk, match.score, match.matchedKeywords);
    assert.equal(citation.materialId, 'inheritance');
    assert.equal(citation.chunkId, match.chunk.id);
    assert.equal(citation.pageNumber, match.chunk.pageNumber);
  }

  const genericHeadings = { ...source, chunks: source.chunks.map(chunk => ({
    ...chunk, sectionHeading: `Page ${chunk.pageNumber}`,
  })) };
  assert.equal(retrieve('Explain inheritance, upcasting, downcasting, and typecasting', [genericHeadings]).isSufficient, true);
  assert.equal(retrieve('Explain photosynthesis', [source]).isSufficient, false);
  assert.equal(retrieve('Explain photosynthesis; mention inheritance only as an analogy', [source]).isSufficient, false);
  assert.equal(retrieve('Explain inheritance with a C# comparison', [source]).isSufficient, true);
  const followUp = 'Can you give another example of that?';
  const history = prepareConversation(followUp, [
    { role: 'user', text: 'Explain inheritance and upcasting in my notes.' },
    { role: 'assistant', text: 'An invented previous answer is not source evidence.' },
  ]);
  assert.equal(retrieve(resolveRetrievalQuestion(followUp, history)).isSufficient, true);
  assert.equal(retrieve('Explain inheritance', [source], []).isSufficient, false);
  assert.equal(retrieve('Explain inheritance', [source], ['other']).isSufficient, false);
});
