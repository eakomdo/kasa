/** Answer checking for typed practice in Twi and Ga. */

export type Grade = 'correct' | 'almost' | 'wrong';

/** Lowercase, Unicode-normalise, drop punctuation, collapse spaces. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?.!,;:"“”‘’'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map Ghanaian-language letters to their nearest English keys: ɛ→e, ɔ→o, ŋ→n. */
export function foldSpecialLetters(s: string): string {
  return normalizeAnswer(s).replace(/ɛ/g, 'e').replace(/ɔ/g, 'o').replace(/ŋ/g, 'n');
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/**
 * "almost" = right word, but typed with e/o/n instead of ɛ/ɔ/ŋ, or one small
 * typo in a longer word. It counts as correct so learners on basic phone
 * keyboards are not punished, and the UI shows the proper spelling.
 */
export function gradeTyped(answer: string, expected: string): Grade {
  const a = normalizeAnswer(answer);
  const e = normalizeAnswer(expected);
  if (!a) return 'wrong';
  if (a === e) return 'correct';
  const fa = foldSpecialLetters(a);
  const fe = foldSpecialLetters(e);
  if (fa === fe) return 'almost';
  if (fe.length >= 5 && editDistance(fa, fe) === 1) return 'almost';
  return 'wrong';
}

export const countsAsCorrect = (g: Grade): boolean => g !== 'wrong';
