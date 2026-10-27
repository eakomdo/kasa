from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.core.exceptions import ApiError

from .levels import LEVELS
from .models import DailyFeature, Unit
from .services import serialize_items, serialize_unit, units_for


@api_view(['GET'])
def level_units(request, level_id: str):
    if level_id not in LEVELS:
        raise ApiError('That class was not found.', 404)
    lang = request.query_params.get('lang', request.user.lang)
    return Response([serialize_unit(request.user, u, i + 1) for i, u in enumerate(units_for(lang, level_id))])


@api_view(['GET'])
def unit_detail(request, unit_id: str):
    unit = get_object_or_404(Unit, pk=unit_id)
    ordered = [u.id for u in units_for(unit.lang, request.user.level_id)]
    order = ordered.index(unit.id) + 1 if unit.id in ordered else 0
    return Response(serialize_unit(request.user, unit, order))


@api_view(['GET'])
def unit_vocabulary(request, unit_id: str):
    unit = get_object_or_404(Unit, pk=unit_id)
    return Response(serialize_items(request, request.user, unit.items.filter(kind='word').order_by('position')))


@api_view(['GET'])
def unit_phrases(request, unit_id: str):
    unit = get_object_or_404(Unit, pk=unit_id)
    return Response(serialize_items(request, request.user, unit.items.filter(kind='phrase').order_by('position')))


@api_view(['GET'])
def daily_feature(request):
    lang = request.query_params.get('lang', request.user.lang)
    features = list(DailyFeature.objects.filter(lang=lang)) or list(DailyFeature.objects.filter(lang='twi'))
    if not features:
        raise ApiError('No feature for today.', 404)
    day_number = (timezone.localdate() - timezone.datetime(1970, 1, 1).date()).days
    f = features[day_number % len(features)]
    return Response({'kicker': f.kicker, 'local': f.local, 'english': f.english})
