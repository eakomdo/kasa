"""Example Django REST Framework views wiring Kasa's endpoints to Khaya.

Response shapes match what frontend/index.html expects. VocabItem stands in
for your teacher-verified curriculum model (fields: id, unit_id, lang,
english, translation, audio_url).
"""
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import khaya
from .models import VocabItem  # your curriculum model


@api_view(["POST"])
def translate_lookup(request):
    text = (request.data.get("text") or "").strip()
    lang = request.data.get("lang", "twi")
    if not text or lang not in khaya.LANG_CODES:
        return Response({"detail": "Send some text and a language (twi or ga)."}, status=400)

    # 1. Teacher-verified curriculum first, in either direction
    item = (VocabItem.objects.filter(lang=lang, english__iexact=text).first()
            or VocabItem.objects.filter(lang=lang, translation__iexact=text).first())
    if item:
        reverse = item.translation.lower() == text.lower()
        return Response({"query": text, "reverse": reverse, "related": [], "result": {
            "item_id": item.id, "unit": item.unit_id, "source": "curriculum",
            "output": item.english if reverse else item.translation}})

    # 2. Otherwise ask Khaya. Treat input with Twi/Ga letters as local-to-English.
    to_english = any(c in text for c in "ɛɔŋƐƆŊ")
    try:
        output = khaya.translate(text, lang, to_english=to_english)
    except khaya.KhayaError:
        return Response({"detail": "The translator is busy. Try again in a moment."}, status=502)
    return Response({"query": text, "reverse": to_english, "related": [], "result": {
        "item_id": None, "unit": None, "source": "khaya", "output": output}})


@api_view(["GET"])
def tts(request):
    text = request.GET.get("text", "").strip()
    lang = request.GET.get("lang", "twi")
    # The frontend sends Khaya's TTS code; map it back to a Kasa language id
    lang = {"twi": "twi", "gaa": "ga"}.get(lang, lang)
    if not text or lang not in khaya.LANG_CODES or len(text) > 200:
        return Response({"detail": "Send a short text and a language."}, status=400)
    try:
        audio, content_type = khaya.synthesize(text, lang, request.GET.get("speaker", "female"))
    except khaya.KhayaError:
        return Response({"detail": "Couldn't generate audio right now."}, status=502)
    resp = HttpResponse(audio, content_type=content_type)
    resp["Cache-Control"] = "public, max-age=2592000"  # 30 days: phones keep it, saving data
    return resp
