"""
Accounts URL configuration.

Auth endpoints:
  POST   /api/auth/register/
  POST   /api/auth/login/
  POST   /api/auth/logout/
  POST   /api/auth/token/refresh/
  GET    /api/auth/google/              — initiates Google OAuth
  GET    /api/auth/google/callback/     — Google OAuth callback
  GET    /api/auth/me/
  PATCH  /api/auth/me/
  GET    /api/auth/mapbox-token/
"""
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from dj_rest_auth.views import LoginView, PasswordResetView, PasswordResetConfirmView
from dj_rest_auth.registration.views import RegisterView, SocialLoginView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client

from .views import MeView, LogoutView, MapboxTokenView
from .throttles import LoginRateThrottle


class GoogleLogin(SocialLoginView):
    """Google OAuth2 JWT login endpoint."""

    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    callback_url = "http://localhost/api/auth/google/callback/"


urlpatterns = [
    # Standard auth
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(throttle_classes=[LoginRateThrottle]), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    # Profile
    path("me/", MeView.as_view(), name="auth-me"),
    # Google OAuth
    path("google/", GoogleLogin.as_view(), name="google-login"),
    # Mapbox token (public)
    path("mapbox-token/", MapboxTokenView.as_view(), name="mapbox-token"),
    # Password reset
    path("password/reset/", PasswordResetView.as_view(), name="password-reset"),
    path("password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
