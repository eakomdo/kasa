import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

KINDS = (
    'join_request',
    'join_approved',
    'join_declined',
    'community_approved',
    'community_rejected',
    'role_changed',
    'reply',
    'answer_accepted',
    'badge',
)


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=20, choices=[(k, k) for k in KINDS])
    title = models.CharField(max_length=140)
    body = models.CharField(max_length=300)
    href = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'read'])]

    def __str__(self):
        return f'{self.kind} for {self.user}'


def notify(user, kind: str, title: str, body: str, href: str | None = None) -> None:
    """In-app notification. Production also fans out to push/WhatsApp/SMS per the user's settings (Celery task)."""
    Notification.objects.create(user=user, kind=kind, title=title, body=body, href=href)
