"""
Events serializers — GeoJSON FeatureCollection output for map consumption.
"""
import magic
import io
from PIL import Image
from django.conf import settings
from django.contrib.gis.geos import Point
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from apps.cities.models import City
from apps.cities.serializers import CitySerializer
from .models import Category, Event, EventInteraction, Tag


# ----------------------------------------------------------------
# Category
# ----------------------------------------------------------------
class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category — icon and color for frontend rendering."""

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "icon", "color_hex", "description"]


# ----------------------------------------------------------------
# Tag
# ----------------------------------------------------------------
class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


# ----------------------------------------------------------------
# Event (GeoJSON)
# ----------------------------------------------------------------
class EventGeoSerializer(GeoFeatureModelSerializer):
    """
    GeoJSON FeatureCollection serializer for Event.
    Used in list / map endpoints.
    Properties include all display fields; geometry is the `location` PointField.
    """

    id = serializers.UUIDField(read_only=True)
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    city = CitySerializer(read_only=True)
    interaction_counts = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Event
        geo_field = "location"
        fields = [
            "id",
            "title",
            "description",
            "organizer_name",
            "category",
            "tags",
            "location",
            "address",
            "neighborhood",
            "city",
            "start_datetime",
            "end_datetime",
            "is_free",
            "price_info",
            "instagram_url",
            "ticket_url",
            "cover_image_url",
            "max_capacity",
            "is_recurring",
            "status",
            "is_verified",
            "view_count",
            "interaction_counts",
            "created_at",
        ]

    def get_interaction_counts(self, obj) -> dict:
        qs = obj.interactions.values("interaction_type")
        counts = {}
        for row in qs:
            it = row["interaction_type"]
            counts[it] = counts.get(it, 0) + 1
        return counts

    def get_cover_image_url(self, obj) -> str | None:
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.cover_image.url)
        return obj.cover_image.url


class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating/updating events.
    Accepts `lng` + `lat` and builds a PostGIS Point; validates bounding box.
    Also handles cover image upload with MIME validation and resize.
    """

    lng = serializers.FloatField(write_only=True)
    lat = serializers.FloatField(write_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=60),
        required=False,
        write_only=True,
        allow_empty=True,
    )
    cover_image = serializers.ImageField(required=False, allow_null=True)

    def to_internal_value(self, data):
        """Handle tag_names sent as a JSON string from FormData."""
        import json
        mutable = data.copy() if hasattr(data, "copy") else dict(data)
        raw_tags = mutable.get("tag_names")
        if isinstance(raw_tags, str):
            try:
                parsed = json.loads(raw_tags)
                if isinstance(parsed, list):
                    mutable.setlist("tag_names", parsed) if hasattr(mutable, "setlist") else mutable.update({"tag_names": parsed})
            except (json.JSONDecodeError, AttributeError):
                pass
        return super().to_internal_value(mutable)

    class Meta:
        model = Event
        fields = [
            "title", "description", "organizer_name",
            "category", "tag_names",
            "lng", "lat",
            "address", "neighborhood", "city",
            "start_datetime", "end_datetime",
            "is_free", "price_info",
            "instagram_url", "ticket_url",
            "cover_image", "max_capacity",
            "is_recurring", "recurrence_rule",
        ]

    def validate_cover_image(self, image):
        """Validate MIME type (not just extension) and enforce 5 MB limit."""
        if image is None:
            return image
        if image.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(
                f"Image too large. Maximum size is {settings.MAX_UPLOAD_SIZE // (1024*1024)} MB."
            )
        # Read header bytes for MIME detection
        header = image.read(2048)
        image.seek(0)
        mime = magic.from_buffer(header, mime=True)
        if mime not in settings.ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError(
                f"Unsupported image type: {mime}. Allowed: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
            )
        return image

    def validate(self, data):
        """Build the PostGIS Point from lat/lng. Bounding-box check is advisory only."""
        lng = data.get("lng")
        lat = data.get("lat")
        city = data.get("city")

        if lng is not None and lat is not None:
            point = Point(lng, lat, srid=4326)
            data["location"] = point

            # Bounding-box validation — skip if bbox not configured
            if city is not None and getattr(city, "bounding_box", None):
                try:
                    if not city.bounding_box.contains(point):
                        raise serializers.ValidationError(
                            {
                                "location": (
                                    f"As coordenadas estão fora da área válida para {city.name}."
                                )
                            }
                        )
                except (AttributeError, Exception) as exc:
                    # bbox check error is non-fatal — log and continue
                    import logging
                    logging.getLogger(__name__).warning("bbox_check_failed: %s", exc)

        return data

    def _resize_image(self, image, max_size=(1920, 1080)):
        """Resize uploaded image to max dimensions using Pillow, preserving aspect ratio."""
        img = Image.open(image)
        img.thumbnail(max_size, Image.LANCZOS)
        output = io.BytesIO()
        fmt = img.format or "JPEG"
        img.save(output, format=fmt, quality=85, optimize=True)
        output.seek(0)
        image.file = output
        return image

    def create(self, validated_data):
        tag_names = validated_data.pop("tag_names", [])
        validated_data.pop("lng", None)
        validated_data.pop("lat", None)
        cover_image = validated_data.get("cover_image")
        if cover_image:
            validated_data["cover_image"] = self._resize_image(cover_image)

        request = self.context.get("request")
        user = request.user if request else None

        # Publish immediately — admins can moderate via admin panel if needed
        event_status = "PUBLISHED"

        event = Event.objects.create(
            **validated_data,
            organizer_user=user,
            status=event_status,
        )

        # Resolve or create tags
        for tag_name in tag_names:
            from django.utils.text import slugify
            slug = slugify(tag_name)
            tag, _ = Tag.objects.get_or_create(slug=slug, defaults={"name": tag_name})
            event.tags.add(tag)

        return event

    def update(self, instance, validated_data):
        tag_names = validated_data.pop("tag_names", None)
        validated_data.pop("lng", None)
        validated_data.pop("lat", None)

        cover_image = validated_data.get("cover_image")
        if cover_image:
            validated_data["cover_image"] = self._resize_image(cover_image)

        # Save history snapshot before mutation
        from .utils import save_event_snapshot
        save_event_snapshot(instance, self.context.get("request"))

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tag_names is not None:
            instance.tags.clear()
            for tag_name in tag_names:
                from django.utils.text import slugify
                slug = slugify(tag_name)
                tag, _ = Tag.objects.get_or_create(slug=slug, defaults={"name": tag_name})
                instance.tags.add(tag)

        return instance


class EventInteractionSerializer(serializers.ModelSerializer):
    """Serializer for creating/reading EventInteraction records."""

    class Meta:
        model = EventInteraction
        fields = ["id", "interaction_type", "created_at"]
        read_only_fields = ["id", "created_at"]
