from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("health/", include("core.health.urls")),
    path(settings.ADMIN_URL, admin.site.urls),
]
