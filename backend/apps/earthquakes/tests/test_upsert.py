from datetime import timedelta

import pytest

from apps.earthquakes.models import Earthquake
from apps.earthquakes.services.upsert import upsert_earthquakes
from apps.earthquakes.tests.factories import NOW, EarthquakeFactory, make_record

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


def test_creates_new_events_with_all_fields() -> None:
    record = make_record("us1", magnitude=None, depth_km=None)

    result = upsert_earthquakes("usgs", [record])

    assert (result.created, result.updated, result.unchanged, result.merged) == (1, 0, 0, 0)
    row = Earthquake.objects.get(external_id="us1")
    assert row.magnitude is None
    assert row.depth_km is None
    assert row.source_ids == ["us1"]
    assert row.occurred_at == record.occurred_at


def test_importing_twice_does_not_duplicate() -> None:
    records = [make_record("us1"), make_record("us2")]

    upsert_earthquakes("usgs", records)
    second = upsert_earthquakes("usgs", records)

    assert (second.created, second.updated, second.unchanged) == (0, 0, 2)
    assert Earthquake.objects.count() == 2


def test_newer_version_updates_the_event() -> None:
    upsert_earthquakes("usgs", [make_record("us1", magnitude=4.0)])
    corrected = make_record("us1", magnitude=4.6, updated_at=NOW, status="reviewed")

    result = upsert_earthquakes("usgs", [corrected])

    assert result.updated == 1
    row = Earthquake.objects.get(external_id="us1")
    assert row.magnitude == 4.6
    assert row.source_updated_at == NOW


def test_older_version_is_ignored() -> None:
    upsert_earthquakes("usgs", [make_record("us1", magnitude=4.6, updated_at=NOW)])
    stale = make_record("us1", magnitude=4.0, updated_at=NOW - timedelta(minutes=30))

    result = upsert_earthquakes("usgs", [stale])

    assert (result.updated, result.unchanged) == (0, 1)
    assert Earthquake.objects.get(external_id="us1").magnitude == 4.6


def test_changed_preferred_id_renames_instead_of_duplicating() -> None:
    upsert_earthquakes("usgs", [make_record("tx2026abc", updated_at=NOW - timedelta(minutes=20))])
    renamed = make_record(
        "us6000xyz", source_ids=("us6000xyz", "tx2026abc"), updated_at=NOW, magnitude=4.4
    )

    result = upsert_earthquakes("usgs", [renamed])

    assert (result.created, result.updated) == (0, 1)
    row = Earthquake.objects.get()
    assert row.external_id == "us6000xyz"
    assert row.source_ids == ["us6000xyz", "tx2026abc"]
    assert row.magnitude == 4.4


def test_merged_events_keep_one_row_and_delete_the_other() -> None:
    EarthquakeFactory(external_id="nc75452891", source_ids=["nc75452891"])
    EarthquakeFactory(external_id="nn00926046", source_ids=["nn00926046"])
    merged = make_record(
        "nc75452891",
        source_ids=("nc75452891", "nn00926046", "us6000u3uq"),
        updated_at=NOW,
    )

    result = upsert_earthquakes("usgs", [merged])

    assert (result.created, result.updated, result.merged) == (0, 1, 1)
    row = Earthquake.objects.get()
    assert row.external_id == "nc75452891"
    assert row.source_ids == ["nc75452891", "nn00926046", "us6000u3uq"]


def test_merge_onto_id_held_by_another_row_respects_unique_constraint() -> None:
    EarthquakeFactory(external_id="ak1", source_ids=["ak1"])
    EarthquakeFactory(external_id="us1", source_ids=["us1"])
    record = make_record("us1", source_ids=("us1", "ak1"), updated_at=NOW)

    result = upsert_earthquakes("usgs", [record])

    assert result.merged == 1
    assert list(Earthquake.objects.values_list("external_id", flat=True)) == ["us1"]


def test_repeated_id_in_batch_keeps_latest_version() -> None:
    older = make_record("us1", magnitude=3.0, updated_at=NOW - timedelta(minutes=10))
    newer = make_record("us1", magnitude=3.5, updated_at=NOW)

    result = upsert_earthquakes("usgs", [newer, older])

    assert result.created == 1
    assert Earthquake.objects.get().magnitude == 3.5


def test_events_missing_from_a_later_batch_are_not_deleted() -> None:
    upsert_earthquakes("usgs", [make_record("us1"), make_record("us2")])

    upsert_earthquakes("usgs", [make_record("us2")])

    assert Earthquake.objects.count() == 2


def test_sources_do_not_collide() -> None:
    EarthquakeFactory(source="other", external_id="us1", source_ids=["us1"])

    result = upsert_earthquakes("usgs", [make_record("us1")])

    assert result.created == 1
    assert Earthquake.objects.count() == 2
