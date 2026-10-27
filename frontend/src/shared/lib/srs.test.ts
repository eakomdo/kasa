import { describe, expect, it } from 'vitest';
import { INTERVAL_DAYS, MAX_MASTERY, applyAttempt, isDue, xpFor } from './srs';

const now = new Date('2026-10-26T10:00:00Z');
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);

describe('applyAttempt', () => {
  it('moves a new word to box 1, due tomorrow', () => {
    const r = applyAttempt(null, true, now);
    expect(r.mastery).toBe(1);
    expect(days(r.nextReviewAt)).toBe(INTERVAL_DAYS[1]);
  });

  it('spaces reviews further apart as mastery grows', () => {
    expect(days(applyAttempt(2, true, now).nextReviewAt)).toBe(7);
    expect(days(applyAttempt(4, true, now).nextReviewAt)).toBe(30);
  });

  it('never goes past the top box', () => {
    expect(applyAttempt(MAX_MASTERY, true, now).mastery).toBe(MAX_MASTERY);
  });

  it('drops a missed word back to box 1 and makes it due now', () => {
    const r = applyAttempt(4, false, now);
    expect(r.mastery).toBe(1);
    expect(r.nextReviewAt.getTime()).toBe(now.getTime());
  });

  it('keeps a brand-new missed word at 0', () => {
    expect(applyAttempt(null, false, now).mastery).toBe(0);
  });
});

describe('isDue and xp', () => {
  it('is due at or after the review time', () => {
    expect(isDue(now, now)).toBe(true);
    expect(isDue(new Date(now.getTime() + 1000), now)).toBe(false);
  });

  it('rewards effort as well as accuracy', () => {
    expect(xpFor(true)).toBeGreaterThan(xpFor(false));
    expect(xpFor(false)).toBeGreaterThan(0);
  });
});
