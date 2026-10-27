from django.urls import path

from . import views

urlpatterns = [
    # Communities and memberships
    path('communities/', views.communities),
    path('communities/join-by-code/', views.join_by_code),
    path('communities/<str:community_id>/', views.community_detail),
    path('communities/<str:community_id>/join/', views.join),
    path('communities/<str:community_id>/leave/', views.leave),
    path('communities/<str:community_id>/members/', views.members),
    path('communities/<str:community_id>/requests/<uuid:user_id>/<str:decision>/', views.answer_request),
    path('communities/<str:community_id>/members/<uuid:user_id>/', views.member_role),
    path('communities/<str:community_id>/members/<uuid:user_id>/remove/', views.remove_member),
    path('communities/<str:community_id>/transfer/', views.transfer),
    path('communities/<str:community_id>/code/rotate/', views.rotate_code),
    # Discussions
    path('community/threads/', views.threads),
    path('community/threads/<uuid:thread_id>/', views.thread_detail),
    path('community/threads/<uuid:thread_id>/replies/', views.thread_reply),
    path('community/threads/<uuid:thread_id>/vote/', views.thread_vote),
    path('community/threads/<uuid:thread_id>/pin/', views.thread_pin),
    path('community/threads/<uuid:thread_id>/lock/', views.thread_lock),
    path('community/threads/<uuid:thread_id>/remove/', views.thread_remove),
    path('community/replies/<uuid:reply_id>/vote/', views.reply_vote),
    path('community/replies/<uuid:reply_id>/accept/', views.accept_reply),
    path('community/replies/<uuid:reply_id>/remove/', views.reply_remove),
    path('community/reports/', views.reports),
]
