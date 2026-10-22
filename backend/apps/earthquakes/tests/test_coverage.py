from datetime import timedelta

import pytest

from apps.earthquakes.models import SyncRun
from apps.earthquakes.selectors import compute_coverage, get_data_state
from apps.earthquakes.tests.factories import NOW, make_successful_run

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
DAY = timedelta(days=1)


def test_no_successful_runs_means_no_coverage() -> None:
    SyncRun.objects.create(source="usgs", feed="day", status="failed", started_at=NOW)

    assert get_data_state().coverage is None


def test_month_plus_later_day_runs_extend_coverage() -> None:
    make_successful_run(NOW - 30 * DAY, NOW - DAY, started_at=NOW - DAY)
    make_successful_run(NOW - 2 * DAY + timedelta(hours=1), NOW, feed="day")

    coverage = compute_coverage(NOW)

    assert coverage is not None
    assert (coverage.start, coverage.end) == (NOW - 30 * DAY, NOW)


def test_gap_cuts_coverage_at_the_most_recent_continuous_stretch() -> None:
    make_successful_run(NOW - 40 * DAY, NOW - 10 * DAY, started_at=NOW - 10 * DAY)
    # Scheduler detenido 9 días: solo hay feeds diarios recientes.
    make_successful_run(NOW - DAY, NOW, feed="day")

    coverage = compute_coverage(NOW)

    assert coverage is not None
    assert (coverage.start, coverage.end) == (NOW - DAY, NOW)


def test_not_modified_run_extends_coverage_to_its_start() -> None:
    ten_minutes_ago = NOW - timedelta(minutes=10)
    make_successful_run(NOW - 30 * DAY, ten_minutes_ago, started_at=ten_minutes_ago)
    make_successful_run(feed="day", started_at=NOW, not_modified=True)

    coverage = compute_coverage(NOW)

    assert coverage is not None
    assert (coverage.start, coverage.end) == (NOW - 30 * DAY, NOW)


def test_failed_runs_do_not_count() -> None:
    make_successful_run(NOW - 30 * DAY, NOW - DAY, started_at=NOW - DAY)
    SyncRun.objects.create(
        source="usgs",
        feed="day",
        status=SyncRun.Status.FAILED,
        started_at=NOW,
        window_start=NOW - DAY,
        window_end=NOW,
    )

    coverage = compute_coverage(NOW)

    assert coverage is not None
    assert coverage.end == NOW - DAY


def test_last_successful_sync_is_latest_finish() -> None:
    run = make_successful_run()

    coverage = get_data_state().coverage

    assert coverage is not None
    assert coverage.last_successful_sync_at == run.finished_at
