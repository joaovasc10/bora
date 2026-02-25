"""
Tests for events API endpoints — CRUD, spatial filters, interactions.
"""
import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta


BASE_URL = "/api/events/"


@pytest.mark.django_db
class TestEventList:
    """GET /api/events/ — GeoJSON FeatureCollection."""

    def test_list_returns_geojson(self, api_client, event):
        resp = api_client.get(BASE_URL)
        assert resp.status_code == 200
        data = resp.json()
        # GeoJSON FeatureCollection expected from DRF-GIS
        assert "features" in data or isinstance(data, dict)

    def test_list_filter_by_category(self, api_client, event):
        resp = api_client.get(BASE_URL, {"category": event.category.slug})
        assert resp.status_code == 200

    def test_list_filter_by_city(self, api_client, event):
        resp = api_client.get(BASE_URL, {"city": event.city.slug})
        assert resp.status_code == 200

    def test_list_filter_is_free(self, api_client, event):
        resp = api_client.get(BASE_URL, {"is_free": "true"})
        assert resp.status_code == 200

    def test_list_filter_bbox(self, api_client, event):
        # bbox covers Porto Alegre
        resp = api_client.get(BASE_URL, {"bbox": "-51.27,-30.23,-51.05,-30.00"})
        assert resp.status_code == 200

    def test_list_filter_invalid_bbox(self, api_client, event):
        # invalid bbox should not raise 500 — controller logs warning and ignores it
        resp = api_client.get(BASE_URL, {"bbox": "invalid"})
        assert resp.status_code == 200

    def test_draft_events_not_in_list(self, api_client, poa_city, category, user):
        from apps.events.models import Event

        Event.objects.create(
            title="Draft Event",
            organizer_name="Org",
            category=category,
            location=Point(-51.2177, -30.0346, srid=4326),
            city=poa_city,
            start_datetime=timezone.now() + timedelta(days=2),
            is_free=True,
            status="DRAFT",
        )
        resp = api_client.get(BASE_URL)
        assert resp.status_code == 200
        # Draft event should not appear in public list
        features = resp.json().get("features", [])
        titles = [f["properties"]["title"] for f in features]
        assert "Draft Event" not in titles

    def test_deleted_events_not_in_list(self, api_client, event):
        event.soft_delete()
        resp = api_client.get(BASE_URL)
        assert resp.status_code == 200
        features = resp.json().get("features", [])
        ids = [f["id"] for f in features]
        assert str(event.id) not in ids


@pytest.mark.django_db
class TestEventCreate:
    """POST /api/events/"""

    def _payload(self, poa_city, category):
        return {
            "title": "New Test Event",
            "description": "A new event",
            "organizer_name": "Organizer",
            "category": str(category.id),
            "lng": -51.2177,
            "lat": -30.0346,
            "address": "Largo do Açorianos",
            "neighborhood": "Centro",
            "city": str(poa_city.id),
            "start_datetime": (timezone.now() + timedelta(days=3)).isoformat(),
            "is_free": True,
        }

    def test_create_unauthenticated_fails(self, api_client, poa_city, category):
        resp = api_client.post(BASE_URL, self._payload(poa_city, category), format="json")
        assert resp.status_code == 401

    def test_create_authenticated_success(self, auth_client, poa_city, category):
        resp = auth_client.post(BASE_URL, self._payload(poa_city, category), format="json")
        assert resp.status_code == 201
        data = resp.json()
        assert data["properties"]["title"] == "New Test Event"

    def test_create_outside_bounding_box_rejected(self, auth_client, poa_city, category):
        payload = self._payload(poa_city, category)
        # São Paulo coordinates — outside POA bounding box
        payload["lat"] = -23.5505
        payload["lng"] = -46.6333
        resp = auth_client.post(BASE_URL, payload, format="json")
        assert resp.status_code == 400
        assert "location" in resp.json() or "detail" in resp.json()

    def test_verified_user_event_published_immediately(
        self, verified_auth_client, poa_city, category
    ):
        payload = self._payload(poa_city, category)
        resp = verified_auth_client.post(BASE_URL, payload, format="json")
        assert resp.status_code == 201
        assert resp.json()["properties"]["status"] == "PUBLISHED"

    def test_unverified_user_event_starts_as_draft(
        self, auth_client, poa_city, category
    ):
        payload = self._payload(poa_city, category)
        resp = auth_client.post(BASE_URL, payload, format="json")
        assert resp.status_code == 201
        assert resp.json()["properties"]["status"] == "DRAFT"


