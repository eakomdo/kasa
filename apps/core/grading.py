"""Answer checking for Twi and Ga. Port of the frontend's src/shared/lib/grading.ts."""

import re
import unicodedata
from typing import Literal

Grade = Literal['correct', 'almost', 'wrong']

_PUNCT = re.compile(r'[?.!,;:"“”‘’\'()]')
_SPACE = re.compile(r'\s+')


def normalize_answer(s: str) -> str:
    """Lowercase, Unicode-normalise, drop punctuation, collapse spaces."""
    s = unicodedata.normalize('NFC', s or '').lower()
    return _SPACE.sub(' ', _PUNCT.sub('', s)).strip()


def fold_special_letters(s: str) -> str:
    """Map ɛ→e, ɔ→o, ŋ→n so plain-keyboard spellings can be compared."""
    return normalize_answer(s).replace('ɛ', 'e').replace('ɔ', 'o').replace('ŋ', 'n')


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        diag, prev[0] = prev[0], i
        for j in range(1, len(b) + 1):
            tmp = prev[j]
            prev[j] = min(prev[j] + 1, prev[j - 1] + 1, diag + (0 if a[i - 1] == b[j - 1] else 1))
            diag = tmp
    return prev[len(b)]


def grade_typed(answer: str, expected: str) -> Grade:
    """'almost' = right word typed with e/o/n for ɛ/ɔ/ŋ, or one typo in a longer word. Counts as correct."""
    a, e = normalize_answer(answer), normalize_answer(expected)
    if not a:
        return 'wrong'
    if a == e:
        return 'correct'
    fa, fe = fold_special_letters(a), fold_special_letters(e)
    if fa == fe:
        return 'almost'
    if len(fe) >= 5 and edit_distance(fa, fe) == 1:
        return 'almost'
    return 'wrong'


def counts_as_correct(g: Grade) -> bool:
    return g != 'wrong'
