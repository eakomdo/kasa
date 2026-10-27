import type { Unit, VocabItem } from '@/shared/api/schemas';
import { getLevel } from '@/shared/config/levels';
import { dayKey } from '@/shared/lib/date';
import { DAILY_FEATURES, ITEMS, UNITS, phraseIdsOf, wordIdsOf, type SeedUnit } from '../data/curriculum';
import type { Db } from '../db';
import { HttpError, route } from '../http';

export function serializeItem(db: Db, userId: string | null, id: string): VocabItem {
  const item = ITEMS[id];
  if (!item) throw new HttpError(404, 'That word was not found.');
  const p = userId ? db.progress[userId]?.[id] : undefined;
  return { ...item, mastery: p ? p.mastery : null };
}

export function serializeUnit(db: Db, userId: string | null, u: SeedUnit, order: number): Unit {
  const ids = wordIdsOf(u);
  const learned = userId ? ids.filter((id) => (db.progress[userId]?.[id]?.mastery ?? 0) >= 2).length : 0;
  return {
    id: u.id,
    lang: u.lang,
    bands: u.bands,
    order,
    titleLocal: u.titleLocal,
    titleEn: u.titleEn,
    strand: u.strand,
    note: u.note,
    wordCount: u.words.length,
    phraseCount: u.phrases.length,
    contentStatus: u.contentStatus,
    progress: { learned, total: ids.length },
  };
}

export const unitsFor = (lang: string, levelId: string) => {
  const band = getLevel(levelId).band;
  return UNITS.filter((u) => u.lang === lang && u.bands.includes(band));
};

const findUnit = (id: string) => {
  const u = UNITS.find((x) => x.id === id);
  if (!u) throw new HttpError(404, 'That unit was not found.');
  return u;
};

export const curriculumRoutes = [
  route('GET', '/levels/:levelId/units/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const lang = ctx.query.get('lang') ?? user.lang;
    return unitsFor(lang, ctx.params.levelId!).map((u, i) => serializeUnit(ctx.db, user.id, u, i + 1));
  }),

  route('GET', '/units/:unitId/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    const u = findUnit(ctx.params.unitId!);
    const order = unitsFor(u.lang, user.levelId).findIndex((x) => x.id === u.id) + 1;
    return serializeUnit(ctx.db, user.id, u, order);
  }),

  route('GET', '/units/:unitId/vocabulary/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    return wordIdsOf(findUnit(ctx.params.unitId!)).map((id) => serializeItem(ctx.db, user.id, id));
  }),

  route('GET', '/units/:unitId/phrases/', (ctx) => {
    const user = ctx.requireUser({ allowSuspended: true });
    return phraseIdsOf(findUnit(ctx.params.unitId!)).map((id) => serializeItem(ctx.db, user.id, id));
  }),

  route('GET', '/daily-feature/', (ctx) => {
    const lang = (ctx.query.get('lang') ?? 'twi') as keyof typeof DAILY_FEATURES;
    const list = DAILY_FEATURES[lang] ?? DAILY_FEATURES.twi;
    const dayNumber = Math.floor(new Date(dayKey(ctx.now)).getTime() / 86_400_000);
    return list[dayNumber % list.length];
  }),
];
