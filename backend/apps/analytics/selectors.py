"""Agregados deterministas sobre el conjunto filtrado completo (nunca sobre una página
de la lista ni sobre los puntos truncados del mapa)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from django.db.models import Count, F, Max, Q
from django.db.models.functions import Trunc

from apps.analytics.domain import DEPTH_CLASSES, MAGNITUDE_BANDS, Band, Granularity
from apps.earthquakes.domain import EarthquakeFilters
from apps.earthquakes.selectors import filter_events


@dataclass(frozen=True)
class Strongest:
    id: UUID
    magnitude: float
    place: str
    occurred_at: datetime


@dataclass(frozen=True)
class Summary:
    total: int
    max_magnitude: float | None
    strongest: Strongest | None
    magnitude_counts: tuple[int, ...]  # en el orden de MAGNITUDE_BANDS
    magnitude_unknown: int
    depth_counts: tuple[int, ...]  # en el orden de DEPTH_CLASSES
    depth_unknown: int


@dataclass(frozen=True)
class BucketCount:
    count: int
    max_magnitude: float | None


def summarize(filters: EarthquakeFilters) -> Summary:
    """Conteo, máximo y distribuciones en una sola consulta agregada (más el evento máximo)."""
    events = filter_events(filters)
    aggregates = {
        "total": Count("pk"),
        "max_magnitude": Max("magnitude"),
        "magnitude_unknown": Count("pk", filter=Q(magnitude__isnull=True)),
        "depth_unknown": Count("pk", filter=Q(depth_km__isnull=True)),
    }
    for index, band in enumerate(MAGNITUDE_BANDS):
        aggregates[f"magnitude_{index}"] = Count("pk", filter=_in_band("magnitude", band))
    for index, band in enumerate(DEPTH_CLASSES):
        aggregates[f"depth_{index}"] = Count("pk", filter=_in_band("depth_km", band))
    row = events.aggregate(**aggregates)

    strongest_row = (
        events.filter(magnitude__isnull=False)
        .order_by(F("magnitude").desc(), "-occurred_at", "-pk")
        .values("id", "magnitude", "place", "occurred_at")
        .first()
    )
    strongest = None
    if strongest_row is not None and strongest_row["magnitude"] is not None:
        strongest = Strongest(
            id=strongest_row["id"],
            magnitude=strongest_row["magnitude"],
            place=strongest_row["place"],
            occurred_at=strongest_row["occurred_at"],
        )
    return Summary(
        total=row["total"],
        max_magnitude=row["max_magnitude"],
        strongest=strongest,
        magnitude_counts=tuple(row[f"magnitude_{i}"] for i in range(len(MAGNITUDE_BANDS))),
        magnitude_unknown=row["magnitude_unknown"],
        depth_counts=tuple(row[f"depth_{i}"] for i in range(len(DEPTH_CLASSES))),
        depth_unknown=row["depth_unknown"],
    )


def timeline(filters: EarthquakeFilters, granularity: Granularity) -> dict[datetime, BucketCount]:
    """Conteo y magnitud máxima por intervalo UTC. Solo intervalos con eventos: el
    relleno con ceros lo hace quien conoce la ventana completa."""
    rows = (
        filter_events(filters)
        .annotate(bucket=Trunc("occurred_at", granularity.value, tzinfo=UTC))
        .values("bucket")
        .annotate(count=Count("pk"), max_magnitude=Max("magnitude"))
        .order_by("bucket")
    )
    return {
        row["bucket"]: BucketCount(count=row["count"], max_magnitude=row["max_magnitude"])
        for row in rows
    }


def count(filters: EarthquakeFilters) -> int:
    return filter_events(filters).count()


def _in_band(field: str, band: Band) -> Q:
    condition = Q(**{f"{field}__isnull": False})
    if band.lower is not None:
        condition &= Q(**{f"{field}__gte": band.lower})
    if band.upper is not None:
        condition &= Q(**{f"{field}__lt": band.upper})
    return condition
