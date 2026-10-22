from datetime import UTC, datetime, timedelta
from itertools import pairwise

from apps.analytics.domain import (
    DEPTH_CLASSES,
    MAGNITUDE_BANDS,
    Granularity,
    bucket_starts,
    granularity_for,
    previous_window,
    within_coverage,
)
from apps.earthquakes.domain import Coverage, Window

T0 = datetime(2026, 10, 20, 2, 30, tzinfo=UTC)


def test_bands_are_contiguous_and_open_at_the_ends() -> None:
    for bands in (MAGNITUDE_BANDS, DEPTH_CLASSES):
        assert bands[0].lower is None
        assert bands[-1].upper is None
        for current, following in pairwise(bands):
            assert current.upper == following.lower


def test_depth_classes_match_the_map_legend() -> None:
    # frontend/src/shared/lib/depth.ts: 35, 70, 150, 300 km.
    assert [band.upper for band in DEPTH_CLASSES] == [35, 70, 150, 300, None]


def test_granularity_is_hourly_up_to_48_hours() -> None:
    assert granularity_for(Window(T0, T0 + timedelta(hours=48))) is Granularity.HOUR
    assert granularity_for(Window(T0, T0 + timedelta(hours=48, seconds=1))) is Granularity.DAY


def test_buckets_cover_the_whole_window_including_partial_edges() -> None:
    window = Window(T0, T0 + timedelta(hours=3))  # 02:30 → 05:30
    starts = bucket_starts(window, Granularity.HOUR)
    assert [start.hour for start in starts] == [2, 3, 4, 5]

    days = bucket_starts(Window(T0, T0 + timedelta(days=2)), Granularity.DAY)
    assert [start.day for start in days] == [20, 21, 22]
    assert all(start.hour == 0 and start.tzinfo is UTC for start in days)


def test_previous_window_has_the_same_length_and_touches_the_current() -> None:
    window = Window(T0, T0 + timedelta(days=7))
    previous = previous_window(window)
    assert previous == Window(T0 - timedelta(days=7), T0)


def test_comparison_requires_the_previous_window_inside_coverage() -> None:
    coverage = Coverage(T0 - timedelta(days=10), T0 + timedelta(days=7), T0)
    inside = Window(T0 - timedelta(days=7), T0)
    partly_outside = Window(T0 - timedelta(days=11), T0)
    assert within_coverage(inside, coverage)
    assert not within_coverage(partly_outside, coverage)
    assert not within_coverage(inside, None)
