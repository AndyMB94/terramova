import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from core.exceptions import ExternalServiceError
from integrations.usgs.normalize import parse_feed

FIXTURE = Path(__file__).parent / "fixtures" / "all_day_sample.geojson"


@pytest.fixture
def feed() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text())
    return data


def encode(data: dict[str, Any]) -> bytes:
    return json.dumps(data).encode()


def with_feature(feed: dict[str, Any], **changes: Any) -> dict[str, Any]:
    """Copia del feed con el primer evento modificado (rutas tipo 'properties__mag')."""
    data = copy.deepcopy(feed)
    feature = data["features"][0]
    for path, value in changes.items():
        *parents, leaf = path.split("__")
        target = feature
        for key in parents:
            target = target[key]
        target[leaf] = value
    return data


def test_parses_real_fixture(feed: dict[str, Any]) -> None:
    parsed = parse_feed(encode(feed))

    assert len(parsed.records) == 5
    assert parsed.rejected == ()
    assert parsed.generated_at == datetime(2026, 10, 22, 2, 27, 34, tzinfo=UTC)

    first = parsed.records[0]
    assert first.external_id == "aka2026uxfeuy"
    assert (first.longitude, first.latitude, first.depth_km) == (-152.941, 60.16, 133.3)
    assert first.magnitude == 2
    assert first.magnitude_type == "ml"
    assert first.place == "71 km WNW of Happy Valley, Alaska"
    assert first.status == "automatic"
    assert first.event_type == "earthquake"
    assert first.source_url == "https://earthquake.usgs.gov/earthquakes/eventpage/aka2026uxfeuy"
    assert first.occurred_at.tzinfo == UTC
    assert first.source_updated_at >= first.occurred_at


def test_keeps_all_source_ids_with_preferred_first(feed: dict[str, Any]) -> None:
    records = {r.external_id: r for r in parse_feed(encode(feed)).records}

    assert records["nc75452891"].source_ids == ("nc75452891", "nn00926046", "us6000u3uq")
    assert records["aka2026uxfeuy"].source_ids == ("aka2026uxfeuy",)


def test_non_earthquake_types_are_kept_with_their_type(feed: dict[str, Any]) -> None:
    records = {r.external_id: r for r in parse_feed(encode(feed)).records}

    assert records["uw714123632"].event_type == "explosion"


def test_preserves_nulls(feed: dict[str, Any]) -> None:
    data = with_feature(
        feed,
        properties__mag=None,
        properties__magType=None,
        properties__place=None,
        properties__updated=None,
        geometry__coordinates=[10.0, 20.0, None],
    )

    record = parse_feed(encode(data)).records[0]

    assert record.magnitude is None
    assert record.magnitude_type == ""
    assert record.place == ""
    assert record.depth_km is None
    assert record.source_updated_at == record.occurred_at


def test_accepts_negative_magnitude_and_depth(feed: dict[str, Any]) -> None:
    data = with_feature(feed, properties__mag=-1.29, geometry__coordinates=[10.0, 20.0, -3.4])

    record = parse_feed(encode(data)).records[0]

    assert record.magnitude == -1.29
    assert record.depth_km == -3.4


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"geometry__coordinates": [10.0, 91.0, 5.0]}, "invalid_geometry"),
        ({"geometry__coordinates": [181.0, 0.0, 5.0]}, "invalid_geometry"),
        ({"geometry__coordinates": [10.0, 20.0]}, "invalid_geometry"),
        ({"geometry__coordinates": ["10", 20.0, 5.0]}, "invalid_geometry"),
        ({"geometry__type": "Polygon"}, "invalid_geometry"),
        ({"properties__time": None}, "invalid_time"),
        ({"properties__time": "2026-10-22"}, "invalid_time"),
        ({"properties__mag": "2.0"}, "invalid_magnitude"),
        ({"properties__mag": 99.0}, "invalid_magnitude"),
        ({"properties__status": "x" * 17}, "invalid_record"),
    ],
)
def test_rejects_invalid_event_without_aborting_batch(
    feed: dict[str, Any], changes: dict[str, Any], reason: str
) -> None:
    parsed = parse_feed(encode(with_feature(feed, **changes)))

    assert len(parsed.records) == 4
    assert [(r.external_id, r.reason) for r in parsed.rejected] == [("aka2026uxfeuy", reason)]


def test_rejects_invalid_id_without_echoing_it(feed: dict[str, Any]) -> None:
    parsed = parse_feed(encode(with_feature(feed, id="<script>alert(1)</script>")))

    assert [(r.external_id, r.reason) for r in parsed.rejected] == [(None, "invalid_id")]


def test_drops_untrusted_url_but_keeps_event(feed: dict[str, Any]) -> None:
    data = with_feature(feed, properties__url="javascript:alert(1)")

    record = parse_feed(encode(data)).records[0]

    assert record.source_url == ""


def test_truncates_long_place(feed: dict[str, Any]) -> None:
    record = parse_feed(encode(with_feature(feed, properties__place="a" * 400))).records[0]

    assert len(record.place) == 255


def test_ignores_malformed_alias_ids(feed: dict[str, Any]) -> None:
    data = with_feature(feed, properties__ids=",aka2026uxfeuy,bad id!,us7000abcd,")

    record = parse_feed(encode(data)).records[0]

    assert record.source_ids == ("aka2026uxfeuy", "us7000abcd")


@pytest.mark.parametrize(
    "content",
    [
        b"not json",
        b'{"type": "FeatureCollection"}',
        b'{"type": "Topology", "metadata": {"generated": 1}, "features": []}',
        b'{"type": "FeatureCollection", "metadata": {"generated": NaN}, "features": []}',
        b"[]",
    ],
)
def test_invalid_envelope_fails_whole_feed(content: bytes) -> None:
    with pytest.raises(ExternalServiceError) as excinfo:
        parse_feed(content)
    assert excinfo.value.reason == "invalid_payload"


def test_empty_feed_is_valid(feed: dict[str, Any]) -> None:
    data = dict(feed, features=[])

    parsed = parse_feed(encode(data))

    assert parsed.records == ()
    assert parsed.rejected == ()
