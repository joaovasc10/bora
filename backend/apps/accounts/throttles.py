"""Custom DRF throttle classes."""
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limit login attempts to 5 per minute per IP."""

    scope = "login"
    rate = "5/min"
