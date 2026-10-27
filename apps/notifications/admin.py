from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'kind', 'title', 'read', 'created_at')
    list_filter = ('kind', 'read')
    search_fields = ('user__email', 'title', 'body')
    raw_id_fields = ('user',)
    date_hierarchy = 'created_at'
