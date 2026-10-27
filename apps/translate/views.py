"""Lookup, translation suggestions and pronunciation audio. Behaviour matches the frontend mock (handlers/lookup.ts)."""

import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path

from django.core.cache import cache
from django.db.models import F, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.exceptions import ApiError, field_error
from apps.core.grading import fold_special_letters, normalize_answer
from apps.core.permissions import require_active
from apps.curriculum.models import Item
from apps.curriculum.services import serialize_items

from . import khaya
from .models import Suggestion, VerifiedTranslation

LOCAL_LETTERS = re.compile(r'[ɛɔŋƐƆŊ]')
# Common English words that make poor matches for related vocabulary
STOP_WORDS = {
    'the', 'and', 'you', 'your', 'are', 'for', 'from', 'with', 'what', 'how', 'this', 'that',
    'is', 'it', 'its', 'have', 'has', 'can', 'not', 'too', 'say', 'said',
}  # fmt: skip
ITEM_INDEX_TTL = 10 * 60
KHAYA_CACHE_TTL = 30 * 24 * 60 * 60
DAILY_SUGGESTION_LIMIT = 20
SAMPLES_PATH = Path(__file__).resolve().parents[1] / 'curriculum' / 'fixtures' / 'curriculum.json'


def _text(data, key: str, max_len: int, label: str) -> str:
    """Trimmed string field with the mock's exact messages."""
    value = data.get(key)
    s = value.strip() if isinstance(value, str) else ''
    if not s:
        raise field_error(key, f'Add {label}.')
    if len(s) > max_len:
        raise field_error(key, f'{label[0].upper()}{label[1:]} can be at most {max_len} characters.')
    return s


def _item_index(lang: str) -> list[tuple]:
    """(id, english_norm, translation_folded) for every item in a language, cached briefly."""
    key = f'lookup-items:{lang}'
    index = cache.get(key)
    if index is None:
        index = [
            (i, normalize_answer(en), fold_special_letters(tr))
            for i, en, tr in Item.objects.filter(lang=lang)
            .order_by('unit__order', 'kind', 'position')
            .values_list('id', 'english', 'translation')
        ]
        cache.set(key, index, ITEM_INDEX_TTL)
    return index


@lru_cache(maxsize=1)
def _offline_samples() -> dict:
    """Stand-in for Khaya when no API key is configured (development and tests)."""
    return json.loads(SAMPLES_PATH.read_text(encoding='utf-8')).get('khayaSamples', {})


def _khaya_output(text: str, q: str, lang: str, to_english: bool) -> str | None:
    if not khaya.configured():
        for en, loc in _offline_samples().get(lang, []):
            if (fold_special_letters(loc) == fold_special_letters(q)) if to_english else (en == q):
                return en if to_english else loc
        return None
    digest = hashlib.sha256(q.encode()).hexdigest()
    key = f'khaya:{lang}:{"en" if to_english else "loc"}:{digest}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    try:
        out = khaya.translate(text, lang, to_english=to_english).strip()
    except khaya.KhayaError:
        raise ApiError('The translator is busy. Try again in a moment.', 502) from None
    if out:
        cache.set(key, out, KHAYA_CACHE_TTL)
    return out or None


