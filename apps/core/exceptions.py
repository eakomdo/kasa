"""
Error responses in the shape the frontend expects:
  {"detail": "message"}            general errors
  {"field": ["message"]}           validation errors
Every message is shown to learners as written, so keep them plain and kind.
"""

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(exceptions.APIException):
    """Raise with a learner-facing message and a status code."""

    def __init__(self, detail: str | dict, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.status_code = status_code
        super().__init__(detail)


def field_error(field: str, message: str) -> ApiError:
    return ApiError({field: [message]})


FRIENDLY = {
    status.HTTP_401_UNAUTHORIZED: 'Please log in to continue.',
    status.HTTP_403_FORBIDDEN: 'You don’t have permission to do that.',
    status.HTTP_404_NOT_FOUND: 'We couldn’t find that.',
    status.HTTP_429_TOO_MANY_REQUESTS: 'You’re going a bit fast. Wait a moment and try again.',
}


def exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()
    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        return Response({'detail': FRIENDLY[401]}, status=status.HTTP_401_UNAUTHORIZED)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and 'detail' in data:
        default = getattr(exc, 'default_detail', None)
        # Replace DRF's generic English defaults with our friendlier copy
        if str(data['detail']) == str(default) and response.status_code in FRIENDLY:
            data = {'detail': FRIENDLY[response.status_code]}
        else:
            data = {'detail': str(data['detail'])}
    elif isinstance(data, list):
        data = {'detail': ' '.join(str(x) for x in data)}
    response.data = data
    return response
