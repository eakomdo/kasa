from django.urls import path

from . import views

urlpatterns = [
    path('overview/', views.overview),
    path('reports/', views.reports),
    path('reports/<int:report_id>/resolve/', views.resolve_report),
    path('suggestions/', views.suggestions),
    path('suggestions/<int:suggestion_id>/review/', views.review_suggestion),
    path('users/', views.users),
    path('users/<uuid:user_id>/', views.user_detail),
    path('communities/', views.communities),
    path('communities/<str:community_id>/review/', views.review_community),
    path('communities/<str:community_id>/archive/', views.archive_community),
]
