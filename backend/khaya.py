"""Khaya AI (GhanaNLP) client for the Kasa API.

The Kasa frontend never calls Khaya directly. It calls our own endpoints
(/api/translate/lookup/, /api/tts/), and those call Khaya with the key below,
so the subscription key never ships to students' phones.

Get a key at https://translation.ghananlp.org and set KHAYA_API_KEY.
Endpoints and payloads match the `khaya` SDK (v0.3.0) on PyPI.
"""
import hashlib
import os
from pathlib import Path

import requests

BASE_URL = "https://translation-api.ghananlp.org"
API_KEY = os.environ.get("KHAYA_API_KEY", "")
TIMEOUT = 30
TTS_CACHE = Path(os.environ.get("KHAYA_TTS_CACHE", "media/tts-cache"))

# Kasa language id -> Khaya code per service
LANG_CODES = {
    "twi": {"mt": "tw", "tts": "twi", "asr": "twi"},
    "ga": {"mt": "gaa", "tts": "gaa", "asr": "gaa"},
}
TTS_SPEAKERS = {"female", "male_low", "male_high"}


class KhayaError(Exception):
    pass


def _headers(content_type="application/json"):
    if not API_KEY:
        raise KhayaError("KHAYA_API_KEY is not set")
    return {"Ocp-Apim-Subscription-Key": API_KEY, "Content-Type": content_type}


def translate(text, lang, to_english=False):
    """English -> Twi/Ga, or the reverse with to_english=True."""
    code = LANG_CODES[lang]["mt"]
    pair = f"{code}-en" if to_english else f"en-{code}"
    r = requests.post(f"{BASE_URL}/v1/translate", json={"in": text, "lang": pair},
                      headers=_headers(), timeout=TIMEOUT)
    if r.status_code != 200:
        raise KhayaError(f"translate failed ({r.status_code}): {r.text[:200]}")
    return r.json()


def synthesize(text, lang, speaker="female"):
    """Return (audio_bytes, content_type). Cached on disk: the same word is
    requested by thousands of students, and each Khaya call costs quota."""
    code = LANG_CODES[lang]["tts"]
    speaker = speaker if speaker in TTS_SPEAKERS else "female"
    key = hashlib.sha256(f"{code}|{speaker}|{text}".encode()).hexdigest()
    cached = TTS_CACHE / f"{key}.wav"
    if cached.exists():
        return cached.read_bytes(), "audio/wav"

    r = requests.post(f"{BASE_URL}/tts/v1/tts",
                      json={"text": text, "language": code, "speaker_id": speaker},
                      headers=_headers(), timeout=TIMEOUT)
    if r.status_code != 200:
        raise KhayaError(f"tts failed ({r.status_code}): {r.text[:200]}")
    TTS_CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(r.content)
    return r.content, r.headers.get("content-type", "audio/wav")


def transcribe(audio_bytes, lang):
    """Speech -> text, for a future 'say it out loud' pronunciation check."""
    code = LANG_CODES[lang]["asr"]
    r = requests.post(f"{BASE_URL}/asr/v1/transcribe", params={"language": code},
                      data=audio_bytes, headers=_headers("audio/wav"), timeout=TIMEOUT)
    if r.status_code != 200:
        raise KhayaError(f"asr failed ({r.status_code}): {r.text[:200]}")
    return r.json()
