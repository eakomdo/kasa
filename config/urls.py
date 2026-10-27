from importlib import import_module

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.schema import document


def _doc(module: str, tag: str):
    mod = import_module(module)
    document(mod.urlpatterns, tag)
    return module


api = [
    path('', include(_doc('apps.accounts.urls', 'accounts'))),
    path('', include(_doc('apps.curriculum.urls', 'curriculum'))),
    path('', include(_doc('apps.learning.urls', 'learning'))),
    path('', include(_doc('apps.translate.urls', 'translate'))),
    path('', include(_doc('apps.community.urls', 'community'))),
    path('', include(_doc('apps.notifications.urls', 'notifications'))),
    path('admin/', include(_doc('apps.staff.urls', 'community-admin'))),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('health/', include('apps.core.urls')),
]

urlpatterns = [
    # People who open the API in a browser land on the docs instead of a 404
    path('', RedirectView.as_view(url='/api/docs/', permanent=False)),
    path('docs/', RedirectView.as_view(url='/api/docs/', permanent=False)),
    path('django-admin/', admin.site.urls),
    path('api/', include(api)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = 'Kasa curriculum and moderation'
admin.site.site_title = 'Kasa admin'
