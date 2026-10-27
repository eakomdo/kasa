import type { BadgeId, PracticeCard, ProgressSummary } from '@/shared/api/schemas';
import { addDays, dayKey } from '@/shared/lib/date';
import { shuffle } from '@/shared/lib/misc';
import { LEARNED_AT, MASTERED_AT, applyAttempt, isDue, xpFor } from '@/shared/lib/srs';
import { ITEMS, UNITS, wordIdsOf } from '../data/curriculum';
import type { Db } from '../db';
import { HttpError, route } from '../http';
import { serializeItem, unitsFor } from './curriculum';

/* ---------- Streaks, XP and badges (shared with community + leaderboard) ---------- */
export function streakOf(db: Db, userId: string, now: Date): { current: number; longest: number } {
  const days = db.activity[userId] ?? {};
  const active = (d: Date) => (days[dayKey(d)]?.count ?? 0) > 0;
  let start = active(now) ? now : active(addDays(now, -1)) ? addDays(now, -1) : null;
  let current = 0;
  while (start && active(start)) {
    current++;
    start = addDays(start, -1);
  }
  const sorted = Object.keys(days)
    .filter((k) => days[k]!.count > 0)
    .sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev && dayKey(addDays(new Date(`${prev}T12:00:00`), 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { current, longest: Math.max(longest, current) };
}

/** Monday of the current week (school weeks start Monday). */
export function weekStart(now: Date): Date {
  const d = new Date(`${dayKey(now)}T12:00:00`);
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

export function xpThisWeek(db: Db, userId: string, now: Date): number {
  const start = dayKey(weekStart(now));
  return Object.entries(db.activity[userId] ?? {})
    .filter(([day]) => day >= start)
    .reduce((sum, [, a]) => sum + a.xp, 0);
}

export function awardBadge(db: Db, userId: string, id: BadgeId, now: Date): boolean {
  const list = (db.badges[userId] ??= []);
  if (list.some((b) => b.id === id)) return false;
  list.push({ id, earnedAt: now.toISOString() });
  return true;
}

function counts(db: Db, userId: string, lang: string) {
  const entries = Object.entries(db.progress[userId] ?? {}).filter(([id]) => ITEMS[id]?.lang === lang);
  return {
    learned: entries.filter(([, p]) => p.mastery >= LEARNED_AT).length,
    mastered: entries.filter(([, p]) => p.mastery >= MASTERED_AT).length,
    entries,
  };
}

function checkLearningBadges(db: Db, userId: string, lang: string, now: Date) {
  const total = Object.values(db.activity[userId] ?? {}).reduce((s, a) => s + a.count, 0);
  if (total > 0) awardBadge(db, userId, 'akwaaba', now);
  if (total >= 100) awardBadge(db, userId, 'sankofa', now);
  if (streakOf(db, userId, now).current >= 7) awardBadge(db, userId, 'nnanson', now);
  if (counts(db, userId, lang).mastered >= 25) awardBadge(db, userId, 'nyansapo', now);
}

/* ---------- Routes ---------- */
export const practiceRoutes = [
  route('GET', '/practice/next-batch/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const lang = ctx.query.get('lang') ?? user.lang;
    const levelId = ctx.query.get('level') ?? user.levelId;
    const unitId = ctx.query.get('unit');
    const limit = Math.min(50, Math.max(1, Number(ctx.query.get('limit') ?? user.dailyGoal)));
    const progress = (ctx.db.progress[user.id] ??= {});

    const units = unitId ? UNITS.filter((u) => u.id === unitId) : unitsFor(lang, levelId);
    if (unitId && units.length === 0) throw new HttpError(404, 'That unit was not found.');
    const pool = units.flatMap(wordIdsOf);
    if (!unitId) {
      // Items learners added themselves (e.g. from lookup) join the general review pool
      for (const id of Object.keys(progress))
        if (!pool.includes(id) && ITEMS[id]?.lang === lang) pool.push(id);
    }

    const due = pool.filter((id) => progress[id] && isDue(progress[id]!.nextReviewAt, ctx.now));
    due.sort((a, b) => progress[a]!.nextReviewAt.localeCompare(progress[b]!.nextReviewAt));
    const fresh = pool.filter((id) => !progress[id]);
    let ids = [...due, ...fresh];
    if (unitId && ids.length < limit) {
      const rest = pool
        .filter((id) => !ids.includes(id))
        .sort((a, b) => progress[a]!.mastery - progress[b]!.mastery);
      ids = [...ids, ...rest];
    }

    const cards: PracticeCard[] = ids.slice(0, limit).map((id) => {
      const item = ITEMS[id]!;
      const sameLang = Object.values(ITEMS).filter(
        (x) => x.lang === item.lang && x.kind === item.kind && x.translation !== item.translation,
      );
      const near = shuffle(sameLang.filter((x) => x.unitId === item.unitId));
      const far = shuffle(sameLang.filter((x) => x.unitId !== item.unitId));
      const distractors = [...new Set([...near, ...far].map((x) => x.translation))].slice(0, 3);
      return { ...serializeItem(ctx.db, user.id, id), distractors, isNew: !progress[id] };
    });
    return { cards };
  }),

  route('POST', '/practice/attempt/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const { clientId, itemId, correct, answeredAt } = ctx.body as Record<string, unknown>;
    if (typeof clientId !== 'string' || typeof itemId !== 'string' || typeof correct !== 'boolean')
      throw new HttpError(400, 'Send clientId, itemId and correct.');
    const seen = ctx.db.processedAttempts[clientId];
    if (seen) return seen; // idempotent: offline retries must not double-count
    const item = ITEMS[itemId];
    if (!item) throw new HttpError(404, 'That word was not found.');

    const at =
      typeof answeredAt === 'string' && !Number.isNaN(Date.parse(answeredAt))
        ? new Date(answeredAt)
        : ctx.now;
    const progress = (ctx.db.progress[user.id] ??= {});
    const next = applyAttempt(progress[itemId]?.mastery ?? null, correct, at);
    progress[itemId] = {
      mastery: next.mastery,
      nextReviewAt: next.nextReviewAt.toISOString(),
      lastSeenAt: at.toISOString(),
    };

    const days = (ctx.db.activity[user.id] ??= {});
    const day = (days[dayKey(at)] ??= { count: 0, xp: 0 });
    day.count += 1;
    day.xp += xpFor(correct);
    checkLearningBadges(ctx.db, user.id, item.lang, ctx.now);

    const result = { itemId, mastery: next.mastery, nextReviewAt: next.nextReviewAt.toISOString() };
    ctx.db.processedAttempts[clientId] = result;
    return result;
  }),

  route('POST', '/practice/deck/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const itemId = typeof ctx.body.itemId === 'string' ? ctx.body.itemId : '';
    if (!ITEMS[itemId]) throw new HttpError(404, 'That word was not found.');
    const progress = (ctx.db.progress[user.id] ??= {});
    progress[itemId] ??= {
      mastery: 0,
      nextReviewAt: ctx.now.toISOString(),
      lastSeenAt: ctx.now.toISOString(),
    };
    return serializeItem(ctx.db, user.id, itemId);
  }),

  route('GET', '/progress/summary/', (ctx): ProgressSummary => {
    const user = ctx.requireUser({ allowSuspended: true });
    const lang = ctx.query.get('lang') ?? user.lang;
    const { learned, mastered, entries } = counts(ctx.db, user.id, lang);
    const progress = ctx.db.progress[user.id] ?? {};
    const levelWords = unitsFor(lang, user.levelId).flatMap(wordIdsOf);
    const days = ctx.db.activity[user.id] ?? {};
    const streak = streakOf(ctx.db, user.id, ctx.now);
    return {
      streak: streak.current,
      longestStreak: streak.longest,
      learned,
      mastered,
      dueCount: entries.filter(([, p]) => isDue(p.nextReviewAt, ctx.now)).length,
      newCount: levelWords.filter((id) => !progress[id]).length,
      todayCount: days[dayKey(ctx.now)]?.count ?? 0,
      totalReviewed: Object.values(days).reduce((s, a) => s + a.count, 0),
      xpThisWeek: xpThisWeek(ctx.db, user.id, ctx.now),
      history: Array.from({ length: 14 }, (_, i) => {
        const date = dayKey(addDays(ctx.now, i - 13));
        return { date, count: days[date]?.count ?? 0 };
      }),
      badges: ctx.db.badges[user.id] ?? [],
    };
  }),
];
