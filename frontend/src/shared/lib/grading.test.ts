import { describe, expect, it } from 'vitest';
import { countsAsCorrect, editDistance, foldSpecialLetters, gradeTyped, normalizeAnswer } from './grading';

describe('normalizeAnswer', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalizeAnswer('  Wo ho te sɛn?  ')).toBe('wo ho te sɛn');
    expect(normalizeAnswer('ME  HO YƐ.')).toBe('me ho yɛ');
  });
});

describe('foldSpecialLetters', () => {
  it('maps ɛ ɔ ŋ to plain keyboard letters', () => {
    expect(foldSpecialLetters('Ɔkyerɛkyerɛfoɔ')).toBe('okyerekyerefoo');
    expect(foldSpecialLetters('Nyɔŋma')).toBe('nyonma');
  });
});

describe('gradeTyped', () => {
  it('accepts exact answers regardless of case and punctuation', () => {
    expect(gradeTyped('medaase', 'Medaase')).toBe('correct');
    expect(gradeTyped('wo ho te sɛn', 'Wo ho te sɛn?')).toBe('correct');
  });

  it('calls plain-letter spellings "almost" so basic keyboards are not punished', () => {
    expect(gradeTyped('mmiensa', 'Mmiɛnsa')).toBe('almost');
    expect(gradeTyped('oyiwaladonn', 'Oyiwaladɔŋŋ')).toBe('almost');
  });

  it('forgives one typo in longer words only', () => {
    expect(gradeTyped('akwaba', 'Akwaaba')).toBe('almost');
    expect(gradeTyped('tu', 'Ti')).toBe('wrong');
  });

  it('rejects wrong and empty answers', () => {
    expect(gradeTyped('daabi', 'Aane')).toBe('wrong');
    expect(gradeTyped('   ', 'Aane')).toBe('wrong');
  });

  it('almost counts as correct for scheduling', () => {
    expect(countsAsCorrect('almost')).toBe(true);
    expect(countsAsCorrect('wrong')).toBe(false);
  });
});

describe('editDistance', () => {
  it('computes Levenshtein distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });
});
