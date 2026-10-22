from pathlib import Path

import httpx

from apps.earthquakes.ports import Feed, FeedBatch, FeedNotModified
from core.http import HttpClient
from integrations.usgs.client import FEED_URLS, UsgsFeedClient
from integrations.usgs.source import UsgsEarthquakeSource

FIXTURE = Path(__file__).parent / "fixtures" / "all_day_sample.geojson"
LAST_MODIFIED = "Thu, 22 Oct 2026 02:27:34 GMT"


def make_source(handler: httpx.MockTransport) -> UsgsEarthquakeSource:
    http = HttpClient(user_agent="TerraMova-tests", transport=handler, sleep=lambda _: None)
    return UsgsEarthquakeSource(UsgsFeedClient(http))


def test_fetches_fixed_url_and_returns_batch() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, content=FIXTURE.read_bytes(), headers={"Last-Modified": LAST_MODIFIED}
        )

    result = make_source(httpx.MockTransport(handler)).fetch_feed(Feed.DAY)

    assert isinstance(result, FeedBatch)
    assert len(result.records) == 5
    assert result.last_modified == LAST_MODIFIED
    assert str(requests[0].url) == FEED_URLS[Feed.DAY]
    assert "If-Modified-Since" not in requests[0].headers


def test_sends_if_modified_since_and_handles_304() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(304)

    result = make_source(httpx.MockTransport(handler)).fetch_feed(
        Feed.WEEK, if_modified_since=LAST_MODIFIED
    )

    assert result == FeedNotModified(last_modified=LAST_MODIFIED)
    assert requests[0].headers["If-Modified-Since"] == LAST_MODIFIED
    assert str(requests[0].url) == FEED_URLS[Feed.WEEK]


def test_feed_urls_are_fixed_usgs_https() -> None:
    assert set(FEED_URLS) == set(Feed)
    assert all(url.startswith("https://earthquake.usgs.gov/") for url in FEED_URLS.values())
