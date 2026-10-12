import type { ReviewRecord } from '../types/index.ts';

/**
 * Spaced Repetition Scheduling Constants
 * Initial heuristics:
 * - 1st consecutive success: 1 day
 * - 2nd consecutive success: 3 days
 * - 3rd consecutive success: 7 days
 * - 4th consecutive success: 14 days
 * - 5th+ consecutive success: 30 days
 * - Failed review / retry: 10 minutes
 */
export const SUCCESS_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const RETRY_INTERVAL_MINUTES = 10;

export const MS_PER_MINUTE = 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RecordReviewOptions {
  topicId: string;
  topicName: string;
  isSuccess: boolean;
  scorePercentage: number;
  materialId?: string;
  materialTitle?: string;
  sourceReference?: {
    materialTitle: string;
    pageOrSlideNumber: number;
    quoteExcerpt?: string;
  };
  now?: Date;
}

/**
 * Computes the updated review record using the deterministic interval schedule.
 */
export function calculateNextReview(
  existingRecord: ReviewRecord | null | undefined,
  options: RecordReviewOptions
): ReviewRecord {
  const now = options.now ? new Date(options.now) : new Date();
  const nowTime = now.getTime();

  const prevConsecutive = existingRecord?.consecutiveSuccessCount ?? 0;
  const prevTotalAttempts = existingRecord?.totalAttempts ?? 0;
  const prevCorrectAttempts = existingRecord?.correctAttempts ?? 0;
  const prevEase = existingRecord?.easeFactor ?? 2.5;

  let nextConsecutive: number;
  let intervalMs: number;
  let intervalDays: number;
  let result: 'pass' | 'fail';

  // Calculate quality grade (0-5) from score percentage
  const grade =
    options.scorePercentage >= 90
      ? 5
      : options.scorePercentage >= 80
      ? 4
      : options.scorePercentage >= 70
      ? 3
      : options.scorePercentage >= 50
      ? 2
      : options.scorePercentage >= 30
      ? 1
      : 0;

  // SuperMemo SM-2 Ease Factor calculation: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let nextEase = prevEase + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  nextEase = Math.max(1.3, Math.round(nextEase * 100) / 100);

  if (options.isSuccess && grade >= 3) {
    result = 'pass';
    nextConsecutive = prevConsecutive + 1;
    // Index into SUCCESS_INTERVALS_DAYS based on 1-based nextConsecutive
    intervalDays =
      nextConsecutive <= SUCCESS_INTERVALS_DAYS.length
        ? SUCCESS_INTERVALS_DAYS[nextConsecutive - 1]
        : SUCCESS_INTERVALS_DAYS[SUCCESS_INTERVALS_DAYS.length - 1];
    intervalMs = intervalDays * MS_PER_DAY;
  } else {
    result = 'fail';
    nextConsecutive = 0;
    intervalDays = Math.round((RETRY_INTERVAL_MINUTES / (24 * 60)) * 100) / 100;
    intervalMs = RETRY_INTERVAL_MINUTES * MS_PER_MINUTE;
  }

  const nextDueDate = new Date(nowTime + intervalMs);

  return {
    topicId: options.topicId,
    topicName: options.topicName,
    materialId: options.materialId ?? existingRecord?.materialId,
    materialTitle: options.materialTitle ?? existingRecord?.materialTitle,
    sourceReference: options.sourceReference ?? existingRecord?.sourceReference,
    lastReviewedAt: now.toISOString(),
    nextReviewDueAt: nextDueDate.toISOString(),
    consecutiveSuccessCount: nextConsecutive,
    totalAttempts: prevTotalAttempts + 1,
    correctAttempts: options.isSuccess ? prevCorrectAttempts + 1 : prevCorrectAttempts,
    lastScorePercentage: options.scorePercentage,
    lastResult: result,
    intervalDays,
    easeFactor: nextEase,
  };
}

/**
 * Checks if a topic review is due right now.
 */
export function isReviewDue(record: ReviewRecord, now?: Date): boolean {
  if (!record?.nextReviewDueAt) return false;
  const currentTime = now ? now.getTime() : Date.now();
  const dueTime = new Date(record.nextReviewDueAt).getTime();
  return dueTime <= currentTime;
}

/**
 * Filters a list of review records to those that are currently due for review.
 */
export function getDueReviews(records: ReviewRecord[], now?: Date): ReviewRecord[] {
  return records.filter((r) => isReviewDue(r, now));
}

/**
 * Filters a list of review records to those that are scheduled in the future (not yet due).
 */
export function getUpcomingReviews(records: ReviewRecord[], now?: Date): ReviewRecord[] {
  return records.filter((r) => !isReviewDue(r, now));
}

/**
 * Formats time until due or overdue status for display in cards.
 */
