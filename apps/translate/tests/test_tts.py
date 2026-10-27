from unittest import mock

from rest_framework.test import APIClient


def test_without_a_key_the_api_explains(db):
    r = APIClient().get('/api/tts/', {'text': 'Maakye', 'lang': 'twi'})
    assert r.status_code == 503
    assert r.json() == {'detail': 'Pronunciation audio plays once Kasa is connected to Khaya AI.'}


def test_bad_request(db):
    assert APIClient().get('/api/tts/', {'text': '', 'lang': 'twi'}).status_code == 400
    assert APIClient().get('/api/tts/', {'text': 'Maakye', 'lang': 'fr'}).status_code == 400


def test_audio_is_fetched_once_then_served_from_disk(db, settings, tmp_path):
    settings.KHAYA_API_KEY = 'test-key'
    settings.TTS_CACHE_DIR = tmp_path
    fake = mock.Mock(status_code=200, content=b'RIFFfakewav', headers={'content-type': 'audio/wav'})
    with mock.patch('apps.translate.khaya.requests.post', return_value=fake) as post:
        a = APIClient().get('/api/tts/', {'text': 'Maakye', 'lang': 'twi', 'speaker': 'male_low'})
        b = APIClient().get('/api/tts/', {'text': 'Maakye', 'lang': 'twi', 'speaker': 'male_low'})
    assert a.status_code == b.status_code == 200
    assert a.content == b.content == b'RIFFfakewav'
    assert a['Content-Type'] == 'audio/wav'
    assert a['Cache-Control'] == 'public, max-age=2592000'
    assert post.call_count == 1
    sent = post.call_args.kwargs
    assert sent['json'] == {'text': 'Maakye', 'language': 'twi', 'speaker_id': 'male_low'}
    assert sent['headers']['Ocp-Apim-Subscription-Key'] == 'test-key'


def test_ga_uses_the_khaya_ga_code(db, settings, tmp_path):
    settings.KHAYA_API_KEY = 'k'
    settings.TTS_CACHE_DIR = tmp_path
    fake = mock.Mock(status_code=200, content=b'x', headers={})
    with mock.patch('apps.translate.khaya.requests.post', return_value=fake) as post:
        assert APIClient().get('/api/tts/', {'text': 'Ojekoo', 'lang': 'gaa'}).status_code == 200
    assert post.call_args.kwargs['json']['language'] == 'gaa'


def test_khaya_error_is_502(db, settings, tmp_path):
    settings.KHAYA_API_KEY = 'k'
    settings.TTS_CACHE_DIR = tmp_path
    with mock.patch('apps.translate.khaya.requests.post', return_value=mock.Mock(status_code=500, text='boom')):
        r = APIClient().get('/api/tts/', {'text': 'Maakye', 'lang': 'twi'})
    assert r.status_code == 502
