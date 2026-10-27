"""
Load the curriculum and (optionally) the demo world: sample accounts, Ama's
progress, leaderboard peers and the community. Idempotent.

    python manage.py seed_demo              # curriculum + demo data
    python manage.py seed_demo --curriculum-only   # production: content only
    python manage.py seed_demo --reset      # wipe demo data first

Every demo account's password is "demo1234".
"""

import json
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.curriculum.models import DailyFeature, Item, Unit
from apps.learning.models import BadgeAward, DailyActivity, LeaderboardPeer, Progress

APPS = Path(__file__).resolve().parents[3]
DEMO_PASSWORD = 'demo1234'


def load_json(rel: str) -> dict:
    return json.loads((APPS / rel).read_text(encoding='utf-8'))


def seed_curriculum() -> int:
    data = load_json('curriculum/fixtures/curriculum.json')
    count = 0
    for u in data['units']:
        unit, _ = Unit.objects.update_or_create(
            id=u['id'],
            defaults={
                'lang': u['lang'],
                'bands': u['bands'],
                'order': u['order'],
                'title_local': u['titleLocal'],
                'title_en': u['titleEn'],
                'strand': u['strand'],
                'note': u['note'],
                'content_status': u['contentStatus'],
            },
        )
        for kind, key, letter in (('word', 'words', 'w'), ('phrase', 'phrases', 'p')):
            for i, (english, translation) in enumerate(u[key]):
                Item.objects.update_or_create(
                    id=f'{u["id"]}-{letter}{i + 1}',
                    defaults={
                        'unit': unit,
                        'lang': u['lang'],
                        'kind': kind,
                        'english': english,
                        'translation': translation,
                        'position': i,
                    },
                )
                count += 1
    DailyFeature.objects.all().delete()
    for lang, features in data['dailyFeatures'].items():
        for i, f in enumerate(features):
            DailyFeature.objects.create(lang=lang, kicker=f['kicker'], local=f['local'], english=f['english'], order=i)
    return count


def seed_people(now) -> dict[str, User]:
    """Returns the seed key ("u-ama") -> User map the community seed uses."""
    data = load_json('accounts/fixtures/people.json')
    users: dict[str, User] = {}
    for p in data['people']:
        user = User.objects.filter(email=p['email']).first() or User(email=p['email'])
        user.name = p['name']
        user.role = p['role']
        user.lang = p['lang']
        user.level_id = p['levelId']
        user.school = p.get('school')
        user.region = p.get('region')
        user.guardian_email = p.get('guardianEmail')
        user.status = p.get('status', 'active')
        user.plan = p.get('plan', 'free')
        user.onboarded = True
        user.created_at = now - timedelta(days=p['joinedDaysAgo'])
        user.last_active_at = now - timedelta(days=p.get('activeDaysAgo', 0))
        user.is_staff = p['role'] in ('moderator', 'admin')
        user.is_superuser = p['role'] == 'admin'
        user.set_password(DEMO_PASSWORD)
        user.save()
        users[p['id']] = user

    LeaderboardPeer.objects.all().delete()
    LeaderboardPeer.objects.bulk_create(
        LeaderboardPeer(
            display_name=x['displayName'], school=x['school'], region=x['region'], lang=x['lang'], xp=x['xp']
        )
        for x in data['peers']
    )
    return users


def seed_learning(ama: User, now) -> None:
    """Ama is a few days into JHS 1 Twi, with words due today."""
    Progress.objects.filter(user=ama).delete()
    DailyActivity.objects.filter(user=ama).delete()
    BadgeAward.objects.filter(user=ama).delete()
    mastery = [4, 4, 3, 3, 2, 2, 1, 1, 1, 1]
    for i in range(10):
        Progress.objects.create(
            user=ama,
            item_id=f'tw-greet-w{i + 1}',
            mastery=mastery[i],
            next_review_at=now + timedelta(days=-1 if i % 3 == 0 else 2),
            last_seen_at=now - timedelta(days=2),
        )
    for i in range(4):
        Progress.objects.create(
            user=ama,
            item_id=f'tw-family-w{i + 1}',
            mastery=1,
            next_review_at=now - timedelta(hours=12),
            last_seen_at=now - timedelta(days=1),
        )
    today = timezone.localdate(now)
    for i, count in enumerate([12, 8, 15, 10]):
        DailyActivity.objects.create(user=ama, day=today - timedelta(days=i + 1), count=count, xp=count * 8)
    DailyActivity.objects.create(user=ama, day=today - timedelta(days=6), count=6, xp=42)
    BadgeAward.objects.create(user=ama, badge='akwaaba', earned_at=now - timedelta(days=6))


class Command(BaseCommand):
    help = 'Load the curriculum and the demo world (sample accounts, progress, communities).'

    def add_arguments(self, parser):
        parser.add_argument('--curriculum-only', action='store_true', help='Only load curriculum content.')
        parser.add_argument('--reset', action='store_true', help='Delete demo communities and activity first.')

    @transaction.atomic
    def handle(self, *args, **opts):
        now = timezone.now()
        items = seed_curriculum()
        self.stdout.write(self.style.SUCCESS(f'Curriculum: {Unit.objects.count()} units, {items} items'))
        if opts['curriculum_only']:
            return

        users = seed_people(now)
        seed_learning(users['u-ama'], now)
        self.stdout.write(self.style.SUCCESS(f'Demo accounts: {len(users)} (password "{DEMO_PASSWORD}")'))

        # The community seed lives with the community app
        from apps.community.seed import seed_community

        summary = seed_community(users, now, reset=opts['reset'])
        self.stdout.write(self.style.SUCCESS(f'Community: {summary}'))
