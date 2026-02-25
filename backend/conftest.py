"""
Pytest fixtures shared across the entire test suite.
"""
import pytest
from django.contrib.gis.geos import Point, Polygon
from rest_framework.test import APIClient


# ----------------------------------------------------------------
# Factories (factory_boy)
# ----------------------------------------------------------------
@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def poa_city(db):
    """Porto Alegre City fixture with valid PostGIS geometry."""
    from apps.cities.models import City

    bbox = Polygon(
        (
            (-51.27, -30.23),
            (-51.05, -30.23),
            (-51.05, -30.00),
            (-51.27, -30.00),
            (-51.27, -30.23),
        ),
        srid=4326,
    )
    center = Point(-51.2177, -30.0346, srid=4326)

    city, _ = City.objects.get_or_create(
        slug="porto-alegre",
        defaults={
            "name": "Porto Alegre",
            "state": "RS",
            "country": "BR",
            "bounding_box": bbox,
            "center": center,
            "zoom_default": 13.0,
            "is_active": True,
        },
    )
    return city


@pytest.fixture
def category(db):
    """Return or create a test Category."""
    from apps.events.models import Category

    cat, _ = Category.objects.get_or_create(
        slug="show-musica",
        defaults={
            "name": "Show / Música ao Vivo",
            "icon": "🎵",
            "color_hex": "#3B82F6",
            "description": "Shows e apresentações musicais.",
        },
    )
    return cat


@pytest.fixture
def user(db):
    """Plain authenticated user."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    u = User.objects.create_user(
        email="test@example.com",
        password="TestPass123!",
        first_name="Test",
        last_name="User",
    )
    return u


@pytest.fixture
def verified_user(db):
    """User with verified organizer status in their profile."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    u = User.objects.create_user(
        email="verified@example.com",
        password="TestPass123!",
    )
    u.profile.is_verified = True
    u.profile.save()
    return u


@pytest.fixture
def auth_client(api_client, user):
    """APIClient with JWT authentication for a regular user."""
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def verified_auth_client(api_client, verified_user):
    """APIClient with JWT authentication for a verified organizer."""
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(verified_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def event(db, poa_city, category, user):
    """Published event located inside Porto Alegre's bounding box."""
    from django.utils import timezone
    from datetime import timedelta
    from apps.events.models import Event

    return Event.objects.create(
        title="Test Show",
        description="A great test show",
        organizer_name="Test Organizer",
        organizer_user=user,
        category=category,
        location=Point(-51.2177, -30.0346, srid=4326),
        address="Rua Teste, 100 — Centro, Porto Alegre",
        neighborhood="Centro",
        city=poa_city,
        start_datetime=timezone.now() + timedelta(days=1),
        end_datetime=timezone.now() + timedelta(days=1, hours=3),
        is_free=True,
        status="PUBLISHED",
    )
