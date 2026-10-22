from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from apps.earthquakes.models import Earthquake, SyncRun


class ReadOnlyAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Los datos solo cambian por sincronización; el admin es para consulta."""

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(Earthquake)
class EarthquakeAdmin(ReadOnlyAdmin):
    list_display = ["external_id", "occurred_at", "magnitude", "magnitude_type", "place", "status"]
    list_filter = ["status", "event_type", "source"]
    search_fields = ["external_id", "place"]
    date_hierarchy = "occurred_at"
    ordering = ["-occurred_at"]


@admin.register(SyncRun)
class SyncRunAdmin(ReadOnlyAdmin):
    list_display = [
        "started_at",
        "feed",
        "status",
        "received",
        "created",
        "updated",
        "merged",
        "rejected",
        "error_code",
    ]
    list_filter = ["feed", "status"]
