from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.exceptions import ApiError

from .models import User
from .serializers import MePatchSerializer, RegisterSerializer, serialize_user


class AuthThrottle(ScopedRateThrottle):
    scope_attr = 'throttle_scope'

    def get_cache_key(self, request, view):
        self.scope = 'auth'
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return self.cache_format % {'scope': 'auth', 'ident': self.get_ident(request)}


def _token_response(user: User, code=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': serialize_user(user)}, status=code)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    email = str(request.data.get('email', '')).strip().lower()
    password = str(request.data.get('password', ''))
    user = authenticate(request, email=email, password=password) if email and password else None
    if user is None:
        raise ApiError('That email and password don’t match. Check both and try again.')
    return _token_response(user)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    s = RegisterSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    with transaction.atomic():
        user = User.objects.create_user(
            email=s.validated_data['email'],
            password=s.validated_data['password'],
            name=s.validated_data['name'].strip(),
        )
    return _token_response(user, status.HTTP_201_CREATED)


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({'ok': True})


@api_view(['GET', 'PATCH'])
def me(request):
    user: User = request.user
    if request.method == 'GET':
        return Response(serialize_user(user))

    s = MePatchSerializer(data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    data = s.validated_data
    for field in ('name', 'lang', 'level_id', 'daily_goal', 'voice', 'onboarded'):
        if field in data:
            setattr(user, field, data[field])
    for field in ('school', 'region', 'guardian_email'):
        if field in data:
            setattr(user, field, (data[field] or '').strip() or None)
    if 'reminder' in data:
        r = data['reminder']
        user.reminder_enabled = r.get('enabled', user.reminder_enabled)
        user.reminder_channel = r.get('channel', user.reminder_channel)
        user.reminder_time = r.get('time', user.reminder_time)
    user.save()
    return Response(serialize_user(user))
