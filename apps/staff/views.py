"""Community admin endpoints (/api/admin/…). Rules and copy match the mock's handlers/admin.ts."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.serializers import serialize_author
from apps.community import services as cs
from apps.community.models import Community, Reply, Report, Thread
from apps.core.exceptions import ApiError
from apps.core.pagination import page_response
from apps.core.permissions import IsModerator
from apps.curriculum.levels import level_label
from apps.notifications.models import notify
from apps.translate.models import Suggestion, VerifiedTranslation

ACTIONS = ('dismiss', 'remove_content', 'warn_user', 'suspend_user')
ROLES = ('student', 'teacher', 'moderator', 'admin')


# ---------------------------------------------------------------- Helpers
def target_of(r: Report):
    """(author, thread_id, text, post) for a report's target, or None if the post is gone."""
    if r.target_type == 'thread':
        t = Thread.objects.select_related('author').filter(pk=r.target_id).first()
        return (t.author, str(t.id), f'{t.title}: {t.body}', t) if t else None
    rep = Reply.objects.select_related('author').filter(pk=r.target_id).first()
    return (rep.author, str(rep.thread_id), rep.body, rep) if rep else None


def name_of(user: User | None) -> str:
    return user.display_name if user else 'A learner'


def serialize_report(rep: Report, count: int) -> dict:
    target = target_of(rep)
    return {
        'id': str(rep.id),
        'target_type': rep.target_type,
        'target_id': str(rep.target_id),
        'thread_id': target[1] if target else '',
        'target_excerpt': cs.excerpt_of(target[2], 240) if target else 'This post no longer exists.',
        'target_author': serialize_author(target[0] if target else None),
        'reason': rep.reason,
        'note': rep.note,
        'report_count': count,
        'reported_by': name_of(rep.reporter),
        'created_at': rep.created_at.isoformat(),
        'status': rep.status,
        'resolution': rep.resolution,
    }


def grouped_reports(status: str) -> list[dict]:
    """One row per reported post per status, newest report first."""
    rows = list(Report.objects.filter(status=status).select_related('reporter').order_by('-created_at'))
    counts: dict[tuple, int] = {}
    for r in rows:
        counts[(r.target_type, r.target_id)] = counts.get((r.target_type, r.target_id), 0) + 1
    seen: set[tuple] = set()
    out = []
    for r in rows:
        key = (r.target_type, r.target_id)
        if key in seen:
            continue
        seen.add(key)
        out.append(serialize_report(r, counts[key]))
    return out


def serialize_suggestion(sg: Suggestion) -> dict:
    return {
        'id': str(sg.id),
        'lang': sg.lang,
        'query': sg.query,
        'current_translation': sg.current_translation,
        'suggestion': sg.suggestion,
        'submitted_by': name_of(sg.submitted_by),
        'supporters': sg.supporters,
        'created_at': sg.created_at.isoformat(),
        'status': sg.status,
    }


def reports_against(user: User) -> int:
    threads = Thread.objects.filter(author=user).values('id')
    replies = Reply.objects.filter(author=user).values('id')
    return Report.objects.filter(
        Q(target_type='thread', target_id__in=threads) | Q(target_type='reply', target_id__in=replies)
    ).count()


def serialize_admin_user(u: User) -> dict:
    return {
        'id': str(u.id),
        'display_name': u.display_name,
        'email': u.email,
        'role': u.role,
        'status': u.status,
        'level_label': level_label(u.level_id),
        'lang': u.lang,
        'region': u.region,
        'school': u.school,
        'created_at': u.created_at.isoformat(),
        'last_active_at': (u.last_active_at or u.created_at).isoformat(),
        'reports_against': reports_against(u),
    }


def _pick(value, allowed, default):
    return value if value in allowed else default


