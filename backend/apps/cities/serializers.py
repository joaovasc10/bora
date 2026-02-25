"""Cities serializers — GeoJSON-aware."""
from rest_framework_gis.serializers import GeoFeatureModelSerializer, GeometryField
from rest_framework import serializers
from .models import City


class CitySerializer(serializers.ModelSerializer):
    """Standard JSON serializer for City — includes center coordinates as plain object."""

    center_lng = serializers.SerializerMethodField()
    center_lat = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = [
            "id", "name", "slug", "state", "country",
            "zoom_default", "is_active", "center_lng", "center_lat",
        ]

    def get_center_lng(self, obj) -> float:
        return obj.center.x if obj.center else None

    def get_center_lat(self, obj) -> float:
        return obj.center.y if obj.center else None
