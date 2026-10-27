import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class Community(models.Model):
    """
    A group: official Kasa communities, school/class groups, study groups and
    interest clubs. Anyone may propose one; non-staff proposals stay `pending`
    until a Kasa moderator approves them.
    """

    id = models.SlugField(primary_key=True, max_length=60)  # readable, used in URLs: "asafo-jhs1b"
    name = models.CharField(max_length=60, unique=True)
    description = models.CharField(max_length=400)
    kind = models.CharField(
        max_length=10,
        choices=[
            ('official', 'Official'),
            ('school', 'School'),
            ('class', 'Class'),
            ('study', 'Study group'),
            ('interest', 'Interest group'),
        ],
    )
    official = models.BooleanField(default=False)
    lang = models.CharField(max_length=4, null=True, blank=True)
    bands = models.JSONField(default=list, blank=True)
    join_policy = models.CharField(
        max_length=8, choices=[('open', 'Open'), ('request', 'Ask to join'), ('code', 'Class code')]
    )
    join_code = models.CharField(max_length=12, unique=True)
    status = models.CharField(
        max_length=10,
        choices=[('pending', 'Pending'), ('active', 'Active'), ('rejected', 'Rejected'), ('archived', 'Archived')],
        default='pending',
        db_index=True,
    )
    color = models.CharField(
        max_length=6, choices=[(c, c) for c in ('forest', 'gold', 'clay', 'sky')], default='forest'
    )
    school = models.CharField(max_length=80, null=True, blank=True)
    region = models.CharField(max_length=30, null=True, blank=True)
    rules = models.JSONField(default=list, blank=True)
    staff_only_posting = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_communities')
    created_at = models.DateTimeField(default=timezone.now)
    review_note = models.CharField(max_length=300, null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        ordering = ['-official', 'name']
        verbose_name_plural = 'communities'

    def __str__(self):
        return self.name


class Membership(models.Model):
    """Community role: owner > admin > helper > member. Admin needs an adult account."""

    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(
        max_length=8, null=True, blank=True, choices=[(r, r) for r in ('owner', 'admin', 'helper', 'member')]
    )
    status = models.CharField(max_length=8, choices=[('member', 'Member'), ('pending', 'Pending')], db_index=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    requested_at = models.DateTimeField(null=True, blank=True)
    request_note = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['community', 'user'], name='uniq_membership')]

    def __str__(self):
        return f'{self.user} in {self.community} ({self.role or self.status})'


class Thread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='threads')
    title = models.CharField(max_length=120)
    body = models.TextField(max_length=4000)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='threads')
    lang = models.CharField(max_length=4, null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_activity_at = models.DateTimeField(default=timezone.now, db_index=True)
    pinned = models.BooleanField(default=False)
    locked = models.BooleanField(default=False)
    status = models.CharField(max_length=8, choices=[('visible', 'Visible'), ('removed', 'Removed')], default='visible')
    accepted_reply = models.ForeignKey('Reply', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    base_score = models.IntegerField(default=0)  # seed data only

    class Meta:
        ordering = ['-last_activity_at']

    def __str__(self):
        return self.title


class Reply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='replies')
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=8, choices=[('visible', 'Visible'), ('removed', 'Removed')], default='visible')
    base_score = models.IntegerField(default=0)

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = 'replies'

    def __str__(self):
        return f'Reply to {self.thread_id}'


class Vote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    target_type = models.CharField(max_length=6, choices=[('thread', 'Thread'), ('reply', 'Reply')])
    target_id = models.UUIDField()
    value = models.SmallIntegerField()  # -1, 0, 1

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'target_type', 'target_id'], name='uniq_vote')]
        indexes = [models.Index(fields=['target_type', 'target_id'])]

    def __str__(self):
        return f'{self.value:+d} on {self.target_type} {self.target_id}'


class Report(models.Model):
    target_type = models.CharField(max_length=6, choices=[('thread', 'Thread'), ('reply', 'Reply')])
    target_id = models.UUIDField(db_index=True)
    reason = models.CharField(
        max_length=20,
        choices=[(r, r) for r in ('spam', 'bullying', 'inappropriate', 'personal_info', 'wrong_translation', 'other')],
    )
    note = models.CharField(max_length=500, blank=True, default='')
    reporter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(
        max_length=10,
        choices=[('open', 'Open'), ('resolved', 'Resolved'), ('dismissed', 'Dismissed')],
        default='open',
        db_index=True,
    )
    resolution = models.CharField(max_length=300, null=True, blank=True)
    action = models.CharField(max_length=16, null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reason} report on {self.target_type} {self.target_id}'


class ModerationLog(models.Model):
    """Audit trail: who did what, to what, when and why."""

    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    action = models.CharField(max_length=40)
    target_type = models.CharField(max_length=20)
    target_id = models.CharField(max_length=64)
    note = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} on {self.target_type} {self.target_id}'
