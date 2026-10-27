"""Practice, progress and leaderboards. Behaviour matches the frontend mock (handlers/practice.ts, leaderboard.ts)."""

import random
from datetime import UTC, timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.core.exceptions import ApiError
from apps.core.timeutil import today, week_start
from apps.curriculum.models import Item, Unit
from apps.curriculum.services import serialize_item, units_for

from .models import Attempt, BadgeAward, DailyActivity, LeaderboardPeer, Progress
from .services import check_learning_badges, streak_of, total_reviewed, xp_this_week
from .srs import LEARNED_AT, MASTERED_AT, apply_attempt, xp_for


def _word_pool(units: list[Unit]) -> list[str]:
    """Word ids for these units in syllabus order, in one query."""
    order = {u.id: i for i, u in enumerate(units)}
    rows = Item.objects.filter(unit_id__in=list(order), kind='word').values_list('id', 'unit_id', 'position')
    return [r[0] for r in sorted(rows, key=lambda r: (order[r[1]], r[2]))]


def _distractors(item: Item, candidates: list[dict], rng: random.Random) -> list[str]:
    """Three wrong answers of the same language and kind, preferring the same unit."""
    same = [
        c
        for c in candidates
        if c['lang'] == item.lang and c['kind'] == item.kind and c['translation'] != item.translation
    ]
    near = [c for c in same if c['unit_id'] == item.unit_id]
    far = [c for c in same if c['unit_id'] != item.unit_id]
    rng.shuffle(near)
    rng.shuffle(far)
    seen: list[str] = []
    for c in near + far:
        if c['translation'] not in seen:
            seen.append(c['translation'])
        if len(seen) == 3:
            break
    return seen


@api_view(['GET'])
def next_batch(request):
    user = request.user
    lang = request.query_params.get('lang') or user.lang
    level_id = request.query_params.get('level') or user.level_id
    unit_id = request.query_params.get('unit')
    try:
        limit = int(request.query_params.get('limit') or user.daily_goal)
    except ValueError:
        limit = user.daily_goal
    limit = min(50, max(1, limit))
    now = timezone.now()

    if unit_id:
        unit = Unit.objects.filter(pk=unit_id).first()
        if unit is None:
            raise ApiError('That unit was not found.', 404)
        units = [unit]
    else:
        units = units_for(lang, level_id)
    pool = _word_pool(units)

    progress = {
        p['item_id']: p
        for p in Progress.objects.filter(user=user, item__lang=unit.lang if unit_id else lang).values(
            'item_id', 'mastery', 'next_review_at'
        )
    }
    if not unit_id:
        # Items learners added themselves (e.g. from lookup) join the general review pool
        in_pool = set(pool)
        pool += [i for i in progress if i not in in_pool]

    due = sorted(
        (i for i in pool if i in progress and progress[i]['next_review_at'] <= now),
        key=lambda i: progress[i]['next_review_at'],
    )
    fresh = [i for i in pool if i not in progress]
    ids = due + fresh
    if unit_id and len(ids) < limit:
        chosen = set(ids)
        ids += sorted((i for i in pool if i not in chosen), key=lambda i: progress[i]['mastery'])
    ids = ids[:limit]

    items = Item.objects.in_bulk(ids)
    langs = {items[i].lang for i in ids if i in items}
    candidates = list(Item.objects.filter(lang__in=langs).values('id', 'unit_id', 'lang', 'kind', 'translation'))
    rng = random.Random()
    cards = []
    for i in ids:
        item = items.get(i)
        if item is None:
            continue
        p = progress.get(i)
        cards.append(
            {
                **serialize_item(request, item, p['mastery'] if p else None),
                'distractors': _distractors(item, candidates, rng),
                'is_new': p is None,
            }
        )
    return Response({'cards': cards})


def _attempt_result(a: Attempt) -> dict:
    return {'item_id': a.item_id, 'mastery': a.mastery_after, 'next_review_at': a.next_review_at.isoformat()}


