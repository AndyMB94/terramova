from apps.earthquakes.ports import Feed
from core.http import HttpClient, HttpResponse

USER_AGENT = "TerraMova/0.1 (+https://github.com/AndyMB94/terramova)"

# URLs fijas: ningún parámetro externo decide a qué host se conecta el backend.
FEED_URLS = {
    Feed.DAY: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    Feed.WEEK: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
    Feed.MONTH: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
}


class UsgsFeedClient:
    def __init__(self, http: HttpClient) -> None:
        self._http = http

    def fetch(self, feed: Feed, *, if_modified_since: str = "") -> HttpResponse:
        headers = {"If-Modified-Since": if_modified_since} if if_modified_since else {}
        return self._http.get(FEED_URLS[feed], headers=headers)
