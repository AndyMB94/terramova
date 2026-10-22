from django.urls import path

from apps.earthquakes.api.views import (
    EarthquakeDetailView,
    EarthquakeGeoJsonView,
    EarthquakeListView,
    MetaView,
)

urlpatterns = [
    path("earthquakes/", EarthquakeListView.as_view(), name="earthquakes-list"),
    path("earthquakes/geojson/", EarthquakeGeoJsonView.as_view(), name="earthquakes-geojson"),
    path("earthquakes/<uuid:event_id>/", EarthquakeDetailView.as_view(), name="earthquakes-detail"),
    path("meta/", MetaView.as_view(), name="meta"),
]
