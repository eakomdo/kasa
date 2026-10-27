from django.contrib import admin

from .models import DailyFeature, Item, Unit


class ItemInline(admin.TabularInline):
    model = Item
    fields = ['id', 'kind', 'english', 'translation', 'audio', 'position']
    extra = 1
    ordering = ['kind', 'position']


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    """Where the curriculum team writes units. Mark a unit 'verified' only after native-speaker sign-off."""

    list_display = ['id', 'title_local', 'title_en', 'lang', 'bands', 'order', 'content_status']
    list_filter = ['lang', 'content_status', 'strand']
    list_editable = ['order', 'content_status']
    search_fields = ['id', 'title_local', 'title_en']
    inlines = [ItemInline]


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'translation', 'english', 'lang', 'kind', 'unit', 'has_recording']
    list_filter = ['lang', 'kind', 'unit']
    search_fields = ['english', 'translation', 'id']

    @admin.display(boolean=True, description='Recording')
    def has_recording(self, obj):
        return bool(obj.audio)


@admin.register(DailyFeature)
class DailyFeatureAdmin(admin.ModelAdmin):
    list_display = ['local', 'english', 'lang', 'kicker', 'order']
    list_filter = ['lang']
