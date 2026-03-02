from django.urls import path
from .views import CityListView, CityDetailView, CityGeoView

urlpatterns = [
    path("", CityListView.as_view(), name="city-list"),
    path("<slug:slug>/", CityDetailView.as_view(), name="city-detail"),
    path("<slug:slug>/geo/", CityGeoView.as_view(), name="city-geo"),
]
