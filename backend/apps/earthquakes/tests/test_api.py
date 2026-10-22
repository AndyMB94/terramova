from datetime import timedelta
from typing import Any

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone
from pytest_django import DjangoAssertNumQueries
from redis.exceptions import ConnectionError as RedisConnectionError
from rest_framework.throttling import SimpleRateThrottle

from apps.earthquakes.models import Earthquake, SyncRun
from apps.earthquakes.tests.factories import NOW, EarthquakeFactory, make_successful_run
from core.api import throttling

pytestmark = [pytest.mark.integration, pytest.mark.django_db]

LIST = "/api/v1/earthquakes/"
GEOJSON = "/api/v1/earthquakes/geojson/"
META = "/api/v1/meta/"
HOUR = timedelta(hours=1)


@pytest.fixture(autouse=True)
def coverage() -> None:
    """Cobertura de 30 días hasta NOW, como tras una importación mensual."""
    make_successful_run()


def get(client: Client, url: str, **params: Any) -> Any:
    response = client.get(url, params)
    assert response.status_code == 200, response.content
    return response.json()


def ids(payload: dict[str, Any]) -> list[str]:
    return [item["external_id"] for item in payload["results"]]


# --- lista y filtros -------------------------------------------------------------------


def test_list_defaults_to_last_seven_days_of_earthquakes(client: Client) -> None:
    EarthquakeFactory(external_id="recent", occurred_at=NOW - HOUR)
    EarthquakeFactory(external_id="old", occurred_at=NOW - timedelta(days=8))
    EarthquakeFactory(external_id="blast", occurred_at=NOW - HOUR, event_type="quarry blast")

    payload = get(client, LIST)

    assert ids(payload) == ["recent"]
    assert payload["window"] == {
        "start": "2026-10-15T02:30:00Z",
        "end": "2026-10-22T02:30:00Z",
    }


def test_event_type_all_includes_other_types(client: Client) -> None:
    EarthquakeFactory(external_id="quake", occurred_at=NOW - HOUR)
    EarthquakeFactory(external_id="blast", occurred_at=NOW - 2 * HOUR, event_type="quarry blast")

    assert ids(get(client, LIST, event_type="all")) == ["quake", "blast"]
    assert ids(get(client, LIST, event_type="quarry blast")) == ["blast"]


def test_magnitude_and_depth_ranges(client: Client) -> None:
    EarthquakeFactory(external_id="small", magnitude=2.0, depth_km=5)
    EarthquakeFactory(external_id="match", magnitude=4.5, depth_km=30)
    EarthquakeFactory(external_id="deep", magnitude=4.5, depth_km=300)
    EarthquakeFactory(external_id="unknown", magnitude=None, depth_km=None)

    payload = get(client, LIST, min_magnitude=4, max_magnitude=5, max_depth_km=100)

    assert ids(payload) == ["match"]


def test_bbox_and_antimeridian(client: Client) -> None:
    EarthquakeFactory(external_id="chile", longitude=-71.5, latitude=-33.0)
    EarthquakeFactory(external_id="fiji", longitude=178.0, latitude=-18.0)
    EarthquakeFactory(external_id="tonga", longitude=-174.0, latitude=-20.0)
    EarthquakeFactory(external_id="australia", longitude=150.0, latitude=-20.0)

    assert ids(get(client, LIST, bbox="-82,-56,-34,13")) == ["chile"]
    assert sorted(ids(get(client, LIST, bbox="170,-30,-170,-10"))) == ["fiji", "tonga"]


def test_window_is_clipped_and_reported(client: Client) -> None:
    payload = get(client, LIST, start="2026-09-01T00:00:00Z", end="2026-09-25T00:00:00-05:00")

    assert payload["window"] == {"start": "2026-09-22T02:30:00Z", "end": "2026-09-25T05:00:00Z"}


def test_list_is_empty_without_coverage(client: Client) -> None:
    SyncRun.objects.all().delete()
    EarthquakeFactory(occurred_at=NOW - HOUR)

    payload = get(client, LIST)

    assert payload == {"results": [], "next_cursor": None, "window": None}


