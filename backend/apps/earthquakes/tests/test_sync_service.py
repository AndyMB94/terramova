from collections.abc import Iterator
from datetime import timedelta

import pytest
from django.db import connections
from django.db.backends.base.base import BaseDatabaseWrapper

from apps.earthquakes.models import Earthquake, SyncRun
from apps.earthquakes.ports import Feed, FeedNotModified, RejectedRecord
from apps.earthquakes.selectors import current_data_version, last_successful_sync
from apps.earthquakes.services.sync import (
    SYNC_LOCK_NAME,
    SyncAlreadyRunning,
    SyncEarthquakesService,
)
from apps.earthquakes.tests.factories import NOW, FakeSource, make_batch, make_record
from core.exceptions import ExternalServiceError
from core.locks import lock_key

pytestmark = pytest.mark.integration
LAST_MODIFIED = "Thu, 22 Oct 2026 02:27:34 GMT"


def service(source: FakeSource) -> SyncEarthquakesService:
    return SyncEarthquakesService(source=source, clock=lambda: NOW)


@pytest.mark.django_db
def test_successful_sync_records_counts_and_window() -> None:
    source = FakeSource(make_batch(make_record("us1"), make_record("us2")))

    run = service(source).execute(Feed.DAY)

    assert run.status == SyncRun.Status.SUCCEEDED
    assert (run.received, run.created, run.updated, run.rejected) == (2, 2, 0, 0)
    assert run.window_start == NOW - timedelta(days=1)
    assert run.window_end == NOW
    assert run.source_last_modified == LAST_MODIFIED
    assert run.finished_at == NOW
    assert Earthquake.objects.count() == 2


@pytest.mark.django_db
def test_second_sync_is_idempotent_and_conditional() -> None:
    batch = make_batch(make_record("us1"))
    source = FakeSource(batch, batch)

    service(source).execute(Feed.WEEK)
    second = service(source).execute(Feed.WEEK)

    assert (second.created, second.updated, second.unchanged) == (0, 0, 1)
    assert source.calls == [(Feed.WEEK, ""), (Feed.WEEK, LAST_MODIFIED)]
    assert Earthquake.objects.count() == 1


@pytest.mark.django_db
def test_conditional_header_is_per_feed() -> None:
    source = FakeSource(make_batch(make_record("us1")), make_batch(make_record("us1")))

    service(source).execute(Feed.DAY)
    service(source).execute(Feed.MONTH)

    assert source.calls[1] == (Feed.MONTH, "")


@pytest.mark.django_db
def test_not_modified_counts_as_success_without_changes() -> None:
    source = FakeSource(make_batch(make_record("us1")), FeedNotModified(LAST_MODIFIED))
    service(source).execute(Feed.DAY)
    version = current_data_version()

    run = service(source).execute(Feed.DAY)

    assert run.status == SyncRun.Status.SUCCEEDED
    assert run.not_modified is True
    assert run.source_last_modified == LAST_MODIFIED
    assert last_successful_sync(Feed.DAY) == run
    assert current_data_version() == version


@pytest.mark.django_db
def test_source_failure_preserves_data_and_last_success() -> None:
    source = FakeSource(make_batch(make_record("us1")), ExternalServiceError("timeout"))
    first = service(source).execute(Feed.DAY)

    failed = service(source).execute(Feed.DAY)

    assert failed.status == SyncRun.Status.FAILED
    assert failed.error_code == "source_timeout"
    assert failed.source_last_modified == ""
    assert last_successful_sync(Feed.DAY) == first
    assert Earthquake.objects.count() == 1


@pytest.mark.django_db
def test_rejected_records_make_the_run_partial() -> None:
    batch = make_batch(
        make_record("us1"),
        rejected=(RejectedRecord(None, "invalid_id"), RejectedRecord("us2", "invalid_geometry")),
    )

    run = service(FakeSource(batch)).execute(Feed.DAY)

    assert run.status == SyncRun.Status.PARTIAL
    assert (run.received, run.created, run.rejected) == (3, 1, 2)
    assert run.rejected_reasons == {"invalid_id": 1, "invalid_geometry": 1}
    assert last_successful_sync() == run


