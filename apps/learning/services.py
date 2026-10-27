"""Learning rules shared across apps: badges, streaks and XP."""

from datetime import datetime, timedelta

from django.db.models import Sum
from django.utils import timezone

from apps.core.timeutil import today, week_start

from .models import BADGES, BadgeAward, DailyActivity, Progress
from .srs import MASTERED_AT


def award_badge(user, badge: str) -> bool:
    """Give a badge once. Returns True if it was newly earned."""
    assert badge in BADGES, badge
    _, created = BadgeAward.objects.get_or_create(user=user, badge=badge, defaults={'earned_at': timezone.now()})
    return created


def active_days(user) -> set:
    return set(DailyActivity.objects.filter(user=user, count__gt=0).values_list('day', flat=True))


def streak_of(user, now: datetime | None = None) -> tuple[int, int]:
    """(current, longest). The current streak ends today, or yesterday if the learner hasn't practised yet today."""
    days = active_days(user)
    d = today(now)
    start = d if d in days else (d - timedelta(days=1) if d - timedelta(days=1) in days else None)
    current = 0
    while start is not None and start in days:
        current += 1
        start -= timedelta(days=1)
    longest = run = 0
    prev = None
    for day in sorted(days):
        run = run + 1 if prev is not None and day == prev + timedelta(days=1) else 1
        longest = max(longest, run)
        prev = day
    return current, max(longest, current)


def xp_this_week(user, now: datetime | None = None) -> int:
    total = DailyActivity.objects.filter(user=user, day__gte=week_start(now)).aggregate(s=Sum('xp'))['s']
    return total or 0


def total_reviewed(user) -> int:
    return DailyActivity.objects.filter(user=user).aggregate(s=Sum('count'))['s'] or 0


def check_learning_badges(user, lang: str, now: datetime | None = None) -> None:
    total = total_reviewed(user)
    if total > 0:
        award_badge(user, 'akwaaba')
    if total >= 100:
        award_badge(user, 'sankofa')
    if streak_of(user, now)[0] >= 7:
        award_badge(user, 'nnanson')
    if Progress.objects.filter(user=user, item__lang=lang, mastery__gte=MASTERED_AT).count() >= 25:
        award_badge(user, 'nyansapo')
