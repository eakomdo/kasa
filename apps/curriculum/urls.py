from django.urls import path

from . import views

urlpatterns = [
    path('levels/<str:level_id>/units/', views.level_units),
    path('units/<str:unit_id>/', views.unit_detail),
    path('units/<str:unit_id>/vocabulary/', views.unit_vocabulary),
    path('units/<str:unit_id>/phrases/', views.unit_phrases),
    path('daily-feature/', views.daily_feature),
]
