from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.earthquakes.management.commands import sync_earthquakes
from apps.earthquakes.ports import Feed, FeedNotModified
from apps.earthquakes.services.sync import SyncAlreadyRunning, SyncEarthquakesService
from apps.earthquakes.tests.factories import NOW, FakeSource, make_batch, make_record
from core.exceptions import ExternalServiceError

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


def use_source(monkeypatch: pytest.MonkeyPatch, source: FakeSource) -> None:
    monkeypatch.setattr(
        sync_earthquakes,
        "build_sync_service",
        lambda: SyncEarthquakesService(source=source, clock=lambda: NOW),
    )


def test_success_prints_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    use_source(monkeypatch, FakeSource(make_batch(make_record("us1"))))
    out = StringIO()

    call_command("sync_earthquakes", "--feed", "day", stdout=out)

    assert "creados 1" in out.getvalue()


def test_not_modified_prints_message(monkeypatch: pytest.MonkeyPatch) -> None:
    use_source(monkeypatch, FakeSource(FeedNotModified("x")))
    out = StringIO()

    call_command("sync_earthquakes", "--feed", "week", stdout=out)

    assert "sin cambios" in out.getvalue()


def test_failure_exits_with_code_1(monkeypatch: pytest.MonkeyPatch) -> None:
    use_source(monkeypatch, FakeSource(ExternalServiceError("timeout")))

    with pytest.raises(CommandError) as excinfo:
        call_command("sync_earthquakes", "--feed", "day")

    assert excinfo.value.returncode == 1
    assert "source_timeout" in str(excinfo.value)


def test_concurrent_run_exits_with_code_3(monkeypatch: pytest.MonkeyPatch) -> None:
    class BusyService:
        def execute(self, feed: Feed) -> None:
            raise SyncAlreadyRunning

    monkeypatch.setattr(sync_earthquakes, "build_sync_service", BusyService)

    with pytest.raises(CommandError) as excinfo:
        call_command("sync_earthquakes", "--feed", "month")

    assert excinfo.value.returncode == 3


def test_feed_is_required_and_validated() -> None:
    with pytest.raises(CommandError):
        call_command("sync_earthquakes", "--feed", "year")


def test_builds_real_usgs_service_without_network() -> None:
    built = sync_earthquakes.build_sync_service()

    assert built.source.source_name == "usgs"
