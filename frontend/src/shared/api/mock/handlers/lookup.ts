import type { LookupResult } from '@/shared/api/schemas';
import { foldSpecialLetters, normalizeAnswer } from '@/shared/lib/grading';
import { createId } from '@/shared/lib/misc';
import { ITEMS, KHAYA_SAMPLES } from '../data/curriculum';
import { HttpError, route, str } from '../http';
import { serializeItem } from './curriculum';

const LOCAL_LETTERS = /[ɛɔŋƐƆŊ]/;
/** Common English words that make poor matches for related vocabulary. */
const STOP_WORDS = new Set([
  'the',
  'and',
  'you',
  'your',
  'are',
  'for',
  'from',
  'with',
  'what',
  'how',
  'this',
  'that',
  'is',
  'it',
  'its',
  'have',
  'has',
  'can',
  'not',
  'too',
  'say',
  'said',
]);

export const lookupRoutes = [
  // Production: curriculum + approved translations first, then Khaya AI /v1/translate.
  route('POST', '/translate/lookup/', (ctx): LookupResult => {
    const user = ctx.requireUser({ allowSuspended: true });
    const text = str(ctx.body, 'text', { min: 1, max: 200, label: 'a word or phrase' });
    const lang = ctx.body.lang === 'ga' ? 'ga' : 'twi';
    const q = normalizeAnswer(text);
    const items = Object.values(ITEMS).filter((i) => i.lang === lang);

    const toLocal = items.find((i) => normalizeAnswer(i.english) === q);
    const toEnglish = toLocal
      ? undefined
      : items.find((i) => foldSpecialLetters(i.translation) === foldSpecialLetters(q));
    const words = q.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    const related = items
      .filter((i) => i !== toLocal && i !== toEnglish)
      .filter(
        (i) =>
          normalizeAnswer(i.english).includes(q) ||
          words.some((w) => normalizeAnswer(i.english).split(' ').includes(w)),
      )
      .slice(0, 4)
      .map((i) => serializeItem(ctx.db, user.id, i.id));

    const hit = toLocal ?? toEnglish;
    if (hit) {
      return {
        query: text,
        direction: toLocal ? 'to_local' : 'to_english',
        result: {
          output: toLocal ? hit.translation : hit.english,
          source: 'curriculum',
          itemId: hit.id,
          unitId: hit.unitId,
        },
        related,
      };
    }

    const verified = ctx.db.verifiedTranslations.find(
      (v) => v.lang === lang && normalizeAnswer(v.english) === q,
    );
    if (verified) {
      return {
        query: text,
        direction: 'to_local',
        result: { output: verified.translation, source: 'curriculum', itemId: null, unitId: null },
        related,
      };
    }

    const isLocal = LOCAL_LETTERS.test(text);
    const sample = KHAYA_SAMPLES[lang].find(([en, loc]) =>
      isLocal ? foldSpecialLetters(loc) === foldSpecialLetters(q) : en === q,
    );
    if (sample) {
      return {
        query: text,
        direction: isLocal ? 'to_english' : 'to_local',
        result: { output: isLocal ? sample[0] : sample[1], source: 'khaya', itemId: null, unitId: null },
        related,
      };
    }
    return { query: text, direction: isLocal ? 'to_english' : 'to_local', result: null, related };
  }),

  route('POST', '/translate/suggestions/', (ctx) => {
    const user = ctx.requireUser();
    const lang = ctx.body.lang === 'ga' ? 'ga' : 'twi';
    const query = str(ctx.body, 'query', { min: 1, max: 200, label: 'the word or phrase' });
    const suggestion = str(ctx.body, 'suggestion', { min: 1, max: 300, label: 'your translation' });
    const current = typeof ctx.body.currentTranslation === 'string' ? ctx.body.currentTranslation : null;
    const existing = ctx.db.suggestions.find(
      (s) =>
        s.status === 'pending' &&
        s.lang === lang &&
        normalizeAnswer(s.query) === normalizeAnswer(query) &&
        normalizeAnswer(s.suggestion) === normalizeAnswer(suggestion),
    );
    if (existing) {
      if (existing.submittedById !== user.id) existing.supporters += 1;
      return { ok: true };
    }
    if (
      ctx.db.suggestions.filter(
        (s) => s.submittedById === user.id && s.createdAt.slice(0, 10) === ctx.now.toISOString().slice(0, 10),
      ).length >= 20
    )
      throw new HttpError(429, 'You’ve sent lots of suggestions today. Medaase! Try again tomorrow.');
    ctx.db.suggestions.unshift({
      id: `s-${createId()}`,
      lang,
      query,
      currentTranslation: current,
      suggestion,
      submittedById: user.id,
      supporters: 0,
      createdAt: ctx.now.toISOString(),
      status: 'pending',
    });
    return { ok: true };
  }),

  // Audio needs the real Khaya TTS proxy; the mock answers 503 so the UI can explain.
  route('GET', '/tts/', () => {
    throw new HttpError(503, 'Pronunciation audio plays once Kasa is connected to Khaya AI.');
  }),
];
