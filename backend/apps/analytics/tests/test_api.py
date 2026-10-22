import random
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.test import Client
from pytest_django import DjangoAssertNumQueries

from apps.earthquakes.domain import EarthquakeFilters, Window
from apps.earthquakes.models import SyncRun
from apps.earthquakes.selectors import map_points
from apps.earthquakes.tests.factories import NOW, EarthquakeFactory, make_successful_run

pytestmark = [pytest.mark.integration, pytest.mark.django_db]

SUMMARY = "/api/v1/analytics/summary/"
TIMELINE = "/api/v1/analytics/timeline/"
LIST = "/api/v1/earthquakes/"
GEOJSON = "/api/v1/earthquakes/geojson/"
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)


@pytest.fixture(autouse=True)
def coverage() -> None:
    """Cobertura de 30 días hasta NOW, como tras una importación mensual."""
    make_successful_run()


def get(client: Client, url: str, **params: Any) -> Any:
    response = client.get(url, params)
    assert response.status_code == 200, response.content
    return response.json()


def iso(value: Any) -> str:
    return str(value.isoformat().replace("+00:00", "Z"))


def counts(items: list[dict[str, Any]]) -> dict[str, int]:
    return {item["key"]: item["count"] for item in items}


# --- resumen ----------------------------------------------------------------------------


def test_summary_bands_include_edges_negatives_and_nulls(client: Client) -> None:
    for magnitude, depth in [
        (-0.3, -1.5),  # sobre el nivel del mar: primera clase
        (0.5, 10),
        (1.0, 35),  # el límite inferior pertenece a la banda
        (2.99, 69.9),
        (7.0, 300),
        (None, None),
    ]:
        EarthquakeFactory(magnitude=magnitude, depth_km=depth)

    payload = get(client, SUMMARY)

    assert payload["total"] == 6
    assert counts(payload["magnitude_bands"]) == {
        "lt1": 2,
        "1-2": 1,
        "2-3": 1,
        "3-4": 0,
        "4-5": 0,
        "5-6": 0,
        "6-7": 0,
        "7plus": 1,
    }
    assert payload["magnitude_unknown"] == 1
    assert counts(payload["depth_classes"]) == {
        "0-35": 2,
        "35-70": 2,
        "70-150": 0,
        "150-300": 0,
        "300plus": 1,
    }
    assert payload["depth_unknown"] == 1
    assert payload["magnitude_bands"][0] == {"key": "lt1", "min": None, "max": 1.0, "count": 2}


def test_strongest_event_breaks_ties_by_most_recent(client: Client) -> None:
    EarthquakeFactory(external_id="older", magnitude=6.4, occurred_at=NOW - 3 * HOUR)
    newer = EarthquakeFactory.create(
        external_id="newer", magnitude=6.4, occurred_at=NOW - HOUR, place="Más reciente"
    )
    EarthquakeFactory(magnitude=None)

    payload = get(client, SUMMARY)

    assert payload["max_magnitude"] == 6.4
    assert payload["strongest"] == {
        "id": str(newer.id),
        "magnitude": 6.4,
        "place": "Más reciente",
        "occurred_at": iso(newer.occurred_at),
    }


def test_summary_without_events_or_coverage_is_explicit(client: Client) -> None:
    empty = get(client, SUMMARY, min_magnitude=9)
    assert empty["total"] == 0
    assert empty["strongest"] is None
    assert empty["window"] is not None  # hay cobertura, pero ningún evento coincide

    SyncRun.objects.all().delete()
    no_data = get(client, SUMMARY)
    assert no_data["window"] is None
    assert no_data["total"] == 0
    assert no_data["comparison"] == {
        "available": False,
        "previous_window": None,
        "previous_total": None,
        "reason": "no_data",
    }
    assert get(client, TIMELINE) == {"window": None, "granularity": "day", "buckets": []}


