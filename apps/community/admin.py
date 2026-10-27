from django.contrib import admin

from .models import Community, Membership, ModerationLog, Reply, Report, Thread


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ['user']
    fields = ['user', 'role', 'status', 'joined_at', 'requested_at', 'request_note']


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ['name', 'kind', 'status', 'join_policy', 'official', 'lang', 'created_by', 'created_at']
    list_filter = ['status', 'kind', 'official', 'join_policy', 'lang']
    search_fields = ['id', 'name', 'school', 'region']
    readonly_fields = ['created_at']
    autocomplete_fields = ['created_by', 'reviewed_by']
    inlines = [MembershipInline]


class ReplyInline(admin.StackedInline):
    model = Reply
    extra = 0
    autocomplete_fields = ['author']
    fields = ['author', 'body', 'status', 'created_at', 'base_score']


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ['title', 'community', 'author', 'status', 'pinned', 'locked', 'created_at']
    list_filter = ['status', 'pinned', 'locked', 'community']
    search_fields = ['title', 'body']
    autocomplete_fields = ['author', 'community']
    raw_id_fields = ['accepted_reply']
    inlines = [ReplyInline]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['reason', 'target_type', 'target_id', 'reporter', 'status', 'action', 'created_at']
    list_filter = ['status', 'reason', 'target_type']
    search_fields = ['note', 'resolution', 'target_id']
    autocomplete_fields = ['reporter', 'resolved_by']


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    """Audit trail: read-only, even for superusers."""

    list_display = ['created_at', 'actor', 'action', 'target_type', 'target_id', 'note']
    list_filter = ['action', 'target_type']
    search_fields = ['target_id', 'note']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
