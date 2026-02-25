"""
Events app — Category, Tag, Event, EventInteraction, EventHistory models.

All models use UUID PKs and timezone-aware datetimes (stored as UTC).
Event locations are stored as PostGIS PointField (SRID 4326).
"""
import uuid
from django.conf import settings
from django.contrib.gis.db import models
from django.utils import timezone


class Category(models.Model):
    """
    Event category with visual styling metadata.
    Pre-populated via the `seed_categories` management command.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    icon = models.CharField(
        max_length=50, help_text="Emoji or Mapbox icon name, e.g. '🎉' or 'music'"
    )
    color_hex = models.CharField(
        max_length=7, help_text="Hex color for map pin, e.g. #FF5733", default="#3B82F6"
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.icon} {self.name}"


class Tag(models.Model):
    """Free-form tag that can be attached to events."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=80, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class EventStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"


class Event(models.Model):
    """
    Core event model. Location stored as PostGIS PointField for spatial queries.

    Soft delete: set `deleted_at` instead of removing the row.
    Moderation: new users' events start as DRAFT until an admin publishes them.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Content
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    organizer_name = models.CharField(max_length=150)
    organizer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )

    # Classification
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="events")
    tags = models.ManyToManyField(Tag, blank=True, related_name="events")

    # Location (PostGIS)
    location = models.PointField(srid=4326, help_text="Event pin location (lng, lat)")
    address = models.CharField(max_length=255, blank=True, default="")
    neighborhood = models.CharField(max_length=100, blank=True, default="")
    city = models.ForeignKey("cities.City", on_delete=models.PROTECT, related_name="events")

    # Date/time
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True, blank=True)

    # Pricing
    is_free = models.BooleanField(default=True)
    price_info = models.CharField(max_length=200, blank=True, null=True)

    # External links
    instagram_url = models.URLField(blank=True, null=True)
    ticket_url = models.URLField(blank=True, null=True)

    # Media
    cover_image = models.ImageField(upload_to="events/covers/%Y/%m/", null=True, blank=True)

    # Attendance
    max_capacity = models.PositiveIntegerField(null=True, blank=True)

    # Recurrence (iCal RRULE)
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="iCal RRULE string, e.g. FREQ=WEEKLY;BYDAY=SA",
    )

    # Status / moderation
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.DRAFT,
        db_index=True,
    )
    is_verified = models.BooleanField(default=False, help_text="Verified by admin")

    # Analytics
    view_count = models.PositiveIntegerField(default=0)

    # Soft-delete
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ["start_datetime"]
        indexes = [
            models.Index(fields=["status", "start_datetime"]),
            models.Index(fields=["city", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.start_datetime:%Y-%m-%d})"

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self):
        """Mark event as deleted without removing from database."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])


class EventInteraction(models.Model):
    """
    Tracks user interactions with events: interested, going, saved, reported.
    Unique together on (user, event, interaction_type).
    """

    class InteractionType(models.TextChoices):
        INTERESTED = "INTERESTED", "Interested"
        GOING = "GOING", "Going"
        SAVED = "SAVED", "Saved"
        REPORTED = "REPORTED", "Reported"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_interactions",
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="interactions")
    interaction_type = models.CharField(
        max_length=20, choices=InteractionType.choices, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Event Interaction"
        verbose_name_plural = "Event Interactions"
        unique_together = [("user", "event", "interaction_type")]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} — {self.interaction_type} — {self.event.title}"


class EventHistory(models.Model):
    """
    Immutable audit log — JSON snapshot of Event fields stored after each edit.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="history")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="event_edits",
    )
    snapshot = models.JSONField(help_text="Full JSON snapshot of event fields at time of edit")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Event History"
        verbose_name_plural = "Event Histories"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"History #{self.id} — {self.event.title}"