def test_numbers_are_rounded_and_dates_use_z(client: Client) -> None:
    EarthquakeFactory(
        longitude=-121.229667663574, latitude=37.1699981689453, depth_km=-0.699999988079071
    )

    item = get(client, LIST)["results"][0]

    assert (item["longitude"], item["latitude"], item["depth_km"]) == (-121.229668, 37.169998, -0.7)
    assert item["occurred_at"].endswith("Z")


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2026-10-01T00:00:00"},
        {"start": "ayer"},
        {"start": "2026-08-01T00:00:00Z", "end": "2026-10-01T00:00:00Z"},
        {"start": "2026-10-10T00:00:00Z", "end": "2026-10-01T00:00:00Z"},
        {"min_magnitude": "nan"},
        {"min_magnitude": "6", "max_magnitude": "5"},
        {"bbox": "1,2,3"},
        {"bbox": "-200,0,10,10"},
        {"bbox": "0,10,10,0"},
        {"page_size": "0"},
        {"page_size": "101"},
        {"ordering": "place"},
        {"event_type": "<script>"},
        {"cursor": "no-es-un-cursor"},
    ],
)
def test_invalid_filters_return_400_without_internals(
    client: Client, params: dict[str, str]
) -> None:
    response = client.get(LIST, params)

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_filters"
    assert "Traceback" not in response.content.decode()


# --- paginación por cursor -------------------------------------------------------------


def walk(client: Client, *, inserts: dict[int, list[dict[str, Any]]], **params: Any) -> list[str]:
    """Recorre todas las páginas; `inserts` añade eventos antes de pedir la página n."""
    seen: list[str] = []
    cursor = None
    page = 0
    while True:
        for values in inserts.get(page, []):
            EarthquakeFactory(**values)
        query = dict(params, page_size=3, **({"cursor": cursor} if cursor else {}))
        payload = get(client, LIST, **query)
        seen += ids(payload)
        cursor = payload["next_cursor"]
        page += 1
        if not cursor:
            return seen


def test_recent_ordering_is_stable_when_new_events_arrive(client: Client) -> None:
    for minute in range(8):
        occurred = NOW - timedelta(minutes=10 + minute)
        EarthquakeFactory(external_id=f"e{minute}", occurred_at=occurred)
    newer = [{"external_id": "new", "occurred_at": NOW - timedelta(minutes=1)}]

    seen = walk(client, inserts={1: newer})

    assert seen == [f"e{minute}" for minute in range(8)]


def test_magnitude_ordering_with_ties_and_nulls_is_stable(client: Client) -> None:
    for n in range(7):
        EarthquakeFactory(external_id=f"tie{n}", magnitude=2.0)
    EarthquakeFactory(external_id="big", magnitude=5.0)
    EarthquakeFactory(external_id="null1", magnitude=None)
    EarthquakeFactory(external_id="null2", magnitude=None)
    # Llega otro evento empatado a mitad del recorrido.
    inserts = {2: [{"external_id": "late-tie", "magnitude": 2.0}]}

    seen = walk(client, inserts=inserts, ordering="-magnitude")

    originals = {"big", "null1", "null2", *(f"tie{n}" for n in range(7))}
    assert len(seen) == len(set(seen)), "sin duplicados"
    assert originals <= set(seen), "sin saltos"
    assert seen[0] == "big"
    assert seen[-2:] in (["null1", "null2"], ["null2", "null1"])


def test_cursor_from_other_ordering_is_rejected(client: Client) -> None:
    for n in range(4):
        EarthquakeFactory(external_id=f"e{n}")
    cursor = get(client, LIST, page_size=2)["next_cursor"]

    response = client.get(LIST, {"cursor": cursor, "ordering": "-magnitude"})

    assert response.status_code == 400


def test_list_query_count_is_bounded(
    client: Client, django_assert_max_num_queries: DjangoAssertNumQueries
) -> None:
    for _ in range(20):
        EarthquakeFactory()

    with django_assert_max_num_queries(5):
        client.get(LIST, {"page_size": 100})


# --- detalle ---------------------------------------------------------------------------


def test_detail(client: Client) -> None:
    event = EarthquakeFactory.create(external_id="us1")

    payload = get(client, f"{LIST}{event.pk}/")

    assert payload["external_id"] == "us1"


def test_detail_404(client: Client) -> None:
    response = client.get(f"{LIST}00000000-0000-0000-0000-000000000000/")

    assert response.status_code == 404
    assert response.json()["code"] == "event_not_found"


# --- GeoJSON ---------------------------------------------------------------------------


def test_geojson_shape(client: Client) -> None:
    EarthquakeFactory(longitude=-71.5, latitude=-33.0, magnitude=4.4, depth_km=None)

    payload = get(client, GEOJSON)

    assert payload["type"] == "FeatureCollection"
    feature = payload["features"][0]
    assert feature["geometry"] == {"type": "Point", "coordinates": [-71.5, -33.0]}
    assert feature["properties"]["magnitude"] == 4.4
    assert feature["properties"]["depth_km"] is None
    assert payload["metadata"]["truncated"] is False
    assert payload["metadata"]["total_matching"] == 1


