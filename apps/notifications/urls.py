from django.urls import path

from . import views

urlpatterns = [
    path('notifications/', views.notification_list),
    path('notifications/read/', views.mark_read),
]
