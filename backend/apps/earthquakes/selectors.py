from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from django.db.models import F, Q, QuerySet

from apps.earthquakes.domain import (
    MAX_MAP_POINTS,
    Coverage,
    EarthquakeFilters,
    EventNotFound,
    Ordering,
)
from apps.earthquakes.models import Earthquake, SyncRun
from apps.earthquakes.ports import Feed
from core.api.pagination import KeysetPage, paginate_keyset
from core.cache import safe_get, safe_set

# La cobertura útil nunca va más allá de 31 días antes de su final; con un margen de
# un periodo mensual basta para encontrar la sincronización que la abre.
COVERAGE_LOOKBACK = timedelta(days=62)
COVERAGE_CACHE_TIMEOUT = 600


def last_successful_sync(feed: Feed | None = None) -> SyncRun | None:
    runs = SyncRun.objects.filter(status__in=SyncRun.SUCCESSFUL_STATUSES)
    if feed is not None:
        runs = runs.filter(feed=feed)
    return runs.order_by("-started_at", "-id").first()


def current_data_version() -> int:
    """Identificador de la última sincronización que cambió filas (0 si ninguna).

    Las cachés de la API lo usan en sus claves: cambia solo cuando cambian los datos,
    así que no hay que purgar nada.
    """
    run = (
        SyncRun.objects.filter(status__in=SyncRun.SUCCESSFUL_STATUSES)
        .exclude(created=0, updated=0, merged=0)
        .order_by("-id")
        .only("id")
        .first()
    )
    return run.id if run else 0


@dataclass(frozen=True)
class DataState:
    data_version: int
    coverage: Coverage | None


def get_data_state() -> DataState:
    """Versión de datos y cobertura. La cobertura se cachea por última sincronización."""
    latest = last_successful_sync()
    if latest is None:
        return DataState(current_data_version(), None)

    key = f"earthquakes:coverage:{latest.pk}"
    cached = safe_get(key)
    if isinstance(cached, Coverage):
        coverage: Coverage | None = cached
    else:
        coverage = compute_coverage(latest.started_at)
        safe_set(key, coverage, COVERAGE_CACHE_TIMEOUT)
    return DataState(current_data_version(), coverage)


def compute_coverage(until: datetime) -> Coverage | None:
    """Une las ventanas de las sincronizaciones correctas y devuelve el tramo continuo
    que termina en la más reciente. Un hueco (scheduler detenido) corta la cobertura.

    Un 304 confirma que el feed seguía igual en `started_at`, así que cubre
    [started_at - periodo, started_at].
    """
    runs = SyncRun.objects.filter(
        status__in=SyncRun.SUCCESSFUL_STATUSES, started_at__gte=until - COVERAGE_LOOKBACK
    ).values_list("feed", "started_at", "finished_at", "not_modified", "window_start", "window_end")

    intervals: list[tuple[datetime, datetime]] = []
    last_finished: datetime | None = None
    for feed, started_at, finished_at, not_modified, window_start, window_end in runs:
        if finished_at is not None and (last_finished is None or finished_at > last_finished):
            last_finished = finished_at
        if not_modified:
            intervals.append((started_at - Feed(feed).period, started_at))
        elif window_start is not None and window_end is not None:
            intervals.append((window_start, window_end))

    if not intervals or last_finished is None:
        return None

    intervals.sort(key=lambda interval: interval[1], reverse=True)
    start, end = intervals[0]
    for interval_start, interval_end in intervals[1:]:
        if interval_end < start:
            break
        start = min(start, interval_start)
    return Coverage(start=start, end=end, last_successful_sync_at=last_finished)


def filter_events(filters: EarthquakeFilters) -> QuerySet[Earthquake]:
    events = Earthquake.objects.filter(
        occurred_at__gte=filters.window.start, occurred_at__lt=filters.window.end
    )
    if filters.event_type is not None:
        events = events.filter(event_type=filters.event_type)
    if filters.min_magnitude is not None:
        events = events.filter(magnitude__gte=filters.min_magnitude)
    if filters.max_magnitude is not None:
        events = events.filter(magnitude__lte=filters.max_magnitude)
    if filters.min_depth_km is not None:
        events = events.filter(depth_km__gte=filters.min_depth_km)
    if filters.max_depth_km is not None:
        events = events.filter(depth_km__lte=filters.max_depth_km)
    if filters.bbox is not None:
        box = filters.bbox
        events = events.filter(latitude__gte=box.south, latitude__lte=box.north)
        if box.crosses_antimeridian:
            events = events.filter(Q(longitude__gte=box.west) | Q(longitude__lte=box.east))
        else:
            events = events.filter(longitude__gte=box.west, longitude__lte=box.east)
    return events


def list_events(
    filters: EarthquakeFilters, *, ordering: Ordering, page_size: int, cursor: str | None
) -> KeysetPage[Earthquake]:
    if ordering is Ordering.MAGNITUDE:
        return paginate_keyset(
            filter_events(filters),
            field="magnitude",
            page_size=page_size,
            cursor=cursor,
            parse_value=_parse_float,
            dump_value=lambda value: value,
        )
    return paginate_keyset(
        filter_events(filters),
        field="occurred_at",
        page_size=page_size,
        cursor=cursor,
        parse_value=datetime.fromisoformat,
        dump_value=lambda value: value.isoformat(),
    )


@dataclass(frozen=True)
class MapPoints:
    points: Sequence[Mapping[str, Any]]
    total_matching: int

    @property
    def truncated(self) -> bool:
        return self.total_matching > len(self.points)


def map_points(filters: EarthquakeFilters, *, limit: int = MAX_MAP_POINTS) -> MapPoints:
    """Puntos para el mapa; si superan el límite se priorizan los de mayor magnitud."""
    events = filter_events(filters)
    rows = list(
        events.order_by(F("magnitude").desc(nulls_last=True), "-occurred_at", "-pk").values(
            "id", "longitude", "latitude", "magnitude", "depth_km", "occurred_at", "place"
        )[:limit]
    )
    total = len(rows) if len(rows) < limit else events.count()
    return MapPoints(points=rows, total_matching=total)


def get_event(event_id: UUID) -> Earthquake:
    try:
        return Earthquake.objects.get(pk=event_id)
    except Earthquake.DoesNotExist as exc:
        raise EventNotFound from exc


def _parse_float(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("valor de cursor no numérico")
    return float(value)
