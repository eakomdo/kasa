from django.conf import settings
from django.db import models


class Suggestion(models.Model):
    """A learner's proposed translation. Moderators approve it into VerifiedTranslation."""

    lang = models.CharField(max_length=4, choices=[('twi', 'Twi'), ('ga', 'Ga')])
    query = models.CharField(max_length=200)
    current_translation = models.CharField(max_length=300, null=True, blank=True)
    suggestion = models.CharField(max_length=300)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    supporters = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=10,
        choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
        default='pending',
        db_index=True,
    )
    final_translation = models.CharField(max_length=300, null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.query} → {self.suggestion} ({self.status})'


class VerifiedTranslation(models.Model):
    """Teacher-approved translation outside the curriculum; lookup treats it as verified."""

    lang = models.CharField(max_length=4)
    english = models.CharField(max_length=200)
    translation = models.CharField(max_length=300)
    source = models.ForeignKey(Suggestion, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['lang', 'english'])]

    def __str__(self):
        return f'{self.english} → {self.translation}'
