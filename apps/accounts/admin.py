from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['-created_at']
    list_display = ['name', 'email', 'role', 'status', 'lang', 'level_id', 'school', 'region', 'created_at']
    list_filter = ['role', 'status', 'lang', 'level_id', 'region', 'plan']
    search_fields = ['name', 'email', 'school']
    readonly_fields = ['created_at', 'last_active_at']
    fieldsets = (
        (None, {'fields': ('email', 'password', 'name')}),
        ('Kasa', {'fields': ('role', 'status', 'onboarded', 'lang', 'level_id', 'daily_goal', 'voice', 'plan')}),
        ('School and family', {'fields': ('school', 'region', 'guardian_email')}),
        ('Reminders', {'fields': ('reminder_enabled', 'reminder_channel', 'reminder_time')}),
        ('Access', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('created_at', 'last_active_at', 'last_login')}),
    )
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'name', 'role', 'password1', 'password2')}),)
