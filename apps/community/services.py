"""
Communities, memberships and discussions: permission model, serialization and
validation. A port of the frontend mock (src/shared/api/mock/handlers/community.ts);
`access()` is the single implementation of the permission model documented in
the API contract, and every view goes through it.
"""

import random
import re
import unicodedata
from dataclasses import dataclass

from django.db.models import Count, IntegerField, OuterRef, Q, QuerySet, Subquery, Sum, TextField, Value
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.serializers import serialize_author
from apps.core.exceptions import ApiError, field_error
from apps.core.permissions import is_staff_role
from apps.core.safety import check_post_safety

from .models import Community, Membership, ModerationLog, Reply, Thread, Vote

PAGE_SIZE = 15
DAILY_THREAD_LIMIT = 5
DAILY_REPLY_LIMIT = 30
MAX_PENDING_PROPOSALS = 3
TAGS = ('twi', 'ga', 'bece', 'wassce', 'pronunciation', 'grammar', 'proverbs', 'vocabulary')
REASONS = ('spam', 'bullying', 'inappropriate', 'personal_info', 'wrong_translation', 'other')
KINDS = ('school', 'class', 'study', 'interest')
POLICIES = ('open', 'request', 'code')
BANDS = ('lp', 'up', 'jhs', 'shs')
COLORS = ('forest', 'gold', 'clay', 'sky')
RANK = {'owner': 4, 'admin': 3, 'helper': 2, 'member': 1}
_UNSET = object()


# ---------------------------------------------------------------- Access
def is_adult(user: User) -> bool:
    return user.role != 'student'


def membership_of(community: Community, user: User) -> Membership | None:
    return Membership.objects.filter(community=community, user=user).first()


@dataclass
class Access:
    membership: Membership | None
    is_member: bool
    role: str | None
    perms: dict
    can_appoint_helpers: bool  # students who own a community may appoint helpers but nothing above


def access(c: Community, user: User, m=_UNSET) -> Access:
    """The permission model, in one place."""
    if m is _UNSET:
        m = membership_of(c, user)
    staff = is_staff_role(user)
    is_member = m is not None and m.status == 'member'
    role = (m.role or 'member') if is_member else None
    rank = RANK[role] if role else 0
    live = c.status == 'active'
    visible = c.status in ('active', 'archived')
    can_view = (
        staff or (visible and (c.join_policy == 'open' or is_member)) or (not visible and c.created_by_id == user.id)
    )
    can_manage_members = staff or (rank >= RANK['admin'] and is_adult(user))
    return Access(
        membership=m,
        is_member=is_member,
        role=role,
        can_appoint_helpers=can_manage_members or role == 'owner',
        perms={
            'can_view': can_view,
            'can_post': live
            and user.status == 'active'
            and (staff or (is_member and (not c.staff_only_posting or rank >= RANK['admin']))),
            'can_manage_requests': staff or rank >= RANK['helper'],
            'can_pin': staff or rank >= RANK['helper'],
            'can_remove_posts': staff or (rank >= RANK['admin'] and is_adult(user)),
            'can_manage_members': can_manage_members,
            'can_appoint_admins': staff or (role == 'owner' and is_adult(user)),
            'can_edit_settings': staff or rank >= RANK['admin'] or role == 'owner',
            'can_leave': m is not None and role != 'owner',
        },
    )


def can_participate(c: Community, user: User, a: Access) -> bool:
    """Members (not just readers) can reply and vote; staff can everywhere."""
    return c.status == 'active' and user.status == 'active' and (is_staff_role(user) or a.is_member)


def find_community(id_or_slug: str, user: User) -> Community:
    c = Community.objects.select_related('created_by').filter(pk=id_or_slug).first()
    hidden = c is not None and c.status in ('pending', 'rejected')
    if c is None or (hidden and c.created_by_id != user.id and not is_staff_role(user)):
        raise ApiError('We couldn’t find that community. It may have been closed.', 404)
    return c


def managers_of(c: Community) -> QuerySet[Membership]:
    return Membership.objects.filter(
        community=c, status='member', role__in=('owner', 'admin', 'helper')
    ).select_related('user')


def log(actor: User, action: str, target_type: str, target_id, note: str = '') -> None:
    ModerationLog.objects.create(
        actor=actor, action=action, target_type=target_type, target_id=str(target_id), note=note
    )


