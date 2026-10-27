import uuid

from django.utils import timezone

from apps.learning.models import Progress
from conftest import STUDENT


def attempt(c, item_id, correct=True, client_id=None, answered_at=None):
    return c.post(
        '/api/practice/attempt/',
        {
            'clientId': client_id or str(uuid.uuid4()),
            'itemId': item_id,
            'correct': correct,
            'mode': 'flashcard',
            'answeredAt': answered_at or timezone.now().isoformat(),
        },
        format='json',
    )


def test_due_words_come_first_with_three_distractors(as_user):
    c = as_user(STUDENT)
    r = c.get('/api/practice/next-batch/', {'lang': 'twi', 'level': 'b7', 'limit': 10})
    assert r.status_code == 200
    cards = r.json()['cards']
    assert len(cards) == 10
    # Ama has 8 due words; they come before new ones, oldest due first
    assert [c['isNew'] for c in cards] == [False] * 8 + [True] * 2
    assert cards[0]['id'].startswith('tw-greet')
    for card in cards:
        assert len(card['distractors']) == 3
        assert card['translation'] not in card['distractors']
        assert len(set(card['distractors'])) == 3


def test_next_batch_shape_matches_contract(as_user):
    card = as_user(STUDENT).get('/api/practice/next-batch/', {'limit': 1}).json()['cards'][0]
    assert set(card) == {
        'id',
        'unitId',
        'lang',
        'kind',
        'english',
        'translation',
        'audioUrl',
        'mastery',
        'distractors',
        'isNew',
    }


def test_unit_scoped_batch_fills_up_with_weakest_words(as_user):
    cards = as_user(STUDENT).get('/api/practice/next-batch/', {'unit': 'tw-greet', 'limit': 10}).json()['cards']
    assert len(cards) == 10
    assert all(c['unitId'] == 'tw-greet' for c in cards)
    # 4 due first, then the rest by mastery, lowest first
    rest = [c['mastery'] for c in cards[4:]]
    assert rest == sorted(rest)


def test_unknown_unit_is_404(as_user):
    r = as_user(STUDENT).get('/api/practice/next-batch/', {'unit': 'nope'})
    assert r.status_code == 404
    assert r.json() == {'detail': 'That unit was not found.'}


def test_attempts_are_idempotent_by_client_id(as_user):
    c = as_user(STUDENT)
    a = attempt(c, 'tw-num-w1', client_id='abc-123')
    b = attempt(c, 'tw-num-w1', client_id='abc-123')
    assert a.status_code == b.status_code == 200
    assert a.json() == b.json()
    summary = c.get('/api/progress/summary/', {'lang': 'twi'}).json()
    assert summary['todayCount'] == 1


def test_correct_attempt_schedules_the_next_review(as_user):
    r = attempt(as_user(STUDENT), 'tw-num-w1', correct=True).json()
    assert r['itemId'] == 'tw-num-w1' and r['mastery'] == 1


def test_miss_drops_mastery_and_makes_it_due(as_user):
    c = as_user(STUDENT)
    r = attempt(c, 'tw-greet-w1', correct=False).json()  # seeded at mastery 4
    assert r['mastery'] == 1


def test_attempt_on_unknown_item_is_404(as_user):
    r = attempt(as_user(STUDENT), 'nope')
    assert r.status_code == 404
    assert r.json() == {'detail': 'That word was not found.'}


def test_attempt_needs_client_id_item_and_correct(as_user):
    r = as_user(STUDENT).post('/api/practice/attempt/', {'itemId': 'tw-num-w1'}, format='json')
    assert r.status_code == 400
    assert r.json() == {'detail': 'Send clientId, itemId and correct.'}


def test_activity_counts_on_the_day_answered(as_user):
    c = as_user(STUDENT)
    yesterday = (timezone.now() - timezone.timedelta(days=1)).isoformat()
    attempt(c, 'tw-num-w2', answered_at=yesterday)
    summary = c.get('/api/progress/summary/').json()
    assert summary['todayCount'] == 0
    assert summary['history'][-2]['count'] == 13  # seeded 12 yesterday, plus this answer


def test_deck_adds_a_word_to_the_review_pool(as_user):
    c = as_user(STUDENT)
    r = c.post('/api/practice/deck/', {'itemId': 'tw-market-p1'}, format='json')
    assert r.status_code == 200
    assert r.json()['mastery'] == 0
    ids = [x['id'] for x in c.get('/api/practice/next-batch/', {'limit': 50}).json()['cards']]
    assert 'tw-market-p1' in ids
    assert c.post('/api/practice/deck/', {'itemId': 'nope'}, format='json').status_code == 404


def test_first_attempt_awards_akwaaba(as_user, db):
    from rest_framework.test import APIClient

    c = APIClient()
    r = c.post(
        '/api/auth/register/',
        {'name': 'New Learner', 'email': 'new@example.com', 'password': 'longenough1'},
        format='json',
    )
    c.credentials(HTTP_AUTHORIZATION=f'Token {r.json()["token"]}')
    attempt(c, 'tw-greet-w1')
    badges = [b['id'] for b in c.get('/api/progress/summary/').json()['badges']]
    assert badges == ['akwaaba']
    assert Progress.objects.filter(user__email='new@example.com').count() == 1
