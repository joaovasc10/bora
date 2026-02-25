"""
Events views — GeoJSON map endpoint, CRUD, interactions, search, nearby.
"""
import structlog
from django.contrib.gis.geos import Polygon, Point
from django.contrib.gis.measure import D
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.accounts.permissions import IsOwnerOrReadOnly
from .models import Category, Event, EventInteraction, EventStatus
from .serializers import (
    CategorySerializer,
    EventGeoSerializer,
    EventCreateUpdateSerializer,
    EventInteractionSerializer,
)
from .tasks import increment_view_count

logger = structlog.get_logger(__name__)


# ----------------------------------------------------------------
# Categories
# ----------------------------------------------------------------
class CategoryListView(ListAPIView):
    """GET /api/categories/ — all categories."""
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


# ----------------------------------------------------------------
# Events
# ----------------------------------------------------------------
class EventViewSet(ModelViewSet):
    """
    Full CRUD + extra actions for Event.
    list:   GET  /api/events/                 → GeoJSON FeatureCollection
    create: POST /api/events/
    retrieve: GET /api/events/{id}/
    partial_update: PATCH /api/events/{id}/
    destroy: DELETE /api/events/{id}/         → soft delete
    interact: POST /api/events/{id}/interact/
    mine: GET /api/events/mine/
    search: GET /api/events/search/
    nearby: GET /api/events/nearby/
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    pagination_class = None  # GeoJSON list is always unpaginated

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EventCreateUpdateSerializer
        return EventGeoSerializer

    def get_queryset(self):
        """Base queryset: only non-deleted, published events."""
        qs = (
            Event.objects.filter(
                deleted_at__isnull=True,
                status=EventStatus.PUBLISHED,
            )
            .select_related("category", "city")
            .prefetch_related("tags", "interactions")
            .order_by("-created_at")
        )

        city = self.request.query_params.get("city")
        if city:
            qs = qs.filter(city__slug=city)

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)

        is_free = self.request.query_params.get("is_free")
        if is_free in ("true", "1"):
            qs = qs.filter(is_free=True)
        elif is_free in ("false", "0"):
            qs = qs.filter(is_free=False)

        start_date = self.request.query_params.get("start_date")
        if start_date:
            try:
                qs = qs.filter(start_datetime__date__gte=start_date)
            except Exception:
                pass

        end_date = self.request.query_params.get("end_date")
        if end_date:
            try:
                qs = qs.filter(start_datetime__date__lte=end_date)
            except Exception:
                pass

        bbox = self.request.query_params.get("bbox")
        if bbox:
            try:
                min_lng, min_lat, max_lng, max_lat = map(float, bbox.split(","))
                bbox_polygon = Polygon.from_bbox((min_lng, min_lat, max_lng, max_lat))
                bbox_polygon.srid = 4326
                qs = qs.filter(location__within=bbox_polygon)
            except Exception:
                pass

        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(title__icontains=q) | qs.filter(description__icontains=q)

        return qs

    def list(self, request, *args, **kwargs):
        """Return a proper GeoJSON FeatureCollection (always unpaginated)."""
        try:
            qs = self.get_queryset()
            serializer = EventGeoSerializer(
                qs, many=True, context=self.get_serializer_context()
            )
            return Response(serializer.data)
        except Exception as exc:
            logger.exception("events_list_error", error=str(exc))
            return Response(
                {"type": "FeatureCollection", "features": []},
                status=status.HTTP_200_OK,
            )

    # -- Write operations --------------------------------------------------------

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Soft delete — sets deleted_at timestamp, never removes from DB."""
        event = self.get_object()
        event.deleted_at = timezone.now()
        event.save(update_fields=["deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, *args, **kwargs):
        """Increment view_count asynchronously on each view."""
        instance = self.get_object()
        try:
            increment_view_count.delay(str(instance.id))
        except Exception:
            pass
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    # -- Extra actions -----------------------------------------------------------

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        """GET /api/events/mine/ — eventos criados pelo usuário logado (DRAFT + PUBLISHED)."""
        qs = (
            Event.objects.filter(
                organizer_user=request.user,
                deleted_at__isnull=True,
            )
            .select_related("category", "city")
            .prefetch_related("tags", "interactions")
            .order_by("-created_at")
        )
        serializer = EventGeoSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def interact(self, request, pk=None):
        """
        POST /api/events/{id}/interact/
        Body: {"interaction_type": "GOING"}
        Toggle behaviour — creates or removes an interaction.
        """
        event = self.get_object()
        interaction_type = request.data.get("interaction_type")

        if interaction_type not in EventInteraction.InteractionType.values:
            return Response(
                {"detail": f"Invalid interaction_type. Choose from: {EventInteraction.InteractionType.values}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        interaction, created = EventInteraction.objects.get_or_create(
            user=request.user,
            event=event,
            interaction_type=interaction_type,
        )

        if not created:
            interaction.delete()
            return Response({"detail": f"{interaction_type} removed."}, status=status.HTTP_200_OK)

        # Auto-flag after 5 reports
        if interaction_type == EventInteraction.InteractionType.REPORTED:
            report_count = EventInteraction.objects.filter(
                event=event,
                interaction_type=EventInteraction.InteractionType.REPORTED,
            ).count()
            if report_count >= 5:
                event.status = EventStatus.DRAFT
                event.save(update_fields=["status"])
                logger.warning("event_auto_flagged", event_id=str(event.id), reports=report_count)

        serializer = EventInteractionSerializer(interaction)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="search")
    def search(self, request):
        """GET /api/events/search/?q=..."""
        qs = self.get_queryset()
        serializer = EventGeoSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="nearby")
    def nearby(self, request):
        """GET /api/events/nearby/?lat=&lng=&radius_km="""
        try:
            lat = float(request.query_params["lat"])
            lng = float(request.query_params["lng"])
            radius_km = float(request.query_params.get("radius_km", 5))
        except (KeyError, ValueError):
            return Response(
                {"detail": "Required: lat, lng. Optional: radius_km (default 5)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        center = Point(lng, lat, srid=4326)
        qs = (
            self.get_queryset()
            .filter(location__distance_lte=(center, D(km=radius_km)))
            .order_by("start_datetime")
        )
        serializer = EventGeoSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)