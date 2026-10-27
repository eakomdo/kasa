from datetime import timedelta

from django.utils import timezone


class LastActiveMiddleware:
    """Records when a signed-in user was last active (at most once a minute per user)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            now = timezone.now()
            if not user.last_active_at or now - user.last_active_at > timedelta(minutes=1):
                type(user).objects.filter(pk=user.pk).update(last_active_at=now)
        return response
