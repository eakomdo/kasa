from datetime import date, datetime, timedelta

from django.utils import timezone


def today(now: datetime | None = None) -> date:
    """Calendar day in Africa/Accra (UTC+0)."""
    return timezone.localdate(now or timezone.now())


def day_key(d: date) -> str:
    return d.isoformat()


def week_start(now: datetime | None = None) -> date:
    """Monday of the current school week."""
    d = today(now)
    return d - timedelta(days=d.weekday())
