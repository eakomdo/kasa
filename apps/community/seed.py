"""
Demo community world: official Kasa communities, learner-run ones in every
review state, discussions, reports, translation suggestions and a few
notifications. Ported from the frontend mock (data/community.ts) via
fixtures/community.json, whose timestamps are seconds relative to "now".

Seeded threads and replies get deterministic UUIDs (uuid5 of the mock id), so
`seed_uuid('t-asafo-reply')` always names the same discussion.
"""

import json
import uuid
from datetime import timedelta
from pathlib import Path

from django.utils import timezone

from apps.notifications.models import Notification
from apps.translate.models import Suggestion, VerifiedTranslation

from .models import Community, Membership, ModerationLog, Reply, Report, Thread, Vote

FIXTURE = Path(__file__).resolve().parent / 'fixtures' / 'community.json'
NAMESPACE = uuid.UUID('6f1f3c52-9d0e-4b9e-9a51-2a7d6c0e8b11')


def seed_uuid(mock_id: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, mock_id)


def _at(now, offset):
    return None if offset is None else now + timedelta(seconds=offset)


def _href(href: str | None) -> str | None:
    """Rewrite mock thread links (/community/t/t-foo) to the seeded UUIDs."""
    if href and href.startswith('/community/t/'):
        return f'/community/t/{seed_uuid(href.rsplit("/", 1)[-1])}'
    return href


def seed_community(users: dict, now=None, reset: bool = False) -> str:
    now = now or timezone.now()
    data = json.loads(FIXTURE.read_text(encoding='utf-8'))
    community_ids = [c['id'] for c in data['communities']]
    seeded_users = list(users.values())

    # Idempotent: clear what a previous run created (and, with --reset, everything community-related)
    if reset:
        Vote.objects.all().delete()
        Report.objects.all().delete()
        ModerationLog.objects.all().delete()
        Thread.objects.all().delete()
        Community.objects.all().delete()
        Suggestion.objects.all().delete()
        VerifiedTranslation.objects.all().delete()
    else:
        Report.objects.filter(reporter__in=seeded_users).delete()
        Community.objects.filter(pk__in=community_ids).delete()  # cascades to threads, replies, memberships
        Suggestion.objects.filter(submitted_by__in=seeded_users).delete()
    Notification.objects.filter(user__in=seeded_users).delete()

    for c in data['communities']:
        Community.objects.create(
            id=c['id'],
            name=c['name'],
            description=c['description'],
            kind=c['kind'],
            official=c['official'],
            lang=c['lang'],
            bands=c['bands'],
            join_policy=c['joinPolicy'],
            join_code=c['joinCode'],
            status=c['status'],
            color=c['color'],
            school=c['school'],
            region=c['region'],
            rules=c['rules'],
            staff_only_posting=c['staffOnlyPosting'],
            created_by=users.get(c['createdById']),
            created_at=_at(now, c['createdAt']),
            review_note=c['reviewNote'],
            reviewed_by=users.get(c['reviewedById']) if c.get('reviewedById') else None,
        )

    Membership.objects.bulk_create(
        Membership(
            community_id=m['communityId'],
            user=users[m['userId']],
            role=m['role'],
            status=m['status'],
            joined_at=_at(now, m['joinedAt']),
            requested_at=_at(now, m['requestedAt']),
            request_note=m['requestNote'],
        )
        for m in data['memberships']
    )

    accepted: dict[uuid.UUID, uuid.UUID] = {}
    for t in data['threads']:
        Thread.objects.create(
            id=seed_uuid(t['id']),
            community_id=t['communityId'],
            title=t['title'],
            body=t['body'],
            author=users.get(t['authorId']),
            lang=t['lang'],
            tags=t['tags'],
            created_at=_at(now, t['createdAt']),
            last_activity_at=_at(now, t['lastActivityAt']),
            pinned=t['pinned'],
            locked=t['locked'],
            status=t['status'],
            base_score=t['baseScore'],
        )
        if t['acceptedReplyId']:
            accepted[seed_uuid(t['id'])] = seed_uuid(t['acceptedReplyId'])

    Reply.objects.bulk_create(
        Reply(
            id=seed_uuid(r['id']),
            thread_id=seed_uuid(r['threadId']),
            author=users.get(r['authorId']),
            body=r['body'],
            created_at=_at(now, r['createdAt']),
            status=r['status'],
            base_score=r['baseScore'],
        )
        for r in data['replies']
    )
    for thread_id, reply_id in accepted.items():
        Thread.objects.filter(pk=thread_id).update(accepted_reply_id=reply_id)

    for r in data['reports']:
        Report.objects.create(
            target_type=r['targetType'],
            target_id=seed_uuid(r['targetId']),
            reason=r['reason'],
            note=r['note'],
            reporter=users.get(r['reporterId']),
            created_at=_at(now, r['createdAt']),
            status=r['status'],
            resolution=r['resolution'],
            action=r['action'],
            resolved_by=users.get('u-yaw') if r['status'] != 'open' else None,
        )

    for sg in data['suggestions']:
        row = Suggestion.objects.create(
            lang=sg['lang'],
            query=sg['query'],
            current_translation=sg['currentTranslation'],
            suggestion=sg['suggestion'],
            submitted_by=users.get(sg['submittedById']),
            supporters=sg['supporters'],
            status=sg['status'],
            final_translation=sg['suggestion'] if sg['status'] == 'approved' else None,
            reviewed_by=users.get('u-yaw') if sg['status'] != 'pending' else None,
            reviewed_at=now if sg['status'] != 'pending' else None,
        )
        # created_at is auto_now_add, so backdate it afterwards
        Suggestion.objects.filter(pk=row.pk).update(created_at=_at(now, sg['createdAt']))
        if sg['status'] == 'approved':
            VerifiedTranslation.objects.filter(lang=sg['lang'], english=sg['query'].lower()).delete()
            VerifiedTranslation.objects.create(
                lang=sg['lang'], english=sg['query'].lower(), translation=sg['suggestion'], source=row
            )

    for n in data['notifications']:
        Notification.objects.create(
            user=users[n['userId']],
            kind=n['kind'],
            title=n['title'],
            body=n['body'],
            href=_href(n['href']),
            created_at=_at(now, n['createdAt']),
            read=n['read'],
        )

    return (
        f'{len(data["communities"])} communities, {len(data["threads"])} threads, {len(data["replies"])} replies, '
        f'{len(data["reports"])} reports, {len(data["suggestions"])} suggestions'
    )
