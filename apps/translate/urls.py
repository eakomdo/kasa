from django.urls import path

from . import views

urlpatterns = [
    path('translate/lookup/', views.lookup),
    path('translate/suggestions/', views.suggest),
    path('tts/', views.tts),
]
