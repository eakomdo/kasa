"""
Spaced repetition (Leitner boxes). Port of the frontend's src/shared/lib/srs.ts.

Mastery 0–5. A correct answer moves an item up a box and pushes the next review
further out; a miss drops it back to box 1 and makes it due again immediately.
"""

from datetime import datetime, timedelta

INTERVAL_DAYS = (0, 1, 3, 7, 14, 30)
MAX_MASTERY = 5
LEARNED_AT = 1  # mastery at which a word counts as "learned"
MASTERED_AT = 3  # ...and as "mastered"


def apply_attempt(previous: int | None, correct: bool, now: datetime) -> tuple[int, datetime]:
    prev = previous or 0
    if correct:
        mastery = min(prev + 1, MAX_MASTERY)
        return mastery, now + timedelta(days=INTERVAL_DAYS[mastery])
    return (1 if prev > 0 else 0), now


def is_due(next_review_at: datetime, now: datetime) -> bool:
    return next_review_at <= now


def xp_for(correct: bool) -> int:
    """Effort counts as well as accuracy, so struggling learners still progress."""
    return 10 if correct else 3
