from django.contrib import admin, messages
from django.utils import timezone

from .models import Suggestion, VerifiedTranslation


@admin.register(Suggestion)
class SuggestionAdmin(admin.ModelAdmin):
    list_display = ('query', 'suggestion', 'current_translation', 'lang', 'supporters', 'status', 'created_at')
    list_filter = ('status', 'lang')
    search_fields = ('query', 'suggestion')
    raw_id_fields = ('submitted_by', 'reviewed_by')
    actions = ['approve', 'reject']

    @admin.action(description='Approve: lookup shows it as teacher-checked')
    def approve(self, request, queryset):
        count = 0
        for s in queryset.filter(status='pending'):
            final = s.final_translation or s.suggestion
            VerifiedTranslation.objects.create(lang=s.lang, english=s.query, translation=final, source=s)
            s.status, s.final_translation = 'approved', final
            s.reviewed_by, s.reviewed_at = request.user, timezone.now()
            s.save()
            count += 1
        self.message_user(request, f'Approved {count} suggestion(s).', messages.SUCCESS)

    @admin.action(description='Reject')
    def reject(self, request, queryset):
        n = queryset.filter(status='pending').update(
            status='rejected', reviewed_by=request.user, reviewed_at=timezone.now()
        )
        self.message_user(request, f'Rejected {n} suggestion(s).', messages.SUCCESS)


@admin.register(VerifiedTranslation)
class VerifiedTranslationAdmin(admin.ModelAdmin):
    list_display = ('english', 'translation', 'lang', 'created_at')
    list_filter = ('lang',)
    search_fields = ('english', 'translation')
    raw_id_fields = ('source',)