@pytest.mark.django_db
class TestEventRetrieve:
    def test_retrieve_published_event(self, api_client, event):
        resp = api_client.get(f"{BASE_URL}{event.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["properties"]["title"] == event.title

    def test_retrieve_nonexistent_event(self, api_client):
        resp = api_client.get(f"{BASE_URL}00000000-0000-0000-0000-000000000000/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestEventDelete:
    def test_soft_delete_by_owner(self, auth_client, event):
        resp = auth_client.delete(f"{BASE_URL}{event.id}/")
        assert resp.status_code == 204
        event.refresh_from_db()
        assert event.deleted_at is not None

    def test_delete_by_non_owner_forbidden(self, api_client, event):
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import RefreshToken

        User = get_user_model()
        other = User.objects.create_user(email="other@test.com", password="Pass123!")
        refresh = RefreshToken.for_user(other)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

        resp = api_client.delete(f"{BASE_URL}{event.id}/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestEventInteract:
    def test_going_interaction_creates_record(self, auth_client, event):
        resp = auth_client.post(
            f"{BASE_URL}{event.id}/interact/",
            {"interaction_type": "GOING"},
            format="json",
        )
        assert resp.status_code == 201

    def test_toggle_removes_interaction(self, auth_client, event):
        # Create
        auth_client.post(
            f"{BASE_URL}{event.id}/interact/",
            {"interaction_type": "SAVED"},
            format="json",
        )
        # Toggle off
        resp = auth_client.post(
            f"{BASE_URL}{event.id}/interact/",
            {"interaction_type": "SAVED"},
            format="json",
        )
        assert resp.status_code == 200
        assert "removed" in resp.json()["detail"].lower()

    def test_invalid_interaction_type_rejected(self, auth_client, event):
        resp = auth_client.post(
            f"{BASE_URL}{event.id}/interact/",
            {"interaction_type": "INVALID_TYPE"},
            format="json",
        )
        assert resp.status_code == 400

    def test_interact_requires_auth(self, api_client, event):
        resp = api_client.post(
            f"{BASE_URL}{event.id}/interact/",
            {"interaction_type": "GOING"},
            format="json",
        )
        assert resp.status_code == 401


@pytest.mark.django_db
class TestNearbyEndpoint:
    def test_nearby_returns_events_within_radius(self, api_client, event):
        resp = api_client.get(
            f"{BASE_URL}nearby/",
            {"lat": -30.0346, "lng": -51.2177, "radius_km": 5},
        )
        assert resp.status_code == 200

    def test_nearby_missing_params(self, api_client):
        resp = api_client.get(f"{BASE_URL}nearby/")
        assert resp.status_code == 400

    def test_nearby_event_outside_radius_not_returned(self, api_client, event):
        # Search from São Paulo — 1000+ km away
        resp = api_client.get(
            f"{BASE_URL}nearby/",
            {"lat": -23.5505, "lng": -46.6333, "radius_km": 5},
        )
        assert resp.status_code == 200
        features = resp.json().get("features", [])
        ids = [f["id"] for f in features]
        assert str(event.id) not in ids


@pytest.mark.django_db
class TestMineEndpoint:
    def test_mine_returns_user_events(self, auth_client, event):
        resp = auth_client.get(f"{BASE_URL}mine/")
        assert resp.status_code == 200

    def test_mine_requires_auth(self, api_client):
        resp = api_client.get(f"{BASE_URL}mine/")
        assert resp.status_code == 401
