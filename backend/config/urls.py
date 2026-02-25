"""POA Eventos — root URL configuration."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def health_check(request):
    """Minimal health endpoint used by Railway's healthcheck probe."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check),
    path("admin/", admin.site.urls),
    # API
    path("api/auth/", include("apps.accounts.urls")),
    path("api/events/", include("apps.events.urls")),
    path("api/categories/", include("apps.events.category_urls")),
    path("api/cities/", include("apps.cities.urls")),
    # allauth (social)
    path("accounts/", include("allauth.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
