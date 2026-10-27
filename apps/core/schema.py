"""
Make every function view visible in the OpenAPI docs (/api/docs/).

The precise request/response shapes are the Zod schemas in the web app
(src/shared/api/schemas.ts) and docs/api-contract.md; here each endpoint is
listed under its app's tag with a JSON body and response so the docs are
complete and browsable.
"""

import functools
import re

from django.urls import URLPattern, URLResolver
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema


def _copy(fn):
    """A distinct function object per method, so GET and PATCH on one view get separate docs."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper


def document(patterns, tag: str, prefix: str = ''):
    for p in patterns:
        if isinstance(p, URLResolver):
            document(p.url_patterns, tag, prefix + str(p.pattern))
        elif isinstance(p, URLPattern) and hasattr(p.callback, 'cls'):
            cls = p.callback.cls
            if getattr(cls, '_kasa_documented', False):
                continue
            for method in ('get', 'post', 'patch', 'put', 'delete'):
                handler = getattr(cls, method, None)
                if handler is None:
                    continue
                route = re.sub(r'[^a-z0-9]+', '_', (prefix + str(p.pattern)).lower()).strip('_')
                op_id = f'{tag}_{route}_{method}'
                setattr(
                    cls,
                    method,
                    extend_schema(
                        tags=[tag],
                        operation_id=op_id,
                        request=None if method in ('get', 'delete') else OpenApiTypes.OBJECT,
                        responses=OpenApiTypes.OBJECT,
                    )(_copy(handler)),
                )
            cls._kasa_documented = True
    return patterns
