"""Reglas de consulta pública: límites, ventana temporal, área y filtros. Sin ORM."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

from core.exceptions import DomainError

MAX_WINDOW = timedelta(days=31)
DEFAULT_WINDOW = timedelta(days=7)
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100
MAX_MAP_POINTS = 5000
DEFAULT_EVENT_TYPE = "earthquake"
ALL_EVENT_TYPES = "all"
# La sincronización diaria corre cada 2-5 min: más de 15 min sin éxito es un retraso.
STALE_AFTER = timedelta(minutes=15)


class InvalidFilters(DomainError):
    code = "invalid_filters"
    status_code = 400
    default_message = "Los filtros no son válidos."


class EventNotFound(DomainError):
    code = "event_not_found"
    status_code = 404
    default_message = "El evento no existe."


class Ordering(StrEnum):
    RECENT = "-occurred_at"
    MAGNITUDE = "-magnitude"


@dataclass(frozen=True)
class Window:
    """Intervalo temporal semiabierto [start, end) en UTC."""

    start: datetime
    end: datetime


@dataclass(frozen=True)
class Coverage:
    """Tramo continuo de tiempo que las sincronizaciones correctas cubren."""

    start: datetime
    end: datetime
    last_successful_sync_at: datetime


@dataclass(frozen=True)
class BBox:
    west: float
    south: float
    east: float
    north: float

    @property
    def crosses_antimeridian(self) -> bool:
        return self.west > self.east


@dataclass(frozen=True)
class EarthquakeFilters:
    window: Window
    event_type: str | None  # None: todos los tipos; el valor por defecto lo fija la API
    min_magnitude: float | None = None
    max_magnitude: float | None = None
    min_depth_km: float | None = None
    max_depth_km: float | None = None
    bbox: BBox | None = None

    def canonical(self) -> dict[str, object]:
        """Representación estable para claves de caché y ETag."""
        return {
            "start": self.window.start.isoformat(),
            "end": self.window.end.isoformat(),
            "min_magnitude": self.min_magnitude,
            "max_magnitude": self.max_magnitude,
            "min_depth_km": self.min_depth_km,
            "max_depth_km": self.max_depth_km,
            "bbox": None
            if self.bbox is None
            else [self.bbox.west, self.bbox.south, self.bbox.east, self.bbox.north],
            "event_type": self.event_type,
        }


def resolve_window(
    start: datetime | None, end: datetime | None, coverage: Coverage | None
) -> Window | None:
    """Ventana efectiva: la pedida (o la de por defecto) recortada a la cobertura real.

    Sin fechas se usan los últimos DEFAULT_WINDOW hasta el final de la cobertura (no
    hasta "ahora"): así la respuesta es estable entre sincronizaciones y cacheable.
    Devuelve None si no hay cobertura o la intersección queda vacía.
    """
    if start is not None and end is not None and start >= end:
        raise InvalidFilters("La fecha inicial debe ser anterior a la final.")
    if coverage is None:
        return None

    effective_end = min(end, coverage.end) if end is not None else coverage.end
    requested_start = start if start is not None else effective_end - DEFAULT_WINDOW
    if effective_end - requested_start > MAX_WINDOW:
        raise InvalidFilters("El rango de fechas no puede superar 31 días.")

    effective_start = max(requested_start, coverage.start)
    if effective_start >= effective_end:
        return None
    return Window(effective_start, effective_end)
