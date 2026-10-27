import uuid

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Notification


def serialize_notification(n: Notification) -> dict:
    return {
        'id': str(n.id),
        'kind': n.kind,
        'title': n.title,
        'body': n.body,
        'href': n.href,
        'created_at': n.created_at.isoformat(),
        'read': n.read,
    }


@api_view(['GET'])
def notification_list(request):
    mine = Notification.objects.filter(user=request.user)
    return Response(
        {
            'items': [serialize_notification(n) for n in mine.order_by('-created_at')[:50]],
            'unread_count': mine.filter(read=False).count(),
        }
    )


@api_view(['POST'])
def mark_read(request):
    """Body {ids: [...]} marks those read; an empty body marks everything read."""
    ids = request.data.get('ids') if isinstance(request.data, dict) else None
    qs = Notification.objects.filter(user=request.user, read=False)
    if isinstance(ids, list):
        qs = qs.filter(id__in=[i for i in ids if _is_uuid(i)])
    qs.update(read=True)
    return Response({'ok': True})


def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True
