from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.curriculum.levels import LEVELS, REGIONS

from .models import User


def serialize_user(u: User) -> dict:
    """The `User` shape in the API contract (camelCased by the renderer)."""
    return {
        'id': str(u.id),
        'name': u.name,
        'display_name': u.display_name,
        'email': u.email,
        'role': u.role,
        'status': u.status,
        'onboarded': u.onboarded,
        'lang': u.lang,
        'level_id': u.level_id,
        'daily_goal': u.daily_goal,
        'voice': u.voice,
        'school': u.school,
        'region': u.region,
        'guardian_email': u.guardian_email,
        'plan': u.plan,
        'reminder': {'enabled': u.reminder_enabled, 'channel': u.reminder_channel, 'time': u.reminder_time},
        'created_at': u.created_at.isoformat(),
    }


def serialize_author(u: User | None) -> dict:
    """What other learners may see about a person."""
    from apps.curriculum.levels import short_label

    if u is None:
        return {'id': 'deleted', 'display_name': 'Former learner', 'role': 'student', 'level_label': None}
    return {
        'id': str(u.id),
        'display_name': u.display_name,
        'role': u.role,
        'level_label': short_label(u.level_id) if u.role == 'student' else None,
    }


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=60, error_messages={'blank': 'Add your first name so we know what to call you.'}
    )
    email = serializers.EmailField(
        error_messages={'invalid': 'That email doesn’t look right. Check for a missing @ or dot.'}
    )
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists. Try logging in.')
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Use at least 8 characters for your password.')
        try:
            password_validation.validate_password(value)
        except DjangoValidationError:
            raise serializers.ValidationError('That password is too easy to guess. Try a longer one.') from None
        return value


class ReminderSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    channel = serializers.ChoiceField(choices=['whatsapp', 'sms', 'push'], required=False)
    time = serializers.RegexField(r'^\d{2}:\d{2}$', required=False)


class MePatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, required=False)
    lang = serializers.ChoiceField(
        choices=['twi', 'ga'], required=False, error_messages={'invalid_choice': 'Choose Twi or Ga.'}
    )
    level_id = serializers.ChoiceField(
        choices=list(LEVELS), required=False, error_messages={'invalid_choice': 'Choose your class.'}
    )
    daily_goal = serializers.ChoiceField(
        choices=[5, 10, 20, 30], required=False, error_messages={'invalid_choice': 'Pick 5, 10, 20 or 30 cards.'}
    )
    voice = serializers.ChoiceField(choices=['female', 'male_low', 'male_high'], required=False)
    school = serializers.CharField(max_length=80, required=False, allow_null=True, allow_blank=True)
    region = serializers.ChoiceField(
        choices=list(REGIONS),
        required=False,
        allow_null=True,
        allow_blank=True,
        error_messages={'invalid_choice': 'Choose a region from the list.'},
    )
    guardian_email = serializers.EmailField(
        required=False,
        allow_null=True,
        allow_blank=True,
        error_messages={'invalid': 'Check the parent or guardian’s email address.'},
    )
    reminder = ReminderSerializer(required=False)
    onboarded = serializers.BooleanField(required=False)