# --- consistencia con el conjunto completo filtrado --------------------------------------


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"min_magnitude": 3},
        {"max_depth_km": 70, "min_magnitude": 1.5},
        {"bbox": "170,-60,-160,60"},  # cruza el antimeridiano
        {"event_type": "all"},
        {"start": iso(NOW - 2 * DAY), "end": iso(NOW)},  # por hora
    ],
)
def test_statistics_match_every_way_of_counting_the_filtered_set(
    client: Client, params: dict[str, Any]
) -> None:
    rng = random.Random(20261022)  # noqa: S311 - datos de prueba reproducibles
    for _ in range(300):
        EarthquakeFactory(
            occurred_at=NOW - timedelta(minutes=rng.randint(1, 8 * 24 * 60)),
            magnitude=None if rng.random() < 0.05 else round(rng.uniform(-0.5, 7.5), 2),
            depth_km=None if rng.random() < 0.03 else round(rng.uniform(-2, 650), 1),
            longitude=rng.choice([-179.5, -170.0, 0.0, 120.0, 175.0, 179.9]),
            latitude=rng.uniform(-70, 70),
            event_type="earthquake" if rng.random() < 0.9 else "quarry blast",
        )

    summary = get(client, SUMMARY, **params)
    timeline = get(client, TIMELINE, **params)
    total = summary["total"]
    assert total > 0

    assert sum(counts(summary["magnitude_bands"]).values()) + summary["magnitude_unknown"] == total
    assert sum(counts(summary["depth_classes"]).values()) + summary["depth_unknown"] == total
    assert sum(bucket["count"] for bucket in timeline["buckets"]) == total
    assert timeline["window"] == summary["window"]

    # Lista: recorrer todas las páginas por cursor.
    seen: set[str] = set()
    cursor = None
    while True:
        page = get(client, LIST, page_size=100, **params, **({"cursor": cursor} if cursor else {}))
        seen.update(item["id"] for item in page["results"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(seen) == total

    # Mapa: el total no depende del límite de puntos aunque se trunque.
    assert get(client, GEOJSON, **params)["metadata"]["total_matching"] == total
    filters = EarthquakeFilters(
        window=Window(
            datetime.fromisoformat(summary["window"]["start"]),
            datetime.fromisoformat(summary["window"]["end"]),
        ),
        event_type=None if params.get("event_type") == "all" else "earthquake",
        min_magnitude=params.get("min_magnitude"),
        max_depth_km=params.get("max_depth_km"),
        bbox=None,
    )
    if "bbox" not in params:
        truncated = map_points(filters, limit=10)
        assert truncated.truncated and truncated.total_matching == total


# --- línea temporal -----------------------------------------------------------------------


def test_timeline_is_hourly_for_short_windows_and_fills_empty_hours(client: Client) -> None:
    start, end = NOW - 3 * HOUR - timedelta(minutes=30), NOW  # 23:00 → 02:30
    EarthquakeFactory(occurred_at=start + timedelta(minutes=10), magnitude=2.0)
    EarthquakeFactory(occurred_at=start + timedelta(minutes=20), magnitude=4.4)
    EarthquakeFactory(occurred_at=NOW - timedelta(minutes=5), magnitude=None)

    payload = get(client, TIMELINE, start=iso(start), end=iso(end))

    assert payload["granularity"] == "hour"
    assert [(b["start"][11:16], b["count"], b["is_partial"]) for b in payload["buckets"]] == [
        ("23:00", 2, False),
        ("00:00", 0, False),
        ("01:00", 0, False),
        ("02:00", 1, True),  # la ventana termina a las 02:30
    ]
    assert payload["buckets"][0]["max_magnitude"] == 4.4
    assert payload["buckets"][3]["max_magnitude"] is None


def test_timeline_is_daily_for_the_default_week(client: Client) -> None:
    EarthquakeFactory(occurred_at=NOW - 6 * DAY)

    payload = get(client, TIMELINE)

    assert payload["granularity"] == "day"
    buckets = payload["buckets"]
    assert len(buckets) == 8  # 15 oct 02:30 → 22 oct 02:30 toca 8 días UTC
    assert buckets[0]["start"] == "2026-10-15T00:00:00Z" and buckets[0]["is_partial"]
    assert buckets[-1]["end"] == "2026-10-23T00:00:00Z" and buckets[-1]["is_partial"]
    assert not any(bucket["is_partial"] for bucket in buckets[1:-1])


# --- comparación y cobertura --------------------------------------------------------------


def test_comparison_uses_the_previous_equal_window_with_the_same_filters(client: Client) -> None:
    EarthquakeFactory(occurred_at=NOW - DAY, magnitude=4.0)
    EarthquakeFactory(occurred_at=NOW - 8 * DAY, magnitude=4.0)
    EarthquakeFactory(occurred_at=NOW - 9 * DAY, magnitude=4.5)
    EarthquakeFactory(occurred_at=NOW - 9 * DAY, magnitude=1.0)  # no cumple el filtro

    payload = get(client, SUMMARY, min_magnitude=3)

    assert payload["total"] == 1
    assert payload["comparison"] == {
        "available": True,
        "previous_window": {"start": "2026-10-08T02:30:00Z", "end": "2026-10-15T02:30:00Z"},
        "previous_total": 2,
        "reason": None,
    }


def test_comparison_is_refused_when_the_previous_window_is_not_covered(client: Client) -> None:
    # 30 días con 30 días de cobertura: la ventana anterior no está sincronizada.
    payload = get(client, SUMMARY, start=iso(NOW - 30 * DAY), end=iso(NOW))

    assert payload["comparison"]["available"] is False
    assert payload["comparison"]["reason"] == "outside_coverage"
    assert payload["comparison"]["previous_total"] is None
    assert payload["window_clipped"] is False


def test_window_clipped_by_coverage_is_reported(client: Client) -> None:
    payload = get(client, SUMMARY, start=iso(NOW - 31 * DAY), end=iso(NOW))

    assert payload["window_clipped"] is True
    assert payload["window"]["start"] == "2026-09-22T02:30:00Z"  # inicio de la cobertura
    assert get(client, SUMMARY)["window_clipped"] is False


# --- errores, caché y coste ---------------------------------------------------------------


def test_invalid_filters_are_rejected_like_the_events_api(client: Client) -> None:
    for url in (SUMMARY, TIMELINE):
        response = client.get(url, {"min_magnitude": 5, "max_magnitude": 3})
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_filters"


def test_etag_returns_304_and_changes_with_the_data(client: Client) -> None:
    EarthquakeFactory()
    first = client.get(SUMMARY)
    etag = first["ETag"]
    assert first["Cache-Control"].startswith("public, max-age=60")
    assert client.get(SUMMARY, HTTP_IF_NONE_MATCH=etag).status_code == 304

    make_successful_run(started_at=NOW + timedelta(minutes=1), created=1)
    assert client.get(SUMMARY)["ETag"] != etag


def test_summary_uses_a_bounded_number_of_queries(
    client: Client, django_assert_max_num_queries: DjangoAssertNumQueries
) -> None:
    EarthquakeFactory.create_batch(20)
    with django_assert_max_num_queries(7):
        get(client, SUMMARY)
    with django_assert_max_num_queries(5):
        get(client, TIMELINE)