def test_geojson_truncates_keeping_largest_magnitudes(client: Client) -> None:
    Earthquake.objects.bulk_create(
        [EarthquakeFactory.build(magnitude=3.0, updated_at=NOW) for _ in range(5000)]
        + [EarthquakeFactory.build(magnitude=1.0, updated_at=NOW) for _ in range(3)]
    )

    payload = get(client, GEOJSON)

    metadata = payload["metadata"]
    assert metadata["truncated"] is True
    assert metadata["returned"] == 5000
    assert metadata["total_matching"] == 5003
    assert metadata["selection"] == "magnitude_desc"
    magnitudes = [f["properties"]["magnitude"] for f in payload["features"]]
    assert magnitudes == sorted(magnitudes, reverse=True)
    assert 1.0 not in magnitudes  # se descartan los 3 de menor magnitud


# --- caché HTTP ------------------------------------------------------------------------


def test_etag_and_304(client: Client) -> None:
    EarthquakeFactory()
    first = client.get(LIST)

    second = client.get(LIST, HTTP_IF_NONE_MATCH=first["ETag"])

    assert first["Cache-Control"] == "public, max-age=60, stale-while-revalidate=60"
    assert second.status_code == 304
    assert second.content == b""


def test_etag_changes_when_data_or_filters_change(client: Client) -> None:
    etag = client.get(LIST)["ETag"]

    assert client.get(LIST, {"min_magnitude": 3})["ETag"] != etag

    EarthquakeFactory()
    make_successful_run(started_at=NOW + timedelta(minutes=1), created=1)

    assert client.get(LIST)["ETag"] != etag


def test_responses_are_served_from_cache_until_data_changes(client: Client) -> None:
    EarthquakeFactory(external_id="first")
    assert ids(get(client, LIST)) == ["first"]

    # Una fila nueva sin sincronización que cambie la versión de datos no se ve: caché.
    EarthquakeFactory(external_id="sneaky", occurred_at=NOW - timedelta(minutes=5))
    assert ids(get(client, LIST)) == ["first"]

    make_successful_run(started_at=NOW + timedelta(minutes=1), created=1)
    assert ids(get(client, LIST)) == ["sneaky", "first"]


def test_api_keeps_working_when_redis_is_down(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    EarthquakeFactory(external_id="us1")

    def broken(*args: object, **kwargs: object) -> None:
        raise RedisConnectionError("redis caído")

    monkeypatch.setattr(cache, "get", broken)
    monkeypatch.setattr(cache, "set", broken)
    throttling._fallback_cache.clear()

    assert ids(get(client, LIST)) == ["us1"]
    assert get(client, META)["coverage"] is not None


# --- límites de tasa -------------------------------------------------------------------


def test_per_ip_limit_returns_429_with_retry_after(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    rates = dict(SimpleRateThrottle.THROTTLE_RATES, per_ip="2/min")
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)

    statuses = [client.get(META).status_code for _ in range(3)]
    limited = client.get(META)

    assert statuses == [200, 200, 429]
    assert limited.json()["code"] == "rate_limited"
    assert int(limited["Retry-After"]) > 0


def test_fallback_limit_applies_without_redis(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    rates = dict(SimpleRateThrottle.THROTTLE_RATES, per_ip_fallback="1/min")
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)
    throttling._fallback_cache.clear()

    def broken(*args: object, **kwargs: object) -> None:
        raise RedisConnectionError("redis caído")

    monkeypatch.setattr(cache, "get", broken)
    monkeypatch.setattr(cache, "set", broken)

    assert client.get(META).status_code == 200
    assert client.get(META).status_code == 429


def test_health_is_never_throttled(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    rates = dict(SimpleRateThrottle.THROTTLE_RATES, per_ip="1/min", **{"global": "1/min"})
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)

    assert [client.get("/health/live/").status_code for _ in range(3)] == [200, 200, 200]


# --- meta ------------------------------------------------------------------------------


def test_meta_reports_coverage_freshness_and_limits(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(minutes=5))

    payload = get(client, META)

    assert payload["source"]["name"] == "USGS"
    assert payload["coverage"] == {"start": "2026-09-22T02:30:00Z", "end": "2026-10-22T02:30:00Z"}
    assert payload["last_successful_sync_at"] == "2026-10-22T02:30:03Z"
    assert payload["is_stale"] is False
    assert payload["default_event_type"] == "earthquake"
    assert payload["limits"]["max_map_points"] == 5000


def test_meta_flags_stale_data(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(hours=2))

    assert get(client, META)["is_stale"] is True
