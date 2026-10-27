from apps.accounts.models import User
from apps.notifications.models import notify
from conftest import STUDENT, TEACHER


def test_list_and_mark_read(as_user):
    c = as_user(STUDENT)
    ama = User.objects.get(email=STUDENT)
    before = c.get('/api/notifications/').json()['unreadCount']
    notify(ama, 'reply', 'Kwame replied', 'He answered your question.', '/community/t/x')
    notify(ama, 'badge', 'New badge', 'You earned Sankofa.')
    notify(User.objects.get(email=TEACHER), 'reply', 'Not for Ama', '...')

    data = c.get('/api/notifications/').json()
    assert data['unreadCount'] == before + 2
    first = data['items'][0]
    assert set(first) == {'id', 'kind', 'title', 'body', 'href', 'createdAt', 'read'}
    assert all(n['title'] != 'Not for Ama' for n in data['items'])

    c.post('/api/notifications/read/', {'ids': [first['id'], 'not-a-uuid']}, format='json')
    assert c.get('/api/notifications/').json()['unreadCount'] == before + 1
    c.post('/api/notifications/read/', {}, format='json')
    assert c.get('/api/notifications/').json()['unreadCount'] == 0


def test_requires_login(client, db):
    assert client.get('/api/notifications/').status_code == 401
