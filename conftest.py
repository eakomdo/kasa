"""Shared pytest fixtures. Tests run against the seeded demo world, like the frontend's mock contract tests."""

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _fast_tests(settings):
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
    settings.ALLOWED_HOSTS = ['testserver']
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_CLASSES': []}
    settings.KHAYA_API_KEY = ''  # never call the real Khaya API from tests
    settings.KASA_DEMO_DATA = True  # pytest-django runs with DEBUG off


@pytest.fixture
def seeded(db):
    call_command('seed_demo', verbosity=0)


@pytest.fixture
def client():
    return APIClient()


def login(client: APIClient, email: str, password: str = 'demo1234') -> APIClient:
    r = client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')
    assert r.status_code == 200, r.content
    client.credentials(HTTP_AUTHORIZATION=f'Token {r.json()["token"]}')
    return client


@pytest.fixture
def as_user(seeded):
    """as_user('ama.mensah@example.com') -> authenticated APIClient"""

    def _make(email: str) -> APIClient:
        return login(APIClient(), email)

    return _make


STUDENT = 'ama.mensah@example.com'
TEACHER = 'kojo.boateng@example.com'
MODERATOR = 'yaw.darko@example.com'
ADMIN = 'efua.asante@example.com'
