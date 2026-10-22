from datetime import timedelta

import pytest

from apps.earthquakes.domain import (
    DEFAULT_WINDOW,
    BBox,
    Coverage,
    InvalidFilters,
    Window,
    resolve_window,
)
from apps.earthquakes.tests.factories import NOW

COVERAGE = Coverage(start=NOW - timedelta(days=30), end=NOW, last_successful_sync_at=NOW)


def test_default_window_is_last_seven_days_of_coverage() -> None:
    assert resolve_window(None, None, COVERAGE) == Window(NOW - DEFAULT_WINDOW, NOW)


def test_requested_window_inside_coverage_is_kept() -> None:
    start, end = NOW - timedelta(days=3), NOW - timedelta(days=1)

    assert resolve_window(start, end, COVERAGE) == Window(start, end)


def test_window_is_clipped_to_coverage() -> None:
    window = resolve_window(NOW - timedelta(days=31), NOW + timedelta(days=5), COVERAGE)

    assert window == Window(COVERAGE.start, NOW)


def test_only_end_uses_default_length_before_it() -> None:
    end = NOW - timedelta(days=2)

    assert resolve_window(None, end, COVERAGE) == Window(end - DEFAULT_WINDOW, end)


def test_only_start_runs_until_end_of_coverage() -> None:
    start = NOW - timedelta(days=10)

    assert resolve_window(start, None, COVERAGE) == Window(start, NOW)


def test_window_longer_than_31_days_is_rejected() -> None:
    with pytest.raises(InvalidFilters):
        resolve_window(NOW - timedelta(days=40), NOW - timedelta(days=8), COVERAGE)


def test_start_after_end_is_rejected() -> None:
    with pytest.raises(InvalidFilters):
        resolve_window(NOW, NOW - timedelta(days=1), COVERAGE)


def test_without_coverage_there_is_no_window() -> None:
    assert resolve_window(None, None, None) is None


def test_window_outside_coverage_is_empty() -> None:
    old = NOW - timedelta(days=60)

    assert resolve_window(old, old + timedelta(days=1), COVERAGE) is None


def test_bbox_detects_antimeridian() -> None:
    assert BBox(170, -30, -170, -10).crosses_antimeridian
    assert not BBox(-82, -56, -34, 13).crosses_antimeridian
