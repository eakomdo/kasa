from django.urls import path

from . import views

urlpatterns = [
    path('practice/next-batch/', views.next_batch),
    path('practice/attempt/', views.attempt),
    path('practice/deck/', views.add_to_deck),
    path('progress/summary/', views.progress_summary),
    path('leaderboard/', views.leaderboard),
]
