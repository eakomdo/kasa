from django.db import connection
from django.http import JsonResponse
from django.urls import path


def health(request):
    """Load-balancer health check: the app is up and the database answers."""
    with connection.cursor() as c:
        c.execute('SELECT 1')
    return JsonResponse({'ok': True})


urlpatterns = [path('', health, name='health')]