export function formatTimeUntilDue(dueDateString: string, now?: Date): string {
  const currentTime = now ? now.getTime() : Date.now();
  const dueTime = new Date(dueDateString).getTime();
  const diffMs = dueTime - currentTime;

  if (diffMs <= 0) {
    const overdueMinutes = Math.floor(Math.abs(diffMs) / MS_PER_MINUTE);
    if (overdueMinutes < 60) {
      return overdueMinutes === 0 ? 'Due now' : `Due now (${overdueMinutes}m overdue)`;
    }
    const overdueHours = Math.floor(overdueMinutes / 60);
    if (overdueHours < 24) {
      return `Due now (${overdueHours}h overdue)`;
    }
    const overdueDays = Math.floor(overdueHours / 24);
    return `Due now (${overdueDays}d overdue)`;
  }

  const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (diffMinutes < 60) {
    return `Due in ${diffMinutes} min`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Due in ${diffHours} hr`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

/**
 * Deterministic unit check function for automated verification without external test runners.
 */
export function runSpacedRepetitionSelfTest(): {
  success: boolean;
  results: Array<{ test: string; passed: boolean; details?: string }>;
} {
  const results: Array<{ test: string; passed: boolean; details?: string }> = [];
  const baseTime = new Date('2026-10-12T12:00:00Z');

  // Test 1: 1st success -> 1 day interval
  const rec1 = calculateNextReview(null, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: true,
    scorePercentage: 100,
    now: baseTime,
  });
  const expectedT1Due = new Date(baseTime.getTime() + 1 * MS_PER_DAY).toISOString();
  const pass1 = rec1.consecutiveSuccessCount === 1 && rec1.nextReviewDueAt === expectedT1Due;
  results.push({ test: 'First success schedules in 1 day', passed: pass1 });

  // Test 2: 2nd consecutive success -> 3 days interval
  const rec2 = calculateNextReview(rec1, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: true,
    scorePercentage: 90,
    now: new Date(rec1.nextReviewDueAt),
  });
  const expectedT2Due = new Date(
    new Date(rec1.nextReviewDueAt).getTime() + 3 * MS_PER_DAY
  ).toISOString();
  const pass2 = rec2.consecutiveSuccessCount === 2 && rec2.nextReviewDueAt === expectedT2Due;
  results.push({ test: 'Second consecutive success schedules in 3 days', passed: pass2 });

  // Test 3: 3rd consecutive success -> 7 days interval
  const rec3 = calculateNextReview(rec2, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: true,
    scorePercentage: 85,
    now: new Date(rec2.nextReviewDueAt),
  });
  const expectedT3Due = new Date(
    new Date(rec2.nextReviewDueAt).getTime() + 7 * MS_PER_DAY
  ).toISOString();
  const pass3 = rec3.consecutiveSuccessCount === 3 && rec3.nextReviewDueAt === expectedT3Due;
  results.push({ test: 'Third consecutive success schedules in 7 days', passed: pass3 });

  // Test 4: 4th consecutive success -> 14 days interval
  const rec4 = calculateNextReview(rec3, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: true,
    scorePercentage: 95,
    now: new Date(rec3.nextReviewDueAt),
  });
  const expectedT4Due = new Date(
    new Date(rec3.nextReviewDueAt).getTime() + 14 * MS_PER_DAY
  ).toISOString();
  const pass4 = rec4.consecutiveSuccessCount === 4 && rec4.nextReviewDueAt === expectedT4Due;
  results.push({ test: 'Fourth consecutive success schedules in 14 days', passed: pass4 });

  // Test 5: 5th consecutive success -> 30 days interval
  const rec5 = calculateNextReview(rec4, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: true,
    scorePercentage: 100,
    now: new Date(rec4.nextReviewDueAt),
  });
  const expectedT5Due = new Date(
    new Date(rec4.nextReviewDueAt).getTime() + 30 * MS_PER_DAY
  ).toISOString();
  const pass5 = rec5.consecutiveSuccessCount === 5 && rec5.nextReviewDueAt === expectedT5Due;
  results.push({ test: 'Fifth consecutive success schedules in 30 days', passed: pass5 });

  // Test 6: Incorrect answer resets consecutive count and schedules retry in 10 minutes
  const failTime = new Date(rec5.nextReviewDueAt);
  const recFail = calculateNextReview(rec5, {
    topicId: 't1',
    topicName: 'Topic 1',
    isSuccess: false,
    scorePercentage: 40,
    now: failTime,
  });
  const expectedFailDue = new Date(
    failTime.getTime() + RETRY_INTERVAL_MINUTES * MS_PER_MINUTE
  ).toISOString();
  const pass6 =
    recFail.consecutiveSuccessCount === 0 &&
    recFail.nextReviewDueAt === expectedFailDue &&
    recFail.lastResult === 'fail';
  results.push({
    test: 'Failed review resets count to 0 and schedules 10-minute retry',
    passed: pass6,
  });

  // Test 7: Due detection
  const isDueNow = isReviewDue(recFail, new Date(failTime.getTime() + 11 * MS_PER_MINUTE));
  const isNotDueYet = !isReviewDue(recFail, new Date(failTime.getTime() + 5 * MS_PER_MINUTE));
  results.push({
    test: 'Due checking detects due timestamps correctly',
    passed: isDueNow && isNotDueYet,
  });

  const allPassed = results.every((r) => r.passed);
  return { success: allPassed, results };
}
