import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface GeminiCallConfig {
  systemInstruction?: string;
  temperature?: number;
  thinkingConfig?: { thinkingLevel?: ThinkingLevel };
}
export type GeminiFailureCategory = 'overloaded' | 'rate_limit' | 'auth' | 'model' | 'network' | 'timeout' | 'malformed' | 'sdk';
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  category?: GeminiFailureCategory;
  statusCode?: number;
  userFacingMessage?: string;
  attemptsMade: number;
}
function statusOf(error: any): number | undefined {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.status_code);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}
export function classifyGeminiError(error: any): GeminiFailureCategory {
  const status = statusOf(error);
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  // HTTP status is less ambiguous than provider wording such as "model unavailable".
  if (status === 503 || status === 502) return 'overloaded';
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'model';
  if (status === 408 || status === 504) return 'timeout';
  if (status && status >= 400) return 'sdk';
  if (error?.name === 'AbortError' || error?.name === 'RequestAbortedError') return 'timeout';
  if (error?.name === 'TimeoutError' || code === 'deadline_exceeded' || /timed out|timeout/.test(message)) return 'timeout';
  if (/resource_exhausted|quota|rate limit/.test(message)) return 'rate_limit';
  if (/api.key.*invalid|permission_denied|unauthorized/.test(message)) return 'auth';
  if (/model.*(not found|unavailable|invalid)/.test(message)) return 'model';
  if (/high demand|overloaded|unavailable/.test(message)) return 'overloaded';
  if (/cert|tls|ssl|econn|enotfound|fetch failed|network|socket|unable_to_verify_leaf_signature/.test(`${code} ${message}`)) return 'network';
  if (error?.name === 'MalformedGeminiResponse') return 'malformed';
  return 'sdk';
}
export function isRetryableGeminiError(error: any): boolean { return classifyGeminiError(error) === 'overloaded'; }
function retryAfterMs(error: any): number | undefined {
  const value = error?.response?.headers?.get?.('retry-after') ?? error?.headers?.['retry-after'];
  if (!value) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) && delay >= 0 ? delay : undefined;
}
export function geminiFailureResponse(category: GeminiFailureCategory, attemptsMade: number): RetryResult<never> {
  const messages: Record<GeminiFailureCategory, [number, string]> = {
    overloaded: [503, 'Gemini is temporarily unavailable. Please try again later.'],
    rate_limit: [429, 'StudyMate has reached its current AI usage limit. Please try again later.'],
    auth: [503, "StudyMate's AI service is not configured correctly. Please contact the administrator."],
    model: [503, "StudyMate's configured AI model is unavailable. Please contact the administrator."],
    network: [503, "StudyMate couldn't connect to the AI service. Please try again."],
    timeout: [504, 'StudyMate could not get a response from its AI tutor in time. Please try again.'],
    malformed: [502, 'StudyMate received an incomplete AI response. Please try again.'],
    sdk: [502, "StudyMate's AI tutor encountered an error. Please try again."],
  };
  return { success: false, category, statusCode: messages[category][0], userFacingMessage: messages[category][1], attemptsMade };
}

type TimingEvent = {
  stage: 'start' | 'headers' | 'body' | 'abort' | 'fetch_error';
  attempt: number;
  elapsedMs: number;
  status?: number;
  category?: GeminiFailureCategory;
};

/** The SDK accepts a standard fetch. Observe its response without reading or cloning it. */
export function createGeminiTimingFetch(
  attempt: number,
  record: (event: TimingEvent) => void = (event) => console.info('Gemini transport timing', event),
  transport: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    const emit = (stage: TimingEvent['stage'], details: Partial<TimingEvent> = {}) =>
      record({ stage, attempt, elapsedMs: Math.round(performance.now() - started), ...details });
    emit('start');
    init?.signal?.addEventListener('abort', () => emit('abort'), { once: true });
    try {
      const response = await transport(input, init);
      emit('headers', { status: response.status });
      // The installed SDK consumes successful and error responses via json/text.
      // Wrapping those methods observes completion without duplicating or changing the body.
      const readJson = response.json.bind(response);
      const readText = response.text.bind(response);
      response.json = async () => {
        try { return await readJson(); }
        finally { emit('body', { status: response.status }); }
      };
      response.text = async () => {
        try { return await readText(); }
        finally { emit('body', { status: response.status }); }
      };
      return response;
    } catch (error) {
      emit('fetch_error', { category: classifyGeminiError(error) });
      throw error;
    }
  };
}

export async function generateContentWithRetry(ai: GoogleGenAI, options: {
  model: string;
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  config?: GeminiCallConfig;
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}): Promise<RetryResult<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>>> {
  const timeoutMs = options.timeoutMs ?? (Number(process.env.GEMINI_TIMEOUT_MS) || 30000);
  const maxRetries = Math.min(options.maxRetries ?? 1, 1);
  const budgetEnd = Date.now() + timeoutMs;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(1, budgetEnd - Date.now()));
    try {
      const response = await ai.models.generateContent({
        model: options.model, contents: options.contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, ...options.config,
          abortSignal: controller.signal,
          httpOptions: { fetch: createGeminiTimingFetch(attempt) },
        },
      });
      if (typeof response.text !== 'string' || !response.text.trim())
        throw Object.assign(new Error('Empty Gemini response'), { name: 'MalformedGeminiResponse' });
      return { success: true, data: response, attemptsMade: attempt };
    } catch (error) {
      const category = timedOut ? 'timeout' : classifyGeminiError(error);
      console.warn(`Gemini request failed: category=${category} status=${statusOf(error) ?? 'none'} attempt=${attempt}`);
      // SDK abort is client-side only. A timed-out request may still run at Google.
      if (category !== 'overloaded' || attempt > maxRetries) return geminiFailureResponse(category, attempt);
      const delay = retryAfterMs(error) ?? (options.baseDelayMs ?? 500);
      if (delay > 2000 || Date.now() + delay + 1000 >= budgetEnd) return geminiFailureResponse(category, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally { clearTimeout(timer); }
  }
  return geminiFailureResponse('sdk', maxRetries + 1);
}
