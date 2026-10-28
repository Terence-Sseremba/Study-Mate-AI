// Bound request history by characters, leaving room for system instructions and
// evidence without an extra countTokens API call. This is not an exact token count.
export const MAX_HISTORY_MESSAGES = 30;
const configuredBudget = Number(process.env.STUDYMATE_HISTORY_CHAR_BUDGET);
export const MAX_HISTORY_CHARS = Number.isFinite(configuredBudget) && configuredBudget >= 4000
  ? Math.min(configuredBudget, 60000) : 24000;
export const MAX_MESSAGE_CHARS = 4000;

export interface ConversationTurn {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export function prepareConversation(question: string, rawHistory: unknown): ConversationTurn[] {
  const current = question.slice(0, MAX_MESSAGE_CHARS);
  const candidates = Array.isArray(rawHistory) ? rawHistory.slice(-MAX_HISTORY_MESSAGES) : [];
  const valid = candidates.flatMap((item): ConversationTurn[] => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    if (entry.role !== 'user' && entry.role !== 'assistant') return [];
    if (entry.errorState || typeof entry.text !== 'string' || !entry.text.trim()) return [];
    return [{ role: entry.role === 'assistant' ? 'model' : 'user', parts: [{ text: entry.text.slice(0, MAX_MESSAGE_CHARS) }] }];
  });
  // The client normally sends only earlier turns. Defend against a caller that
  // also includes the pending question at the end.
  if (valid.at(-1)?.role === 'user' && valid.at(-1)?.parts[0].text.trim() === current.trim()) valid.pop();
  let remaining = MAX_HISTORY_CHARS - current.length;
  const selected: ConversationTurn[] = [];
  // Keep the newest complete exchange when possible, especially the tutor's
  // immediately preceding knowledge-check question.
  for (let i = valid.length - 1; i >= 0; i--) {
    const turn = valid[i];
    const length = turn.parts[0].text.length;
    if (length > remaining) break;
    selected.unshift(turn);
    remaining -= length;
  }
  return [...selected, { role: 'user', parts: [{ text: current }] }];
}

export function resolveRetrievalQuestion(question: string, conversation: ConversationTurn[]): string {
  const refersBack = /\b(that|this|it|another|again|same|previous|above)\b/i.test(question);
  const checksPriorAnswer = /\b(?:am i correct|is my answer correct|did i get (?:it|that) right|my answer|i think|is that right)\b/i.test(question);
  if (!refersBack && !checksPriorAnswer) return question;
  const priorUserQuestion = conversation.slice(0, -1).reverse()
    .find((turn) => turn.role === 'user')?.parts[0].text;
  return priorUserQuestion ? `${priorUserQuestion.slice(0, 500)} ${question}` : question;
}