# ---------------------------------------------------------------- Community serialization
def with_counts(qs: QuerySet[Community]) -> QuerySet[Community]:
    members = (
        Membership.objects.filter(community=OuterRef('pk'), status='member')
        .values('community')
        .annotate(n=Count('pk'))
        .values('n')
    )
    threads = (
        Thread.objects.filter(community=OuterRef('pk'), status='visible')
        .values('community')
        .annotate(n=Count('pk'))
        .values('n')
    )
    return qs.select_related('created_by').annotate(
        member_count=Coalesce(Subquery(members, output_field=IntegerField()), Value(0)),
        thread_count=Coalesce(Subquery(threads, output_field=IntegerField()), Value(0)),
    )


def _membership_json(m: Membership | None) -> dict | None:
    if m is None:
        return None
    return {'status': m.status, 'role': (m.role or 'member') if m.status == 'member' else None}


def serialize_community(c: Community, user: User, m=_UNSET) -> dict:
    if m is _UNSET:
        m = membership_of(c, user)
    member_count = getattr(c, 'member_count', None)
    if member_count is None:
        member_count = Membership.objects.filter(community=c, status='member').count()
    thread_count = getattr(c, 'thread_count', None)
    if thread_count is None:
        thread_count = Thread.objects.filter(community=c, status='visible').count()
    return {
        'id': c.id,
        'slug': c.id,
        'name': c.name,
        'description': c.description,
        'kind': c.kind,
        'official': c.official,
        'lang': c.lang,
        'bands': c.bands or [],
        'join_policy': c.join_policy,
        'status': c.status,
        'color': c.color,
        'school': c.school,
        'region': c.region,
        'member_count': member_count,
        'thread_count': thread_count,
        'staff_only_posting': c.staff_only_posting,
        'created_by': serialize_author(c.created_by),
        'created_at': c.created_at.isoformat(),
        'membership': _membership_json(m),
    }


def serialize_communities(rows, user: User) -> list[dict]:
    """Many communities with one membership query for the viewer."""
    rows = list(rows)
    mine = {m.community_id: m for m in Membership.objects.filter(user=user, community__in=[c.id for c in rows])}
    return [serialize_community(c, user, mine.get(c.id)) for c in rows]


def serialize_detail(c: Community, user: User) -> dict:
    a = access(c, user)
    can_see_review = c.created_by_id == user.id or is_staff_role(user)
    pending = Membership.objects.filter(community=c, status='pending').count() if a.perms['can_manage_requests'] else 0
    return {
        **serialize_community(c, user, a.membership),
        'rules': c.rules or [],
        'join_code': c.join_code if a.perms['can_manage_requests'] else None,
        'pending_requests': pending,
        'review_note': c.review_note if can_see_review else None,
        'permissions': a.perms,
    }


def serialize_member(m: Membership) -> dict:
    return {
        'user': serialize_author(m.user),
        'role': (m.role or 'member') if m.status == 'member' else None,
        'status': m.status,
        'joined_at': m.joined_at.isoformat() if m.joined_at else None,
        'requested_at': m.requested_at.isoformat() if m.requested_at else None,
        'request_note': m.request_note,
    }


def join_result(c: Community, user: User, m: Membership) -> dict:
    fresh = with_counts(Community.objects.filter(pk=c.pk)).get()
    return {'community': serialize_community(fresh, user, m), 'membership': _membership_json(m)}


# ---------------------------------------------------------------- Thread serialization
def _vote_sum(kind: str):
    return (
        Vote.objects.filter(target_type=kind, target_id=OuterRef('pk'))
        .values('target_type')
        .annotate(s=Sum('value'))
        .values('s')
    )


def thread_queryset() -> QuerySet[Thread]:
    replies = (
        Reply.objects.filter(thread=OuterRef('pk'), status='visible')
        .values('thread')
        .annotate(n=Count('pk'))
        .values('n')
    )
    return Thread.objects.select_related('author', 'community', 'accepted_reply').annotate(
        votes=Coalesce(Subquery(_vote_sum('thread'), output_field=IntegerField()), Value(0)),
        reply_count=Coalesce(Subquery(replies, output_field=IntegerField()), Value(0)),
    )


def excerpt_of(body: str, max_len: int = 160) -> str:
    flat = re.sub(r'\s+', ' ', body).strip()
    return f'{flat[: max_len - 1].rstrip()}…' if len(flat) > max_len else flat


