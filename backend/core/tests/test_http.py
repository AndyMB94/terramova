from collections.abc import Callable, Iterator

import httpx
import pytest

from core.exceptions import ExternalServiceError
from core.http import HttpClient

URL = "https://example.test/feed.json"
Handler = Callable[[httpx.Request], httpx.Response]


def make_client(handler: Handler, **overrides: object) -> tuple[HttpClient, list[float]]:
    sleeps: list[float] = []
    options: dict[str, object] = {
        "user_agent": "TerraMova-tests",
        "transport": httpx.MockTransport(handler),
        "sleep": sleeps.append,
        "max_attempts": 3,
        "backoff_seconds": 1.0,
    }
    options.update(overrides)
    return HttpClient(**options), sleeps  # type: ignore[arg-type]


def test_returns_body_and_lowercase_headers() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["User-Agent"] == "TerraMova-tests"
        return httpx.Response(200, content=b'{"ok": true}', headers={"Last-Modified": "X"})

    client, _ = make_client(handler)
    response = client.get(URL)

    assert response.status_code == 200
    assert response.content == b'{"ok": true}'
    assert response.headers["last-modified"] == "X"


def test_304_is_returned_without_body() -> None:
    client, _ = make_client(lambda request: httpx.Response(304))

    assert client.get(URL, headers={"If-Modified-Since": "X"}).status_code == 304


def test_retries_5xx_with_backoff_and_then_succeeds() -> None:
    statuses = iter([503, 502, 200])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(next(statuses), content=b"ok")

    client, sleeps = make_client(handler)

    assert client.get(URL).content == b"ok"
    assert sleeps == [1.0, 2.0]


def test_gives_up_after_max_attempts() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500)

    client, _ = make_client(handler)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "http_status"
    assert calls == 3


def test_does_not_retry_4xx() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(404)

    client, sleeps = make_client(handler)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "http_status"
    assert calls == 1
    assert sleeps == []


def test_timeouts_are_retried_and_reported() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("lento", request=request)

    client, sleeps = make_client(handler)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "timeout"
    assert len(sleeps) == 2


def test_connection_errors_are_reported_as_connection() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin red", request=request)

    client, _ = make_client(handler, max_attempts=1)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "connection"


def test_rejects_declared_size_over_limit_without_retrying() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, content=b"x" * 11)

    client, _ = make_client(handler, max_bytes=10)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "too_large"
    assert calls == 1


def test_stops_reading_streamed_body_over_limit() -> None:
    def body() -> Iterator[bytes]:
        for _ in range(100):
            yield b"x" * 4

    client, _ = make_client(lambda request: httpx.Response(200, content=body()), max_bytes=10)

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "too_large"


def test_total_deadline_aborts_slow_bodies() -> None:
    ticks = iter(range(0, 1000, 30))

    def body() -> Iterator[bytes]:
        while True:
            yield b"x"

    client, _ = make_client(
        lambda request: httpx.Response(200, content=body()),
        total_timeout=60.0,
        max_attempts=1,
        clock=lambda: float(next(ticks)),
    )

    with pytest.raises(ExternalServiceError) as excinfo:
        client.get(URL)
    assert excinfo.value.reason == "timeout"
