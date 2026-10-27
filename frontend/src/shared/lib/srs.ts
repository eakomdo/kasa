/**
 * Spaced repetition (Leitner boxes). Mastery 0–5; each correct answer moves an
 * item up a box and pushes its next review further out. A miss drops it back
 * to box 1 so it returns in the next session.
 *
 * The server owns the schedule; this module is shared with the mock backend
 * and documented for the Django implementation in docs/api-contract.md.
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_MASTERY = 5;
/** Mastery at which a word counts as "learned" */
export const LEARNED_AT = 1;
/** Mastery at which a word counts as "mastered" */
export const MASTERED_AT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleResult {
  mastery: number;
  nextReviewAt: Date;
}

export function applyAttempt(previous: number | null, correct: boolean, now: Date): ScheduleResult {
  const prev = previous ?? 0;
  if (correct) {
    const mastery = Math.min(prev + 1, MAX_MASTERY);
    return { mastery, nextReviewAt: new Date(now.getTime() + INTERVAL_DAYS[mastery]! * DAY_MS) };
  }
  return { mastery: prev > 0 ? 1 : 0, nextReviewAt: now };
}

export const isDue = (nextReviewAt: Date | string, now: Date): boolean =>
  new Date(nextReviewAt).getTime() <= now.getTime();

/** XP rewards effort as well as accuracy, so struggling learners still progress. */
export const xpFor = (correct: boolean): number => (correct ? 10 : 3);
