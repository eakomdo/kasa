import { describe, expect, it } from 'vitest';
import type { PracticeCard } from '@/shared/api/schemas';
import { MAX_RETRIES, createSession, sessionReducer, summarise, type SessionState } from './session';

const card = (id: string, translation = `t-${id}`): PracticeCard => ({
  id,
  unitId: 'u',
  lang: 'twi',
  kind: 'word',
  english: `e-${id}`,
  translation,
  audioUrl: null,
  mastery: null,
  distractors: ['a', 'b', 'c'],
  isNew: true,
});

const run = (s: SessionState, ...actions: Parameters<typeof sessionReducer>[1][]) =>
  actions.reduce(sessionReducer, s);

describe('practice session', () => {
  it('builds four shuffled options containing the answer', () => {
    const s = createSession('choice', [card('1')]);
    expect(s.cards[0]!.options).toHaveLength(4);
    expect(s.cards[0]!.options).toContain('t-1');
  });

  it('flashcards advance straight after answering', () => {
    const s = run(
      createSession('flashcard', [card('1'), card('2')]),
      { type: 'flip' },
      { type: 'answer', grade: 'correct' },
    );
    expect(s.index).toBe(1);
    expect(s.phase).toBe('question');
    expect(s.flipped).toBe(false);
  });

  it('choice and typing modes show feedback before moving on', () => {
    let s = run(createSession('typing', [card('1'), card('2')]), {
      type: 'answer',
      grade: 'almost',
      given: 'mmiensa',
    });
    expect(s.phase).toBe('feedback');
    expect(s.given).toBe('mmiensa');
    s = sessionReducer(s, { type: 'next' });
    expect(s.index).toBe(1);
    expect(s.phase).toBe('question');
  });

  it('ignores answers while feedback is showing', () => {
    const s = run(
      createSession('choice', [card('1')]),
      { type: 'answer', grade: 'correct' },
      { type: 'answer', grade: 'wrong' },
    );
    expect(s.results).toHaveLength(1);
  });

  it('brings a missed card back once at the end', () => {
    let s = run(createSession('flashcard', [card('1'), card('2')]), { type: 'answer', grade: 'wrong' });
    expect(s.cards).toHaveLength(3);
    expect(s.cards[2]!.isRetry).toBe(true);
    s = run(s, { type: 'answer', grade: 'correct' }, { type: 'answer', grade: 'wrong' });
    expect(s.cards).toHaveLength(3); // retry cards are not re-queued
    expect(s.phase).toBe('done');
  });

  it(`caps retries at ${MAX_RETRIES}`, () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(String(i)));
    let s = createSession('flashcard', cards);
    for (let i = 0; i < 10; i++) s = sessionReducer(s, { type: 'answer', grade: 'wrong' });
    expect(s.cards.length).toBe(10 + MAX_RETRIES);
  });

  it('summarises first attempts only', () => {
    const s = run(
      createSession('flashcard', [card('1'), card('2')]),
      { type: 'answer', grade: 'wrong' },
      { type: 'answer', grade: 'almost' },
      { type: 'answer', grade: 'correct' },
    );
    const sum = summarise(s.results);
    expect(sum.total).toBe(2);
    expect(sum.remembered).toBe(1);
    expect(sum.toReview.map((r) => r.itemId)).toEqual(['1']);
  });

  it('an empty batch is immediately done', () => {
    expect(createSession('flashcard', []).phase).toBe('done');
  });
});
