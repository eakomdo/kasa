import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import User
from apps.curriculum.models import Unit


@pytest.mark.django_db
def test_demo_accounts_are_refused_outside_debug(settings):
    settings.KASA_DEMO_DATA = False
    with pytest.raises(CommandError, match='--curriculum-only'):
        call_command('seed_demo', verbosity=0)
    assert not User.objects.exists()


@pytest.mark.django_db
def test_curriculum_only_works_in_production(settings):
    settings.KASA_DEMO_DATA = False
    call_command('seed_demo', '--curriculum-only', verbosity=0)
    assert Unit.objects.exists()
    assert not User.objects.exists()
