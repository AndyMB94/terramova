import uuid

from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Earthquake(models.Model):
    """Evento publicado por una fuente. Fechas en UTC; magnitud y profundidad admiten nulo.

    `source_ids` guarda todos los identificadores que la fuente asocia al evento: el
    preferido (`external_id`) puede cambiar cuando la fuente fusiona detecciones.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=16)
    external_id = models.CharField(max_length=64)
    source_ids = ArrayField(models.CharField(max_length=64), default=list)
    occurred_at = models.DateTimeField()
    source_updated_at = models.DateTimeField()
    magnitude = models.FloatField(null=True, blank=True)
    magnitude_type = models.CharField(max_length=16, blank=True)
    longitude = models.FloatField()
    latitude = models.FloatField()
    depth_km = models.FloatField(null=True, blank=True)
    place = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=16, blank=True)
    event_type = models.CharField(max_length=32, blank=True)
    source_url = models.URLField(max_length=500, blank=True)
    ingested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField()

    class Meta:
        verbose_name = "sismo"
        verbose_name_plural = "sismos"
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"], name="earthquake_unique_source_external_id"
            ),
            models.CheckConstraint(
                condition=models.Q(latitude__gte=-90, latitude__lte=90),
                name="earthquake_latitude_range",
            ),
            models.CheckConstraint(
                condition=models.Q(longitude__gte=-180, longitude__lte=180),
                name="earthquake_longitude_range",
            ),
        ]
        indexes = [
            models.Index(fields=["occurred_at"], name="earthquake_occurred_at_idx"),
            models.Index(fields=["source_updated_at"], name="earthquake_updated_at_idx"),
            GinIndex(fields=["source_ids"], name="earthquake_source_ids_gin"),
        ]

    def __str__(self) -> str:
        return f"{self.source}:{self.external_id}"


class SyncRun(models.Model):
    """Registro de una ejecución de sincronización. No guarda contenido de la fuente."""

    class Status(models.TextChoices):
        RUNNING = "running", "En curso"
        SUCCEEDED = "succeeded", "Correcta"
        PARTIAL = "partial", "Correcta con rechazos"
        FAILED = "failed", "Fallida"

    SUCCESSFUL_STATUSES = (Status.SUCCEEDED, Status.PARTIAL)

    source = models.CharField(max_length=16)
    feed = models.CharField(max_length=16)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    window_start = models.DateTimeField(null=True, blank=True)
    window_end = models.DateTimeField(null=True, blank=True)
    source_generated_at = models.DateTimeField(null=True, blank=True)
    source_last_modified = models.CharField(max_length=64, blank=True)
    not_modified = models.BooleanField(default=False)
    received = models.PositiveIntegerField(default=0)
    created = models.PositiveIntegerField(default=0)
    updated = models.PositiveIntegerField(default=0)
    unchanged = models.PositiveIntegerField(default=0)
    merged = models.PositiveIntegerField(default=0)
    rejected = models.PositiveIntegerField(default=0)
    rejected_reasons = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=64, blank=True)

    class Meta:
        verbose_name = "sincronización"
        verbose_name_plural = "sincronizaciones"
        ordering = ["-started_at", "-id"]
        indexes = [
            models.Index(fields=["feed", "status", "-started_at"], name="syncrun_feed_status_idx")
        ]

    def __str__(self) -> str:
        return f"{self.source}/{self.feed} {self.started_at:%Y-%m-%d %H:%M} {self.status}"

    @property
    def changed_rows(self) -> int:
        return self.created + self.updated + self.merged
