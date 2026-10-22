import { http, HttpResponse } from "msw";

import { BLAST, EVENTS, meta, SECOND_PAGE, summary, timeline } from "./fixtures";

/** Peticiones recibidas, para comprobar los parámetros que envía la interfaz. */
export const requests: URL[] = [];
export const analyticsRequests: URL[] = [];

const WINDOW = { start: "2026-10-15T04:33:36Z", end: "2026-10-22T04:33:36Z" };

export const handlers = [
  http.get("*/api/v1/meta/", () => HttpResponse.json(meta())),

  http.get("*/api/v1/earthquakes/", ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    if (url.searchParams.get("cursor") === "page-2") {
      return HttpResponse.json({ results: SECOND_PAGE, next_cursor: null, window: WINDOW });
    }
    const results = url.searchParams.get("event_type") === "all" ? [...EVENTS, BLAST] : EVENTS;
    return HttpResponse.json({ results, next_cursor: "page-2", window: WINDOW });
  }),

  http.get("*/api/v1/earthquakes/geojson/", () =>
    HttpResponse.json({
      type: "FeatureCollection",
      features: EVENTS.map((event) => ({
        type: "Feature",
        id: event.id,
        geometry: { type: "Point", coordinates: [event.longitude, event.latitude] },
        properties: {
          magnitude: event.magnitude,
          depth_km: event.depth_km,
          occurred_at: event.occurred_at,
          place: event.place ?? "",
        },
      })),
      metadata: {
        window: WINDOW,
        total_matching: EVENTS.length,
        returned: EVENTS.length,
        limit: 5000,
        truncated: false,
        selection: "magnitude_desc",
      },
    }),
  ),

  http.get("*/api/v1/analytics/summary/", ({ request }) => {
    analyticsRequests.push(new URL(request.url));
    return HttpResponse.json(summary());
  }),

  http.get("*/api/v1/analytics/timeline/", () => HttpResponse.json(timeline())),

  http.get("*/api/v1/earthquakes/:id/", ({ params }) => {
    const found = [...EVENTS, ...SECOND_PAGE, BLAST].find((item) => item.id === params.id);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json(
          { code: "event_not_found", message: "El evento no existe." },
          { status: 404 },
        );
  }),
];
