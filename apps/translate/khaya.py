"""
Khaya AI (GhanaNLP) client. The frontend never calls Khaya: it calls our
/api/translate/lookup/ and /api/tts/, and those call Khaya with the server's
key, so the subscription key never reaches students' phones.

Endpoints and payloads match the `khaya` SDK (v0.3.0) on PyPI.
"""

import hashlib
import logging

import requests
from django.conf import settings

log = logging.getLogger(__name__)

# Kasa language id -> Khaya code per service
LANG_CODES = {
    'twi': {'mt': 'tw', 'tts': 'twi', 'asr': 'twi'},
    'ga': {'mt': 'gaa', 'tts': 'gaa', 'asr': 'gaa'},
}
TTS_SPEAKERS = {'female', 'male_low', 'male_high'}


class KhayaError(Exception):
    pass


def configured() -> bool:
    return bool(settings.KHAYA_API_KEY)


def _headers(content_type: str = 'application/json') -> dict:
    if not settings.KHAYA_API_KEY:
        raise KhayaError('KHAYA_API_KEY is not set')
    return {'Ocp-Apim-Subscription-Key': settings.KHAYA_API_KEY, 'Content-Type': content_type}


def _post(path: str, **kwargs) -> requests.Response:
    try:
        r = requests.post(f'{settings.KHAYA_BASE_URL}{path}', timeout=settings.KHAYA_TIMEOUT, **kwargs)
    except requests.RequestException as exc:
        log.warning('khaya request failed: %s', exc)
        raise KhayaError(str(exc)) from exc
    if r.status_code != 200:
        log.warning('khaya %s returned %s: %s', path, r.status_code, r.text[:200])
        raise KhayaError(f'{path} failed ({r.status_code})')
    return r


def translate(text: str, lang: str, to_english: bool = False) -> str:
    """English -> Twi/Ga, or the reverse with to_english=True."""
    code = LANG_CODES[lang]['mt']
    pair = f'{code}-en' if to_english else f'en-{code}'
    r = _post('/v1/translate', json={'in': text, 'lang': pair}, headers=_headers())
    out = r.json()
    return out if isinstance(out, str) else str(out)


def synthesize(text: str, lang: str, speaker: str = 'female') -> tuple[bytes, str]:
    """Return (audio_bytes, content_type). Cached on disk: thousands of students request the same word."""
    code = LANG_CODES[lang]['tts']
    speaker = speaker if speaker in TTS_SPEAKERS else 'female'
    key = hashlib.sha256(f'{code}|{speaker}|{text}'.encode()).hexdigest()
    cache_dir = settings.TTS_CACHE_DIR
    cached = cache_dir / f'{key}.wav'
    if cached.exists():
        return cached.read_bytes(), 'audio/wav'
    r = _post('/tts/v1/tts', json={'text': text, 'language': code, 'speaker_id': speaker}, headers=_headers())
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(r.content)
    return r.content, r.headers.get('content-type', 'audio/wav')


def transcribe(audio_bytes: bytes, lang: str) -> str:
    """Speech -> text, for the planned 'say it out loud' pronunciation check."""
    code = LANG_CODES[lang]['asr']
    r = _post('/asr/v1/transcribe', params={'language': code}, data=audio_bytes, headers=_headers('audio/wav'))
    return r.json()
