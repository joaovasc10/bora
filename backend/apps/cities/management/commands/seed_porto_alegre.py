"""
Management command: seed_porto_alegre
Creates the City record for Porto Alegre with accurate bounding box and center.

Bounding box source: approximate POA city limits in WGS84.
Center: Largo do Açorianos (historical center area).
Usage: python manage.py seed_porto_alegre
"""
from django.contrib.gis.geos import Point, Polygon
from django.core.management.base import BaseCommand


# Porto Alegre bounding box (approximate city limits, WGS84)
# SW: -51.2700, -30.2330 — SE: -51.0540, -30.2330
# NE: -51.0540, -30.0069 — NW: -51.2700, -30.0069
POA_BBOX_COORDS = (
    (-51.2700, -30.2330),  # SW
    (-51.0540, -30.2330),  # SE
    (-51.0540, -30.0069),  # NE
    (-51.2700, -30.0069),  # NW
    (-51.2700, -30.2330),  # Close polygon
)

# Center: Largo do Açorianos / Centro Histórico of Porto Alegre
POA_CENTER_LNG = -51.2177
POA_CENTER_LAT = -30.0346


class Command(BaseCommand):
    help = "Seed Porto Alegre city data with accurate PostGIS geometry."

    def handle(self, *args, **options):
        from django.utils.text import slugify
        from apps.cities.models import City

        bounding_box = Polygon(POA_BBOX_COORDS, srid=4326)
        center = Point(POA_CENTER_LNG, POA_CENTER_LAT, srid=4326)

        city, created = City.objects.get_or_create(
            slug="porto-alegre",
            defaults={
                "name": "Porto Alegre",
                "state": "RS",
                "country": "BR",
                "bounding_box": bounding_box,
                "center": center,
                "zoom_default": 13.0,
                "is_active": True,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Porto Alegre created (id={city.id}).\n"
                    f"  Center: {POA_CENTER_LNG}, {POA_CENTER_LAT}\n"
                    f"  Default zoom: {city.zoom_default}"
                )
            )
        else:
            # Update geometry in case bounding box was refined
            city.bounding_box = bounding_box
            city.center = center
            city.save(update_fields=["bounding_box", "center"])
            self.stdout.write(
                self.style.WARNING(
                    f"↺ Porto Alegre already exists (id={city.id}) — geometry updated."
                )
            )
