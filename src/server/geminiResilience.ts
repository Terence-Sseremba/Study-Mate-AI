import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface GeminiCallConfig {
  systemInstruction?: string;
  temperature?: number;
  thinkingConfig?: {
    thinkingLevel?: ThinkingLevel;
  };
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  isBusyError?: boolean;
  isTimeout?: boolean;
  isRateLimit?: boolean;
  statusCode?: number;
  userFacingMessage?: string;
  attemptsMade: number;
}

/**
 * Determines if an error from the Gemini API or network layer is temporary/retryable.
 * Catches 503 (Unavailable/High demand), 429 (Rate limit/Quota), timeouts, and transient network errors.
 * Explicitly rejects 400, 401 (Invalid key), 403 (Permission denied), 404 as non-retryable.
 */
export function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;

  const status =
    err.status ||
    err.statusCode ||
    err.response?.status ||
    err.status_code;

  // 1. Permanent client errors that must NEVER be retried
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }

  const errStr = String(err.message || err.toString() || '').toLowerCase();

  if (
    errStr.includes('api_key_invalid') ||
    errStr.includes('api key not valid') ||
    errStr.includes('permission_denied') ||
    errStr.includes('invalid_argument')
  ) {
    return false;
  }

  // 2. Explicit temporary HTTP status codes
  if (status === 503 || status === 429 || status === 502 || status === 504 || status === 408) {
    return true;
  }

  // 3. Known temporary error messages and codes
  const retryableIndicators = [
    '503',
    'unavailable',
    'high demand',
    'currently experiencing high demand',
    'model is overloaded',
    'overloaded',
    'resource_exhausted',
    '429',
    'rate limit',
    'quota',
    'deadline_exceeded',
    'timed out',
    'timeout',
    'econnreset',
    'etimedout',
    'econnrefused',
    'socket hang up',
    'fetch failed',
    'network error',
    'service unavailable',
  ];

  return retryableIndicators.some((indicator) => errStr.includes(indicator));
}

/**
 * Extracts any Retry-After duration in milliseconds from error metadata if present.
 */
function extractRetryAfterMs(err: any): number | null {
  try {
    const header =
      err.response?.headers?.get?.('retry-after') ||
      err.headers?.['retry-after'];
    if (header) {
      const seconds = parseFloat(header);
      if (!isNaN(seconds) && seconds > 0) {
        return Math.min(5000, Math.round(seconds * 1000));
      }
    }
  } catch {
    // Ignore header extraction failure
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a Gemini generateContent call with bounded exponential backoff, jitter,
 * and a configurable, reasonable timeout appropriate for the model and hosting environment.
 * Default timeout is 25000ms (configurable via GEMINI_TIMEOUT_MS env var).
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: {
    model: string;
    contents: string;
    config?: GeminiCallConfig;
    maxRetries?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
  }
): Promise<RetryResult<any>> {
  const {
    model,
    contents,
    config,
    maxRetries = 2,
    baseDelayMs = 1000,
    timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 30000,
  } = options;

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    attempt++;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Default to ThinkingLevel.LOW to minimize latency (down from ~15s to ~3.5s) while preserving rich reasoning
      const mergedConfig = {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        ...config,
      };

      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents,
          config: mergedConfig as any,
        }),
        timeoutPromise,
      ]);

      if (timeoutTimer) clearTimeout(timeoutTimer);

      return {
        success: true,
        data: response,
        attemptsMade: attempt,
      };
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      lastError = err;
      const isRetryable = isRetryableGeminiError(err);
      const isTimeoutError = String(err?.message || '').toLowerCase().includes('timed out');

      console.warn(
        `Gemini call attempt ${attempt}/${maxRetries + 1} failed: ${err.message || err}. Retryable: ${isRetryable}`
      );

      // If permanent error or exhausted retries (for timeouts allow at most 1 retry to avoid long waits)
      if (!isRetryable || attempt > maxRetries || (isTimeoutError && attempt >= 2)) {
        break;
      }

      // Compute exponential backoff with small random jitter
      const serverRetryAfter = extractRetryAfterMs(err);
      const backoffDelay =
        serverRetryAfter ??
        Math.round(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 300);

      await sleep(backoffDelay);
    }
  }

  const errStr = String(lastError?.message || lastError || '').toLowerCase();
  const status =
    lastError?.status ||
    lastError?.statusCode ||
    lastError?.response?.status ||
    lastError?.status_code;

  const isTimeout =
    status === 504 ||
    status === 408 ||
    errStr.includes('timed out') ||
    errStr.includes('timeout') ||
    errStr.includes('deadline_exceeded');

  const isRateLimit =
    status === 429 ||
    errStr.includes('429') ||
    errStr.includes('quota') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('rate limit');

  const isUnavailable =
    status === 503 ||
    status === 502 ||
    errStr.includes('503') ||
    errStr.includes('unavailable') ||
    errStr.includes('high demand') ||
    errStr.includes('overloaded');

  let userFacingMessage = 'StudyMate\'s AI service is temporarily unavailable. Please retry.';
  let statusCode = 500;

  if (isTimeout) {
    userFacingMessage = 'StudyMate is taking longer than expected. Please try again.';
    statusCode = 504;
  } else if (isRateLimit) {
    userFacingMessage = 'AI usage limit reached. Please try again when service is available.';
    statusCode = 429;
  } else if (isUnavailable) {
    userFacingMessage = 'The AI service is temporarily unavailable.';
    statusCode = 503;
  }

  return {
    success: false,
    error: lastError,
    isBusyError: isUnavailable,
    isTimeout,
    isRateLimit,
    statusCode,
    userFacingMessage,
    attemptsMade: attempt,
  };
}
