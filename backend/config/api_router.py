"""Agrega las rutas públicas de cada app bajo /api/v1/."""

from django.urls import include, path

urlpatterns = [
    path("", include("apps.earthquakes.api.urls")),
    path("", include("apps.analytics.api.urls")),
]
