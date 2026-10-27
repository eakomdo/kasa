from django.conf import settings
from django.db import models

BADGES = ('akwaaba', 'nnanson', 'sankofa', 'nyansapo', 'boafo')


class Progress(models.Model):
    """A learner's spaced-repetition state for one item (Leitner box 0–5)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='progress')
    item = models.ForeignKey('curriculum.Item', on_delete=models.CASCADE, related_name='+')
    mastery = models.PositiveSmallIntegerField(default=0)
    next_review_at = models.DateTimeField(db_index=True)
    last_seen_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'item'], name='uniq_progress_user_item')]
        indexes = [models.Index(fields=['user', 'next_review_at'])]

    def __str__(self):
        return f'{self.user} · {self.item_id} · box {self.mastery}'


class Attempt(models.Model):
    """Every answer. `client_id` makes offline retries idempotent."""

    client_id = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attempts')
    item = models.ForeignKey('curriculum.Item', on_delete=models.CASCADE, related_name='+')
    correct = models.BooleanField()
    mode = models.CharField(max_length=10)
    answered_at = models.DateTimeField()
    mastery_after = models.PositiveSmallIntegerField()
    next_review_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} · {self.item_id} · {"right" if self.correct else "wrong"}'


class DailyActivity(models.Model):
    """Cards and XP per learner per day; drives streaks, history and leaderboards."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity')
    day = models.DateField()
    count = models.PositiveIntegerField(default=0)
    xp = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'day'], name='uniq_activity_user_day')]
        indexes = [models.Index(fields=['day'])]

    def __str__(self):
        return f'{self.user} · {self.day} · {self.count} cards'


class BadgeAward(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='badges')
    badge = models.CharField(max_length=12, choices=[(b, b) for b in BADGES])
    earned_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'badge'], name='uniq_badge')]

    def __str__(self):
        return f'{self.user} · {self.badge}'


class LeaderboardPeer(models.Model):
    """Seeded sample learners for demo leaderboards only. Empty in production."""

    display_name = models.CharField(max_length=40)
    school = models.CharField(max_length=80, null=True, blank=True)
    region = models.CharField(max_length=30)
    lang = models.CharField(max_length=4)
    xp = models.PositiveIntegerField()

    def __str__(self):
        return f'{self.display_name} ({self.xp} XP)'
