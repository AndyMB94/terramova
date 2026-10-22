"""Datos de prueba: factory para filas y constructores para lo que entrega una fuente."""

from datetime import UTC, datetime, timedelta
from typing import Any

import factory

from apps.earthquakes.models import Earthquake, SyncRun
from apps.earthquakes.ports import EarthquakeRecord, Feed, FeedBatch, FeedResult, RejectedRecord

NOW = datetime(2026, 10, 22, 2, 30, tzinfo=UTC)


class EarthquakeFactory(factory.django.DjangoModelFactory[Earthquake]):
    class Meta:
        model = Earthquake

    source = "usgs"
    external_id = factory.Sequence(lambda n: f"us{n:08d}")
    source_ids = factory.LazyAttribute(lambda o: [o.external_id])
    occurred_at = NOW - timedelta(hours=1)
    source_updated_at = NOW - timedelta(minutes=50)
    magnitude = 3.1
    magnitude_type = "ml"
    longitude = -70.5
    latitude = -33.4
    depth_km = 10.0
    place = "Lugar de prueba"
    status = "reviewed"
    event_type = "earthquake"
    source_url = factory.LazyAttribute(
        lambda o: f"https://earthquake.usgs.gov/earthquakes/eventpage/{o.external_id}"
    )
    updated_at = NOW


def make_record(
    external_id: str = "us7000aaaa",
    *,
    source_ids: tuple[str, ...] | None = None,
    occurred_at: datetime | None = None,
    updated_at: datetime | None = None,
    **overrides: Any,
) -> EarthquakeRecord:
    occurred = occurred_at or NOW - timedelta(hours=1)
    values: dict[str, Any] = {
        "external_id": external_id,
        "source_ids": source_ids or (external_id,),
        "occurred_at": occurred,
        "source_updated_at": updated_at or occurred + timedelta(minutes=5),
        "magnitude": 4.2,
        "magnitude_type": "mb",
        "longitude": -71.6,
        "latitude": -33.0,
        "depth_km": 35.0,
        "place": "Frente a la costa",
        "status": "reviewed",
        "event_type": "earthquake",
        "source_url": f"https://earthquake.usgs.gov/earthquakes/eventpage/{external_id}",
    }
    values.update(overrides)
    return EarthquakeRecord(**values)


def make_batch(
    *records: EarthquakeRecord,
    rejected: tuple[RejectedRecord, ...] = (),
    generated_at: datetime = NOW,
    last_modified: str = "Thu, 22 Oct 2026 02:27:34 GMT",
) -> FeedBatch:
    return FeedBatch(
        generated_at=generated_at,
        last_modified=last_modified,
        records=records,
        rejected=rejected,
    )


class FakeSource:
    """Doble de EarthquakeSource: devuelve (o lanza) respuestas preparadas, en orden."""

    source_name = "usgs"

    def __init__(self, *responses: FeedResult | Exception) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[Feed, str]] = []

    def fetch_feed(self, feed: Feed, *, if_modified_since: str = "") -> FeedResult:
        self.calls.append((feed, if_modified_since))
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def make_successful_run(
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    *,
    feed: str = "month",
    started_at: datetime | None = None,
    not_modified: bool = False,
    created: int = 1,
) -> SyncRun:
    """SyncRun correcto que declara una ventana cubierta (por defecto, 30 días hasta NOW)."""
    end = window_end or NOW
    started = started_at or end
    return SyncRun.objects.create(
        source="usgs",
        feed=feed,
        status=SyncRun.Status.SUCCEEDED,
        started_at=started,
        finished_at=started + timedelta(seconds=3),
        window_start=None if not_modified else (window_start or end - timedelta(days=30)),
        window_end=None if not_modified else end,
        not_modified=not_modified,
        created=0 if not_modified else created,
    )