@api_view(['POST'])
def lookup(request):
    user = request.user
    text = _text(request.data, 'text', 200, 'a word or phrase')
    lang = 'ga' if request.data.get('lang') == 'ga' else 'twi'
    q = normalize_answer(text)
    fq = fold_special_letters(q)
    index = _item_index(lang)

    to_local = next((row for row in index if row[1] == q), None)
    to_english = None if to_local else next((row for row in index if row[2] == fq), None)
    hit = to_local or to_english
    words = [w for w in q.split(' ') if len(w) > 2 and w not in STOP_WORDS]
    related_ids = [
        row[0] for row in index if row is not hit and (q in row[1] or any(w in row[1].split(' ') for w in words))
    ][:4]
    by_id = Item.objects.in_bulk(related_ids + ([hit[0]] if hit else []))
    related = serialize_items(request, user, [by_id[i] for i in related_ids if i in by_id])

    if hit:
        item = by_id[hit[0]]
        return Response(
            {
                'query': text,
                'direction': 'to_local' if to_local else 'to_english',
                'result': {
                    'output': item.translation if to_local else item.english,
                    'source': 'curriculum',
                    'item_id': item.id,
                    'unit_id': item.unit_id,
                },
                'related': related,
            }
        )

    verified = VerifiedTranslation.objects.filter(lang=lang, english__iexact=text.strip()).first() or next(
        (v for v in VerifiedTranslation.objects.filter(lang=lang) if normalize_answer(v.english) == q), None
    )
    if verified:
        return Response(
            {
                'query': text,
                'direction': 'to_local',
                'result': {'output': verified.translation, 'source': 'curriculum', 'item_id': None, 'unit_id': None},
                'related': related,
            }
        )

    is_local = bool(LOCAL_LETTERS.search(text))
    output = _khaya_output(text, q, lang, to_english=is_local)
    return Response(
        {
            'query': text,
            'direction': 'to_english' if is_local else 'to_local',
            'result': {'output': output, 'source': 'khaya', 'item_id': None, 'unit_id': None} if output else None,
            'related': related,
        }
    )


@api_view(['POST'])
def suggest(request):
    user = request.user
    require_active(user)
    data = request.data
    lang = 'ga' if data.get('lang') == 'ga' else 'twi'
    query = _text(data, 'query', 200, 'the word or phrase')
    suggestion = _text(data, 'suggestion', 300, 'your translation')
    current = data.get('current_translation') if isinstance(data.get('current_translation'), str) else None

    nq, ns = normalize_answer(query), normalize_answer(suggestion)
    existing = next(
        (
            s
            for s in Suggestion.objects.filter(lang=lang, status='pending').filter(
                Q(query__iexact=query) | Q(query__icontains=nq)
            )
            if normalize_answer(s.query) == nq and normalize_answer(s.suggestion) == ns
        ),
        None,
    )
    if existing:
        if existing.submitted_by_id != user.id:
            Suggestion.objects.filter(pk=existing.pk).update(supporters=F('supporters') + 1)
        return Response({'ok': True})

    sent_today = Suggestion.objects.filter(submitted_by=user, created_at__date=timezone.localdate()).count()
    if sent_today >= DAILY_SUGGESTION_LIMIT:
        raise ApiError('You’ve sent lots of suggestions today. Medaase! Try again tomorrow.', 429)
    Suggestion.objects.create(
        lang=lang, query=query, current_translation=current, suggestion=suggestion, submitted_by=user
    )
    return Response({'ok': True})


# Khaya TTS codes and Kasa language ids both accepted
TTS_LANGS = {'twi': 'twi', 'tw': 'twi', 'gaa': 'ga', 'ga': 'ga'}


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def tts(request):
    """
    Public on purpose: <audio src> can't send an auth header. Responses are
    cacheable for 30 days (CDN, service worker and phone), and anonymous
    requests are throttled by the default anon rate.
    """
    text = (request.query_params.get('text') or '').strip()
    lang = TTS_LANGS.get(request.query_params.get('lang') or '')
    if not text or not lang or len(text) > 200:
        raise ApiError('Send a short text and a language.')
    if not khaya.configured():
        raise ApiError('Pronunciation audio plays once Kasa is connected to Khaya AI.', 503)
    try:
        audio, content_type = khaya.synthesize(text, lang, request.query_params.get('speaker') or 'female')
    except khaya.KhayaError:
        raise ApiError('Couldn’t generate audio right now. Try again in a moment.', 502) from None
    response = HttpResponse(audio, content_type=content_type)
    response['Cache-Control'] = 'public, max-age=2592000'
    return response
