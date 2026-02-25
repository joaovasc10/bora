"""Development settings — DEBUG on, no HTTPS enforcement."""
from .base import *  # noqa

DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ["*"]

# CORS: allow all origins in dev
CORS_ALLOW_ALL_ORIGINS = True

# Django Debug Toolbar (optional — install separately if needed)
# INSTALLED_APPS += ["debug_toolbar"]

# Simpler email in dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Relaxed security headers for local development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
