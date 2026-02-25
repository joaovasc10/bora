"""
Events utility functions.
"""
import json
from typing import Optional


def save_event_snapshot(event, request=None) -> None:
    """
    Save a JSON snapshot of the current event state to EventHistory.
    Called before every update operation so changes are auditable.
    """
    from django.core.serializers.json import DjangoJSONEncoder
    from .models import EventHistory

    snapshot = {
        "title": event.title,
        "description": event.description,
        "organizer_name": event.organizer_name,
        "category_id": str(event.category_id),
        "address": event.address,
        "neighborhood": event.neighborhood,
        "city_id": str(event.city_id),
        "start_datetime": event.start_datetime.isoformat() if event.start_datetime else None,
        "end_datetime": event.end_datetime.isoformat() if event.end_datetime else None,
        "is_free": event.is_free,
        "price_info": event.price_info,
        "status": event.status,
        "is_verified": event.is_verified,
        "location": {
            "lng": event.location.x,
            "lat": event.location.y,
        } if event.location else None,
    }

    user = getattr(request, "user", None) if request else None

    EventHistory.objects.create(
        event=event,
        changed_by=user if user and user.is_authenticated else None,
        snapshot=json.loads(json.dumps(snapshot, cls=DjangoJSONEncoder)),
    )


def reverse_geocode(lng: float, lat: float) -> Optional[str]:
    """
    Perform reverse geocoding using the Mapbox Geocoding API.
    Returns the place_name string or None on failure.
    """
    import requests
    from django.conf import settings

    token = settings.MAPBOX_SECRET_TOKEN
    if not token:
        return None

    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"
    try:
        resp = requests.get(
            url,
            params={"access_token": token, "language": "pt", "types": "address,place"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        if features:
            return features[0].get("place_name", "")
    except Exception:
        pass
    return None
