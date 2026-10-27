from rest_framework.response import Response


def paginate(request, items, default_size: int = 20):
    """Page/pageSize pagination returning {items, total, page, pageSize}."""
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        size = min(100, max(1, int(request.query_params.get('pageSize', default_size))))
    except ValueError:
        page, size = 1, default_size
    total = items.count() if hasattr(items, 'count') and not isinstance(items, list) else len(items)
    start = (page - 1) * size
    return {'items': list(items[start : start + size]), 'total': total, 'page': page, 'page_size': size}


def page_response(request, queryset, serialize, default_size: int = 20):
    page = paginate(request, queryset, default_size)
    page['items'] = [serialize(x) for x in page['items']]
    return Response(page)
