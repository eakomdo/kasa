from datetime import UTC, datetime, timedelta

from apps.learning.srs import INTERVAL_DAYS, MAX_MASTERY, apply_attempt, is_due, xp_for

NOW = datetime(2026, 10, 26, 10, 0, tzinfo=UTC)


def days(d: datetime) -> int:
    return round((d - NOW).total_seconds() / 86400)


def test_new_word_moves_to_box_1_due_tomorrow():
    mastery, nxt = apply_attempt(None, True, NOW)
    assert mastery == 1
    assert days(nxt) == INTERVAL_DAYS[1]


def test_reviews_space_out_as_mastery_grows():
    assert days(apply_attempt(2, True, NOW)[1]) == 7
    assert days(apply_attempt(4, True, NOW)[1]) == 30


def test_never_past_the_top_box():
    assert apply_attempt(MAX_MASTERY, True, NOW)[0] == MAX_MASTERY


def test_miss_drops_to_box_1_and_is_due_now():
    mastery, nxt = apply_attempt(4, False, NOW)
    assert mastery == 1 and nxt == NOW


def test_brand_new_miss_stays_at_0():
    assert apply_attempt(None, False, NOW)[0] == 0


def test_due_and_xp():
    assert is_due(NOW, NOW)
    assert not is_due(NOW + timedelta(seconds=1), NOW)
    assert xp_for(True) > xp_for(False) > 0
