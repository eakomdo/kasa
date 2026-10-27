from apps.accounts.models import User
from apps.translate.models import Suggestion
from conftest import STUDENT, TEACHER


def suggest(c, query='school bag', suggestion='Sukuu bag'):
    return c.post(
        '/api/translate/suggestions/',
        {'lang': 'twi', 'query': query, 'suggestion': suggestion, 'currentTranslation': None},
        format='json',
    )


def test_learners_can_suggest(as_user):
    r = suggest(as_user(STUDENT))
    assert r.status_code == 200 and r.json() == {'ok': True}
    s = Suggestion.objects.get(query='school bag')
    assert s.status == 'pending' and s.supporters == 0


def test_same_suggestion_from_someone_else_adds_a_supporter(as_user):
    suggest(as_user(STUDENT))
    suggest(as_user(STUDENT))  # same person again: no change
    suggest(as_user(TEACHER), query='School bag!', suggestion='sukuu bag')
    s = Suggestion.objects.get(query='school bag')
    assert s.supporters == 1


def test_daily_limit(as_user):
    c = as_user(STUDENT)
    for i in range(20):
        assert suggest(c, query=f'word {i}').status_code == 200
    r = suggest(c, query='one more')
    assert r.status_code == 429
    assert 'lots of suggestions today' in r.json()['detail']


def test_validation_and_suspension(as_user):
    c = as_user(STUDENT)
    r = suggest(c, suggestion='')
    assert r.status_code == 400 and r.json() == {'suggestion': ['Add your translation.']}
    User.objects.filter(email=STUDENT).update(status='suspended')
    assert suggest(c).status_code == 403
