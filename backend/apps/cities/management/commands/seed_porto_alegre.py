"""
Management command: seed_porto_alegre
Creates the City record for Porto Alegre with accurate bounding box and center.

Bounding box source: approximate POA city limits in WGS84.
Center: Largo do Açorianos (historical center area).
Usage: python manage.py seed_porto_alegre
"""
from django.contrib.gis.geos import Point, Polygon, GEOSGeometry
from django.core.management.base import BaseCommand



# IBGE code for Porto Alegre
POA_SOURCE_ID = "4314902"

# WKT polygon for Porto Alegre (approximate city limits, WGS84)
# Based on official city boundaries
POA_WKT = (
    "POLYGON(("
    "-51.27 -30.21, -51.27 -30.00, -51.05 -30.00, -51.05 -30.21, -51.27 -30.21"
    "))"
)

# Center: Largo do Açorianos / Centro Histórico of Porto Alegre
POA_CENTER_LNG = -51.2177
POA_CENTER_LAT = -30.0346


class Command(BaseCommand):
    help = "Seed Porto Alegre city data with accurate PostGIS geometry."

    def handle(self, *args, **options):
        from django.utils.text import slugify
        from apps.cities.models import City

        bounding_box = GEOSGeometry(POA_WKT, srid=4326)
        center = Point(POA_CENTER_LNG, POA_CENTER_LAT, srid=4326)

        city, created = City.objects.get_or_create(
            slug="porto-alegre",
            defaults={
                "name": "Porto Alegre",
                "state": "RS",
                "country": "BR",
                "source_id": POA_SOURCE_ID,
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
            # Update geometry and IBGE code if needed
            city.bounding_box = bounding_box
            city.center = center
            city.source_id = POA_SOURCE_ID
            city.save(update_fields=["bounding_box", "center", "source_id"])
            self.stdout.write(
                self.style.WARNING(
                    f"↺ Porto Alegre already exists (id={city.id}) — geometry and IBGE code updated."
                )
            )
