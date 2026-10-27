from conftest import STUDENT


def test_login_returns_token_and_contract_user(as_user, client, seeded):
    r = client.post('/api/auth/login/', {'email': STUDENT, 'password': 'demo1234'}, format='json')
    assert r.status_code == 200
    user = r.json()['user']
    assert user['displayName'] == 'Ama M.'
    assert user['reminder'] == {'enabled': False, 'channel': 'whatsapp', 'time': '18:00'}
    assert 'password' not in user


def test_wrong_password_has_a_helpful_message(client, seeded):
    r = client.post('/api/auth/login/', {'email': STUDENT, 'password': 'nope'}, format='json')
    assert r.status_code == 400
    assert 'don’t match' in r.json()['detail']


def test_register_validates_fields(client, db):
    r = client.post('/api/auth/register/', {'name': 'Kofi', 'email': 'bad', 'password': '123'}, format='json')
    assert r.status_code == 400
    assert 'email' in r.json() and 'password' in r.json()


def test_register_creates_un_onboarded_student(client, db):
    r = client.post(
        '/api/auth/register/',
        {'name': 'Kofi Asante', 'email': 'kofi@example.com', 'password': 'longenough1'},
        format='json',
    )
    assert r.status_code == 201
    assert r.json()['user']['onboarded'] is False
    assert r.json()['user']['role'] == 'student'


def test_private_endpoints_need_login(client, db):
    r = client.get('/api/me/')
    assert r.status_code == 401
    assert r.json() == {'detail': 'Please log in to continue.'}


def test_profile_updates_are_validated(as_user):
    c = as_user(STUDENT)
    assert c.patch('/api/me/', {'dailyGoal': 7}, format='json').status_code == 400
    r = c.patch('/api/me/', {'dailyGoal': 20, 'region': 'Volta', 'reminder': {'enabled': True}}, format='json')
    assert r.status_code == 200
    body = r.json()
    assert body['dailyGoal'] == 20 and body['region'] == 'Volta' and body['reminder']['enabled'] is True


def test_logout_revokes_token(as_user):
    c = as_user(STUDENT)
    assert c.post('/api/auth/logout/').status_code == 200
    assert c.get('/api/me/').status_code == 401
