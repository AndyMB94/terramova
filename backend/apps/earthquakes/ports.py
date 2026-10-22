"""Contrato entre la sincronización y cualquier fuente de eventos sísmicos.

Los adapters (integrations/) implementan EarthquakeSource y solo importan este módulo.
Los errores de la fuente se señalan con core.exceptions.ExternalServiceError.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol


class Feed(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"

    @property
    def period(self) -> timedelta:
        return FEED_PERIODS[self]


FEED_PERIODS = {
    Feed.DAY: timedelta(days=1),
    Feed.WEEK: timedelta(days=7),
    Feed.MONTH: timedelta(days=30),
}


@dataclass(frozen=True)
class EarthquakeRecord:
    """Evento validado y normalizado. Fechas en UTC; nulos de la fuente conservados."""

    external_id: str
    source_ids: tuple[str, ...]
    occurred_at: datetime
    source_updated_at: datetime
    magnitude: float | None
    magnitude_type: str
    longitude: float
    latitude: float
    depth_km: float | None
    place: str
    status: str
    event_type: str
    source_url: str


@dataclass(frozen=True)
class RejectedRecord:
    """Evento descartado por la validación. `reason` es un código estable."""

    external_id: str | None
    reason: str


@dataclass(frozen=True)
class FeedBatch:
    generated_at: datetime
    last_modified: str
    records: tuple[EarthquakeRecord, ...]
    rejected: tuple[RejectedRecord, ...]

    @property
    def received(self) -> int:
        return len(self.records) + len(self.rejected)


@dataclass(frozen=True)
class FeedNotModified:
    """La fuente confirmó que el feed no cambió desde `if_modified_since`."""

    last_modified: str


FeedResult = FeedBatch | FeedNotModified


class EarthquakeSource(Protocol):
    @property
    def source_name(self) -> str: ...

    def fetch_feed(self, feed: Feed, *, if_modified_since: str = "") -> FeedResult: ...