@pytest.mark.django_db
def test_events_outside_the_window_are_rejected() -> None:
    batch = make_batch(
        make_record("us1"),
        make_record("old", occurred_at=NOW - timedelta(days=32)),
        make_record("future", occurred_at=NOW + timedelta(hours=2)),
    )

    run = service(FakeSource(batch)).execute(Feed.MONTH)

    assert run.status == SyncRun.Status.PARTIAL
    assert run.rejected_reasons == {"out_of_window": 2}
    assert list(Earthquake.objects.values_list("external_id", flat=True)) == ["us1"]


@pytest.mark.django_db
def test_all_records_rejected_is_a_failure() -> None:
    batch = make_batch(rejected=(RejectedRecord("us1", "invalid_time"),))

    run = service(FakeSource(batch)).execute(Feed.DAY)

    assert run.status == SyncRun.Status.FAILED
    assert run.error_code == "all_records_rejected"
    assert last_successful_sync() is None


@pytest.mark.django_db
def test_empty_feed_is_a_success() -> None:
    run = service(FakeSource(make_batch())).execute(Feed.DAY)

    assert run.status == SyncRun.Status.SUCCEEDED
    assert run.received == 0


@pytest.mark.django_db
def test_database_error_rolls_back_the_whole_batch() -> None:
    source = FakeSource(
        make_batch(make_record("us1", magnitude=4.0)),
        # us1 se actualizaría, pero "bad" viola el CHECK de latitud al insertarse.
        make_batch(
            make_record("us1", magnitude=5.0, updated_at=NOW),
            make_record("bad", latitude=95.0),
        ),
    )
    service(source).execute(Feed.DAY)

    run = service(source).execute(Feed.DAY)

    assert run.status == SyncRun.Status.FAILED
    assert run.error_code == "database_error"
    assert run.source_last_modified == ""
    assert list(Earthquake.objects.values_list("external_id", "magnitude")) == [("us1", 4.0)]


@pytest.mark.django_db
def test_interrupted_runs_are_marked_failed() -> None:
    stale = SyncRun.objects.create(source="usgs", feed="day", started_at=NOW - timedelta(hours=2))

    service(FakeSource(make_batch())).execute(Feed.DAY)

    stale.refresh_from_db()
    assert stale.status == SyncRun.Status.FAILED
    assert stale.error_code == "interrupted"


@pytest.mark.django_db
def test_data_version_changes_only_when_rows_change() -> None:
    batch = make_batch(make_record("us1"))
    source = FakeSource(batch, batch, make_batch(make_record("us1", updated_at=NOW)))

    first = service(source).execute(Feed.DAY)
    assert current_data_version() == first.pk

    service(source).execute(Feed.DAY)
    assert current_data_version() == first.pk

    third = service(source).execute(Feed.DAY)
    assert current_data_version() == third.pk


@pytest.fixture
def other_session() -> Iterator[BaseDatabaseWrapper]:
    connection = connections.create_connection("default")
    try:
        yield connection
    finally:
        connection.close()


@pytest.mark.django_db(transaction=True)
def test_concurrent_sync_is_rejected_without_side_effects(
    other_session: BaseDatabaseWrapper,
) -> None:
    source = FakeSource(make_batch(make_record("us1")))
    with other_session.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(%s)", [lock_key(SYNC_LOCK_NAME)])
    try:
        with pytest.raises(SyncAlreadyRunning):
            service(source).execute(Feed.DAY)
    finally:
        with other_session.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_key(SYNC_LOCK_NAME)])

    assert source.calls == []
    assert SyncRun.objects.count() == 0
    assert Earthquake.objects.count() == 0
