"""
Cities app — City model with PostGIS bounding box and center point.
"""
import uuid
from django.contrib.gis.db import models


class City(models.Model):
    """
    Represents a city where POA Eventos is available.

    Uses GeoDjango fields:
    - `bounding_box`: PolygonField defining the valid area for event pins.
    - `center`: PointField for the default map center.
    Both use SRID 4326 (WGS 84 — standard lat/lng).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    state = models.CharField(max_length=2, help_text="State abbreviation, e.g. RS")
    country = models.CharField(max_length=2, default="BR")
    bounding_box = models.PolygonField(
        srid=4326,
        help_text="Polygon defining the valid area for event pins in this city.",
    )
    center = models.PointField(
        srid=4326,
        help_text="Map center point (lat/lng) displayed when browsing this city.",
    )
    zoom_default = models.FloatField(default=13.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "City"
        verbose_name_plural = "Cities"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name}/{self.state}"
