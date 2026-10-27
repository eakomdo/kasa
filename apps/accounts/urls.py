from django.urls import path

from . import views

urlpatterns = [
    path('auth/login/', views.login),
    path('auth/register/', views.register),
    path('auth/logout/', views.logout),
    path('me/', views.me),
]
