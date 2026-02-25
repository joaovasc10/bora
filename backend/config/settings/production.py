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
# Database — Railway injects DATABASE_URL as postgresql://, GeoDjango
# requires the postgis:// scheme.  Re-write it here before Django uses it.
# ----------------------------------------------------------------
_raw_db = env("DATABASE_URL", default="")
if _raw_db and not _raw_db.startswith("postgis://"):
    _raw_db = _raw_db.replace("postgresql://", "postgis://", 1).replace("postgres://", "postgis://", 1)

if _raw_db:
    DATABASES = {"default": env.db_url_config(_raw_db)}
    DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"

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