@api_view(['POST'])
def attempt(request):
    user = request.user
    data = request.data
    client_id, item_id, correct = data.get('client_id'), data.get('item_id'), data.get('correct')
    if not isinstance(client_id, str) or not isinstance(item_id, str) or not isinstance(correct, bool):
        raise ApiError('Send clientId, itemId and correct.')

    seen = Attempt.objects.filter(client_id=client_id).first()
    if seen:
        return Response(_attempt_result(seen))  # idempotent: offline retries must not double-count
    item = Item.objects.filter(pk=item_id).first()
    if item is None:
        raise ApiError('That word was not found.', 404)

    now = timezone.now()
    at = parse_datetime(data['answered_at']) if isinstance(data.get('answered_at'), str) else None
    if at is None:
        at = now
    elif timezone.is_naive(at):
        at = timezone.make_aware(at, UTC)
    mode = str(data.get('mode') or 'flashcard')[:10]

    try:
        with transaction.atomic():
            prog = Progress.objects.select_for_update().filter(user=user, item=item).first()
            mastery, next_review = apply_attempt(prog.mastery if prog else None, correct, at)
            if prog:
                prog.mastery, prog.next_review_at, prog.last_seen_at = mastery, next_review, at
                prog.save(update_fields=['mastery', 'next_review_at', 'last_seen_at'])
            else:
                Progress.objects.create(
                    user=user, item=item, mastery=mastery, next_review_at=next_review, last_seen_at=at
                )

            day = timezone.localdate(at)
            DailyActivity.objects.get_or_create(user=user, day=day)
            DailyActivity.objects.filter(user=user, day=day).update(count=F('count') + 1, xp=F('xp') + xp_for(correct))

            record = Attempt.objects.create(
                client_id=client_id,
                user=user,
                item=item,
                correct=correct,
                mode=mode,
                answered_at=at,
                mastery_after=mastery,
                next_review_at=next_review,
            )
    except IntegrityError:
        # The same answer arrived twice at once: return the one that won
        return Response(_attempt_result(Attempt.objects.get(client_id=client_id)))

    check_learning_badges(user, item.lang, now)
    return Response(_attempt_result(record))


@api_view(['POST'])
def add_to_deck(request):
    item_id = request.data.get('item_id')
    item = Item.objects.filter(pk=item_id).first() if isinstance(item_id, str) else None
    if item is None:
        raise ApiError('That word was not found.', 404)
    now = timezone.now()
    prog, _ = Progress.objects.get_or_create(
        user=request.user, item=item, defaults={'mastery': 0, 'next_review_at': now, 'last_seen_at': now}
    )
    return Response(serialize_item(request, item, prog.mastery))


@api_view(['GET'])
def progress_summary(request):
    user = request.user
    lang = request.query_params.get('lang') or user.lang
    now = timezone.now()
    rows = list(Progress.objects.filter(user=user, item__lang=lang).values_list('item_id', 'mastery', 'next_review_at'))
    seen = {r[0] for r in rows}
    level_words = _word_pool(units_for(lang, user.level_id))

    d = today(now)
    start = d - timedelta(days=13)
    by_day = dict(DailyActivity.objects.filter(user=user, day__gte=start).values_list('day', 'count'))
    current, longest = streak_of(user, now)

    return Response(
        {
            'streak': current,
            'longest_streak': longest,
            'learned': sum(1 for r in rows if r[1] >= LEARNED_AT),
            'mastered': sum(1 for r in rows if r[1] >= MASTERED_AT),
            'due_count': sum(1 for r in rows if r[2] <= now),
            'new_count': sum(1 for i in level_words if i not in seen),
            'today_count': by_day.get(d, 0),
            'total_reviewed': total_reviewed(user),
            'xp_this_week': xp_this_week(user, now),
            'history': [
                {'date': (start + timedelta(days=i)).isoformat(), 'count': by_day.get(start + timedelta(days=i), 0)}
                for i in range(14)
            ],
            'badges': [
                {'id': b.badge, 'earned_at': b.earned_at.isoformat()}
                for b in BadgeAward.objects.filter(user=user).order_by('earned_at')
            ],
        }
    )


@api_view(['GET'])
def leaderboard(request):
    user = request.user
    scope = request.query_params.get('scope')
    scope = scope if scope in ('school', 'region', 'national') else 'school'
    lang = 'ga' if request.query_params.get('lang') == 'ga' else 'twi'
    now = timezone.now()
    if scope == 'school':
        label = user.school or 'Your school'
    elif scope == 'region':
        label = f'{user.region or "Your"} Region'
    else:
        label = 'All of Ghana'

    peers = LeaderboardPeer.objects.filter(lang=lang).exclude(display_name=user.display_name)
    if scope == 'school':
        peers = peers.filter(school=user.school) if user.school else peers.none()
    elif scope == 'region':
        peers = peers.filter(region=user.region) if user.region else peers.none()
    can_rank = scope == 'national' or bool(user.school if scope == 'school' else user.region)

    rows = [
        {'display_name': p.display_name, 'school': p.school, 'region': p.region, 'xp': p.xp, 'is_me': False}
        for p in peers
    ]
    if can_rank:
        rows.append(
            {
                'display_name': user.display_name,
                'school': user.school,
                'region': user.region,
                'xp': xp_this_week(user, now),
                'is_me': True,
            }
        )
    rows.sort(key=lambda r: (-r['xp'], not r['is_me']))
    entries = [{**r, 'rank': i + 1} for i, r in enumerate(rows)]
    return Response(
        {
            'scope': scope,
            'label': label,
            'week_start': week_start(now).isoformat(),
            'entries': entries[:20],
            'me': next((e for e in entries if e['is_me']), None),
        }
    )
