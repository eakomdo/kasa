from unittest import mock

import pytest
from django.core.cache import cache

from apps.translate import khaya
from apps.translate.models import VerifiedTranslation
from conftest import STUDENT


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()


def lookup(c, text, lang='twi'):
    return c.post('/api/translate/lookup/', {'text': text, 'lang': lang}, format='json')


def test_syllabus_entries_come_first(as_user):
    r = lookup(as_user(STUDENT), 'Thank you').json()
    assert r['direction'] == 'to_local'
    assert r['result'] == {'output': 'Medaase', 'source': 'curriculum', 'itemId': 'tw-greet-w5', 'unitId': 'tw-greet'}


def test_twi_to_english_even_without_special_letters(as_user):
    r = lookup(as_user(STUDENT), 'mmiensa').json()
    assert r['direction'] == 'to_english'
    assert r['result']['output'] == 'Three'


def test_words_outside_the_syllabus_come_from_khaya(as_user):
    r = lookup(as_user(STUDENT), 'friend').json()
    assert r['result']['source'] == 'khaya'
    assert r['result']['output'] == 'Adamfo'
    assert r['result']['itemId'] is None


def test_verified_translations_win_over_khaya(as_user):
    VerifiedTranslation.objects.create(lang='twi', english='friend', translation='Ɔyɔnko')
    r = lookup(as_user(STUDENT), 'Friend').json()
    assert r['result'] == {'output': 'Ɔyɔnko', 'source': 'curriculum', 'itemId': None, 'unitId': None}


def test_related_words_ignore_stop_words(as_user):
    c = as_user(STUDENT)
    assert [i['id'] for i in lookup(c, 'morning').json()['related']] == ['tw-greet-w1']
    related = lookup(c, 'Thank you').json()['related']
    assert all('you' not in i['english'].lower().split() or 'thank' in i['english'].lower() for i in related)


def test_no_result(as_user):
    r = lookup(as_user(STUDENT), 'spaceship').json()
    assert r['result'] is None and r['direction'] == 'to_local'


def test_text_is_required(as_user):
    r = as_user(STUDENT).post('/api/translate/lookup/', {'text': '  '}, format='json')
    assert r.status_code == 400
    assert r.json() == {'text': ['Add a word or phrase.']}


def test_live_khaya_is_called_once_then_cached(as_user, settings):
    settings.KHAYA_API_KEY = 'test-key'
    c = as_user(STUDENT)
    with mock.patch.object(khaya, 'translate', return_value='Ɔyɔnko') as call:
        first = lookup(c, 'cousin').json()
        second = lookup(c, 'cousin').json()
    assert first['result']['output'] == second['result']['output'] == 'Ɔyɔnko'
    assert call.call_count == 1
    call.assert_called_with('cousin', 'twi', to_english=False)


def test_khaya_failure_is_a_friendly_502(as_user, settings):
    settings.KHAYA_API_KEY = 'test-key'
    with mock.patch.object(khaya, 'translate', side_effect=khaya.KhayaError('down')):
        r = lookup(as_user(STUDENT), 'teacher of maths')
    assert r.status_code == 502
    assert r.json() == {'detail': 'The translator is busy. Try again in a moment.'}