# ---------------------------------------------------------------- Overview
@api_view(['GET'])
@permission_classes([IsModerator])
def overview(request):
    now = timezone.now()
    today = timezone.localdate(now)
    first = today - timedelta(days=13)
    signups = dict(
        User.objects.filter(created_at__date__gte=first)
        .values_list('created_at__date')
        .annotate(n=Count('id'))
        .values_list('created_at__date', 'n')
    )
    by_day = [
        {'date': (first + timedelta(days=i)).isoformat(), 'count': signups.get(first + timedelta(days=i), 0)}
        for i in range(14)
    ]
    regions = (
        User.objects.exclude(region__isnull=True)
        .exclude(region='')
        .values('region')
        .annotate(learners=Count('id'))
        .order_by('-learners', 'region')[:6]
    )
    return Response(
        {
            'stats': {
                'active_learners_7d': User.objects.filter(last_active_at__gte=now - timedelta(days=7)).count(),
                'new_signups_7d': sum(d['count'] for d in by_day[-7:]),
                'posts_today': Thread.objects.filter(created_at__date=today).count()
                + Reply.objects.filter(created_at__date=today).count(),
                'open_reports': len(grouped_reports('open')),
                'pending_suggestions': Suggestion.objects.filter(status='pending').count(),
                'verified_teachers': User.objects.filter(role='teacher').count(),
                'pending_communities': Community.objects.filter(status='pending').count(),
                'active_communities': Community.objects.filter(status='active').count(),
            },
            'signups_by_day': by_day,
            'language_split': [
                {'lang': lang, 'learners': User.objects.filter(lang=lang).count()} for lang in ('twi', 'ga')
            ],
            'top_regions': [{'region': r['region'], 'learners': r['learners']} for r in regions],
        }
    )


# ---------------------------------------------------------------- Reports
@api_view(['GET'])
@permission_classes([IsModerator])
def reports(request):
    status = _pick(request.query_params.get('status'), ('open', 'resolved', 'dismissed'), 'open')
    return page_response(request, grouped_reports(status), lambda x: x)


@api_view(['POST'])
@permission_classes([IsModerator])
@transaction.atomic
def resolve_report(request, report_id: int):
    staff = request.user
    rep = Report.objects.select_related('reporter').filter(pk=report_id).first()
    if rep is None:
        raise ApiError('That report doesn’t exist.', 404)
    if rep.status != 'open':
        raise ApiError('Another moderator already handled this report.')
    action = request.data.get('action')
    if action not in ACTIONS:
        raise ApiError('Choose what to do with this report.')
    note = cs.text(request.data, 'note', max_len=500, label='your note')
    target = target_of(rep)

    def remove_post():
        if target:
            post = target[3]
            post.status = 'removed'
            post.save(update_fields=['status'])

    if action == 'dismiss':
        summary = f'Dismissed by {staff.display_name}'
    elif action == 'remove_content':
        remove_post()
        summary = f'Post removed by {staff.display_name}'
    elif action == 'warn_user':
        summary = f'{name_of(target[0] if target else None)} was warned by {staff.display_name}'
    else:
        author = target[0] if target else None
        if author is None:
            raise ApiError('The author’s account no longer exists.')
        if author.role != 'student':
            raise ApiError('Teachers and staff can’t be suspended from the report queue. Ask an admin.')
        author.status = 'suspended'
        author.save(update_fields=['status'])
        remove_post()
        summary = f'Post removed and {author.display_name} suspended by {staff.display_name}'

    resolution = f'{summary}: {note}' if note else f'{summary}.'
    group = Report.objects.filter(status='open', target_type=rep.target_type, target_id=rep.target_id)
    count = group.count()
    group.update(
        status='dismissed' if action == 'dismiss' else 'resolved',
        resolution=resolution,
        action=action,
        resolved_by=staff,
    )
    rep.refresh_from_db()
    cs.log(staff, f'report_{action}', rep.target_type, rep.target_id, note)
    return Response(serialize_report(rep, count))


# ---------------------------------------------------------------- Translation suggestions
@api_view(['GET'])
@permission_classes([IsModerator])
def suggestions(request):
    status = _pick(request.query_params.get('status'), ('pending', 'approved', 'rejected'), 'pending')
    rows = (
        Suggestion.objects.filter(status=status).select_related('submitted_by').order_by('-supporters', '-created_at')
    )
    return page_response(request, rows, serialize_suggestion)


@api_view(['POST'])
@permission_classes([IsModerator])
@transaction.atomic
def review_suggestion(request, suggestion_id: int):
    sg = Suggestion.objects.select_related('submitted_by').filter(pk=suggestion_id).first()
    if sg is None:
        raise ApiError('That suggestion doesn’t exist.', 404)
    if sg.status != 'pending':
        raise ApiError('This suggestion was already reviewed.')
    decision = request.data.get('decision')
    if decision not in ('approve', 'reject'):
        raise ApiError('Choose approve or reject.')
    if decision == 'approve':
        final_raw = request.data.get('final_translation')
        final = (
            cs.text(request.data, 'final_translation', max_len=300, label='the translation')
            if isinstance(final_raw, str) and final_raw.strip()
            else sg.suggestion
        )
        english = sg.query.strip().lower()
        VerifiedTranslation.objects.filter(lang=sg.lang, english=english).delete()
        VerifiedTranslation.objects.create(lang=sg.lang, english=english, translation=final, source=sg)
        sg.suggestion = final
        sg.final_translation = final
        sg.status = 'approved'
    else:
        sg.status = 'rejected'
    sg.reviewed_by = request.user
    sg.reviewed_at = timezone.now()
    sg.save()
    cs.log(request.user, f'suggestion_{decision}', 'suggestion', sg.id)
    return Response(serialize_suggestion(sg))


