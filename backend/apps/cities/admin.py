from django.contrib.gis import admin
from .models import City


@admin.register(City)
class CityAdmin(admin.GISModelAdmin):
    list_display = ["name", "state", "country", "zoom_default", "is_active"]
    list_filter = ["is_active", "state", "country"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