def _my_votes(user: User, kind: str, ids) -> dict:
    return {
        str(v.target_id): v.value for v in Vote.objects.filter(user=user, target_type=kind, target_id__in=list(ids))
    }


def serialize_summary(t: Thread, user: User, my_vote: int = 0) -> dict:
    accepted = t.accepted_reply
    return {
        'id': str(t.id),
        'community_id': t.community_id,
        'community_name': t.community.name,
        'title': t.title,
        'excerpt': excerpt_of(t.body),
        'author': serialize_author(t.author),
        'lang': t.lang,
        'tags': t.tags or [],
        'created_at': t.created_at.isoformat(),
        'last_activity_at': t.last_activity_at.isoformat(),
        'reply_count': t.reply_count,
        'score': t.base_score + t.votes,
        'my_vote': my_vote,
        'has_accepted_answer': accepted is not None and accepted.status == 'visible',
        'pinned': t.pinned,
        'locked': t.locked,
    }


def serialize_summaries(rows, user: User) -> list[dict]:
    rows = list(rows)
    mine = _my_votes(user, 'thread', [t.id for t in rows])
    return [serialize_summary(t, user, mine.get(str(t.id), 0)) for t in rows]


def can_accept_in(t: Thread, user: User, a: Access) -> bool:
    return t.author_id == user.id or user.role == 'teacher' or a.perms['can_remove_posts']


def serialize_thread(t: Thread, c: Community, user: User, a: Access | None = None) -> dict:
    a = a or access(c, user)
    t = thread_queryset().get(pk=t.pk)  # fresh counts and score
    replies = list(
        Reply.objects.filter(thread=t)
        .select_related('author')
        .annotate(votes=Coalesce(Subquery(_vote_sum('reply'), output_field=IntegerField()), Value(0)))
    )
    mine = _my_votes(user, 'reply', [r.id for r in replies])
    rows = [serialize_reply(r, user, t.accepted_reply_id, mine.get(str(r.id), 0)) for r in replies]
    rows.sort(key=lambda x: (not x['accepted'], -x['score'], x['created_at']))
    my_vote = _my_votes(user, 'thread', [t.id]).get(str(t.id), 0)
    return {
        **serialize_summary(t, user, my_vote),
        'body': t.body,
        'status': t.status,
        'replies': rows,
        'can_accept': can_accept_in(t, user, a),
        'can_moderate': a.perms['can_pin'],
        'can_remove': a.perms['can_remove_posts'],
    }


def serialize_reply(r: Reply, user: User, accepted_id, my_vote: int | None = None) -> dict:
    removed = r.status == 'removed'
    votes = getattr(r, 'votes', None)
    if votes is None:
        votes = Vote.objects.filter(target_type='reply', target_id=r.id).aggregate(s=Sum('value'))['s'] or 0
    if my_vote is None:
        my_vote = _my_votes(user, 'reply', [r.id]).get(str(r.id), 0)
    return {
        'id': str(r.id),
        'thread_id': str(r.thread_id),
        'author': serialize_author(r.author),
        'body': '' if removed else r.body,
        'created_at': r.created_at.isoformat(),
        'score': r.base_score + votes,
        'my_vote': my_vote,
        'accepted': r.id == accepted_id and not removed,
        'status': r.status,
    }


def score_of(kind: str, target_id, base: int) -> int:
    return base + (Vote.objects.filter(target_type=kind, target_id=target_id).aggregate(s=Sum('value'))['s'] or 0)


# ---------------------------------------------------------------- Validation helpers
def text(data, key: str, *, min_len: int | None = None, max_len: int | None = None, label: str | None = None) -> str:
    """Port of the mock's str(): trimmed string with friendly length messages, keyed by field."""
    value = data.get(key)
    s = value.strip() if isinstance(value, str) else ''
    label = label or key
    cap = label[:1].upper() + label[1:]
    if min_len is not None and len(s) < min_len:
        raise field_error(key, f'Add {label}.' if min_len <= 1 else f'{cap} needs at least {min_len} characters.')
    if max_len is not None and len(s) > max_len:
        raise field_error(key, f'{cap} can be at most {max_len} characters.')
    return s


def assert_safe(value: str, field: str) -> None:
    problem = check_post_safety(value)
    if problem:
        raise field_error(field, problem)


def posted_today(model, user: User) -> int:
    return model.objects.filter(author=user, created_at__date=timezone.localdate()).count()


