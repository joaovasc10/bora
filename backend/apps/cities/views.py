"""Cities views."""
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from .models import City
from .serializers import CitySerializer


class CityListView(ListAPIView):
    """GET /api/cities/ — list of active cities."""

    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    queryset = City.objects.filter(is_active=True).order_by("name")


class CityDetailView(RetrieveAPIView):
    """GET /api/cities/{slug}/ — single city by slug."""

    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    queryset = City.objects.filter(is_active=True)
    lookup_field = "slug"
