"""
Accounts views — me endpoint, token refresh, logout.
"""
import structlog
from django.conf import settings
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from dj_rest_auth.views import LoginView

from .models import UserProfile
from .serializers import UserDetailSerializer, UserUpdateSerializer
from .throttles import LoginRateThrottle

logger = structlog.get_logger(__name__)


class MeView(RetrieveUpdateAPIView):
    """
    GET  /api/auth/me/  — returns current user details + profile.
    PATCH /api/auth/me/ — updates user name / profile fields.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UserUpdateSerializer
        return UserDetailSerializer

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token so it can no longer be used.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("user_logout", user_id=str(request.user.id))
            return Response({"detail": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as exc:
            logger.warning("logout_failed", error=str(exc))
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class MapboxTokenView(APIView):
    """
    GET /api/auth/mapbox-token/
    Returns the public (scoped) Mapbox token for frontend use.
    Never exposes the secret token.
    """

    def get(self, request):
        return Response({"token": settings.MAPBOX_PUBLIC_TOKEN})
