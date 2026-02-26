"""Production settings — HTTPS enforced, strict security."""
from .base import *  # noqa
import environ

env = environ.Env()

DEBUG = False

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# Railway terminates SSL at the load balancer; trust the forwarded header
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Do NOT redirect HTTP→HTTPS inside Django — Railway's proxy already enforces
# it externally, and the internal healthcheck probe uses plain HTTP.
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True

# ----------------------------------------------------------------
# Database — Railway injects DATABASE_URL as postgresql://.
# dj-database-url is the Railway-recommended parser.
# Special chars in passwords (e.g. #) are percent-encoded before parsing.
# ----------------------------------------------------------------
import os as _os
import sys as _sys
from urllib.parse import urlparse as _up, quote as _quote, urlunparse as _unparse
import dj_database_url as _dj_db

_db_url = _os.environ.get("DATABASE_URL", "")
if _db_url:
    # Percent-encode password to handle special chars like # @ ? /
    try:
        _pu = _up(_db_url)
        if _pu.password:
            _encoded_pass = _quote(_pu.password, safe="")
            # Reconstruct netloc with encoded password
            _netloc = f"{_pu.username}:{_encoded_pass}@{_pu.hostname}"
            if _pu.port:
                _netloc += f":{_pu.port}"
            _db_url = _unparse((_pu.scheme, _netloc, _pu.path, _pu.params, _pu.query, _pu.fragment))
        _safe = f"{_pu.scheme}://{_pu.username}:***@{_pu.hostname}:{_pu.port}{_pu.path}"
    except Exception as _e:
        _safe = _db_url[:30] + "..."
        print(f"[settings] WARNING: could not re-encode DATABASE_URL: {_e}", file=_sys.stderr)

    print(f"[settings] DATABASE_URL detected: {_safe}", file=_sys.stderr)

    _parsed = _dj_db.parse(_db_url, conn_max_age=60, ssl_require=True)
    if not _parsed.get("NAME"):
        print(
            f"[settings] ERROR: dj-database-url could not parse NAME from: {_safe}",
            file=_sys.stderr,
        )
    else:
        DATABASES = {"default": _parsed}
        DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"
else:
    print(
        "[settings] WARNING: DATABASE_URL is empty — using base.py default (localhost). "
        "Set DATABASE_URL in Railway Variables.",
        file=_sys.stderr,
    )

# ----------------------------------------------------------------
# Static / Media — WhiteNoise (default) or S3
# ----------------------------------------------------------------

# WhiteNoise serves the frontend SPA at the web root
WHITENOISE_ROOT = BASE_DIR / "frontend"  # noqa
WHITENOISE_INDEX_FILE = True
WHITENOISE_MAX_AGE = 86400
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

USE_S3 = env.bool("USE_S3", default=False)

if USE_S3:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com")
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_DEFAULT_ACL = "public-read"

    STATICFILES_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    STATIC_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/static/"
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/media/"

# ----------------------------------------------------------------
# Logging — structured JSON for prod
# ----------------------------------------------------------------
LOGGING["handlers"]["console"]["formatter"] = "json_formatter"  # noqa
