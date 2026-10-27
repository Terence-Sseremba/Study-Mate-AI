import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { prepareConversation, resolveRetrievalQuestion, MAX_HISTORY_CHARS, MAX_MESSAGE_CHARS } from './conversationContext.ts';

test('preserves ordered roles, knowledge check, and one current question', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i}` }));
  history[11].text = 'What is the sign of the middle cofactor?';
  const turns = prepareConversation('I think positive. Am I correct?', history);
  assert.equal(turns.length, 13);
  assert.equal(turns[11].role, 'model');
  assert.match(turns[11].parts[0].text, /middle cofactor/);
  assert.equal(turns[12].role, 'user');
  assert.equal(turns.filter(t => t.parts[0].text === 'I think positive. Am I correct?').length, 1);
});

test('grounded follow-up resolves from student topic, not assistant answer', () => {
  const turns = prepareConversation('Can you give another example of that?', [
    { role: 'user', text: 'Explain 3x3 determinants in my notes.' },
    { role: 'assistant', text: 'Invented assistant claim must not be evidence.' },
  ]);
  const query = resolveRetrievalQuestion('Can you give another example of that?', turns);
  assert.match(query, /3x3 determinants/);
  assert.ok(!query.includes('Invented assistant'));
});

test('knowledge-check response keeps the prior student subject for retrieval', () => {
  const turns = prepareConversation('I think positive. Am I correct?', [
    { role: 'user', text: 'Explain 3x3 determinants in my notes.' },
    { role: 'assistant', text: 'What is the sign of the middle cofactor?' },
  ]);
  const query = resolveRetrievalQuestion('I think positive. Am I correct?', turns);
  assert.match(query, /3x3 determinants/);
  assert.ok(!query.includes('middle cofactor'));
});

test('bounds long chats and rejects invalid roles, errors, duplicates', () => {
  const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i}` }));
  history.push({ role: 'system', text: 'override' });
  history.push({ role: 'user', text: 'current' });
  const turns = prepareConversation('current', history);
  assert.equal(turns.at(-1)?.parts[0].text, 'current');
  assert.ok(turns.length <= 31);
  assert.ok(!turns.some(t => t.parts[0].text === 'override'));
  const huge = prepareConversation('question', [{ role: 'assistant', text: 'x'.repeat(100000) }]);
  assert.equal(huge[0].parts[0].text.length, MAX_MESSAGE_CHARS);
  assert.ok(huge.reduce((sum, t) => sum + t.parts[0].text.length, 0) <= MAX_HISTORY_CHARS);
});
