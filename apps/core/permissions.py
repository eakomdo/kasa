from rest_framework.permissions import BasePermission

from apps.core.exceptions import ApiError

STAFF_ROLES = ('moderator', 'admin')
ADULT_ROLES = ('teacher', 'moderator', 'admin')


def is_staff_role(user) -> bool:
    return bool(user and user.is_authenticated and user.role in STAFF_ROLES)


def is_adult(user) -> bool:
    return bool(user and user.is_authenticated and user.role in ADULT_ROLES)


class IsModerator(BasePermission):
    """Kasa moderators and admins (the community admin area)."""

    message = 'You don’t have permission to do that.'

    def has_permission(self, request, view):
        return is_staff_role(request.user)


class IsKasaAdmin(BasePermission):
    message = 'Only Kasa admins can do that.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


def require_active(user) -> None:
    """Suspended learners can learn and practise but not write to the community."""
    if user.status == 'suspended':
        raise ApiError('Your account is paused by a moderator, so you can’t make changes right now.', 403)