# ---------------------------------------------------------------- People
@api_view(['GET'])
@permission_classes([IsModerator])
def users(request):
    qp = request.query_params
    rows = User.objects.all()
    q = qp.get('q', '').strip()
    if q:
        rows = rows.filter(Q(name__icontains=q) | Q(email__icontains=q) | Q(school__icontains=q))
    if qp.get('role') in ROLES:
        rows = rows.filter(role=qp['role'])
    if qp.get('status'):
        rows = rows.filter(status=qp['status'])
    return page_response(request, rows.order_by('name'), serialize_admin_user)


@api_view(['PATCH'])
@permission_classes([IsModerator])
def user_detail(request, user_id):
    staff = request.user
    target = get_object_or_404(User, pk=user_id)
    if target.id == staff.id:
        raise ApiError('You can’t change your own account here.')
    role, status = request.data.get('role'), request.data.get('status')
    if role is not None:
        if staff.role != 'admin':
            raise ApiError('Only admins can change roles.', 403)
        if role not in ROLES:
            raise ApiError('Choose a valid role.')
        target.role = role
        target.is_staff = role in ('moderator', 'admin')
    if status is not None:
        if status not in ('active', 'suspended'):
            raise ApiError('Status must be active or suspended.')
        if target.role == 'admin':
            raise ApiError('Admin accounts can’t be suspended.', 403)
        target.status = status
    target.save()
    cs.log(staff, 'user_update', 'user', target.id, f'role={target.role} status={target.status}')
    return Response(serialize_admin_user(target))


# ---------------------------------------------------------------- Communities
@api_view(['GET'])
@permission_classes([IsModerator])
def communities(request):
    status = _pick(request.query_params.get('status'), ('pending', 'active', 'rejected', 'archived'), 'pending')
    rows = cs.with_counts(Community.objects.filter(status=status)).order_by(
        'created_at' if status == 'pending' else '-created_at'
    )
    return page_response(request, rows, lambda c: cs.serialize_community(c, request.user))


@api_view(['POST'])
@permission_classes([IsModerator])
@transaction.atomic
def review_community(request, community_id: str):
    staff = request.user
    c = Community.objects.select_related('created_by').filter(pk=community_id).first()
    if c is None:
        raise ApiError('That community doesn’t exist.', 404)
    if c.status != 'pending':
        raise ApiError('Another moderator already reviewed this community.')
    decision = request.data.get('decision')
    if decision not in ('approve', 'reject'):
        raise ApiError('Choose approve or reject.')
    if decision == 'approve':
        c.status, c.review_note = 'active', None
        if c.created_by:
            notify(
                c.created_by,
                'community_approved',
                f'{c.name} is live!',
                'A Kasa moderator approved your community. Share the code or link to invite people.',
                f'/community/c/{c.id}',
            )
    else:
        note = cs.text(request.data, 'note', min_len=5, max_len=300, label='a reason for the creator')
        c.status, c.review_note = 'rejected', note
        if c.created_by:
            notify(c.created_by, 'community_rejected', f'{c.name} wasn’t approved', note, f'/community/c/{c.id}')
    c.reviewed_by = staff
    c.save()
    cs.log(staff, f'community_{decision}', 'community', c.id, c.review_note or '')
    return Response(cs.serialize_community(c, staff))


@api_view(['POST'])
@permission_classes([IsModerator])
def archive_community(request, community_id: str):
    staff = request.user
    c = Community.objects.select_related('created_by').filter(pk=community_id).first()
    if c is None:
        raise ApiError('That community doesn’t exist.', 404)
    if c.official and staff.role != 'admin':
        raise ApiError('Only admins can archive official communities.', 403)
    if c.status != 'active':
        raise ApiError('Only active communities can be archived.')
    c.status = 'archived'
    c.save(update_fields=['status'])
    cs.log(staff, 'community_archive', 'community', c.id)
    return Response(cs.serialize_community(c, staff))