def parse_vote(value) -> int:
    if value in (-1, 0, 1) and not isinstance(value, bool):
        return int(value)
    raise ApiError('Vote must be -1, 0 or 1.')


def slugify_unique(name: str) -> str:
    flat = unicodedata.normalize('NFKD', name.lower())
    base = re.sub(r'[^a-z0-9]+', '-', flat).strip('-')[:40] or 'community'
    slug, i = base, 2
    while Community.objects.filter(pk=slug).exists():
        slug = f'{base}-{i}'
        i += 1
    return slug


def make_join_code(name: str) -> str:
    """Readable class code like "ASF-7B": three letters from the name, a digit and a letter."""
    letters = re.sub(r'[^A-Z]', '', name.upper())
    head = (letters[:1] or 'K') + re.sub(r'[AEIOU]', '', letters[1:])
    prefix = (head + 'KSA')[:3]
    alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    for _ in range(500):
        code = f'{prefix}-{random.randint(1, 9)}{random.choice(alpha)}'
        if not Community.objects.filter(join_code=code).exists():
            return code
    return f'{prefix}-{random.randbytes(2).hex().upper()}'


def norm_code(code) -> str:
    return re.sub(r'\s+', '', code).upper() if isinstance(code, str) else ''


def validate_fields(data, partial: bool, self_id: str | None = None) -> dict:
    out: dict = {}
    if not partial or 'name' in data:
        name = text(data, 'name', min_len=4, max_len=60, label='the community name')
        assert_safe(name, 'name')
        if Community.objects.filter(name__iexact=name).exclude(pk=self_id).exists():
            raise field_error('name', 'A community with this name already exists. Try adding your school or town.')
        out['name'] = name
    if not partial or 'description' in data:
        description = text(data, 'description', min_len=20, max_len=400, label='the description')
        assert_safe(description, 'description')
        out['description'] = description
    if not partial or 'rules' in data:
        raw = data.get('rules') if isinstance(data.get('rules'), list) else []
        rules = [r.strip() for r in raw if isinstance(r, str) and r.strip()]
        if len(rules) > 6:
            raise field_error('rules', 'Keep it to 6 rules or fewer.')
        for r in rules:
            if len(r) > 140:
                raise field_error('rules', 'Each rule can be at most 140 characters.')
            assert_safe(r, 'rules')
        out['rules'] = rules
    return out


def parse_bands(value) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for b in value:
        if b in BANDS and b not in out:
            out.append(b)
    return out


def parse_policy(value) -> str:
    if value not in POLICIES:
        raise field_error('join_policy', 'Choose how people join.')
    return value


def parse_lang(value) -> str | None:
    return value if value in ('twi', 'ga') else None


# ---------------------------------------------------------------- Threads and members
def thread_context(thread_id, user: User):
    t = Thread.objects.select_related('community').filter(pk=thread_id).first()
    if t is None:
        raise ApiError('This discussion was removed or doesn’t exist.', 404)
    c = find_community(t.community_id, user)
    a = access(c, user)
    if not a.perms['can_view']:
        raise ApiError(f'Join {c.name} to read its discussions.', 403)
    if t.status == 'removed' and not a.perms['can_remove_posts']:
        raise ApiError('This discussion was removed or doesn’t exist.', 404)
    return t, c, a


def find_reply(reply_id) -> Reply:
    r = Reply.objects.select_related('thread').filter(pk=reply_id).first()
    if r is None:
        raise ApiError('That reply doesn’t exist any more.', 404)
    return r


def join_as_member(c: Community, user: User) -> Membership:
    now = timezone.now()
    m = membership_of(c, user)
    if m is not None:
        if m.status == 'pending':
            m.status, m.role, m.joined_at = 'member', 'member', now
            m.save(update_fields=['status', 'role', 'joined_at'])
        return m
    return Membership.objects.create(community=c, user=user, role='member', status='member', joined_at=now)


def member_target(c: Community, user_id) -> tuple[Membership, User]:
    m = Membership.objects.select_related('user').filter(community=c, user_id=user_id).first()
    if m is None:
        raise ApiError('That person isn’t in this community.', 404)
    return m, m.user


def thread_filter(qs: QuerySet[Thread], q: str) -> QuerySet[Thread]:
    if not q:
        return qs

    return qs.annotate(tags_text=Cast('tags', TextField())).filter(
        Q(title__icontains=q) | Q(body__icontains=q) | Q(tags_text__icontains=q)
    )
