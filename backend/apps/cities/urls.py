from django.urls import path
from .views import CityListView, CityDetailView

urlpatterns = [
    path("", CityListView.as_view(), name="city-list"),
    path("<slug:slug>/", CityDetailView.as_view(), name="city-detail"),
]
