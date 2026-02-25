"""Custom middleware for POA Eventos."""


class SecurityHeadersMiddleware:
    """
    Injects security-related HTTP response headers on every response.

    Headers added:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Strict-Transport-Security (only on HTTPS)
    - Content-Security-Policy (restrictive default)
    - Referrer-Policy
    - Permissions-Policy
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"

        if request.is_secure():
            response["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content-Security-Policy — adjust per deployment
        response["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://api.mapbox.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://api.tiles.mapbox.com https://cdn.tailwindcss.com; "
            "img-src 'self' data: blob: https://*.mapbox.com https://*.amazonaws.com; "
            "connect-src 'self' https://api.mapbox.com https://events.mapbox.com wss://api.mapbox.com; "
            "worker-src blob:; "
            "frame-ancestors 'none';"
        )

        return response
