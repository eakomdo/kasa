from django.contrib import admin

from .models import Attempt, BadgeAward, DailyActivity, LeaderboardPeer, Progress


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'item', 'mastery', 'next_review_at', 'last_seen_at')
    list_filter = ('mastery', 'item__lang')
    search_fields = ('user__email', 'user__name', 'item__english', 'item__translation')
    raw_id_fields = ('user', 'item')
    list_select_related = ('user', 'item')


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    """Read-only answer log."""

    list_display = ('user', 'item', 'correct', 'mode', 'answered_at', 'mastery_after')
    list_filter = ('correct', 'mode')
    search_fields = ('user__email', 'item__id', 'client_id')
    list_select_related = ('user', 'item')
    date_hierarchy = 'answered_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(DailyActivity)
class DailyActivityAdmin(admin.ModelAdmin):
    list_display = ('user', 'day', 'count', 'xp')
    search_fields = ('user__email', 'user__name')
    date_hierarchy = 'day'
    raw_id_fields = ('user',)


@admin.register(BadgeAward)
class BadgeAwardAdmin(admin.ModelAdmin):
    list_display = ('user', 'badge', 'earned_at')
    list_filter = ('badge',)
    search_fields = ('user__email', 'user__name')
    raw_id_fields = ('user',)


@admin.register(LeaderboardPeer)
class LeaderboardPeerAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'school', 'region', 'lang', 'xp')
    list_filter = ('lang', 'region')
