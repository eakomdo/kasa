"""Curriculum queries shared by curriculum, practice and lookup."""

from django.db.models import QuerySet

from apps.learning.models import Progress

from .levels import band_of
from .models import Item, Unit


def units_for(lang: str, level_id: str) -> list[Unit]:
    """Units taught at this level's band, in syllabus order. (JSON contains isn't portable, so filter in Python.)"""
    band = band_of(level_id)
    return [u for u in Unit.objects.filter(lang=lang).order_by('order') if band in (u.bands or [])]


def word_ids(unit: Unit) -> list[str]:
    return list(unit.items.filter(kind='word').order_by('position').values_list('id', flat=True))


def mastery_map(user, item_ids) -> dict[str, int]:
    return dict(Progress.objects.filter(user=user, item_id__in=list(item_ids)).values_list('item_id', 'mastery'))


def audio_url(request, item: Item) -> str | None:
    if not item.audio:
        return None
    url = item.audio.url
    return request.build_absolute_uri(url) if request is not None else url


def serialize_item(request, item: Item, mastery: int | None) -> dict:
    return {
        'id': item.id,
        'unit_id': item.unit_id,
        'lang': item.lang,
        'kind': item.kind,
        'english': item.english,
        'translation': item.translation,
        'audio_url': audio_url(request, item),
        'mastery': mastery,
    }


def serialize_items(request, user, items: QuerySet | list) -> list[dict]:
    items = list(items)
    m = mastery_map(user, [i.id for i in items])
    return [serialize_item(request, i, m.get(i.id)) for i in items]


def serialize_unit(user, unit: Unit, order: int) -> dict:
    words = word_ids(unit)
    phrase_count = unit.items.filter(kind='phrase').count()
    learned = Progress.objects.filter(user=user, item_id__in=words, mastery__gte=2).count()
    return {
        'id': unit.id,
        'lang': unit.lang,
        'bands': unit.bands,
        'order': order,
        'title_local': unit.title_local,
        'title_en': unit.title_en,
        'strand': unit.strand,
        'note': unit.note,
        'word_count': len(words),
        'phrase_count': phrase_count,
        'content_status': unit.content_status,
        'progress': {'learned': learned, 'total': len(words)},
    }
