import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleStatusRequest, handleTutorChatRequest } from './apiPlugin.ts';
import type { StudyMaterial, TutorPreferences } from '../types/index.ts';

const preferences: TutorPreferences = {
  teachingApproach: 'direct', difficultyLevel: 'beginner', interactionStyle: 'balanced',
  explanationLength: 'concise', enableKnowledgeChecks: false, customInstructions: '',
};
const source = {
  id: 'java', title: 'Java inheritance', filename: 'inheritance.pdf',
  processingStatus: 'indexed', chunks: [{
    id: 'java-p1', materialId: 'java', materialTitle: 'Java inheritance',
    filename: 'inheritance.pdf', chunkIndex: 1, pageNumber: 1,
    anchorLabel: 'Page 1', sectionHeading: 'Inheritance',
    extractedText: 'Inheritance lets a child class reuse and extend a parent class.',
  }],
} as StudyMaterial;

async function request(question: string, mode: string, selectedMaterialIds?: string[], materials: StudyMaterial[] = [source]) {
  let body = '';
  const response = {
    statusCode: 0,
    setHeader: () => undefined,
    end: (text: string) => { body = text; },
  };
  await handleTutorChatRequest({
    method: 'POST', body: { question, mode, materials, selectedMaterialIds, preferences },
  }, response);
  return { status: response.statusCode, ...JSON.parse(body) };
}

test('grounded route requires selected, relevant evidence; Smart Tutor retains general route', async () => {
  const oldCwd = process.cwd();
  const oldKey = process.env.GEMINI_API_KEY;
  try {
    // Keep this routing test local, even when the project root has a real API key.
    process.chdir(fileURLToPath(new URL('.', import.meta.url)));
    process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
    const noSelection = await request('Explain inheritance', 'grounded_study');
    assert.equal(noSelection.status, 200);
    assert.equal(noSelection.route, 'insufficient');
    const offTopic = await request('Explain photosynthesis', 'grounded_study', ['java']);
    assert.equal(offTopic.status, 200);
    assert.equal(offTopic.route, 'insufficient');
    const grounded = await request('Explain inheritance', 'grounded_study', ['java']);
    assert.equal(grounded.status, 503);
    assert.equal(grounded.route, 'error');
    assert.equal(grounded.errorCategory, 'auth');
    assert.equal(grounded.model, undefined);
    const smart = await request('Explain photosynthesis', 'smart_tutor', ['java']);
    assert.equal(smart.status, 503);
    assert.equal(smart.route, 'error');
    assert.equal(smart.errorCategory, 'auth');
    assert.equal(smart.model, undefined);
    const unavailable = await request('__SIMULATE_503__', 'smart_tutor');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.route, 'error');
    assert.equal(unavailable.canRetry, true);
    assert.equal(unavailable.answer, undefined);
    assert.equal(unavailable.model, undefined);
  } finally {
    process.chdir(oldCwd);
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test('configured model and labels match both successful tutoring routes', async () => {
  const oldCwd = process.cwd();
  const oldKey = process.env.GEMINI_API_KEY;
  const oldFetch = globalThis.fetch;
  const urls: string[] = [];
  const requestBodies: string[] = [];
  const unselectedSource = {
    ...source, id: 'other', title: 'Unselected material', filename: 'other.pdf',
    chunks: [{ ...source.chunks[0], id: 'other-p1', materialId: 'other',
      materialTitle: 'Unselected material', filename: 'other.pdf',
      extractedText: 'UNSELECTED_SOURCE_CONTENT' }],
  } as StudyMaterial;
  try {
    process.chdir(fileURLToPath(new URL('.', import.meta.url)));
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = (async (input, init) => {
      urls.push(String(input));
      requestBodies.push(String(init?.body));
      const grounded = String(init?.body).includes('VERIFIED GROUNDING SOURCE PASSAGES');
      const answer = grounded
        ? 'Inheritance lets a child class reuse and extend a parent class [PASSAGE 1]. Source: Java inheritance, Page 1.'
        : 'Photosynthesis lets plants use sunlight to make sugar from water and carbon dioxide.';
      return new Response(JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [{ text: answer }] }, finishReason: 'STOP' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    let statusBody = '';
    handleStatusRequest({}, {
      setHeader: () => undefined,
      end: (text: string) => { statusBody = text; },
    });
    assert.equal(JSON.parse(statusBody).model, 'gemini-3.6-flash');

    const smart = await request('What is photosynthesis?', 'smart_tutor', undefined, []);
    assert.equal(smart.status, 200);
    assert.equal(smart.route, 'general');
    assert.equal(smart.model, 'gemini-3.6-flash (General Knowledge)');
    assert.deepEqual(smart.citations, []);
    assert.match(requestBodies[0], /using general academic knowledge/i);

    const grounded = await request('Explain inheritance', 'grounded_study', ['java'], [source, unselectedSource]);
    assert.equal(grounded.status, 200);
    assert.equal(grounded.route, 'grounded');
    assert.equal(grounded.model, 'gemini-3.6-flash (Source-Grounded)');
    assert.equal(grounded.citations.length, 1);
    assert.equal(grounded.citations[0].pageNumber, 1);
    const groundedRequest = requestBodies[1];
    assert.match(groundedRequest, /only information supported by the student's selected source passages/i);
    assert.match(groundedRequest, /analogies, examples, definitions, or comparisons only when the selected passages support them/i);
    assert.match(groundedRequest, /not contain enough information.*state that limitation clearly/i);
    assert.match(groundedRequest, /do not fill gaps with general model knowledge/i);
    assert.doesNotMatch(groundedRequest, /general-knowledge teaching may supplement|identify supplementary parts/i);
    assert.ok(groundedRequest.includes(source.chunks[0].extractedText));
    assert.ok(!groundedRequest.includes('UNSELECTED_SOURCE_CONTENT'));
    assert.doesNotMatch(requestBodies[0], /sole authority for this answer/i);
    const originalQuestion = 'According to my uploaded notes only, explain inheritance. Do not use external knowledge.';
    const sourceBounded = await request(originalQuestion, 'grounded_study', ['java']);
    assert.equal(sourceBounded.status, 200);
    assert.equal(sourceBounded.route, 'grounded');
    assert.ok(requestBodies[2].includes(originalQuestion));
    assert.match(requestBodies[2], /respect the student's explicit source-boundary instructions/i);
    assert.equal(urls.length, 3);
    assert.ok(urls.every(url => url.includes('gemini-3.6-flash:generateContent')));
  } finally {
    globalThis.fetch = oldFetch;
    process.chdir(oldCwd);
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
