import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { GoogleGenAI } from '@google/genai';
import { classifyGeminiError, createGeminiTimingFetch, generateContentWithRetry } from './geminiResilience.ts';

const request = (generateContent: (...args: any[]) => Promise<any>, options = {}) =>
  generateContentWithRetry({ models: { generateContent } } as unknown as GoogleGenAI, {
    model: 'gemini-3.6-flash', contents: 'What is photosynthesis?',
    timeoutMs: 100, baseDelayMs: 1, ...options,
  });

test('503 overload retries once and returns honest error metadata', async () => {
  let calls = 0;
  const result = await request(async () => { calls++; throw { status: 503, message: 'Model is temporarily unavailable' }; }, { timeoutMs: 2000 });
  assert.equal(calls, 2);
  assert.equal(result.success, false);
  assert.equal(result.category, 'overloaded');
  assert.equal(result.statusCode, 503);
  assert.equal(result.data, undefined);
  assert.match(result.userFacingMessage || '', /temporarily unavailable/i);
  assert.doesNotMatch(result.userFacingMessage || '', /configured.*model/i);
});

test('numeric HTTP status wins over contradictory provider wording', () => {
  assert.equal(classifyGeminiError({ status: 503, message: 'Model unavailable or invalid' }), 'overloaded');
  assert.equal(classifyGeminiError({ statusCode: 503, message: 'Model unavailable' }), 'overloaded');
  assert.equal(classifyGeminiError({ response: { status: 503 }, message: 'Model not found' }), 'overloaded');
  assert.equal(classifyGeminiError({ status: 429, message: 'Model unavailable' }), 'rate_limit');
  assert.equal(classifyGeminiError({ status: 404, message: 'High demand' }), 'model');
  assert.equal(classifyGeminiError({ status: 401, message: 'Model unavailable' }), 'auth');
  assert.equal(classifyGeminiError({ status: 403, message: 'High demand' }), 'auth');
});

test('network, TLS, timeout, cancellation, and unexpected failures retain categories', () => {
  assert.equal(classifyGeminiError({ code: 'ENOTFOUND' }), 'network');
  assert.equal(classifyGeminiError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }), 'network');
  assert.equal(classifyGeminiError({ name: 'TimeoutError' }), 'timeout');
  assert.equal(classifyGeminiError({ name: 'AbortError' }), 'timeout');
  assert.equal(classifyGeminiError({ status: 504, message: 'Model unavailable' }), 'timeout');
  assert.equal(classifyGeminiError({ status: 500, message: 'Model unavailable' }), 'sdk');
});

for (const [status, category] of [[429, 'rate_limit'], [401, 'auth'], [404, 'model']] as const) {
  test(`${status} fails without retry as ${category}`, async () => {
    let calls = 0;
    const result = await request(async () => { calls++; throw { status, message: 'service error' }; });
    assert.equal(calls, 1);
    assert.equal(result.category, category);
    assert.equal(result.success, false);
  });
}

test('timeout aborts SDK request and does not start a second one', async () => {
  let calls = 0;
  let aborted = false;
  const result = await request(({ config }) => {
    calls++;
    return new Promise((_resolve, reject) => {
      config.abortSignal.addEventListener('abort', () => {
        aborted = true;
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    });
  }, { timeoutMs: 15 });
  assert.equal(aborted, true);
  assert.equal(calls, 1);
  assert.equal(result.category, 'timeout');
  assert.equal(result.statusCode, 504);
});

test('blank SDK response is a failure, not a tutoring answer', async () => {
  const result = await request(async () => ({ text: '  ' }));
  assert.equal(result.category, 'malformed');
  assert.equal(result.data, undefined);
});

test('timing fetch preserves the response and records headers and body once', async () => {
  const stages: string[] = [];
  let calls = 0;
  const diagnosticFetch = createGeminiTimingFetch(1, event => {
    stages.push(event.stage);
    assert.equal(event.attempt, 1);
    assert.ok(event.elapsedMs >= 0);
    if (event.stage === 'headers' || event.stage === 'body') assert.equal(event.status, 200);
  }, (async () => {
    calls++;
    return new Response(JSON.stringify({ answer: 'ok' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch);
  const response = await diagnosticFetch('https://example.invalid');
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { answer: 'ok' });
  assert.equal(calls, 1);
  assert.deepEqual(stages, ['start', 'headers', 'body']);
});
