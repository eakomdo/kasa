/**
 * Practice session state machine. Pure and framework-free so it is easy to
 * test: the page dispatches actions, this decides what happens.
 *
 * question --answer--> feedback --next--> question … --> done
 * (flashcards skip feedback: the learner already saw the answer when flipping)
 */
import type { PracticeCard, PracticeMode } from '@/shared/api/schemas';
import type { Grade } from '@/shared/lib/grading';
import { shuffle } from '@/shared/lib/misc';

export interface SessionCard extends PracticeCard {
  /** Shuffled answer options for multiple choice */
  options: string[];
  /** True for a missed card shown again at the end */
  isRetry: boolean;
}

export interface SessionResult {
  itemId: string;
  english: string;
  translation: string;
  grade: Grade;
  isRetry: boolean;
}

export interface SessionState {
  mode: PracticeMode;
  cards: SessionCard[];
  index: number;
  phase: 'question' | 'feedback' | 'done';
  flipped: boolean;
  given: string | null;
  grade: Grade | null;
  results: SessionResult[];
  initialCount: number;
}

export type SessionAction =
  { type: 'flip' } | { type: 'answer'; grade: Grade; given?: string } | { type: 'next' } | { type: 'end' };

/** Missed cards come back once at the end; this caps how many extra cards a session can grow by. */
export const MAX_RETRIES = 5;

export function buildOptions(card: PracticeCard, random: () => number = Math.random): string[] {
  return shuffle([card.translation, ...card.distractors.slice(0, 3)], random);
}

export function createSession(
  mode: PracticeMode,
  cards: PracticeCard[],
  random: () => number = Math.random,
): SessionState {
  return {
    mode,
    cards: cards.map((c) => ({ ...c, options: buildOptions(c, random), isRetry: false })),
    index: 0,
    phase: cards.length ? 'question' : 'done',
    flipped: false,
    given: null,
    grade: null,
    results: [],
    initialCount: cards.length,
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'flip':
      return state.phase === 'question' ? { ...state, flipped: !state.flipped } : state;

    case 'answer': {
      if (state.phase !== 'question') return state;
      const card = state.cards[state.index];
      if (!card) return state;
      const result: SessionResult = {
        itemId: card.id,
        english: card.english,
        translation: card.translation,
        grade: action.grade,
        isRetry: card.isRetry,
      };
      let cards = state.cards;
      const retries = cards.length - state.initialCount;
      if (action.grade === 'wrong' && !card.isRetry && retries < MAX_RETRIES) {
        cards = [...cards, { ...card, options: buildOptions(card), isRetry: true }];
      }
      const next: SessionState = {
        ...state,
        cards,
        results: [...state.results, result],
        given: action.given ?? null,
        grade: action.grade,
      };
      return state.mode === 'flashcard' ? advance(next) : { ...next, phase: 'feedback' };
    }

    case 'next':
      return state.phase === 'feedback' ? advance(state) : state;

    case 'end':
      return { ...state, phase: 'done' };
  }
}

function advance(state: SessionState): SessionState {
  const index = state.index + 1;
  return {
    ...state,
    index,
    phase: index >= state.cards.length ? 'done' : 'question',
    flipped: false,
    given: null,
    grade: null,
  };
}

export function summarise(results: SessionResult[]) {
  const firstTries = results.filter((r) => !r.isRetry);
  const remembered = firstTries.filter((r) => r.grade !== 'wrong').length;
  const missed = firstTries.filter((r) => r.grade === 'wrong');
  return {
    total: firstTries.length,
    remembered,
    accuracy: firstTries.length ? remembered / firstTries.length : 0,
    toReview: missed,
  };
}
