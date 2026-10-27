"""Community endpoints. Rules and copy match the frontend mock (handlers/community.ts)."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.core.exceptions import ApiError, field_error
from apps.core.permissions import is_staff_role, require_active
from apps.curriculum.levels import band_of
from apps.learning.services import award_badge
from apps.notifications.models import notify

from . import services as s
from .models import Community, Membership, Reply, Report, Thread, Vote

OK = {'ok': True}


# ---------------------------------------------------------------- Communities
@api_view(['GET', 'POST'])
def communities(request):
    return _create_community(request) if request.method == 'POST' else _list_communities(request)


def _list_communities(request):
    user = request.user
    scope = request.query_params.get('scope', 'mine')
    q = request.query_params.get('q', '').strip().lower()
    lang = request.query_params.get('lang')
    band = band_of(user.level_id)
    base = s.with_counts(Community.objects.all())

    if scope == 'created':
        rows = list(base.filter(created_by=user).order_by('-created_at'))
    elif scope == 'discover':
        member_of = Membership.objects.filter(user=user, status='member').values('community_id')
        rows = [
            c
            for c in base.filter(status='active').exclude(pk__in=member_of)
            if (lang == 'all' or not c.lang or c.lang == (lang or user.lang))
            and (lang == 'all' or not c.bands or band in c.bands)
        ]
        rows.sort(key=lambda c: (c.join_policy != 'open', -c.member_count))
    else:
        mine = {m.community_id: m for m in Membership.objects.filter(user=user)}
        rows = list(base.filter(pk__in=list(mine), status__in=('active', 'archived')))
        rows.sort(key=lambda c: (mine[c.id].status == 'pending', c.official, c.name.lower()))

    if q:
        rows = [c for c in rows if q in f'{c.name} {c.description} {c.school or ""} {c.region or ""}'.lower()]
    return Response(s.serialize_communities(rows, user))


@transaction.atomic
def _create_community(request):
    user = request.user
    require_active(user)
    data = request.data
    staff = is_staff_role(user)
    if not staff:
        pending = Community.objects.filter(created_by=user, status='pending').count()
        if pending >= s.MAX_PENDING_PROPOSALS:
            raise ApiError(
                f'You already have {s.MAX_PENDING_PROPOSALS} communities waiting for review. Wait for those first.', 429
            )
    fields = s.validate_fields(data, partial=False)
    kind = data.get('kind')
    if kind not in s.KINDS:
        raise field_error('kind', 'Choose what kind of community this is.')
    school = s.text(data, 'school', max_len=80) or None if isinstance(data.get('school'), str) else None
    region = data.get('region').strip() or None if isinstance(data.get('region'), str) else None
    c = Community.objects.create(
        id=s.slugify_unique(fields['name']),
        name=fields['name'],
        description=fields['description'],
        rules=fields['rules'],
        kind=kind,
        official=False,
        lang=s.parse_lang(data.get('lang')),
        bands=s.parse_bands(data.get('bands')),
        join_policy=s.parse_policy(data.get('join_policy')),
        join_code=s.make_join_code(fields['name']),
        status='active' if staff else 'pending',
        color=s.COLORS[Community.objects.count() % len(s.COLORS)],
        school=school,
        region=region,
        created_by=user,
        reviewed_by=user if staff else None,
    )
    Membership.objects.create(community=c, user=user, role='owner', status='member', joined_at=timezone.now())
    return Response(s.serialize_detail(c, user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
def join_by_code(request):
    user = request.user
    code = s.norm_code(request.data.get('code'))
    if not code:
        raise field_error('code', 'Type the class code your teacher gave you.')
    c = next((x for x in Community.objects.filter(status='active') if s.norm_code(x.join_code) == code), None)
    if c is None:
        raise ApiError('We couldn’t find a community with that code. Check it with your teacher.', 404)
    return Response(s.join_result(c, user, s.join_as_member(c, user)))


@api_view(['GET', 'PATCH'])
def community_detail(request, community_id: str):
    user = request.user
    c = s.find_community(community_id, user)
    if request.method == 'GET':
        return Response(s.serialize_detail(c, user))

    require_active(user)
    if not s.access(c, user).perms['can_edit_settings']:
        raise ApiError('Only the owner and admins can change this community’s settings.', 403)
    if c.official and not is_staff_role(user):
        raise ApiError('Only the Kasa team can change official communities.', 403)
    data = request.data
    fields = s.validate_fields(data, partial=True, self_id=c.id)
    for key in ('name', 'description', 'rules'):
        if key in fields:
            setattr(c, key, fields[key])
    if 'join_policy' in data:
        c.join_policy = s.parse_policy(data.get('join_policy'))
    if 'bands' in data:
        c.bands = s.parse_bands(data.get('bands'))
    if 'lang' in data:
        c.lang = s.parse_lang(data.get('lang'))
    c.save()
    s.log(user, 'community_settings', 'community', c.id)
    return Response(s.serialize_detail(c, user))


@api_view(['POST'])
def rotate_code(request, community_id: str):
    user = request.user
    require_active(user)
    c = s.find_community(community_id, user)
    if not s.access(c, user).perms['can_edit_settings']:
        raise ApiError('Only the owner and admins can change the class code.', 403)
    c.join_code = s.make_join_code(c.name)
    c.save(update_fields=['join_code'])
    s.log(user, 'rotate_code', 'community', c.id)
    return Response(s.serialize_detail(c, user))


@api_view(['POST'])
@transaction.atomic
def join(request, community_id: str):
    user = request.user
    c = s.find_community(community_id, user)
    if c.status != 'active':
        raise ApiError('This community isn’t taking new members right now.')
    existing = s.membership_of(c, user)
    if existing is not None and existing.status == 'member':
        return Response(s.join_result(c, user, existing))
    if c.join_policy == 'open' or is_staff_role(user):
        return Response(s.join_result(c, user, s.join_as_member(c, user)))
    if c.join_policy == 'code':
        if s.norm_code(request.data.get('code')) != s.norm_code(c.join_code):
            raise field_error('code', 'That code doesn’t match. Check it with your teacher and try again.')
        return Response(s.join_result(c, user, s.join_as_member(c, user)))
    if existing is not None and existing.status == 'pending':
        return Response(s.join_result(c, user, existing))

    note = s.text(request.data, 'note', max_len=200, label='your note')
    if note:
        s.assert_safe(note, 'note')
    m = Membership.objects.create(
        community=c, user=user, role=None, status='pending', requested_at=timezone.now(), request_note=note or None
    )
    for mgr in s.managers_of(c):
        notify(
            mgr.user,
            'join_request',
            f'{user.display_name} asked to join {c.name}',
            f'“{note}”' if note else 'Approve or decline the request.',
            f'/community/c/{c.id}/manage',
        )
    return Response(s.join_result(c, user, m))


@api_view(['POST'])
def leave(request, community_id: str):
    user = request.user
    c = s.find_community(community_id, user)
    m = s.membership_of(c, user)
    if m is None:
        return Response(OK)
    if m.role == 'owner':
        raise ApiError('You own this community. Hand it to another teacher or Kasa staff member before you leave.')
    m.delete()
    return Response(OK)


@api_view(['GET'])
def members(request, community_id: str):
    user = request.user
    c = s.find_community(community_id, user)
    a = s.access(c, user)
    wanted = 'pending' if request.query_params.get('status') == 'pending' else 'member'
    if wanted == 'pending' and not a.perms['can_manage_requests']:
        raise ApiError('Only helpers and admins can see join requests.', 403)
    if wanted == 'member' and not (a.is_member or is_staff_role(user)):
        raise ApiError(f'Join {c.name} to see who’s in it.', 403)
    q = request.query_params.get('q', '').strip().lower()
    rows = [s.serialize_member(m) for m in Membership.objects.filter(community=c, status=wanted).select_related('user')]
    rows = [r for r in rows if not q or q in r['user']['display_name'].lower()]
    rows.sort(
        key=lambda r: (
            -(s.RANK[r['role']] if r['role'] else 0),
            r['requested_at'] or '',
            r['user']['display_name'],
        )
    )
    return Response(rows)


@api_view(['POST'])
@transaction.atomic
def answer_request(request, community_id: str, user_id, decision: str):
    user = request.user
    require_active(user)
    c = s.find_community(community_id, user)
    if not s.access(c, user).perms['can_manage_requests']:
        raise ApiError('Only helpers and admins can answer join requests.', 403)
    if decision not in ('approve', 'decline'):
        raise ApiError('Unknown action.', 404)
    m = Membership.objects.select_related('user').filter(community=c, user_id=user_id).first()
    if m is None or m.status != 'pending':
        raise ApiError('That request was already answered.', 404)
    if decision == 'approve':
        m.status, m.role, m.joined_at = 'member', 'member', timezone.now()
        m.save(update_fields=['status', 'role', 'joined_at'])
        notify(
            m.user,
            'join_approved',
            f'You’re in! Welcome to {c.name}',
            f'Your request to join {c.name} was approved.',
            f'/community/c/{c.id}',
        )
    else:
        target = m.user
        m.delete()
        notify(
            target,
            'join_declined',
            f'Your request to join {c.name} wasn’t accepted',
            'You can still learn and ask questions in the open Kasa communities.',
            '/community/discover',
        )
    s.log(user, f'request_{decision}', 'membership', f'{c.id}:{user_id}')
    return Response(OK)


@api_view(['PATCH'])
@transaction.atomic
def member_role(request, community_id: str, user_id):
    user = request.user
    require_active(user)
    c = s.find_community(community_id, user)
    a = s.access(c, user)
    target, target_user = s.member_target(c, user_id)
    nxt = request.data.get('role')
    if nxt not in ('admin', 'helper', 'member'):
        raise ApiError('Choose admin, helper or member.')
    if target.status != 'member':
        raise ApiError('Approve their request before giving them a role.')
    if target_user.id == user.id:
        raise ApiError('You can’t change your own role.')
    if target.role == 'owner':
        raise ApiError('To change the owner, use “Transfer ownership”.')
    if nxt == 'admin' or target.role == 'admin':
        if not a.perms['can_appoint_admins']:
            raise ApiError('Only the owner can appoint or remove admins.', 403)
        if nxt == 'admin' and not s.is_adult(target_user):
            raise ApiError('Admins must be teachers or Kasa staff. You can make this student a helper instead.')
    elif not a.can_appoint_helpers:
        raise ApiError('Only the owner and admins can change roles.', 403)
    target.role = nxt
    target.save(update_fields=['role'])
    if nxt == 'member':
        title = f'You’re now a member of {c.name}'
    else:
        title = f'You’re now {"an admin" if nxt == "admin" else "a helper"} in {c.name}'
    body = {
        'helper': 'Helpers approve join requests and pin important discussions.',
        'admin': 'Admins manage members, settings and posts.',
    }.get(nxt, 'Your helper or admin role was removed.')
    notify(target_user, 'role_changed', title, body, f'/community/c/{c.id}')
    s.log(user, f'role_{nxt}', 'membership', f'{c.id}:{target_user.id}')
    return Response(s.serialize_member(target))


@api_view(['POST'])
def remove_member(request, community_id: str, user_id):
    user = request.user
    require_active(user)
    c = s.find_community(community_id, user)
    a = s.access(c, user)
    if not a.perms['can_manage_members']:
        raise ApiError('Only teachers and Kasa staff who run this community can remove members.', 403)
    target, target_user = s.member_target(c, user_id)
    if target.role == 'owner':
        raise ApiError('The owner can’t be removed.')
    if target_user.id == user.id:
        raise ApiError('Use “Leave community” to remove yourself.')
    if target.role == 'admin' and not a.perms['can_appoint_admins']:
        raise ApiError('Only the owner can remove an admin.', 403)
    target.delete()
    s.log(user, 'remove_member', 'membership', f'{c.id}:{target_user.id}')
    return Response(OK)


@api_view(['POST'])
@transaction.atomic
def transfer(request, community_id: str):
    user = request.user
    require_active(user)
    c = s.find_community(community_id, user)
    a = s.access(c, user)
    if a.role != 'owner' and not is_staff_role(user):
        raise ApiError('Only the owner can hand over this community.', 403)
    target_id = request.data.get('user_id')
    target = (
        Membership.objects.select_related('user').filter(community=c, user_id=target_id).first()
        if isinstance(target_id, str)
        else None
    )
    if target is None or target.status != 'member':
        raise ApiError('That person isn’t a member.', 404)
    if not s.is_adult(target.user):
        raise ApiError('Ownership can only go to a teacher or Kasa staff member of this community.')
    owner = Membership.objects.select_related('user').filter(community=c, role='owner').first()
    if owner is not None:
        owner.role = 'admin' if s.is_adult(owner.user) else 'helper'
        owner.save(update_fields=['role'])
    target.role = 'owner'
    target.save(update_fields=['role'])
    notify(
        target.user,
        'role_changed',
        f'You now own {c.name}',
        'You can manage its settings, members and admins.',
        f'/community/c/{c.id}/manage',
    )
    s.log(user, 'transfer_ownership', 'community', c.id, str(target.user.id))
    return Response(s.serialize_detail(c, user))


# ---------------------------------------------------------------- Discussions
@api_view(['GET', 'POST'])
def threads(request):
    return _create_thread(request) if request.method == 'POST' else _thread_feed(request)


def _thread_feed(request):
    user = request.user
    qp = request.query_params
    community_id = qp.get('communityId') or qp.get('community_id')
    sort = qp.get('sort', 'active')
    q = qp.get('q', '').strip()
    lang = qp.get('lang')
    try:
        offset = max(0, int(qp.get('cursor') or 0))
    except ValueError:
        offset = 0

    rows = s.thread_queryset().filter(status='visible')
    if community_id:
        c = s.find_community(community_id, user)
        if not s.access(c, user).perms['can_view']:
            raise ApiError(f'Join {c.name} to read its discussions.', 403)
        rows = rows.filter(community=c)
    else:
        joined = Membership.objects.filter(user=user, status='member').values('community_id')
        rows = rows.filter(community_id__in=joined)
    if lang:
        rows = rows.filter(Q(lang=lang) | Q(lang__isnull=True))
    rows = s.thread_filter(rows, q)
    if sort == 'unanswered':
        rows = rows.filter(reply_count=0)

    order = []
    if community_id:
        order.append('-pinned')
    if sort == 'top':
        rows = rows.annotate(total=F('base_score') + F('votes'))
        order += ['-total', '-created_at']
    elif sort in ('new', 'unanswered'):
        order.append('-created_at')
    else:
        order.append('-last_activity_at')
    rows = rows.order_by(*order)

    total = rows.count()
    page = list(rows[offset : offset + s.PAGE_SIZE])
    next_cursor = str(offset + s.PAGE_SIZE) if offset + s.PAGE_SIZE < total else None
    return Response({'items': s.serialize_summaries(page, user), 'next_cursor': next_cursor})


def _create_thread(request):
    user = request.user
    require_active(user)
    data = request.data
    community_id = data.get('community_id') if isinstance(data.get('community_id'), str) else ''
    if not community_id:
        raise field_error('community_id', 'Choose a community to ask in.')
    c = s.find_community(community_id, user)
    a = s.access(c, user)
    if not a.perms['can_post']:
        if c.status != 'active':
            raise ApiError('This community isn’t open for new posts.', 403)
        if not a.is_member and not is_staff_role(user):
            raise ApiError(f'Join {c.name} to post in it.', 403)
        raise ApiError(f'Only {c.name}’s admins can start discussions here.', 403)
    title = s.text(data, 'title', min_len=8, max_len=120, label='your title')
    body = s.text(data, 'body', min_len=10, max_len=4000, label='your question')
    s.assert_safe(title, 'title')
    s.assert_safe(body, 'body')
    if s.posted_today(Thread, user) >= s.DAILY_THREAD_LIMIT:
        raise ApiError(
            f'You can start {s.DAILY_THREAD_LIMIT} discussions a day. Try again tomorrow, or add to an existing one.',
            429,
        )
    raw_tags = data.get('tags') if isinstance(data.get('tags'), list) else []
    tags: list[str] = []
    for tag in raw_tags:
        if tag in s.TAGS and tag not in tags:
            tags.append(tag)
    now = timezone.now()
    t = Thread.objects.create(
        community=c,
        title=title,
        body=body,
        author=user,
        lang=c.lang,
        tags=tags[:4],
        created_at=now,
        last_activity_at=now,
    )
    return Response(s.serialize_thread(t, c, user, a), status=status.HTTP_201_CREATED)


@api_view(['GET'])
def thread_detail(request, thread_id):
    t, c, a = s.thread_context(thread_id, request.user)
    return Response(s.serialize_thread(t, c, request.user, a))


@api_view(['POST'])
@transaction.atomic
def thread_reply(request, thread_id):
    user = request.user
    require_active(user)
    t, c, a = s.thread_context(thread_id, user)
    if not s.can_participate(c, user, a):
        raise ApiError(f'Join {c.name} to reply.', 403)
    if t.locked and not a.perms['can_pin']:
        raise ApiError('This discussion is closed, so new replies are turned off.', 403)
    body = s.text(request.data, 'body', min_len=2, max_len=2000, label='your reply')
    s.assert_safe(body, 'body')
    if s.posted_today(Reply, user) >= s.DAILY_REPLY_LIMIT:
        raise ApiError(
            f'You’ve posted {s.DAILY_REPLY_LIMIT} replies today. Great effort! You can reply again tomorrow.', 429
        )
    now = timezone.now()
    reply = Reply.objects.create(thread=t, author=user, body=body, created_at=now)
    Thread.objects.filter(pk=t.pk).update(last_activity_at=now)
    if t.author_id and t.author_id != user.id:
        notify(
            t.author,
            'reply',
            f'{user.display_name} replied to your question',
            f'“{s.excerpt_of(t.title, 80)}” in {c.name}',
            f'/community/t/{t.id}',
        )
    return Response(s.serialize_reply(reply, user, t.accepted_reply_id), status=status.HTTP_201_CREATED)


def _cast_vote(user, kind: str, target_id, value: int, base: int) -> dict:
    Vote.objects.update_or_create(user=user, target_type=kind, target_id=target_id, defaults={'value': value})
    return {'score': s.score_of(kind, target_id, base), 'my_vote': value}


@api_view(['POST'])
def thread_vote(request, thread_id):
    user = request.user
    require_active(user)
    t, c, a = s.thread_context(thread_id, user)
    if not s.can_participate(c, user, a):
        raise ApiError(f'Join {c.name} to vote.', 403)
    if t.author_id == user.id:
        raise ApiError('You can’t vote on your own post.')
    return Response(_cast_vote(user, 'thread', t.id, s.parse_vote(request.data.get('value')), t.base_score))


@api_view(['POST'])
def reply_vote(request, reply_id):
    user = request.user
    require_active(user)
    reply = s.find_reply(reply_id)
    _t, c, a = s.thread_context(reply.thread_id, user)
    if not s.can_participate(c, user, a):
        raise ApiError(f'Join {c.name} to vote.', 403)
    if reply.status == 'removed':
        raise ApiError('This reply was removed by a moderator.')
    if reply.author_id == user.id:
        raise ApiError('You can’t vote on your own post.')
    return Response(_cast_vote(user, 'reply', reply.id, s.parse_vote(request.data.get('value')), reply.base_score))


@api_view(['POST'])
@transaction.atomic
def accept_reply(request, reply_id):
    user = request.user
    require_active(user)
    reply = s.find_reply(reply_id)
    t, c, a = s.thread_context(reply.thread_id, user)
    if not s.can_accept_in(t, user, a):
        raise ApiError('Only the person who asked, a teacher or a community admin can mark the best answer.', 403)
    if reply.status == 'removed':
        raise ApiError('A removed reply can’t be the accepted answer.')
    if t.accepted_reply_id == reply.id:
        t.accepted_reply = None
    else:
        t.accepted_reply = reply
        if reply.author_id and reply.author_id != t.author_id:
            award_badge(reply.author, 'boafo')
        if reply.author_id and reply.author_id != user.id:
            notify(
                reply.author,
                'answer_accepted',
                'Your answer was marked as the best answer',
                f'“{s.excerpt_of(t.title, 80)}” in {c.name}. Ayekoo!',
                f'/community/t/{t.id}',
            )
    t.save(update_fields=['accepted_reply'])
    return Response(s.serialize_thread(t, c, user, a))


def _thread_toggle(request, thread_id, field: str):
    user = request.user
    require_active(user)
    t, c, a = s.thread_context(thread_id, user)
    if not a.perms['can_pin']:
        raise ApiError('Only community helpers and admins can do that.', 403)
    setattr(t, field, not getattr(t, field))
    t.save(update_fields=[field])
    s.log(user, f'{field}_{"on" if getattr(t, field) else "off"}', 'thread', t.id)
    return Response(s.serialize_thread(t, c, user, a))


@api_view(['POST'])
def thread_pin(request, thread_id):
    return _thread_toggle(request, thread_id, 'pinned')


@api_view(['POST'])
def thread_lock(request, thread_id):
    return _thread_toggle(request, thread_id, 'locked')


REMOVE_DENIED = 'Only teachers and Kasa staff who run this community can remove posts. Report it instead.'


@api_view(['POST'])
def thread_remove(request, thread_id):
    user = request.user
    require_active(user)
    t, c, a = s.thread_context(thread_id, user)
    if not a.perms['can_remove_posts']:
        raise ApiError(REMOVE_DENIED, 403)
    t.status = 'removed'
    t.save(update_fields=['status'])
    s.log(user, 'remove_thread', 'thread', t.id)
    return Response(s.serialize_thread(t, c, user, a))


@api_view(['POST'])
def reply_remove(request, reply_id):
    user = request.user
    require_active(user)
    reply = s.find_reply(reply_id)
    t, c, a = s.thread_context(reply.thread_id, user)
    if not a.perms['can_remove_posts']:
        raise ApiError(REMOVE_DENIED, 403)
    reply.status = 'removed'
    reply.save(update_fields=['status'])
    if t.accepted_reply_id == reply.id:
        t.accepted_reply = None
        t.save(update_fields=['accepted_reply'])
    s.log(user, 'remove_reply', 'reply', reply.id)
    return Response(s.serialize_thread(t, c, user, a))


# ---------------------------------------------------------------- Reports (to the Kasa moderation queue)
@api_view(['POST'])
def reports(request):
    user = request.user
    data = request.data
    target_type = data.get('target_type') if data.get('target_type') in ('thread', 'reply') else None
    reason = data.get('reason') if data.get('reason') in s.REASONS else None
    if not target_type or not reason:
        raise ApiError('Choose what’s wrong with this post.')
    target_id = data.get('target_id')
    model = Thread if target_type == 'thread' else Reply
    try:
        target = model.objects.filter(pk=target_id).first() if isinstance(target_id, str) else None
    except DjangoValidationError:  # not a UUID
        target = None
    if target is None:
        raise ApiError('That post doesn’t exist any more.', 404)
    if target.author_id == user.id:
        raise ApiError('You can’t report your own post. You can ask a moderator for help instead.')
    note = s.text(data, 'note', max_len=500, label='your note')
    duplicate = Report.objects.filter(
        reporter=user, target_type=target_type, target_id=target.pk, status='open'
    ).exists()
    if not duplicate:
        Report.objects.create(target_type=target_type, target_id=target.pk, reason=reason, note=note, reporter=user)
    return Response(OK)
