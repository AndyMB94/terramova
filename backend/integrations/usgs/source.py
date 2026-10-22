from apps.earthquakes.ports import Feed, FeedBatch, FeedNotModified, FeedResult
from integrations.usgs.client import UsgsFeedClient
from integrations.usgs.normalize import parse_feed


class UsgsEarthquakeSource:
    """Implementa EarthquakeSource con los feeds GeoJSON de USGS."""

    source_name = "usgs"

    def __init__(self, client: UsgsFeedClient) -> None:
        self._client = client

    def fetch_feed(self, feed: Feed, *, if_modified_since: str = "") -> FeedResult:
        response = self._client.fetch(feed, if_modified_since=if_modified_since)
        last_modified = response.headers.get("last-modified", "")[:64]
        if response.status_code == 304:
            return FeedNotModified(last_modified=last_modified or if_modified_since)

        parsed = parse_feed(response.content)
        return FeedBatch(
            generated_at=parsed.generated_at,
            last_modified=last_modified,
            records=parsed.records,
            rejected=parsed.rejected,
        )
