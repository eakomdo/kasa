"""
Child-safety check for community text. Most Kasa learners are minors, so posts
may not carry contact details, links or insults. This mirrors the frontend's
src/shared/lib/safety.ts exactly: the browser checks for instant feedback,
this module is the real gate.
"""

import re
import unicodedata

# Ghana numbers: 024 123 4567, 0241234567, +233 24 123 4567, 233-24-123-4567
GH_PHONE = re.compile(r'(?:\+?233|\b0)[\s.-]?[2-5]\d(?:[\s.-]?\d){7}\b')
LONG_NUMBER = re.compile(r'\d(?:[\s.-]?\d){8,}')
EMAIL = re.compile(r'[^\s@]+@[^\s@]+\.[a-z]{2,}', re.IGNORECASE)
URL = re.compile(r'\b(?:https?://|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|gh|io|me|ly|co|app|xyz|info)\b', re.IGNORECASE)
SOCIAL_HANDLE = re.compile(r'(?:^|\s)@[a-z0-9_.]{3,}', re.IGNORECASE)

# Kept short on purpose; moderators handle what a word list can't.
INSULTS = ['stupid', 'idiot', 'fool', 'foolish', 'dumb', 'useless', 'shut up', 'kwasia', 'ashawo']
INSULT = re.compile(r'\b(?:' + '|'.join(w.replace(' ', r'\s+') for w in INSULTS) + r')\b', re.IGNORECASE)

CONTACT_MESSAGE = "For your safety, don't share phone numbers, emails, social media or links in the community."
INSULT_MESSAGE = "Let's keep Kasa kind. Please remove the insult before posting."


def check_post_safety(text: str) -> str | None:
    """Return a friendly reason the text can't be posted, or None if it's fine."""
    t = unicodedata.normalize('NFC', text or '')
    if any(p.search(t) for p in (GH_PHONE, LONG_NUMBER, EMAIL, URL, SOCIAL_HANDLE)):
        return CONTACT_MESSAGE
    if INSULT.search(t):
        return INSULT_MESSAGE
    return None
