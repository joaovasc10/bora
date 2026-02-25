"""Events Django admin — GIS-enabled admin for spatial field visualisation."""
from django.contrib.gis import admin
from django.utils import timezone
from .models import Category, Event, EventInteraction, EventHistory, Tag
from .tasks import notify_event_published


class EventHistoryInline(admin.TabularInline):
    model = EventHistory
    extra = 0
    readonly_fields = ["changed_by", "snapshot", "created_at"]
    can_delete = False


class EventInteractionInline(admin.TabularInline):
    model = EventInteraction
    extra = 0
    readonly_fields = ["user", "interaction_type", "created_at"]
    can_delete = False


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["icon", "name", "slug", "color_hex"]
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ["name", "slug"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ["name"]


@admin.register(Event)
class EventAdmin(admin.GISModelAdmin):
    list_display = [
        "title", "category", "city", "status", "is_verified", "is_free",
        "start_datetime", "view_count", "created_at",
    ]
    list_filter = ["status", "is_verified", "is_free", "category", "city"]
    search_fields = ["title", "organizer_name", "address"]
    readonly_fields = ["view_count", "created_at", "updated_at", "deleted_at"]
    raw_id_fields = ["organizer_user", "city", "category"]
    filter_horizontal = ["tags"]
    inlines = [EventInteractionInline, EventHistoryInline]
    actions = ["publish_events", "cancel_events"]

    @admin.action(description="Publish selected events")
    def publish_events(self, request, queryset):
        updated = 0
        for event in queryset.filter(status__in=["DRAFT", "CANCELLED"]):
            event.status = "PUBLISHED"
            event.save(update_fields=["status"])
            notify_event_published.delay(str(event.id))
            updated += 1
        self.message_user(request, f"{updated} event(s) published and organizers notified.")

    @admin.action(description="Cancel selected events")
    def cancel_events(self, request, queryset):
        count = queryset.update(status="CANCELLED")
        self.message_user(request, f"{count} event(s) cancelled.")


@admin.register(EventInteraction)
class EventInteractionAdmin(admin.ModelAdmin):
    list_display = ["user", "event", "interaction_type", "created_at"]
    list_filter = ["interaction_type"]
    raw_id_fields = ["user", "event"]
    readonly_fields = ["created_at"]
